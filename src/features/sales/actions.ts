"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { calculateSaleAmounts } from "@/features/sales/money";
import { saleSchema, type SaleFormState } from "@/features/sales/schemas";
import {
  canDeleteOperationalRecord,
  canManageOrganization,
  isStaff,
} from "@/lib/auth/authorization";
import { getAuthContext } from "@/lib/auth/session";
import { getDatabase } from "@/lib/database";

const saleIdSchema = z.uuid();

function unauthorizedState(): SaleFormState {
  return {
    status: "error",
    message: "You are not authorized to change this sale.",
  };
}

function databaseErrorState(): SaleFormState {
  return {
    status: "error",
    message: "The sale could not be saved. Please try again.",
  };
}

function parseSale(formData: FormData) {
  return saleSchema.safeParse({
    staffProfileId: formData.get("staffProfileId"),
    leadId: formData.get("leadId"),
    clientName: formData.get("clientName"),
    paymentType: formData.get("paymentType"),
    referenceNumber: formData.get("referenceNumber"),
    netPrice: formData.get("netPrice"),
    receivedAmount: formData.get("receivedAmount"),
  });
}

function profileName(profile: {
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  email: string | null;
}) {
  return (
    [profile.firstName, profile.lastName].filter(Boolean).join(" ") ||
    profile.username ||
    profile.email ||
    "Team member"
  );
}

function revalidateSaleViews(leadId?: string | null) {
  revalidatePath("/sales");
  revalidatePath("/dashboard");
  if (leadId) revalidatePath(`/leads/${leadId}`);
}

export async function createSaleAction(
  _state: SaleFormState,
  formData: FormData,
): Promise<SaleFormState> {
  const parsed = parseSale(formData);
  if (!parsed.success) {
    return { status: "error", errors: parsed.error.flatten().fieldErrors };
  }

  const auth = await getAuthContext();
  if (!auth || !isStaff(auth.membership.role)) return unauthorizedState();

  const staffProfileId = canManageOrganization(auth.membership.role)
    ? (parsed.data.staffProfileId ?? auth.profile.id)
    : auth.profile.id;

  try {
    const database = getDatabase();
    const sale = await database.$transaction(async (transaction) => {
      const [staffMembership, lead] = await Promise.all([
        transaction.organizationMembership.findFirst({
          where: {
            organizationId: auth.organization.id,
            profileId: staffProfileId,
            isActive: true,
            role: { in: ["EMPLOYEE", "MANAGER", "SUPER_ADMIN"] },
            profile: { isActive: true },
          },
          select: {
            profile: {
              select: {
                firstName: true,
                lastName: true,
                username: true,
                email: true,
              },
            },
          },
        }),
        parsed.data.leadId
          ? transaction.lead.findFirst({
              where: {
                id: parsed.data.leadId,
                organizationId: auth.organization.id,
                isArchived: false,
                ...(canManageOrganization(auth.membership.role)
                  ? {}
                  : { assignments: { some: { profileId: auth.profile.id } } }),
              },
              select: { id: true },
            })
          : Promise.resolve(null),
      ]);

      if (!staffMembership) throw new Error("STAFF_NOT_FOUND");
      if (parsed.data.leadId && !lead) throw new Error("LEAD_NOT_FOUND");

      const { netPrice, receivedAmount, profit } = calculateSaleAmounts(
        parsed.data.netPrice,
        parsed.data.receivedAmount,
      );

      const created = await transaction.sale.create({
        data: {
          organizationId: auth.organization.id,
          leadId: lead?.id,
          staffProfileId,
          uid: `SAL-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
          staffName: profileName(staffMembership.profile),
          clientName: parsed.data.clientName,
          paymentType: parsed.data.paymentType,
          referenceNumber: parsed.data.referenceNumber,
          netPrice,
          receivedAmount,
          profit,
        },
      });

      await transaction.auditLog.create({
        data: {
          organizationId: auth.organization.id,
          actorProfileId: auth.profile.id,
          action: "sale.created",
          entityType: "Sale",
          entityId: created.id,
          metadata: {
            staffProfileId,
            leadId: lead?.id ?? null,
            netPrice: netPrice.toFixed(2),
            receivedAmount: receivedAmount.toFixed(2),
            profit: profit.toFixed(2),
          },
        },
      });

      return created;
    });

    revalidateSaleViews(sale.leadId);
    return { status: "success", message: "Sale created." };
  } catch (error) {
    if (error instanceof Error && error.message === "STAFF_NOT_FOUND") {
      return { status: "error", message: "The selected staff member is unavailable." };
    }
    if (error instanceof Error && error.message === "LEAD_NOT_FOUND") {
      return { status: "error", message: "The selected lead is unavailable." };
    }
    return databaseErrorState();
  }
}

export async function updateSaleAction(
  saleId: string,
  _state: SaleFormState,
  formData: FormData,
): Promise<SaleFormState> {
  const parsedId = saleIdSchema.safeParse(saleId);
  const parsed = parseSale(formData);
  if (!parsedId.success) return unauthorizedState();
  if (!parsed.success) {
    return { status: "error", errors: parsed.error.flatten().fieldErrors };
  }

  const auth = await getAuthContext();
  if (!auth || !isStaff(auth.membership.role)) return unauthorizedState();

  try {
    const database = getDatabase();
    const updated = await database.$transaction(async (transaction) => {
      const existing = await transaction.sale.findFirst({
        where: {
          id: parsedId.data,
          organizationId: auth.organization.id,
          ...(canManageOrganization(auth.membership.role)
            ? {}
            : { staffProfileId: auth.profile.id }),
        },
      });
      if (!existing) throw new Error("SALE_NOT_FOUND");

      const staffProfileId = canManageOrganization(auth.membership.role)
        ? (parsed.data.staffProfileId ?? existing.staffProfileId ?? auth.profile.id)
        : auth.profile.id;
      const [staffMembership, lead] = await Promise.all([
        transaction.organizationMembership.findFirst({
          where: {
            organizationId: auth.organization.id,
            profileId: staffProfileId,
            isActive: true,
            role: { in: ["EMPLOYEE", "MANAGER", "SUPER_ADMIN"] },
            profile: { isActive: true },
          },
          select: {
            profile: {
              select: {
                firstName: true,
                lastName: true,
                username: true,
                email: true,
              },
            },
          },
        }),
        parsed.data.leadId
          ? transaction.lead.findFirst({
              where: {
                id: parsed.data.leadId,
                organizationId: auth.organization.id,
                isArchived: false,
                ...(canManageOrganization(auth.membership.role)
                  ? {}
                  : { assignments: { some: { profileId: auth.profile.id } } }),
              },
              select: { id: true },
            })
          : Promise.resolve(null),
      ]);

      if (!staffMembership) throw new Error("STAFF_NOT_FOUND");
      if (parsed.data.leadId && !lead) throw new Error("LEAD_NOT_FOUND");

      const { netPrice, receivedAmount, profit } = calculateSaleAmounts(
        parsed.data.netPrice,
        parsed.data.receivedAmount,
      );
      const sale = await transaction.sale.update({
        where: { id: existing.id },
        data: {
          leadId: lead?.id ?? null,
          staffProfileId,
          staffName: profileName(staffMembership.profile),
          clientName: parsed.data.clientName,
          paymentType: parsed.data.paymentType,
          referenceNumber: parsed.data.referenceNumber,
          netPrice,
          receivedAmount,
          profit,
        },
      });

      await transaction.auditLog.create({
        data: {
          organizationId: auth.organization.id,
          actorProfileId: auth.profile.id,
          action: "sale.updated",
          entityType: "Sale",
          entityId: sale.id,
          metadata: {
            previous: {
              leadId: existing.leadId,
              staffProfileId: existing.staffProfileId,
              netPrice: existing.netPrice?.toFixed(2) ?? null,
              receivedAmount: existing.receivedAmount?.toFixed(2) ?? null,
              profit: existing.profit?.toFixed(2) ?? null,
            },
            current: {
              leadId: lead?.id ?? null,
              staffProfileId,
              netPrice: netPrice.toFixed(2),
              receivedAmount: receivedAmount.toFixed(2),
              profit: profit.toFixed(2),
            },
          },
        },
      });

      return { sale, previousLeadId: existing.leadId };
    });

    revalidateSaleViews(updated.previousLeadId);
    if (updated.sale.leadId !== updated.previousLeadId) {
      revalidateSaleViews(updated.sale.leadId);
    }
    return { status: "success", message: "Sale updated." };
  } catch (error) {
    if (error instanceof Error && error.message === "SALE_NOT_FOUND") {
      return unauthorizedState();
    }
    if (error instanceof Error && error.message === "STAFF_NOT_FOUND") {
      return { status: "error", message: "The selected staff member is unavailable." };
    }
    if (error instanceof Error && error.message === "LEAD_NOT_FOUND") {
      return { status: "error", message: "The selected lead is unavailable." };
    }
    return databaseErrorState();
  }
}

export async function deleteSaleAction(
  saleId: string,
  _state: SaleFormState,
  _formData: FormData,
): Promise<SaleFormState> {
  void _state;
  void _formData;
  const parsedId = saleIdSchema.safeParse(saleId);
  if (!parsedId.success) return unauthorizedState();

  const auth = await getAuthContext();
  if (!auth || !canDeleteOperationalRecord(auth.membership.role)) {
    return unauthorizedState();
  }

  try {
    const database = getDatabase();
    const deleted = await database.$transaction(async (transaction) => {
      const sale = await transaction.sale.findFirst({
        where: { id: parsedId.data, organizationId: auth.organization.id },
      });
      if (!sale) throw new Error("SALE_NOT_FOUND");

      await transaction.sale.delete({ where: { id: sale.id } });
      await transaction.auditLog.create({
        data: {
          organizationId: auth.organization.id,
          actorProfileId: auth.profile.id,
          action: "sale.deleted",
          entityType: "Sale",
          entityId: sale.id,
          metadata: {
            uid: sale.uid,
            clientName: sale.clientName,
            netPrice: sale.netPrice?.toFixed(2) ?? null,
            receivedAmount: sale.receivedAmount?.toFixed(2) ?? null,
            profit: sale.profit?.toFixed(2) ?? null,
          },
        },
      });
      return sale;
    });

    revalidateSaleViews(deleted.leadId);
    return { status: "success", message: "Sale deleted." };
  } catch (error) {
    if (error instanceof Error && error.message === "SALE_NOT_FOUND") {
      return unauthorizedState();
    }
    return { status: "error", message: "The sale could not be deleted." };
  }
}

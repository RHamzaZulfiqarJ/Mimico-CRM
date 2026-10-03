"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { cashbookUidFromId } from "@/features/cashbook/identifiers";
import { cashAmount } from "@/features/cashbook/money";
import {
  cashbookEntrySchema,
  type CashbookFormState,
} from "@/features/cashbook/schemas";
import {
  canDeleteOperationalRecord,
  canManageOrganization,
  isStaff,
} from "@/lib/auth/authorization";
import { getAuthContext } from "@/lib/auth/session";
import { getDatabase } from "@/lib/database";

const cashbookIdSchema = z.uuid();

function unauthorizedState(): CashbookFormState {
  return {
    status: "error",
    message: "You are not authorized to change this cashbook entry.",
  };
}

function parseEntry(formData: FormData) {
  return cashbookEntrySchema.safeParse({
    staffProfileId: formData.get("staffProfileId"),
    projectId: formData.get("projectId"),
    clientName: formData.get("clientName"),
    branch: formData.get("branch"),
    paymentType: formData.get("paymentType"),
    referenceNumber: formData.get("referenceNumber"),
    amount: formData.get("amount"),
    direction: formData.get("direction"),
    remarks: formData.get("remarks"),
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

function revalidateCashbook() {
  revalidatePath("/cashbook");
  revalidatePath("/dashboard");
}

export async function createCashbookEntryAction(
  _state: CashbookFormState,
  formData: FormData,
): Promise<CashbookFormState> {
  const parsed = parseEntry(formData);
  if (!parsed.success) {
    return { status: "error", errors: parsed.error.flatten().fieldErrors };
  }

  const auth = await getAuthContext();
  if (!auth || !isStaff(auth.membership.role)) return unauthorizedState();

  const staffProfileId = canManageOrganization(auth.membership.role)
    ? (parsed.data.staffProfileId ?? auth.profile.id)
    : auth.profile.id;
  const database = getDatabase();

  try {
    // Validate independent relations in parallel before opening the write transaction.
    const [staffMembership, project] = await Promise.all([
      database.organizationMembership.findFirst({
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
      database.project.findFirst({
        where: {
          id: parsed.data.projectId,
          organizationId: auth.organization.id,
          status: "ACTIVE",
          isArchived: false,
        },
        select: { id: true },
      }),
    ]);

    if (!staffMembership) {
      return { status: "error", message: "The selected staff member is unavailable." };
    }
    if (!project) {
      return { status: "error", message: "The selected project is unavailable." };
    }

    const id = crypto.randomUUID();
    const uid = cashbookUidFromId(id);
    const amount = cashAmount(parsed.data.amount);
    const [entry] = await database.$transaction([
      database.cashbookEntry.create({
        data: {
          id,
          organizationId: auth.organization.id,
          projectId: project.id,
          staffProfileId,
          uid,
          direction: parsed.data.direction,
          branch: parsed.data.branch,
          staffName: profileName(staffMembership.profile),
          clientName: parsed.data.clientName,
          remarks: parsed.data.remarks,
          paymentType: parsed.data.paymentType,
          referenceNumber: parsed.data.referenceNumber,
          amount,
        },
      }),
      database.auditLog.create({
        data: {
          organizationId: auth.organization.id,
          actorProfileId: auth.profile.id,
          action: "cashbook_entry.created",
          entityType: "CashbookEntry",
          entityId: id,
          metadata: {
            uid,
            direction: parsed.data.direction,
            amount: amount.toFixed(2),
            projectId: project.id,
            staffProfileId,
          },
        },
      }),
    ]);

    revalidateCashbook();
    return {
      status: "success",
      message: `${entry.direction === "IN" ? "Cash in" : "Cash out"} entry created.`,
    };
  } catch {
    return {
      status: "error",
      message: "The cashbook entry could not be saved. Please try again.",
    };
  }
}

export async function deleteCashbookEntryAction(
  entryId: string,
  _state: CashbookFormState,
  _formData: FormData,
): Promise<CashbookFormState> {
  void _state;
  void _formData;
  const parsedId = cashbookIdSchema.safeParse(entryId);
  if (!parsedId.success) return unauthorizedState();

  const auth = await getAuthContext();
  if (!auth || !canDeleteOperationalRecord(auth.membership.role)) {
    return unauthorizedState();
  }

  const database = getDatabase();
  try {
    const entry = await database.cashbookEntry.findFirst({
      where: { id: parsedId.data, organizationId: auth.organization.id },
      select: {
        id: true,
        uid: true,
        direction: true,
        amount: true,
        clientName: true,
      },
    });
    if (!entry) return unauthorizedState();

    await database.$transaction([
      database.cashbookEntry.delete({ where: { id: entry.id } }),
      database.auditLog.create({
        data: {
          organizationId: auth.organization.id,
          actorProfileId: auth.profile.id,
          action: "cashbook_entry.deleted",
          entityType: "CashbookEntry",
          entityId: entry.id,
          metadata: {
            uid: entry.uid,
            direction: entry.direction,
            amount: entry.amount.toFixed(2),
            clientName: entry.clientName,
          },
        },
      }),
    ]);

    revalidateCashbook();
    return { status: "success", message: "Cashbook entry deleted." };
  } catch {
    return { status: "error", message: "The cashbook entry could not be deleted." };
  }
}

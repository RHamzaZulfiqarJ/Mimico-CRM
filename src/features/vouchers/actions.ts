"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { voucherUidFromId } from "@/features/vouchers/identifiers";
import { calculateVoucherAmounts } from "@/features/vouchers/money";
import { voucherSchema, type VoucherFormState } from "@/features/vouchers/schemas";
import {
  canDeleteOperationalRecord,
  canManageOrganization,
  isStaff,
} from "@/lib/auth/authorization";
import { getAuthContext } from "@/lib/auth/session";
import { getDatabase } from "@/lib/database";

const voucherIdSchema = z.uuid();

function unauthorizedState(): VoucherFormState {
  return { status: "error", message: "You are not authorized to change this voucher." };
}

function parseVoucher(formData: FormData) {
  return voucherSchema.safeParse({
    allocatedToProfileId: formData.get("allocatedToProfileId"),
    projectId: formData.get("projectId"),
    issuingDate: formData.get("issuingDate"),
    dueDate: formData.get("dueDate"),
    branch: formData.get("branch"),
    clientName: formData.get("clientName"),
    cnic: formData.get("cnic"),
    phone: formData.get("phone"),
    email: formData.get("email"),
    paymentType: formData.get("paymentType"),
    cheque: formData.get("cheque"),
    propertyType: formData.get("propertyType"),
    area: formData.get("area"),
    total: formData.get("total"),
    paid: formData.get("paid"),
    note: formData.get("note"),
  });
}

function refreshVoucherViews(voucherId?: string) {
  revalidatePath("/vouchers");
  revalidatePath("/approvals");
  revalidatePath("/notifications");
  revalidatePath("/dashboard");
  if (voucherId) {
    revalidatePath(`/vouchers/${voucherId}`);
    revalidatePath(`/vouchers/${voucherId}/print`);
  }
}

export async function createVoucherAction(
  _state: VoucherFormState,
  formData: FormData,
): Promise<VoucherFormState> {
  const parsed = parseVoucher(formData);
  if (!parsed.success) {
    return { status: "error", errors: parsed.error.flatten().fieldErrors };
  }
  const auth = await getAuthContext();
  if (!auth || !isStaff(auth.membership.role)) return unauthorizedState();

  const allocatedToProfileId = canManageOrganization(auth.membership.role)
    ? (parsed.data.allocatedToProfileId ?? auth.profile.id)
    : auth.profile.id;
  const database = getDatabase();

  try {
    const [staffMembership, project, managers] = await Promise.all([
      database.organizationMembership.findFirst({
        where: {
          organizationId: auth.organization.id,
          profileId: allocatedToProfileId,
          isActive: true,
          role: { in: ["EMPLOYEE", "MANAGER", "SUPER_ADMIN"] },
          profile: { isActive: true },
        },
        select: { profileId: true },
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
      database.organizationMembership.findMany({
        where: {
          organizationId: auth.organization.id,
          isActive: true,
          role: { in: ["MANAGER", "SUPER_ADMIN"] },
          profile: { isActive: true },
        },
        select: { profileId: true },
      }),
    ]);
    if (!staffMembership) {
      return { status: "error", message: "The selected staff member is unavailable." };
    }
    if (!project) {
      return { status: "error", message: "The selected project is unavailable." };
    }

    const id = crypto.randomUUID();
    const approvalId = crypto.randomUUID();
    const uid = voucherUidFromId(id);
    const approvalUid = `APR-${approvalId.replaceAll("-", "").slice(0, 12).toUpperCase()}`;
    const { total, paid, remaining } = calculateVoucherAmounts(
      parsed.data.total,
      parsed.data.paid,
    );
    if (remaining.isNegative()) {
      return { status: "error", errors: { paid: ["Paid amount cannot exceed the total."] } };
    }
    const notifications = managers
      .filter(({ profileId }) => profileId !== auth.profile.id)
      .map(({ profileId }) => ({
        organizationId: auth.organization.id,
        recipientProfileId: profileId,
        approvalId,
        type: "voucher_approval_requested",
        title: "Voucher approval needed",
        description: `${parsed.data.clientName} · ${uid}`,
        payload: { approvalId, voucherId: id },
      }));

    await database.$transaction([
      database.voucher.create({
        data: {
          id,
          organizationId: auth.organization.id,
          allocatedToProfileId,
          projectId: project.id,
          uid,
          issuingDate: new Date(`${parsed.data.issuingDate}T00:00:00.000Z`),
          dueDate: new Date(`${parsed.data.dueDate}T00:00:00.000Z`),
          branch: parsed.data.branch,
          clientName: parsed.data.clientName,
          cnic: parsed.data.cnic,
          phone: parsed.data.phone,
          email: parsed.data.email,
          type: parsed.data.paymentType,
          cheque: parsed.data.cheque,
          propertyType: parsed.data.propertyType,
          area: parsed.data.area,
          total,
          paid,
          remaining,
          note: parsed.data.note,
          status: "UNDER_PROCESS",
        },
      }),
      database.approval.create({
        data: {
          id: approvalId,
          organizationId: auth.organization.id,
          requestedByProfileId: auth.profile.id,
          uid: approvalUid,
          type: "VOUCHER",
          title: `Voucher ${uid}`,
          description: `Approve ${uid} for ${parsed.data.clientName}.`,
          payload: {
            voucherId: id,
            uid,
            projectId: project.id,
            allocatedToProfileId,
            total: total.toFixed(2),
            paid: paid.toFixed(2),
            remaining: remaining.toFixed(2),
          },
        },
      }),
      ...(notifications.length
        ? [database.notification.createMany({ data: notifications })]
        : []),
      database.auditLog.create({
        data: {
          organizationId: auth.organization.id,
          actorProfileId: auth.profile.id,
          action: "voucher.created",
          entityType: "Voucher",
          entityId: id,
          metadata: {
            uid,
            approvalId,
            allocatedToProfileId,
            projectId: project.id,
            total: total.toFixed(2),
            paid: paid.toFixed(2),
            remaining: remaining.toFixed(2),
          },
        },
      }),
    ]);

    refreshVoucherViews(id);
    return { status: "success", message: "Voucher submitted for approval." };
  } catch {
    return { status: "error", message: "The voucher could not be saved. Please try again." };
  }
}

export async function deleteVoucherAction(
  voucherId: string,
  _state: VoucherFormState,
  _formData: FormData,
): Promise<VoucherFormState> {
  void _state;
  void _formData;
  const parsedId = voucherIdSchema.safeParse(voucherId);
  if (!parsedId.success) return unauthorizedState();
  const auth = await getAuthContext();
  if (!auth || !canDeleteOperationalRecord(auth.membership.role)) return unauthorizedState();

  const database = getDatabase();
  try {
    const voucher = await database.voucher.findFirst({
      where: { id: parsedId.data, organizationId: auth.organization.id },
      select: { id: true, uid: true, clientName: true, total: true, paid: true, status: true },
    });
    if (!voucher) return unauthorizedState();
    await database.$transaction([
      database.voucher.delete({ where: { id: voucher.id } }),
      database.auditLog.create({
        data: {
          organizationId: auth.organization.id,
          actorProfileId: auth.profile.id,
          action: "voucher.deleted",
          entityType: "Voucher",
          entityId: voucher.id,
          metadata: {
            uid: voucher.uid,
            clientName: voucher.clientName,
            total: voucher.total?.toFixed(2) ?? null,
            paid: voucher.paid?.toFixed(2) ?? null,
            status: voucher.status,
          },
        },
      }),
    ]);
    refreshVoucherViews(voucher.id);
    return { status: "success", message: "Voucher deleted." };
  } catch {
    return { status: "error", message: "The voucher could not be deleted." };
  }
}

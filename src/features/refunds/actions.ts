"use server";

import { revalidatePath } from "next/cache";

import { Prisma } from "@/generated/prisma/client";
import { refundUidFromId } from "@/features/refunds/identifiers";
import { refundSchema, type RefundFormState } from "@/features/refunds/schemas";
import { canManageOrganization, isStaff } from "@/lib/auth/authorization";
import { getAuthContext } from "@/lib/auth/session";
import { getDatabase } from "@/lib/database";

function refreshRefundViews(leadId?: string) {
  revalidatePath("/refunds");
  revalidatePath("/approvals");
  revalidatePath("/notifications");
  revalidatePath("/dashboard");
  if (leadId) revalidatePath(`/leads/${leadId}`);
}

export async function createRefundAction(
  _state: RefundFormState,
  formData: FormData,
): Promise<RefundFormState> {
  const parsed = refundSchema.safeParse({
    leadId: formData.get("leadId"),
    branch: formData.get("branch"),
    amount: formData.get("amount"),
    clientName: formData.get("clientName"),
    cnic: formData.get("cnic"),
    phone: formData.get("phone"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) {
    return { status: "error", errors: parsed.error.flatten().fieldErrors };
  }

  const auth = await getAuthContext();
  if (!auth || !isStaff(auth.membership.role)) {
    return { status: "error", message: "You are not authorized to request a refund." };
  }

  const database = getDatabase();
  const employeeAccess = canManageOrganization(auth.membership.role)
    ? {}
    : { assignments: { some: { profileId: auth.profile.id } } };

  try {
    const [lead, managers] = await Promise.all([
      database.lead.findFirst({
        where: {
          id: parsed.data.leadId,
          organizationId: auth.organization.id,
          isArchived: false,
          ...employeeAccess,
        },
        select: { id: true, uid: true, refundRequested: true },
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
    if (!lead) {
      return { status: "error", message: "This lead is unavailable or not assigned to you." };
    }
    if (lead.refundRequested) {
      return { status: "error", message: "A refund request for this lead is already awaiting a decision." };
    }

    const refundId = crypto.randomUUID();
    const approvalId = crypto.randomUUID();
    const uid = refundUidFromId(refundId);
    const amount = new Prisma.Decimal(parsed.data.amount);
    const approvalUid = `APR-${approvalId.replaceAll("-", "").slice(0, 12).toUpperCase()}`;
    const notifications = managers
      .filter(({ profileId }) => profileId !== auth.profile.id)
      .map(({ profileId }) => ({
        organizationId: auth.organization.id,
        recipientProfileId: profileId,
        approvalId,
        type: "refund_approval_requested",
        title: "Refund approval needed",
        description: `${parsed.data.clientName} · ${uid}`,
        payload: { approvalId, refundId, leadId: lead.id },
      }));

    await database.$transaction(async (transaction) => {
      const reserved = await transaction.lead.updateMany({
        where: {
          id: lead.id,
          organizationId: auth.organization.id,
          refundRequested: false,
        },
        data: { refundRequested: true },
      });
      if (reserved.count !== 1) throw new Error("REFUND_ALREADY_PENDING");

      await transaction.refund.create({
        data: {
          id: refundId,
          organizationId: auth.organization.id,
          leadId: lead.id,
          requestedByProfileId: auth.profile.id,
          uid,
          branch: parsed.data.branch,
          amount,
          clientName: parsed.data.clientName,
          cnic: parsed.data.cnic,
          phone: parsed.data.phone,
          reason: parsed.data.reason,
        },
      });
      await transaction.approval.create({
        data: {
          id: approvalId,
          organizationId: auth.organization.id,
          leadId: lead.id,
          requestedByProfileId: auth.profile.id,
          uid: approvalUid,
          type: "REFUND",
          title: `Refund ${uid}`,
          description: `Approve ${uid} for ${parsed.data.clientName}.`,
          payload: {
            refundId,
            uid,
            leadId: lead.id,
            leadUid: lead.uid,
            branch: parsed.data.branch,
            amount: amount.toFixed(2),
            clientName: parsed.data.clientName,
            phone: parsed.data.phone,
            reason: parsed.data.reason,
          },
        },
      });
      if (notifications.length) {
        await transaction.notification.createMany({ data: notifications });
      }
      await transaction.auditLog.create({
        data: {
          organizationId: auth.organization.id,
          actorProfileId: auth.profile.id,
          action: "refund.requested",
          entityType: "Refund",
          entityId: refundId,
          metadata: {
            uid,
            approvalId,
            leadId: lead.id,
            amount: amount.toFixed(2),
          },
        },
      });
    });

    refreshRefundViews(lead.id);
    return { status: "success", message: "Refund submitted for manager approval." };
  } catch (error) {
    if (error instanceof Error && error.message === "REFUND_ALREADY_PENDING") {
      return { status: "error", message: "A refund request for this lead is already awaiting a decision." };
    }
    return { status: "error", message: "The refund request could not be saved. Please try again." };
  }
}

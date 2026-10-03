"use server";

import { revalidatePath } from "next/cache";

import { cashbookUidFromId } from "@/features/cashbook/identifiers";
import { approvalDecisionSchema, createApprovalSchema, type ApprovalFormState } from "@/features/approvals/schemas";
import { canDecideApproval, isStaff } from "@/lib/auth/authorization";
import { getAuthContext } from "@/lib/auth/session";
import { getDatabase } from "@/lib/database";

function refresh(
  approvalId?: string,
  related?: { voucherId?: string | null; refundId?: string | null; leadId?: string | null },
) {
  revalidatePath("/approvals");
  if (approvalId) revalidatePath(`/approvals/${approvalId}`);
  if (related?.voucherId) {
    revalidatePath("/vouchers");
    revalidatePath(`/vouchers/${related.voucherId}`);
    revalidatePath(`/vouchers/${related.voucherId}/print`);
  }
  if (related?.refundId) revalidatePath("/refunds");
  if (related?.leadId) revalidatePath(`/leads/${related.leadId}`);
  if (related?.refundId) revalidatePath("/cashbook");
  revalidatePath("/notifications");
  revalidatePath("/dashboard");
}

export async function createApprovalAction(_state: ApprovalFormState, formData: FormData): Promise<ApprovalFormState> {
  const parsed = createApprovalSchema.safeParse({ title: formData.get("title"), description: formData.get("description") });
  if (!parsed.success) return { status: "error", errors: parsed.error.flatten().fieldErrors };
  const auth = await getAuthContext();
  if (!auth || !isStaff(auth.membership.role)) return { status: "error", message: "You are not authorized to submit requests." };
  try {
    const database = getDatabase();
    await database.$transaction(async (transaction) => {
      const approval = await transaction.approval.create({ data: {
        organizationId: auth.organization.id, requestedByProfileId: auth.profile.id,
        uid: `APR-${crypto.randomUUID().slice(0, 8).toUpperCase()}`, type: "REQUEST",
        title: parsed.data.title, description: parsed.data.description,
      } });
      const managers = await transaction.organizationMembership.findMany({ where: {
        organizationId: auth.organization.id, isActive: true, role: { in: ["MANAGER", "SUPER_ADMIN"] }, profile: { isActive: true },
      }, select: { profileId: true } });
      const recipients = managers.filter(({ profileId }) => profileId !== auth.profile.id);
      if (recipients.length) await transaction.notification.createMany({ data: recipients.map(({ profileId }) => ({
        organizationId: auth.organization.id, recipientProfileId: profileId, approvalId: approval.id,
        type: "approval_requested", title: "New approval request", description: parsed.data.title, payload: { approvalId: approval.id },
      })) });
      await transaction.auditLog.create({ data: {
        organizationId: auth.organization.id, actorProfileId: auth.profile.id,
        action: "approval.requested", entityType: "Approval", entityId: approval.id,
        metadata: { type: "REQUEST" },
      } });
    });
  } catch { return { status: "error", message: "The request could not be submitted. Please try again." }; }
  refresh();
  return { status: "success", message: "Approval request submitted." };
}

export async function decideApprovalAction(approvalId: string, _state: ApprovalFormState, formData: FormData): Promise<ApprovalFormState> {
  const parsed = approvalDecisionSchema.safeParse({ status: formData.get("status"), note: formData.get("note") });
  if (!parsed.success) return { status: "error", errors: parsed.error.flatten().fieldErrors };
  const auth = await getAuthContext();
  if (!auth || !canDecideApproval(auth.membership.role)) return { status: "error", message: "Only managers can decide requests." };
  let relatedRecord: { voucherId: string | null; refundId: string | null; leadId: string | null } = {
    voucherId: null,
    refundId: null,
    leadId: null,
  };
  try {
    const database = getDatabase();
    relatedRecord = await database.$transaction(async (transaction) => {
      const approval = await transaction.approval.findFirst({ where: { id: approvalId, organizationId: auth.organization.id, status: "UNDER_PROCESS" }, select: { id: true, title: true, type: true, requestedByProfileId: true, payload: true } });
      if (!approval) throw new Error("APPROVAL_UNAVAILABLE");
      const previousPayload = approval.payload && typeof approval.payload === "object" && !Array.isArray(approval.payload) ? approval.payload : {};
      const relatedVoucherId = approval.type === "VOUCHER" && typeof previousPayload.voucherId === "string" ? previousPayload.voucherId : null;
      const relatedRefundId = approval.type === "REFUND" && typeof previousPayload.refundId === "string" ? previousPayload.refundId : null;
      if (approval.type === "VOUCHER" && !relatedVoucherId) throw new Error("VOUCHER_UNAVAILABLE");
      if (approval.type === "REFUND" && !relatedRefundId) throw new Error("REFUND_UNAVAILABLE");
      if (relatedVoucherId) {
        const updatedVoucher = await transaction.voucher.updateMany({
          where: { id: relatedVoucherId, organizationId: auth.organization.id, status: "UNDER_PROCESS" },
          data: { status: parsed.data.status },
        });
        if (updatedVoucher.count !== 1) throw new Error("VOUCHER_UNAVAILABLE");
      }
      let relatedLeadId: string | null = null;
      let cashbookEntryId: string | null = null;
      if (relatedRefundId) {
        const refund = await transaction.refund.findFirst({
          where: {
            id: relatedRefundId,
            organizationId: auth.organization.id,
            status: "UNDER_PROCESS",
          },
          select: {
            id: true,
            uid: true,
            leadId: true,
            branch: true,
            amount: true,
            clientName: true,
            reason: true,
            lead: { select: { projectId: true } },
          },
        });
        if (!refund) throw new Error("REFUND_UNAVAILABLE");
        relatedLeadId = refund.leadId;
        const updatedRefund = await transaction.refund.updateMany({
          where: {
            id: refund.id,
            organizationId: auth.organization.id,
            status: "UNDER_PROCESS",
          },
          data: {
            status: parsed.data.status,
            decidedByProfileId: auth.profile.id,
            decidedAt: new Date(),
          },
        });
        if (updatedRefund.count !== 1) throw new Error("REFUND_UNAVAILABLE");
        if (refund.leadId) {
          await transaction.lead.updateMany({
            where: { id: refund.leadId, organizationId: auth.organization.id },
            data: { refundRequested: false },
          });
        }
        if (parsed.data.status === "ACCEPTED") {
          cashbookEntryId = crypto.randomUUID();
          await transaction.cashbookEntry.create({
            data: {
              id: cashbookEntryId,
              organizationId: auth.organization.id,
              leadId: refund.leadId,
              projectId: refund.lead?.projectId,
              staffProfileId: auth.profile.id,
              uid: cashbookUidFromId(cashbookEntryId),
              direction: "OUT",
              branch: refund.branch,
              staffName: auth.profile.displayName,
              clientName: refund.clientName,
              remarks: `Refund ${refund.uid ?? refund.id}: ${refund.reason}`,
              paymentType: "online",
              referenceNumber: refund.uid ?? refund.id,
              amount: refund.amount,
            },
          });
        }
        await transaction.auditLog.create({ data: {
          organizationId: auth.organization.id,
          actorProfileId: auth.profile.id,
          action: "refund.decided",
          entityType: "Refund",
          entityId: refund.id,
          metadata: {
            status: parsed.data.status,
            note: parsed.data.note ?? null,
            amount: refund.amount.toFixed(2),
            cashbookEntryId,
          },
        } });
      }
      await transaction.approval.update({ where: { id: approval.id }, data: {
        status: parsed.data.status, decidedByProfileId: auth.profile.id, decidedAt: new Date(), payload: { ...previousPayload, decisionNote: parsed.data.note ?? null, cashbookEntryId },
      } });
      if (approval.requestedByProfileId && approval.requestedByProfileId !== auth.profile.id) await transaction.notification.create({ data: {
        organizationId: auth.organization.id, recipientProfileId: approval.requestedByProfileId, approvalId: approval.id,
        type: "approval_decided", title: `Request ${parsed.data.status === "ACCEPTED" ? "approved" : "rejected"}`,
        description: approval.title ?? "Your approval request has been decided.", payload: { approvalId: approval.id, status: parsed.data.status, refundId: relatedRefundId, voucherId: relatedVoucherId },
      } });
      await transaction.auditLog.create({ data: {
        organizationId: auth.organization.id, actorProfileId: auth.profile.id,
        action: "approval.decided", entityType: "Approval", entityId: approval.id,
        metadata: { status: parsed.data.status, note: parsed.data.note ?? null, voucherId: relatedVoucherId, refundId: relatedRefundId, cashbookEntryId },
      } });
      return { voucherId: relatedVoucherId, refundId: relatedRefundId, leadId: relatedLeadId };
    });
  } catch (error) {
    return { status: "error", message: error instanceof Error && (error.message === "APPROVAL_UNAVAILABLE" || error.message === "VOUCHER_UNAVAILABLE" || error.message === "REFUND_UNAVAILABLE") ? "This request has already been decided or its related record is unavailable." : "The decision could not be saved. Please try again." };
  }
  refresh(approvalId, relatedRecord);
  return { status: "success", message: `Request ${parsed.data.status === "ACCEPTED" ? "approved" : "rejected"}.` };
}

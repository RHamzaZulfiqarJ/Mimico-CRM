import { CalendarClock, ClipboardCheck, UserRound } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { ApprovalDecisionForm } from "@/components/approvals/approval-forms";
import { getApprovalDetails } from "@/features/approvals/queries";
import { approvalStatusLabels } from "@/features/approvals/schemas";

export const metadata: Metadata = { title: "Approval details" };
function personLabel(person: { firstName: string | null; lastName: string | null; username: string | null; email: string | null } | null) { return person ? [person.firstName, person.lastName].filter(Boolean).join(" ") || person.username || person.email || "Team member" : "System"; }

export default async function ApprovalDetailsPage({ params }: { params: Promise<{ approvalId: string }> }) {
  const { approvalId } = await params;
  const data = await getApprovalDetails(approvalId);
  if (!data) redirect("/dashboard");
  if (!data.approval) notFound();
  const approval = data.approval;
  const payload = approval.payload && typeof approval.payload === "object" && !Array.isArray(approval.payload) ? approval.payload as Record<string, unknown> : null;
  const decisionNote = typeof payload?.decisionNote === "string" ? payload.decisionNote : null;
  const refundDetails = approval.type === "REFUND" ? {
    clientName: typeof payload?.clientName === "string" ? payload.clientName : "—",
    amount: typeof payload?.amount === "string" ? payload.amount : null,
    branch: typeof payload?.branch === "string" ? payload.branch : "—",
    phone: typeof payload?.phone === "string" ? payload.phone : "—",
    reason: typeof payload?.reason === "string" ? payload.reason : "—",
  } : null;
  return <div className="mx-auto w-full max-w-5xl"><nav className="flex items-center gap-1 text-xs text-gray-500 sm:text-sm"><Link href="/dashboard" className="hover:text-[#20aee3]">Dashboard</Link><span>›</span><Link href="/approvals" className="hover:text-[#20aee3]">Approvals</Link><span>›</span><span>{approval.uid ?? "Details"}</span></nav><div className="mt-2"><h1 className="text-[28px] font-light text-[#20aee3] sm:text-[32px]">Approval Details</h1><span className="mt-2 inline-flex rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-600">{approvalStatusLabels[approval.status]}</span></div><section className="surface-card mt-5 rounded-lg p-5 sm:p-6"><h2 className="text-xl font-normal text-[#ff5c6c]">{approval.title ?? "Approval request"}</h2><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-gray-600">{approval.description}</p>{refundDetails ? <div className="mt-5 rounded-lg border border-amber-100 bg-amber-50/60 p-4"><div className="flex items-center justify-between gap-3"><p className="text-sm font-medium text-amber-800">Refund details</p><Link href="/refunds" className="text-xs font-medium text-[#20aee3] hover:underline">View refunds</Link></div><dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4"><div><dt className="text-xs text-gray-400">Customer</dt><dd className="mt-1 text-gray-700">{refundDetails.clientName}</dd></div><div><dt className="text-xs text-gray-400">Amount</dt><dd className="mt-1 font-medium text-rose-600">{refundDetails.amount ? `PKR ${refundDetails.amount}` : "—"}</dd></div><div><dt className="text-xs text-gray-400">Branch</dt><dd className="mt-1 text-gray-700">{refundDetails.branch}</dd></div><div><dt className="text-xs text-gray-400">Phone</dt><dd className="mt-1 text-gray-700">{refundDetails.phone}</dd></div></dl><p className="mt-3 border-t border-amber-100 pt-3 text-sm leading-6 text-gray-600">{refundDetails.reason}</p></div> : null}<dl className="mt-6 grid gap-3 sm:grid-cols-3"><div className="rounded-lg bg-[#f8fbfc] p-4"><dt className="flex items-center gap-2 text-xs text-gray-400"><UserRound className="size-4" />Requested by</dt><dd className="mt-2 text-sm font-medium text-gray-700">{personLabel(approval.requestedBy)}</dd></div><div className="rounded-lg bg-[#f8fbfc] p-4"><dt className="flex items-center gap-2 text-xs text-gray-400"><CalendarClock className="size-4" />Requested</dt><dd className="mt-2 text-sm font-medium text-gray-700">{approval.createdAt.toLocaleString()}</dd></div><div className="rounded-lg bg-[#f8fbfc] p-4"><dt className="flex items-center gap-2 text-xs text-gray-400"><ClipboardCheck className="size-4" />Decided by</dt><dd className="mt-2 text-sm font-medium text-gray-700">{personLabel(approval.decidedBy)}</dd></div></dl>{decisionNote ? <div className="mt-4 rounded-lg border border-sky-100 bg-sky-50 p-4"><p className="text-xs font-medium text-sky-700">Decision note</p><p className="mt-1 text-sm text-gray-600">{decisionNote}</p></div> : null}</section>{data.canDecide && approval.status === "UNDER_PROCESS" ? <section className="surface-card mt-4 rounded-lg p-5 sm:p-6"><h2 className="text-xl font-normal text-[#ff5c6c]">Record Decision</h2><p className="mb-5 mt-1 text-xs text-gray-400">This decision is final and will notify the requester. Accepted refunds are recorded as cash out automatically.</p><ApprovalDecisionForm approvalId={approval.id} /></section> : null}</div>;
}

import { CalendarClock, FileDown, FolderKanban, UserRound } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { ApprovalDecisionForm } from "@/components/approvals/approval-forms";
import { approvalStatusLabels } from "@/features/approvals/schemas";
import { displayVoucherUid } from "@/features/vouchers/identifiers";
import { getVoucherDetails } from "@/features/vouchers/queries";
import { canDecideApproval } from "@/lib/auth/authorization";

export const metadata: Metadata = { title: "Voucher details" };
const statusClass = { UNDER_PROCESS: "border-amber-200 bg-amber-50 text-amber-700", ACCEPTED: "border-emerald-200 bg-emerald-50 text-emerald-700", REJECTED: "border-rose-200 bg-rose-50 text-rose-600" } as const;
function personLabel(person: { firstName: string | null; lastName: string | null; username: string | null; email: string | null } | null) { return person ? [person.firstName, person.lastName].filter(Boolean).join(" ") || person.username || person.email || "Team member" : "—"; }
function money(value: { toString(): string } | null) { return new Intl.NumberFormat("en-PK", { style: "currency", currency: "PKR", minimumFractionDigits: 2 }).format(Number(value?.toString() ?? 0)); }
function date(value: Date | null) { return value?.toLocaleDateString("en-GB", { timeZone: "UTC", dateStyle: "medium" }) ?? "—"; }

export default async function VoucherDetailsPage({ params }: { params: Promise<{ voucherId: string }> }) {
  const { voucherId } = await params;
  const data = await getVoucherDetails(voucherId);
  if (!data) redirect("/dashboard");
  if (!data.voucher) notFound();
  const voucher = data.voucher;
  const uid = displayVoucherUid(voucher.uid, voucher.id);
  const canDecide = canDecideApproval(data.auth.membership.role);

  return <div className="mx-auto w-full max-w-6xl">
    <nav className="flex items-center gap-1 text-xs text-gray-500 sm:text-sm"><Link href="/dashboard" className="hover:text-[#20aee3]">Dashboard</Link><span>›</span><Link href="/vouchers" className="hover:text-[#20aee3]">Vouchers</Link><span>›</span><span>{uid}</span></nav>
    <div className="mt-2 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><h1 className="text-[28px] font-light text-[#20aee3] sm:text-[32px]">Voucher Details</h1><div className="mt-2 flex flex-wrap items-center gap-2"><span className="text-sm font-medium text-gray-600">{uid}</span><span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${statusClass[voucher.status]}`}>{approvalStatusLabels[voucher.status]}</span></div></div>{voucher.status === "ACCEPTED" ? <Link href={`/vouchers/${voucher.id}/print`} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#20aee3] px-4 text-sm font-medium text-white shadow-sm transition hover:bg-[#179bd0]"><FileDown className="size-4" />Print / Save PDF</Link> : null}</div>

    <section className="surface-card mt-5 rounded-lg p-5 sm:p-6"><div className="flex items-start justify-between gap-4"><div><p className="text-xs uppercase tracking-wide text-gray-400">Customer</p><h2 className="mt-1 text-xl font-medium capitalize text-[#ff5c6c]">{voucher.clientName ?? "Unnamed customer"}</h2><p className="mt-1 text-sm text-gray-500">{voucher.phone ?? "—"}{voucher.email ? ` · ${voucher.email}` : ""}</p></div><p className="text-right text-xs text-gray-400">Issued<br /><span className="text-sm font-medium text-gray-700">{date(voucher.issuingDate)}</span></p></div>
      <dl className="mt-6 grid gap-3 sm:grid-cols-3"><div className="rounded-lg bg-[#f8fbfc] p-4"><dt className="flex items-center gap-2 text-xs text-gray-400"><UserRound className="size-4" />Allocated to</dt><dd className="mt-2 text-sm font-medium text-gray-700">{personLabel(voucher.allocatedTo)}</dd></div><div className="rounded-lg bg-[#f8fbfc] p-4"><dt className="flex items-center gap-2 text-xs text-gray-400"><FolderKanban className="size-4" />Project</dt><dd className="mt-2 text-sm font-medium text-gray-700">{voucher.project?.title ?? "—"}</dd></div><div className="rounded-lg bg-[#f8fbfc] p-4"><dt className="flex items-center gap-2 text-xs text-gray-400"><CalendarClock className="size-4" />Due date</dt><dd className="mt-2 text-sm font-medium text-gray-700">{date(voucher.dueDate)}</dd></div></dl>
      <dl className="mt-5 grid gap-x-6 gap-y-4 border-t border-gray-100 pt-5 text-sm sm:grid-cols-2 lg:grid-cols-4"><div><dt className="text-xs text-gray-400">CNIC</dt><dd className="mt-1 text-gray-700">{voucher.cnic ?? "—"}</dd></div><div><dt className="text-xs text-gray-400">Branch</dt><dd className="mt-1 text-gray-700">{voucher.branch ?? "—"}</dd></div><div><dt className="text-xs text-gray-400">Property</dt><dd className="mt-1 capitalize text-gray-700">{voucher.propertyType ?? "—"} · {voucher.area ?? "—"}</dd></div><div><dt className="text-xs text-gray-400">Payment</dt><dd className="mt-1 capitalize text-gray-700">{voucher.type ?? "—"}{voucher.cheque ? ` · ${voucher.cheque}` : ""}</dd></div></dl>
      {voucher.note ? <div className="mt-5 rounded-lg border border-amber-100 bg-amber-50 p-4"><p className="text-xs font-medium text-amber-700">Note</p><p className="mt-1 whitespace-pre-wrap text-sm text-gray-600">{voucher.note}</p></div> : null}
    </section>

    <section className="mt-4 grid gap-3 sm:grid-cols-3"><article className="surface-card rounded-lg p-4"><p className="text-xs text-gray-400">Total</p><p className="mt-2 text-xl font-light text-gray-700">{money(voucher.total)}</p></article><article className="surface-card rounded-lg p-4"><p className="text-xs text-gray-400">Paid</p><p className="mt-2 text-xl font-light text-emerald-600">{money(voucher.paid)}</p></article><article className="surface-card rounded-lg p-4"><p className="text-xs text-gray-400">Remaining</p><p className="mt-2 text-xl font-light text-[#ff5c6c]">{money(voucher.remaining)}</p></article></section>

    {canDecide && voucher.status === "UNDER_PROCESS" && data.approval?.status === "UNDER_PROCESS" ? <section className="surface-card mt-4 rounded-lg p-5 sm:p-6"><h2 className="text-xl font-normal text-[#ff5c6c]">Voucher Approval</h2><p className="mb-5 mt-1 text-xs text-gray-400">The voucher and approval status will update together.</p><ApprovalDecisionForm approvalId={data.approval.id} /></section> : null}
  </div>;
}

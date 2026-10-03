import {
  CheckCircle2,
  CircleAlert,
  CircleDollarSign,
  Clock3,
  Search,
  XCircle,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { approvalStatusLabels } from "@/features/approvals/schemas";
import { displayRefundUid } from "@/features/refunds/identifiers";
import { getRefundWorkspace } from "@/features/refunds/queries";

export const metadata: Metadata = { title: "Refunds" };

const statusClass = {
  UNDER_PROCESS: "border-amber-200 bg-amber-50 text-amber-700",
  ACCEPTED: "border-emerald-200 bg-emerald-50 text-emerald-700",
  REJECTED: "border-rose-200 bg-rose-50 text-rose-600",
} as const;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function personLabel(person: {
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  email: string | null;
} | null) {
  return person
    ? [person.firstName, person.lastName].filter(Boolean).join(" ") ||
        person.username ||
        person.email ||
        "Team member"
    : "—";
}

function money(value: { toString(): string }) {
  return new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: "PKR",
    minimumFractionDigits: 2,
  }).format(Number(value.toString()));
}

export default async function RefundsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const data = await getRefundWorkspace({
    query: first(raw.query),
    status: first(raw.status),
    page: first(raw.page),
  });
  if (!data) redirect("/dashboard");
  const pageHref = (page: number) => ({
    pathname: "/refunds",
    query: {
      query: data.filters.query,
      status: data.filters.status,
      page: page > 1 ? String(page) : undefined,
    },
  });

  return (
    <div className="mx-auto w-full max-w-[1500px] font-sans">
      <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-xs text-gray-500 sm:text-sm">
        <Link href="/dashboard" className="hover:text-[#20aee3]">Dashboard</Link>
        <span>›</span>
        <span>Refunds</span>
      </nav>
      <div className="mt-2 flex flex-col justify-between gap-4 pb-5 sm:flex-row sm:items-end lg:pb-8">
        <div>
          <h1 className="text-[28px] font-light text-[#20aee3] sm:text-[32px]">Refunds</h1>
          <p className="mt-1 text-xs text-gray-400">
            {data.canDecide
              ? "Review refund requests and their cashbook outcomes."
              : "Track refund requests submitted from your assigned leads."}
          </p>
        </div>
        <Link href="/leads" className="inline-flex h-10 items-center justify-center rounded-lg bg-[#ff5c6c] px-4 text-sm font-medium text-white shadow-md transition hover:-translate-y-0.5 hover:bg-red-500">
          Open leads
        </Link>
      </div>

      <section className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "All refunds", value: data.counts.total, icon: CircleDollarSign, tone: "bg-sky-50 text-[#20aee3]" },
          { label: "Under process", value: data.counts.pending, icon: Clock3, tone: "bg-amber-50 text-amber-600" },
          { label: "Accepted", value: data.counts.accepted, icon: CheckCircle2, tone: "bg-emerald-50 text-emerald-600" },
          { label: "Rejected", value: data.counts.rejected, icon: XCircle, tone: "bg-rose-50 text-rose-600" },
        ].map(({ label, value, icon: Icon, tone }) => (
          <article key={label} className="surface-card flex items-center gap-4 rounded-lg p-4">
            <span className={`flex size-10 items-center justify-center rounded-lg ${tone}`}><Icon className="size-5" /></span>
            <div><p className="text-xl font-medium text-gray-700">{value}</p><p className="text-xs text-gray-400">{label}</p></div>
          </article>
        ))}
      </section>

      <section className="surface-card mb-4 rounded-lg p-3 sm:p-4">
        <form action="/refunds" className="grid gap-3 sm:grid-cols-[1fr_190px_auto]">
          <label className="relative">
            <Search className="absolute left-3 top-3 size-4 text-gray-400" />
            <span className="sr-only">Search refunds</span>
            <input name="query" defaultValue={data.filters.query} placeholder="ID, customer, phone, branch…" className="h-10 w-full rounded-md border border-gray-200 bg-[#f8fbfc] pl-9 pr-3 text-sm outline-none focus:border-[#20aee3]" />
          </label>
          <select name="status" defaultValue={data.filters.status ?? ""} className="h-10 rounded-md border border-gray-200 bg-white px-3 text-sm text-gray-600">
            <option value="">All statuses</option>
            {Object.entries(approvalStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <div className="flex gap-2"><button className="h-10 flex-1 rounded-md bg-[#20aee3] px-4 text-sm font-medium text-white">Apply</button><Link href="/refunds" className="inline-flex h-10 items-center rounded-md border border-gray-200 px-4 text-sm text-gray-600">Clear</Link></div>
        </form>
      </section>

      <section className="surface-card overflow-hidden rounded-lg p-3 sm:p-[15px]">
        <div className="hidden overflow-x-auto lg:block">
          <table className="w-full min-w-[1100px] border-collapse text-left text-sm font-light text-gray-700">
            <thead><tr className="border-b border-gray-200 text-[#20aee3]"><th className="px-3 py-4 font-medium">ID</th><th className="px-3 py-4 font-medium">Created</th><th className="px-3 py-4 font-medium">Customer</th><th className="px-3 py-4 font-medium">Branch</th><th className="px-3 py-4 font-medium">Amount</th><th className="px-3 py-4 font-medium">Requested By</th><th className="px-3 py-4 font-medium">Status</th><th className="px-3 py-4 font-medium">Reason</th><th className="px-3 py-4 font-medium">Action</th></tr></thead>
            <tbody>
              {data.refunds.length === 0 ? <tr><td colSpan={9} className="px-3 py-16 text-center text-gray-400">No refunds match this view.</td></tr> : data.refunds.map((refund) => (
                <tr key={refund.id} className="border-b border-gray-100 transition hover:bg-[#f4fafc]">
                  <td className="whitespace-nowrap px-3 py-4 font-medium">{displayRefundUid(refund.uid, refund.id)}</td>
                  <td className="whitespace-nowrap px-3 py-4">{refund.createdAt.toLocaleDateString("en-GB")}</td>
                  <td className="px-3 py-4 capitalize">{refund.clientName}<span className="mt-0.5 block text-[10px] text-gray-400">{refund.phone}</span></td>
                  <td className="px-3 py-4">{refund.branch ?? "—"}</td>
                  <td className="whitespace-nowrap px-3 py-4 font-medium text-rose-600">{money(refund.amount)}</td>
                  <td className="px-3 py-4">{personLabel(refund.requestedBy)}</td>
                  <td className="px-3 py-4"><span className={`rounded-full border px-2 py-1 text-[10px] font-medium ${statusClass[refund.status]}`}>{approvalStatusLabels[refund.status]}</span></td>
                  <td className="max-w-xs truncate px-3 py-4" title={refund.reason}>{refund.reason}</td>
                  <td className="px-3 py-4"><div className="flex gap-1">{refund.lead ? <Link href={`/leads/${refund.lead.id}`} className="rounded-md border border-sky-100 px-2.5 py-1.5 text-xs text-[#20aee3] hover:bg-sky-50">Lead</Link> : null}{refund.approval ? <Link href={`/approvals/${refund.approval.id}`} className="rounded-md border border-amber-100 px-2.5 py-1.5 text-xs text-amber-700 hover:bg-amber-50">{data.canDecide && refund.status === "UNDER_PROCESS" ? "Decide" : "Approval"}</Link> : null}</div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="grid gap-3 lg:hidden">
          {data.refunds.length === 0 ? <div className="rounded-lg border border-dashed border-gray-200 px-4 py-14 text-center text-sm text-gray-400"><CircleAlert className="mx-auto mb-3 size-8 text-gray-300" />No refunds match this view.</div> : data.refunds.map((refund) => (
            <article key={refund.id} className="rounded-lg border border-gray-100 bg-[#fbfdfe] p-4">
              <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate font-medium capitalize text-gray-700">{refund.clientName}</p><p className="mt-1 text-xs text-gray-400">{displayRefundUid(refund.uid, refund.id)} · {refund.createdAt.toLocaleDateString("en-GB")}</p></div><span className={`shrink-0 rounded-full border px-2 py-1 text-[10px] font-medium ${statusClass[refund.status]}`}>{approvalStatusLabels[refund.status]}</span></div>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-xs"><div><dt className="text-gray-400">Amount</dt><dd className="mt-1 font-medium text-rose-600">{money(refund.amount)}</dd></div><div><dt className="text-gray-400">Branch</dt><dd className="mt-1 truncate text-gray-700">{refund.branch ?? "—"}</dd></div><div><dt className="text-gray-400">Requested by</dt><dd className="mt-1 truncate text-gray-700">{personLabel(refund.requestedBy)}</dd></div><div><dt className="text-gray-400">Phone</dt><dd className="mt-1 truncate text-gray-700">{refund.phone}</dd></div></dl>
              <p className="mt-3 line-clamp-2 text-sm leading-6 text-gray-600">{refund.reason}</p>
              <div className="mt-3 flex justify-end gap-1 border-t border-gray-100 pt-3">{refund.lead ? <Link href={`/leads/${refund.lead.id}`} className="rounded-md border border-sky-100 px-3 py-2 text-xs text-[#20aee3]">Lead</Link> : null}{refund.approval ? <Link href={`/approvals/${refund.approval.id}`} className="rounded-md border border-amber-100 px-3 py-2 text-xs text-amber-700">{data.canDecide && refund.status === "UNDER_PROCESS" ? "Decide" : "Approval"}</Link> : null}</div>
            </article>
          ))}
        </div>
      </section>

      <nav aria-label="Refund pagination" className="mt-5 flex items-center justify-between rounded-lg border border-gray-100 bg-white px-4 py-3 text-sm shadow-sm">
        <span className="text-xs text-gray-500">Page {data.pagination.page}</span>
        <div className="flex gap-2">{data.pagination.hasPrevious ? <Link href={pageHref(data.pagination.page - 1)} className="rounded-md border border-gray-200 px-3 py-2 text-gray-600">Previous</Link> : <span className="rounded-md border border-gray-100 px-3 py-2 text-gray-300">Previous</span>}{data.pagination.hasNext ? <Link href={pageHref(data.pagination.page + 1)} className="rounded-md border border-gray-200 px-3 py-2 text-gray-600">Next</Link> : <span className="rounded-md border border-gray-100 px-3 py-2 text-gray-300">Next</span>}</div>
      </nav>
    </div>
  );
}

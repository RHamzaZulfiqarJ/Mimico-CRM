import { CheckCircle2, Clock3, FileText, Search, XCircle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { DeleteVoucherButton, VoucherCreateDialog } from "@/components/vouchers/voucher-forms";
import { approvalStatusLabels } from "@/features/approvals/schemas";
import { displayVoucherUid } from "@/features/vouchers/identifiers";
import { getVoucherWorkspace } from "@/features/vouchers/queries";
import { canDeleteOperationalRecord, canManageOrganization } from "@/lib/auth/authorization";

export const metadata: Metadata = { title: "Vouchers" };
const statusClass = {
  UNDER_PROCESS: "border-amber-200 bg-amber-50 text-amber-700",
  ACCEPTED: "border-emerald-200 bg-emerald-50 text-emerald-700",
  REJECTED: "border-rose-200 bg-rose-50 text-rose-600",
} as const;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
function personLabel(person: { firstName: string | null; lastName: string | null; username: string | null; email: string | null } | null) {
  return person ? [person.firstName, person.lastName].filter(Boolean).join(" ") || person.username || person.email || "Team member" : "—";
}
function money(value: { toString(): string } | null) {
  return new Intl.NumberFormat("en-PK", { style: "currency", currency: "PKR", minimumFractionDigits: 2 }).format(Number(value?.toString() ?? 0));
}
function dateValue(value: Date | null) {
  return value ? value.toLocaleDateString("en-GB", { timeZone: "UTC" }) : "—";
}
function todayInPakistan() {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Karachi", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export default async function VouchersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const raw = await searchParams;
  const data = await getVoucherWorkspace({ query: first(raw.query), status: first(raw.status), projectId: first(raw.projectId), page: first(raw.page) });
  if (!data) redirect("/dashboard");
  const canChooseStaff = canManageOrganization(data.auth.membership.role);
  const canDelete = canDeleteOperationalRecord(data.auth.membership.role);
  const staffOptions = data.staff.map((profile) => ({ id: profile.id, label: personLabel(profile) }));
  const projectOptions = data.projects.map((project) => ({ id: project.id, label: `${project.uid ? `${project.uid} · ` : ""}${project.title}` }));
  const pageHref = (page: number) => ({ pathname: "/vouchers", query: { query: data.filters.query, status: data.filters.status, projectId: data.filters.projectId, page: page > 1 ? String(page) : undefined } });

  return <div className="mx-auto w-full max-w-[1500px] font-sans">
    <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-xs text-gray-500 sm:text-sm"><Link href="/dashboard" className="hover:text-[#20aee3]">Dashboard</Link><span>›</span><span>Vouchers</span></nav>
    <div className="mt-2 flex flex-col justify-between gap-4 pb-5 lg:flex-row lg:items-center lg:pb-8"><div><h1 className="text-[28px] font-light text-[#20aee3] sm:text-[32px]">Vouchers</h1><p className="mt-1 text-xs text-gray-400">Create, approve, and print payment vouchers.</p></div><VoucherCreateDialog staff={staffOptions} projects={projectOptions} canChooseStaff={canChooseStaff} issueDate={todayInPakistan()} /></div>

    <section className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {[
        { label: "All vouchers", value: data.counts.total, icon: FileText, tone: "text-[#20aee3] bg-sky-50" },
        { label: "Under process", value: data.counts.pending, icon: Clock3, tone: "text-amber-600 bg-amber-50" },
        { label: "Accepted", value: data.counts.accepted, icon: CheckCircle2, tone: "text-emerald-600 bg-emerald-50" },
        { label: "Rejected", value: data.counts.rejected, icon: XCircle, tone: "text-rose-600 bg-rose-50" },
      ].map(({ label, value, icon: Icon, tone }) => <article key={label} className="surface-card flex items-center gap-4 rounded-lg p-4"><span className={`flex size-10 items-center justify-center rounded-lg ${tone}`}><Icon className="size-5" /></span><div><p className="text-xl font-medium text-gray-700">{value}</p><p className="text-xs text-gray-400">{label}</p></div></article>)}
    </section>

    <section className="surface-card mb-4 rounded-lg p-3 sm:p-4"><form action="/vouchers" className="grid gap-3 md:grid-cols-[1fr_180px_240px_auto]"><label className="relative"><Search className="absolute left-3 top-3 size-4 text-gray-400" /><span className="sr-only">Search vouchers</span><input name="query" defaultValue={data.filters.query} placeholder="ID, customer, phone, project…" className="h-10 w-full rounded-md border border-gray-200 bg-[#f8fbfc] pl-9 pr-3 text-sm outline-none focus:border-[#20aee3]" /></label><select name="status" defaultValue={data.filters.status ?? ""} className="h-10 rounded-md border border-gray-200 bg-white px-3 text-sm text-gray-600"><option value="">All statuses</option>{Object.entries(approvalStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><select name="projectId" defaultValue={data.filters.projectId ?? ""} className="h-10 min-w-0 rounded-md border border-gray-200 bg-white px-3 text-sm text-gray-600"><option value="">All projects</option>{projectOptions.map((project) => <option key={project.id} value={project.id}>{project.label}</option>)}</select><div className="flex gap-2"><button className="h-10 flex-1 rounded-md bg-[#20aee3] px-4 text-sm font-medium text-white">Apply</button><Link href="/vouchers" className="inline-flex h-10 items-center rounded-md border border-gray-200 px-4 text-sm text-gray-600">Clear</Link></div></form></section>

    <section className="surface-card overflow-hidden rounded-lg p-3 sm:p-[15px]">
      <div className="hidden overflow-x-auto lg:block"><table className="w-full min-w-[1100px] border-collapse text-left text-sm font-light text-gray-700"><thead><tr className="border-b border-gray-200 text-[#20aee3]"><th className="px-3 py-4 font-medium">ID</th><th className="px-3 py-4 font-medium">Customer</th><th className="px-3 py-4 font-medium">Issue Date</th><th className="px-3 py-4 font-medium">Project</th><th className="px-3 py-4 font-medium">Status</th><th className="px-3 py-4 font-medium">Amount Paid</th><th className="px-3 py-4 font-medium">Remaining</th><th className="px-3 py-4 font-medium">Allocated To</th><th className="px-3 py-4 font-medium">Action</th></tr></thead><tbody>
        {data.vouchers.length === 0 ? <tr><td colSpan={9} className="px-3 py-16 text-center text-gray-400">No vouchers match this view.</td></tr> : data.vouchers.map((voucher) => <tr key={voucher.id} className="border-b border-gray-100 transition hover:bg-[#f4fafc]"><td className="whitespace-nowrap px-3 py-4 font-medium">{displayVoucherUid(voucher.uid, voucher.id)}</td><td className="px-3 py-4 capitalize">{voucher.clientName ?? "—"}<span className="mt-0.5 block text-[10px] text-gray-400">{voucher.phone ?? ""}</span></td><td className="whitespace-nowrap px-3 py-4">{dateValue(voucher.issuingDate)}</td><td className="px-3 py-4">{voucher.project?.title ?? "—"}</td><td className="px-3 py-4"><span className={`rounded-full border px-2 py-1 text-[10px] font-medium ${statusClass[voucher.status]}`}>{approvalStatusLabels[voucher.status]}</span></td><td className="whitespace-nowrap px-3 py-4 text-emerald-600">{money(voucher.paid)}</td><td className="whitespace-nowrap px-3 py-4">{money(voucher.remaining)}</td><td className="px-3 py-4">{personLabel(voucher.allocatedTo)}</td><td className="px-3 py-4"><div className="flex items-center gap-1"><Link href={`/vouchers/${voucher.id}`} className="rounded-md border border-sky-100 px-2.5 py-1.5 text-xs text-[#20aee3] hover:bg-sky-50">View</Link>{voucher.status === "ACCEPTED" ? <Link href={`/vouchers/${voucher.id}/print`} className="rounded-md border border-emerald-100 px-2.5 py-1.5 text-xs text-emerald-600 hover:bg-emerald-50">Print</Link> : null}{canDelete ? <DeleteVoucherButton voucherId={voucher.id} /> : null}</div></td></tr>)}
      </tbody></table></div>
      <div className="grid gap-3 lg:hidden">{data.vouchers.length === 0 ? <div className="rounded-lg border border-dashed border-gray-200 px-4 py-14 text-center text-sm text-gray-400">No vouchers match this view.</div> : data.vouchers.map((voucher) => <article key={voucher.id} className="rounded-lg border border-gray-100 bg-[#fbfdfe] p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate font-medium capitalize text-gray-700">{voucher.clientName ?? "Unnamed customer"}</p><p className="mt-1 text-xs text-gray-400">{displayVoucherUid(voucher.uid, voucher.id)} · {dateValue(voucher.issuingDate)}</p></div><span className={`shrink-0 rounded-full border px-2 py-1 text-[10px] font-medium ${statusClass[voucher.status]}`}>{approvalStatusLabels[voucher.status]}</span></div><dl className="mt-4 grid grid-cols-2 gap-3 text-xs"><div><dt className="text-gray-400">Project</dt><dd className="mt-1 truncate text-gray-700">{voucher.project?.title ?? "—"}</dd></div><div><dt className="text-gray-400">Allocated to</dt><dd className="mt-1 truncate text-gray-700">{personLabel(voucher.allocatedTo)}</dd></div><div><dt className="text-gray-400">Paid</dt><dd className="mt-1 font-medium text-emerald-600">{money(voucher.paid)}</dd></div><div><dt className="text-gray-400">Remaining</dt><dd className="mt-1 text-gray-700">{money(voucher.remaining)}</dd></div></dl><div className="mt-3 flex justify-end gap-1 border-t border-gray-100 pt-3"><Link href={`/vouchers/${voucher.id}`} className="rounded-md border border-sky-100 px-3 py-2 text-xs text-[#20aee3]">View</Link>{voucher.status === "ACCEPTED" ? <Link href={`/vouchers/${voucher.id}/print`} className="rounded-md border border-emerald-100 px-3 py-2 text-xs text-emerald-600">Print</Link> : null}{canDelete ? <DeleteVoucherButton voucherId={voucher.id} /> : null}</div></article>)}</div>
    </section>

    <nav aria-label="Voucher pagination" className="mt-5 flex items-center justify-between rounded-lg border border-gray-100 bg-white px-4 py-3 text-sm shadow-sm"><span className="text-xs text-gray-500">Page {data.pagination.page}</span><div className="flex gap-2">{data.pagination.hasPrevious ? <Link href={pageHref(data.pagination.page - 1)} className="rounded-md border border-gray-200 px-3 py-2 text-gray-600">Previous</Link> : <span className="rounded-md border border-gray-100 px-3 py-2 text-gray-300">Previous</span>}{data.pagination.hasNext ? <Link href={pageHref(data.pagination.page + 1)} className="rounded-md border border-gray-200 px-3 py-2 text-gray-600">Next</Link> : <span className="rounded-md border border-gray-100 px-3 py-2 text-gray-300">Next</span>}</div></nav>
  </div>;
}

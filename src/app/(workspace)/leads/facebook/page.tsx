import { ArrowLeft, ChevronRight, Inbox, Megaphone, RefreshCw } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { FacebookLeadActions } from "@/components/facebook/facebook-lead-actions";
import { FacebookLeadExpiry } from "@/components/facebook/facebook-lead-expiry";
import { getFacebookLeadInbox } from "@/features/facebook/queries";

export const metadata: Metadata = { title: "Facebook Leads" };

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function personLabel(person: { firstName: string | null; lastName: string | null; username: string | null; email: string | null } | null) {
  if (!person) return "—";
  return [person.firstName, person.lastName].filter(Boolean).join(" ") || person.username || person.email || "Team member";
}

const statusStyles = {
  available: "border-amber-300 bg-amber-50 text-amber-700",
  converted: "border-emerald-300 bg-emerald-50 text-emerald-700",
  declined: "border-rose-200 bg-rose-50 text-rose-600",
  expired: "border-slate-200 bg-slate-50 text-slate-500",
  claimed: "border-sky-200 bg-sky-50 text-sky-600",
} as const;

const statusLabels = {
  available: "Available",
  converted: "Converted",
  declined: "Declined",
  expired: "Expired",
  claimed: "Claimed",
} as const;

const views = [
  { value: "available", label: "Available" },
  { value: "converted", label: "Converted" },
  { value: "declined", label: "Declined" },
  { value: "all", label: "All" },
] as const;

export default async function FacebookLeadsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const data = await getFacebookLeadInbox({ view: first(raw.view), page: first(raw.page) });
  if (!data) redirect("/access-pending");

  const pageHref = (page: number) => ({
    pathname: "/leads/facebook" as const,
    query: { view: data.filters.view, ...(page > 1 ? { page: String(page) } : {}) },
  });
  const firstResult = data.leads.length
    ? (data.pagination.page - 1) * data.pagination.pageSize + 1
    : 0;
  const lastResult = data.leads.length ? firstResult + data.leads.length - 1 : 0;

  return (
    <div className="mx-auto w-full max-w-[1500px] font-sans">
      <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-xs text-[#67757c] sm:text-sm"><Link href="/dashboard" className="hover:text-[#20aee3]">Dashboard</Link><span aria-hidden>›</span><Link href="/leads" className="hover:text-[#20aee3]">Leads</Link><span aria-hidden>›</span><span aria-current="page">Facebook</span></nav>

      <div className="mt-2 flex flex-col justify-between gap-4 pb-5 lg:flex-row lg:items-end lg:pb-8">
        <div><h1 className="flex items-center gap-2 text-[28px] font-light text-[#20aee3] sm:text-[32px]"><Megaphone className="size-7" />Facebook Leads</h1><p className="mt-1 text-xs text-gray-400">Claim new Lead Ads enquiries and convert them directly into CRM leads.</p></div>
        <div className="flex flex-wrap gap-2"><Link href="/leads" className="inline-flex h-10 items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 text-sm text-gray-600 transition hover:border-sky-200 hover:text-[#20aee3]"><ArrowLeft className="size-4" />CRM leads</Link><Link href={pageHref(data.pagination.page)} aria-label="Refresh Facebook leads" className="inline-flex size-10 items-center justify-center rounded-lg bg-[#ebf2f5] text-[#82949d] transition hover:text-[#20aee3]"><RefreshCw className="size-4" /></Link></div>
      </div>

      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {views.map((view) => <Link key={view.value} href={{ pathname: "/leads/facebook", query: { view: view.value } }} aria-current={data.filters.view === view.value ? "page" : undefined} className={`whitespace-nowrap rounded-full border px-4 py-2 text-sm transition ${data.filters.view === view.value ? "border-[#20aee3] bg-sky-50 text-[#20aee3]" : "border-gray-200 bg-white text-gray-500 hover:border-sky-200"}`}>{view.label}</Link>)}
      </div>

      <section className="surface-card overflow-hidden rounded-lg p-3 sm:p-[15px]">
        {data.leads.length === 0 ? <div className="flex min-h-64 flex-col items-center justify-center rounded-lg border border-dashed border-gray-200 px-4 text-center"><span className="flex size-12 items-center justify-center rounded-full bg-sky-50 text-[#20aee3]"><Inbox className="size-6" /></span><p className="mt-4 text-sm font-medium text-gray-600">No Facebook leads in this view</p><p className="mt-1 max-w-md text-xs leading-5 text-gray-400">New signed webhook deliveries will appear here automatically after Meta sends them.</p></div> : (
          <div className="grid gap-4 xl:grid-cols-2">
            {data.leads.map((lead) => (
              <article key={lead.id} className="rounded-xl border border-gray-100 bg-[#fbfdfe] p-4 transition duration-200 hover:border-sky-200 hover:shadow-sm sm:p-5">
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                  <div className="min-w-0"><p className="truncate text-base font-medium capitalize text-gray-700">{lead.defaults.clientName || "Unnamed Facebook lead"}</p><p className="mt-1 break-all text-xs text-gray-400">ID: {lead.providerLeadId}</p></div>
                  <span className={`w-fit shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-medium ${statusStyles[lead.displayStatus]}`}>{statusLabels[lead.displayStatus]}</span>
                </div>

                <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-4 text-xs sm:grid-cols-3">
                  <div><dt className="text-gray-400">Phone</dt><dd className="mt-1 break-words text-sm text-gray-700">{lead.defaults.clientPhone || "—"}</dd></div>
                  <div><dt className="text-gray-400">Requested project</dt><dd className="mt-1 break-words text-sm capitalize text-gray-700">{lead.defaults.requestedProject || "—"}</dd></div>
                  <div><dt className="text-gray-400">City / area</dt><dd className="mt-1 break-words text-sm capitalize text-gray-700">{[lead.defaults.city, lead.defaults.area].filter(Boolean).join(" · ") || "—"}</dd></div>
                  <div><dt className="text-gray-400">Received</dt><dd className="mt-1 text-sm text-gray-700">{lead.providerCreatedAt.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</dd></div>
                  <div><dt className="text-gray-400">Availability</dt><dd className={`mt-1 text-sm ${lead.displayStatus === "available" ? "font-medium text-amber-600" : "text-gray-700"}`}>{lead.displayStatus === "available" ? <FacebookLeadExpiry expiresAt={lead.expiresAt?.toISOString() ?? null} /> : statusLabels[lead.displayStatus]}</dd></div>
                  <div><dt className="text-gray-400">Claimed by</dt><dd className="mt-1 break-words text-sm capitalize text-gray-700">{personLabel(lead.acceptedBy)}</dd></div>
                </dl>

                {lead.canAct ? <div className="mt-5 border-t border-gray-100 pt-4"><FacebookLeadActions inboundLeadId={lead.id} defaults={lead.defaults} projects={data.projects} suggestedProjectId={lead.suggestedProjectId} /></div> : lead.convertedLeadId ? <Link href={`/leads/${lead.convertedLeadId}`} className="mt-5 flex items-center justify-between border-t border-gray-100 pt-4 text-sm font-medium text-[#20aee3] transition hover:text-[#007bff]">Open converted CRM lead<ChevronRight className="size-4" /></Link> : null}
              </article>
            ))}
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 px-1 pt-4 text-xs text-gray-500">
          <span>Showing {firstResult}–{lastResult}</span>
          <div className="flex items-center gap-2">{data.pagination.page > 1 ? <Link href={pageHref(data.pagination.page - 1)} className="rounded-md border border-gray-200 bg-white px-3 py-2 hover:border-sky-200 hover:text-[#20aee3]">Previous</Link> : <span className="rounded-md border border-gray-100 px-3 py-2 text-gray-300">Previous</span>}<span>Page {data.pagination.page}</span>{data.pagination.hasNext ? <Link href={pageHref(data.pagination.page + 1)} className="rounded-md border border-gray-200 bg-white px-3 py-2 hover:border-sky-200 hover:text-[#20aee3]">Next</Link> : <span className="rounded-md border border-gray-100 px-3 py-2 text-gray-300">Next</span>}</div>
        </div>
      </section>
    </div>
  );
}

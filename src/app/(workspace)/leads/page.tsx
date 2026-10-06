import {
  Archive,
  BellRing,
  ChevronRight,
  Filter,
  List,
  MoreVertical,
  RefreshCw,
  RotateCcw,
  Search,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { LeadCreateDialog } from "@/components/leads/lead-forms";
import { LeadImportDialog } from "@/components/leads/lead-import-dialog";
import { ClientRecords } from "@/components/client/client-records";
import { restoreLeadAction } from "@/features/leads/actions";
import { displayLeadUid } from "@/features/leads/identifiers";
import { getLeadWorkspace } from "@/features/leads/queries";
import {
  leadPriorities,
  leadStages,
  priorityLabels,
  stageLabels,
} from "@/features/leads/schemas";
import { canCreateLead, canManageOrganization } from "@/lib/auth/authorization";

export const metadata: Metadata = { title: "Leads" };

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function personLabel(person: { firstName: string | null; lastName: string | null; username: string | null; email: string | null }) {
  return [person.firstName, person.lastName].filter(Boolean).join(" ") || person.username || person.email || "Team member";
}

function whatsappNumber(phone: string | null) {
  if (!phone) return "";
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.startsWith("00")) return cleaned.slice(2);
  if (cleaned.startsWith("0")) return `92${cleaned.slice(1)}`;
  return cleaned;
}

const stageClass = {
  CLOSED_WON: "border-green-500 text-green-500",
  CLOSED_LOST: "border-red-400 text-red-400",
  FOLLOW_UP: "border-sky-400 text-sky-400",
  CONTACTED_CLIENT: "border-orange-400 text-orange-400",
  CALL_NOT_ATTEND: "border-lime-400 text-lime-500",
  VISIT_SCHEDULED: "border-teal-400 text-teal-500",
  VISIT_DONE: "border-indigo-400 text-indigo-500",
  NEW_CLIENT: "border-rose-700 text-rose-700",
} as const;

const toolbarButton = "flex size-10 shrink-0 items-center justify-center rounded-md bg-[#ebf2f5] text-[#82949d] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#dfe6e8] hover:text-[#20aee3] hover:shadow-sm disabled:translate-y-0 disabled:opacity-45 disabled:shadow-none";

export default async function LeadsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const raw = await searchParams;
  const data = await getLeadWorkspace({ query: first(raw.query), stage: first(raw.stage), priority: first(raw.priority), projectId: first(raw.projectId), archived: first(raw.archived), page: first(raw.page) });
  if (!data) redirect("/access-pending");

  if (data.auth.membership.role === "CLIENT") return <ClientRecords data={data} />;

  const projectOptions = data.projects.map((project) => ({ id: project.id, label: project.title }));
  const staffOptions = data.staff.map((profile) => ({ id: profile.id, label: personLabel(profile) }));
  const activeFilterCount = [data.filters.stage, data.filters.priority, data.filters.projectId].filter(Boolean).length;
  const pageHref = (page: number) => {
    const query: Record<string, string> = {};
    if (data.filters.query) query.query = data.filters.query;
    if (data.filters.stage) query.stage = data.filters.stage;
    if (data.filters.priority) query.priority = data.filters.priority;
    if (data.filters.projectId) query.projectId = data.filters.projectId;
    if (data.filters.archived) query.archived = "true";
    if (page > 1) query.page = String(page);
    return { pathname: "/leads" as const, query };
  };
  const firstResult = data.leads.length
    ? (data.pagination.page - 1) * data.pagination.pageSize + 1
    : 0;
  const lastResult = data.leads.length
    ? firstResult + data.leads.length - 1
    : 0;

  return (
    <div className="mx-auto w-full max-w-[1500px] font-sans">
      <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-xs text-[#67757c] sm:text-sm"><Link href="/dashboard" className="transition hover:text-[#20aee3]">Dashboard</Link><span aria-hidden>›</span><span className="capitalize" aria-current="page">leads</span></nav>

      <div className="mt-2 flex flex-col justify-between gap-4 pb-5 lg:flex-row lg:items-center lg:pb-8">
        <div>
          <h1 className="text-[28px] font-light capitalize text-[#20aee3] sm:text-[32px]">{data.filters.archived ? "Archived Leads" : "Leads"}</h1>
          <p className="mt-1 text-xs text-gray-400">{data.leads.length} {data.leads.length === 1 ? "lead" : "leads"} on this page</p>
        </div>
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
          <form action="/leads" className="relative w-full sm:w-56">
            {data.filters.archived ? <input type="hidden" name="archived" value="true" /> : null}
            <Search className="pointer-events-none absolute left-2 top-2.5 size-5 text-[#a6b5bd]" />
            <input name="query" aria-label="Search leads" defaultValue={data.filters.query} placeholder="Search leads" className="h-10 w-full rounded-md bg-[#ebf2f5] pl-9 pr-2 text-sm text-gray-700 outline-none transition focus:bg-white focus:ring-2 focus:ring-[#20aee3]/25" />
          </form>
          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:overflow-visible sm:pb-0">
          <Link href={data.filters.archived ? "/leads?archived=true" : "/leads"} aria-label="Refresh leads" title="Refresh" className={toolbarButton}><RefreshCw className="size-5" /></Link>
          {canManageOrganization(data.auth.membership.role) ? <Link href={data.filters.archived ? "/leads" : "/leads?archived=true"} aria-label={data.filters.archived ? "Active leads" : "Archived leads"} title={data.filters.archived ? "Active leads" : "Archived leads"} className={`${toolbarButton} ${data.filters.archived ? "bg-sky-50 text-[#20aee3]" : ""}`}>{data.filters.archived ? <RotateCcw className="size-5" /> : <Archive className="size-5" />}</Link> : null}
          <Link href="/leads/facebook" aria-label="Facebook leads" title="Facebook leads" className={toolbarButton}><span className="text-lg font-semibold">f</span></Link>
          <button disabled aria-label="Change lead view, coming soon" title="Additional views are coming soon" className={toolbarButton}><List className="size-5" /></button>
          <details className="relative shrink-0">
            <summary aria-label="Filter leads" title="Filter leads" className={`${toolbarButton} relative list-none cursor-pointer`}><Filter className="size-5" />{activeFilterCount ? <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-[#ff5c6c] text-[9px] font-semibold text-white">{activeFilterCount}</span> : null}</summary>
            <form action="/leads" className="dialog-enter fixed left-3 right-3 top-20 z-50 grid gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-2xl sm:absolute sm:left-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-72">
              <div className="flex items-center justify-between"><p className="text-sm font-medium text-gray-700">Filter leads</p>{activeFilterCount ? <span className="text-xs text-[#20aee3]">{activeFilterCount} active</span> : null}</div>
              <input type="hidden" name="query" value={data.filters.query ?? ""} />
              {data.filters.archived ? <input type="hidden" name="archived" value="true" /> : null}
              <select name="stage" defaultValue={data.filters.stage ?? ""} className="h-10 rounded-md border border-gray-300 bg-white px-3 text-sm"><option value="">All statuses</option>{leadStages.map((stage) => <option key={stage} value={stage}>{stageLabels[stage]}</option>)}</select>
              <select name="priority" defaultValue={data.filters.priority ?? ""} className="h-10 rounded-md border border-gray-300 bg-white px-3 text-sm"><option value="">All priorities</option>{leadPriorities.map((priority) => <option key={priority} value={priority}>{priorityLabels[priority]}</option>)}</select>
              <select name="projectId" defaultValue={data.filters.projectId ?? ""} className="h-10 rounded-md border border-gray-300 bg-white px-3 text-sm"><option value="">All projects</option>{data.projects.map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}</select>
              <div className="flex justify-end gap-2"><Link href={data.filters.archived ? "/leads?archived=true" : "/leads"} className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 transition hover:bg-gray-50">Clear</Link><button className="rounded-md bg-[#20aee3] px-3 py-2 text-sm text-white transition hover:bg-[#179bd0]">Apply</button></div>
            </form>
          </details>
          {!data.filters.archived && canCreateLead(data.auth.membership.role) ? <Link href="/leads/reminders" aria-label="Call reminders" title="Call reminders" className={toolbarButton}><BellRing className="size-5" /></Link> : null}
          {!data.filters.archived && canCreateLead(data.auth.membership.role) ? <LeadImportDialog buttonClassName={toolbarButton} /> : null}
          {!data.filters.archived && canCreateLead(data.auth.membership.role) ? <LeadCreateDialog projects={projectOptions} staff={staffOptions} canChooseAssignee={canManageOrganization(data.auth.membership.role)} /> : null}
          </div>
        </div>
      </div>

      {data.filters.archived && first(raw.error) === "duplicate-phone" ? <p role="alert" className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">This lead cannot be restored because an active lead already uses the same phone number.</p> : null}

      <section className="surface-card overflow-hidden rounded-lg p-3 sm:p-[15px]">
        <div className="hidden overflow-x-auto lg:block">
          <table className="w-full min-w-[980px] border-collapse text-left text-sm font-light text-gray-700">
            <thead>
              <tr className="border-b border-gray-200 text-[#20aee3]">
                <th className="px-3 py-4 font-medium">ID</th><th className="px-3 py-4 font-medium">Client Name</th><th className="px-3 py-4 font-medium">Client Phone</th><th className="px-3 py-4 font-medium">Created</th><th className="px-3 py-4 font-medium">Priority</th><th className="px-3 py-4 font-medium">Status</th><th className="px-3 py-4 font-medium">Project</th><th className="px-3 py-4 font-medium">Staff</th><th className="px-3 py-4 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {data.leads.length === 0 ? <tr><td colSpan={9} className="px-3 py-16 text-center text-gray-400">No leads found.</td></tr> : data.leads.map((lead) => (
                <tr key={lead.id} className="border-b border-gray-100 transition-colors hover:bg-[#f4fafc]">
                  <td className="px-3 py-4 font-medium text-gray-600">{displayLeadUid(lead.uid, lead.id)}</td>
                  <td className="px-3 py-4">{data.filters.archived ? <span className="capitalize text-gray-700">{lead.clientName ?? "—"}</span> : <Link href={`/leads/${lead.id}`} className="capitalize text-[#20aee3] hover:text-[#007bff]">{lead.clientName ?? "—"}</Link>}</td>
                  <td className="px-3 py-4">{lead.clientPhone ? <a href={`https://wa.me/${whatsappNumber(lead.clientPhone)}`} target="_blank" rel="noreferrer" className="transition hover:text-red-500">{lead.clientPhone}</a> : "—"}</td>
                  <td className="px-3 py-4">{lead.createdAt.toLocaleDateString("en-GB")}</td>
                  <td className="px-3 py-4 capitalize">{priorityLabels[lead.priority]}</td>
                  <td className="px-3 py-4"><span className={`inline-flex rounded-full border px-2 py-1 text-xs font-medium ${stageClass[lead.stage]}`}>{stageLabels[lead.stage]}</span></td>
                  <td className="px-3 py-4 capitalize">{lead.project?.title ?? "—"}</td>
                  <td className="px-3 py-4 capitalize">{lead.assignments.map(({ profile }) => personLabel(profile)).join(", ") || "—"}</td>
                  <td className="px-3 py-4"><div className="flex items-center gap-2">{data.filters.archived ? <form action={restoreLeadAction.bind(null, lead.id)}><button className="inline-flex items-center gap-1 text-emerald-600 transition hover:text-emerald-700"><RotateCcw className="size-4" />Restore</button></form> : <><Link href={`/leads/${lead.id}`} title="View" className="text-[#20aee3] hover:text-[#007bff]">View</Link><MoreVertical className="size-5 text-gray-400" /></>}</div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="grid gap-3 lg:hidden">
          {data.leads.length === 0 ? <div className="rounded-lg border border-dashed border-gray-200 px-4 py-14 text-center text-sm text-gray-400">No leads match this view.</div> : data.leads.map((lead) => (
            <article key={lead.id} className="rounded-lg border border-gray-100 bg-[#fbfdfe] p-4 transition hover:border-sky-200 hover:shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0"><p className="truncate text-sm font-medium capitalize text-gray-700">{lead.clientName ?? "Unnamed lead"}</p><p className="mt-1 text-xs text-gray-400">{displayLeadUid(lead.uid, lead.id)} · {lead.createdAt.toLocaleDateString("en-GB")}</p></div>
                <span className={`shrink-0 rounded-full border px-2 py-1 text-[10px] font-medium ${stageClass[lead.stage]}`}>{stageLabels[lead.stage]}</span>
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
                <div><dt className="text-gray-400">Phone</dt><dd className="mt-1 truncate text-gray-700">{lead.clientPhone ?? "—"}</dd></div>
                <div><dt className="text-gray-400">Priority</dt><dd className="mt-1 capitalize text-gray-700">{priorityLabels[lead.priority]}</dd></div>
                <div><dt className="text-gray-400">Project</dt><dd className="mt-1 truncate capitalize text-gray-700">{lead.project?.title ?? "—"}</dd></div>
                <div><dt className="text-gray-400">Staff</dt><dd className="mt-1 truncate capitalize text-gray-700">{lead.assignments.map(({ profile }) => personLabel(profile)).join(", ") || "Unassigned"}</dd></div>
              </dl>
              {data.filters.archived ? <form action={restoreLeadAction.bind(null, lead.id)} className="mt-4 border-t border-gray-100 pt-3"><button className="flex w-full items-center justify-between text-sm font-medium text-emerald-600 transition hover:text-emerald-700">Restore lead<RotateCcw className="size-4" /></button></form> : <Link href={`/leads/${lead.id}`} className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3 text-sm font-medium text-[#20aee3] transition hover:text-[#007bff]">View lead details<ChevronRight className="size-4" /></Link>}
            </article>
          ))}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 px-1 pt-4 text-xs text-gray-500">
          <span>Showing {firstResult}–{lastResult}</span>
          <div className="flex items-center gap-2">
            {data.pagination.page > 1 ? <Link href={pageHref(data.pagination.page - 1)} className="rounded-md border border-gray-200 bg-white px-3 py-2 transition hover:border-sky-200 hover:text-[#20aee3]">Previous</Link> : <span className="rounded-md border border-gray-100 px-3 py-2 text-gray-300">Previous</span>}
            <span>Page {data.pagination.page}</span>
            {data.pagination.hasNext ? <Link href={pageHref(data.pagination.page + 1)} className="rounded-md border border-gray-200 bg-white px-3 py-2 transition hover:border-sky-200 hover:text-[#20aee3]">Next</Link> : <span className="rounded-md border border-gray-100 px-3 py-2 text-gray-300">Next</span>}
          </div>
        </div>
      </section>
    </div>
  );
}

import { ArrowLeft, ArrowRight, FileSearch, Search } from "lucide-react";
import Link from "next/link";

import type { getLeadWorkspace } from "@/features/leads/queries";
import { displayLeadUid } from "@/features/leads/identifiers";
import { leadStages, stageLabels } from "@/features/leads/schemas";

type LeadWorkspace = NonNullable<Awaited<ReturnType<typeof getLeadWorkspace>>>;

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Karachi",
  day: "2-digit",
  month: "short",
  year: "numeric",
});

export function ClientRecords({ data }: { data: LeadWorkspace }) {
  const pageHref = (page: number) => {
    const query: Record<string, string> = {};
    if (data.filters.query) query.query = data.filters.query;
    if (data.filters.stage) query.stage = data.filters.stage;
    if (data.filters.projectId) query.projectId = data.filters.projectId;
    if (page > 1) query.page = String(page);
    return { pathname: "/leads" as const, query };
  };

  return (
    <div className="mx-auto w-full max-w-6xl">
      <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm text-stone-600 hover:text-slate-950"><ArrowLeft className="size-4" />Overview</Link>
      <header className="mt-6 border-b border-stone-300 pb-6">
        <p className="text-sm text-stone-500">Information centre</p>
        <h1 className="mt-2 text-3xl font-medium tracking-tight text-slate-900 sm:text-4xl">My records</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-stone-600">Search and review the records that have been linked to your account.</p>
      </header>

      <form action="/leads" className="grid gap-3 border-b border-stone-300 py-5 md:grid-cols-[minmax(0,1fr)_220px_220px_auto]">
        <label className="relative">
          <span className="sr-only">Search records</span>
          <Search className="pointer-events-none absolute left-3 top-3 size-4 text-stone-500" />
          <input name="query" defaultValue={data.filters.query} placeholder="Search by reference or information" className="h-10 w-full border border-stone-300 bg-white pl-9 pr-3 text-sm text-slate-800 outline-none focus:border-sky-700" />
        </label>
        <select name="stage" aria-label="Filter by status" defaultValue={data.filters.stage ?? ""} className="h-10 border border-stone-300 bg-white px-3 text-sm text-slate-700 outline-none focus:border-sky-700">
          <option value="">All statuses</option>
          {leadStages.map((stage) => <option key={stage} value={stage}>{stageLabels[stage]}</option>)}
        </select>
        <select name="projectId" aria-label="Filter by project" defaultValue={data.filters.projectId ?? ""} className="h-10 border border-stone-300 bg-white px-3 text-sm text-slate-700 outline-none focus:border-sky-700">
          <option value="">All projects</option>
          {data.projects.map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}
        </select>
        <button className="h-10 bg-slate-900 px-5 text-sm font-medium text-white transition hover:bg-slate-700">Check records</button>
      </form>

      <section className="divide-y divide-stone-300" aria-label="Client records">
        {data.leads.length === 0 ? (
          <div className="py-20 text-center">
            <FileSearch className="mx-auto size-8 text-stone-400" />
            <p className="mt-4 font-medium text-slate-800">No matching records</p>
            <p className="mt-1 text-sm text-stone-500">Try removing the filters or contact your representative.</p>
          </div>
        ) : data.leads.map((lead) => (
          <article key={lead.id} className="grid gap-5 py-6 md:grid-cols-[minmax(0,1.3fr)_minmax(150px,0.6fr)_minmax(150px,0.6fr)_auto] md:items-center">
            <div className="min-w-0">
              <p className="text-xs text-stone-500">{displayLeadUid(lead.uid, lead.id)}</p>
              <h2 className="mt-1 truncate text-lg font-medium text-slate-900">{lead.project?.title ?? "General enquiry"}</h2>
              <p className="mt-1 text-sm text-stone-500">Added {dateFormatter.format(lead.createdAt)}</p>
            </div>
            <div>
              <p className="text-xs text-stone-500">Current status</p>
              <p className="mt-1 text-sm font-medium text-slate-800">{stageLabels[lead.stage]}</p>
            </div>
            <div>
              <p className="text-xs text-stone-500">Area</p>
              <p className="mt-1 text-sm font-medium text-slate-800">{lead.area ? `${lead.area} Marla` : "Not specified"}</p>
            </div>
            <Link href={`/leads/${lead.id}`} className="inline-flex items-center justify-between gap-3 border border-slate-900 px-4 py-2 text-sm font-medium text-slate-900 transition hover:bg-slate-900 hover:text-white md:justify-center">
              View information <ArrowRight className="size-4" />
            </Link>
          </article>
        ))}
      </section>

      <footer className="flex items-center justify-between border-t border-stone-300 pt-5 text-sm text-stone-600">
        <span>Page {data.pagination.page}</span>
        <div className="flex gap-2">
          {data.pagination.page > 1 ? <Link href={pageHref(data.pagination.page - 1)} className="border border-stone-300 bg-white px-4 py-2 hover:border-slate-500">Previous</Link> : null}
          {data.pagination.hasNext ? <Link href={pageHref(data.pagination.page + 1)} className="border border-stone-300 bg-white px-4 py-2 hover:border-slate-500">Next</Link> : null}
        </div>
      </footer>
    </div>
  );
}

import { ArrowRight, FileText, FolderOpen, ShieldCheck } from "lucide-react";
import Link from "next/link";

import type { getDashboardWorkspace } from "@/features/dashboard/queries";
import { displayLeadUid } from "@/features/leads/identifiers";
import { stageLabels } from "@/features/leads/schemas";

type DashboardData = NonNullable<Awaited<ReturnType<typeof getDashboardWorkspace>>>;

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Karachi",
  day: "2-digit",
  month: "short",
  year: "numeric",
});

export function ClientDashboard({ data }: { data: DashboardData }) {
  const completed = data.leadMetrics.wonLeads + data.leadMetrics.lostLeads;
  const inProgress = Math.max(0, data.leadMetrics.activeLeads - completed);
  const latestUpdate = data.recentLeads[0]?.updatedAt;

  return (
    <div className="mx-auto w-full max-w-6xl">
      <header className="border-b border-stone-300 pb-7">
        <p className="text-sm text-stone-500">Client overview</p>
        <h1 className="mt-2 text-3xl font-medium tracking-tight text-slate-900 sm:text-4xl">
          Hello, {data.auth.profile.displayName}
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-stone-600 sm:text-base">
          Review the information and updates shared with you by {data.auth.organization.name}.
        </p>
      </header>

      <section className="grid border-b border-stone-300 sm:grid-cols-3" aria-label="Record summary">
        {[
          ["Your records", data.leadMetrics.activeLeads, "All information currently linked to your account"],
          ["In progress", inProgress, "Records still being handled by the team"],
          ["Completed", completed, "Records with a completed outcome"],
        ].map(([label, value, description], index) => (
          <article key={label} className={`py-6 sm:px-6 ${index ? "border-t border-stone-300 sm:border-l sm:border-t-0" : "sm:pl-0"}`}>
            <p className="text-sm font-medium text-stone-600">{label}</p>
            <p className="mt-2 text-3xl font-semibold tabular-nums text-slate-900">{value}</p>
            <p className="mt-2 max-w-xs text-xs leading-5 text-stone-500">{description}</p>
          </article>
        ))}
      </section>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1.6fr)_minmax(280px,0.7fr)]">
        <section>
          <div className="flex items-end justify-between gap-4 border-b border-stone-300 pb-3">
            <div>
              <h2 className="text-xl font-medium text-slate-900">Recent information</h2>
              <p className="mt-1 text-sm text-stone-500">Your latest linked records and their current status.</p>
            </div>
            <Link href="/leads" className="hidden items-center gap-1 text-sm font-medium text-slate-700 hover:text-slate-950 sm:inline-flex">
              View all <ArrowRight className="size-4" />
            </Link>
          </div>

          <div className="divide-y divide-stone-200">
            {data.recentLeads.length === 0 ? (
              <div className="py-14 text-center">
                <FolderOpen className="mx-auto size-7 text-stone-400" />
                <p className="mt-3 text-sm font-medium text-slate-700">No records are linked yet</p>
                <p className="mt-1 text-xs text-stone-500">Your information will appear here when it is shared with your account.</p>
              </div>
            ) : data.recentLeads.map((lead) => (
              <Link key={lead.id} href={`/leads/${lead.id}`} className="group grid gap-2 py-5 transition sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-6">
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-900 group-hover:text-sky-700">{lead.project?.title ?? "General enquiry"}</p>
                  <p className="mt-1 text-xs text-stone-500">Reference {displayLeadUid(lead.uid, lead.id)}</p>
                </div>
                <div className="flex items-center justify-between gap-5 sm:justify-end">
                  <span className="text-sm text-stone-700">{stageLabels[lead.stage]}</span>
                  <time className="whitespace-nowrap text-xs text-stone-500" dateTime={lead.updatedAt.toISOString()}>{dateFormatter.format(lead.updatedAt)}</time>
                  <ArrowRight className="size-4 text-stone-400 transition group-hover:translate-x-1 group-hover:text-sky-700" />
                </div>
              </Link>
            ))}
          </div>
          <Link href="/leads" className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-slate-700 sm:hidden">View all records <ArrowRight className="size-4" /></Link>
        </section>

        <aside className="border border-stone-300 bg-white p-5 sm:p-6">
          <ShieldCheck className="size-6 text-sky-700" />
          <h2 className="mt-4 text-lg font-medium text-slate-900">Read-only access</h2>
          <p className="mt-2 text-sm leading-6 text-stone-600">
            This portal gives you a clear view of information shared with your account. Contact your representative if anything needs to be corrected.
          </p>
          <div className="mt-6 border-t border-stone-200 pt-5">
            <div className="flex items-center gap-3 text-sm text-stone-600">
              <FileText className="size-5 text-stone-500" />
              <span>Documents are available inside each record.</span>
            </div>
            <p className="mt-5 text-xs text-stone-500">
              Last update: {latestUpdate ? dateFormatter.format(latestUpdate) : "No updates yet"}
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

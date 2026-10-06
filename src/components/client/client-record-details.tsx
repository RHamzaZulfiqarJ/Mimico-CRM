import { ArrowLeft, Download, FileText } from "lucide-react";
import Link from "next/link";

import type { getLeadDetails } from "@/features/leads/queries";
import { formatAttachmentSize } from "@/features/attachments/policy";
import { displayLeadUid } from "@/features/leads/identifiers";
import { stageLabels } from "@/features/leads/schemas";

type LeadDetailsData = NonNullable<Awaited<ReturnType<typeof getLeadDetails>>>;
type ClientLead = NonNullable<LeadDetailsData["lead"]>;

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Karachi",
  day: "2-digit",
  month: "short",
  year: "numeric",
});

export function ClientRecordDetails({ lead }: { lead: ClientLead }) {
  const details = [
    ["Project", lead.project?.title ?? "Not specified"],
    ["Status", stageLabels[lead.stage]],
    ["Area", lead.area ? `${lead.area} Marla` : "Not specified"],
    ["Last updated", dateFormatter.format(lead.updatedAt)],
  ];

  return (
    <div className="mx-auto w-full max-w-6xl">
      <Link href="/leads" className="inline-flex items-center gap-2 text-sm text-stone-600 hover:text-slate-950"><ArrowLeft className="size-4" />My records</Link>

      <header className="mt-6 border-b border-stone-300 pb-7">
        <p className="text-sm text-stone-500">Reference {displayLeadUid(lead.uid, lead.id)}</p>
        <div className="mt-2 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <h1 className="text-3xl font-medium tracking-tight text-slate-900 sm:text-4xl">{lead.project?.title ?? "Record information"}</h1>
            <p className="mt-3 text-sm text-stone-600">Information shared with your client account.</p>
          </div>
          <p className="w-fit border border-stone-400 bg-white px-3 py-1.5 text-sm font-medium text-slate-800">{stageLabels[lead.stage]}</p>
        </div>
      </header>

      <dl className="grid border-b border-stone-300 sm:grid-cols-2 lg:grid-cols-4">
        {details.map(([label, value], index) => (
          <div key={label} className={`py-5 sm:px-5 ${index ? "border-t border-stone-300 sm:border-l sm:border-t-0" : "sm:pl-0"}`}>
            <dt className="text-xs text-stone-500">{label}</dt>
            <dd className="mt-2 text-sm font-medium text-slate-900">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="grid gap-10 py-8 lg:grid-cols-[minmax(0,1fr)_minmax(300px,0.65fr)]">
        <section>
          <div className="border-b border-stone-300 pb-3">
            <h2 className="text-xl font-medium text-slate-900">Updates</h2>
            <p className="mt-1 text-sm text-stone-500">A chronological view of status changes shared by the team.</p>
          </div>
          <div className="divide-y divide-stone-200">
            {lead.followUps.length === 0 ? <p className="py-10 text-sm text-stone-500">No updates have been shared yet.</p> : lead.followUps.map((update) => (
              <article key={update.id} className="flex items-center justify-between gap-5 py-5">
                <p className="text-sm font-medium text-slate-800">{stageLabels[update.stage]}</p>
                <time className="whitespace-nowrap text-xs text-stone-500" dateTime={update.createdAt.toISOString()}>{dateFormatter.format(update.createdAt)}</time>
              </article>
            ))}
          </div>
        </section>

        <aside>
          <div className="border-b border-stone-300 pb-3">
            <h2 className="text-xl font-medium text-slate-900">Documents</h2>
            <p className="mt-1 text-sm text-stone-500">Files made available with this record.</p>
          </div>
          <div className="divide-y divide-stone-200">
            {lead.attachments.length === 0 ? <p className="py-10 text-sm text-stone-500">No documents are available.</p> : lead.attachments.map((attachment) => (
              <article key={attachment.id} className="flex items-center gap-3 py-4">
                <FileText className="size-5 shrink-0 text-stone-500" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-800">{attachment.originalName ?? "Document"}</p>
                  <p className="mt-1 text-xs text-stone-500">{formatAttachmentSize(attachment.sizeBytes)} · {dateFormatter.format(attachment.createdAt)}</p>
                </div>
                <a href={`/api/attachments/${attachment.id}/download`} aria-label={`Download ${attachment.originalName ?? "document"}`} className="border border-stone-300 p-2 text-slate-700 transition hover:border-slate-600 hover:text-slate-950"><Download className="size-4" /></a>
              </article>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}

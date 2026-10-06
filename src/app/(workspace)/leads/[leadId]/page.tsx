import { Archive, Download, FileText, MoreVertical, Paperclip, Trash2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AssignmentForm, FollowUpForm, LeadProgressForm } from "@/components/leads/lead-forms";
import { AttachmentUploader } from "@/components/leads/attachment-uploader";
import { ClientRecordDetails } from "@/components/client/client-record-details";
import { RefundCreateDialog } from "@/components/refunds/refund-forms";
import { deleteLeadAttachmentAction } from "@/features/attachments/actions";
import { formatAttachmentSize } from "@/features/attachments/policy";
import { archiveLeadAction } from "@/features/leads/actions";
import { displayLeadUid } from "@/features/leads/identifiers";
import { getLeadDetails } from "@/features/leads/queries";
import { priorityLabels, stageLabels } from "@/features/leads/schemas";
import { canDeleteOperationalRecord, canManageOrganization, isStaff } from "@/lib/auth/authorization";

export const metadata: Metadata = { title: "Lead details" };

function personLabel(person: { firstName: string | null; lastName: string | null; username: string | null; email: string | null }) {
  return [person.firstName, person.lastName].filter(Boolean).join(" ") || person.username || person.email || "Team member";
}

const headingCell = "whitespace-nowrap px-4 py-3 text-left text-base font-normal text-[#20aee3]";
const valueCell = "whitespace-nowrap px-4 py-4 text-sm font-light text-gray-700";

export default async function LeadDetailsPage({ params }: { params: Promise<{ leadId: string }> }) {
  const { leadId } = await params;
  const data = await getLeadDetails(leadId);
  if (!data) redirect("/access-pending");
  if (!data.lead) notFound();

  const { lead } = data;
  if (data.auth.membership.role === "CLIENT") return <ClientRecordDetails lead={lead} />;

  const canEdit = isStaff(data.auth.membership.role);
  const canManage = canManageOrganization(data.auth.membership.role);
  const projectOptions = data.projects.map((project) => ({ id: project.id, label: project.title }));
  const staffOptions = data.staff.map((profile) => ({ id: profile.id, label: personLabel(profile) }));
  const archiveAction = archiveLeadAction.bind(null, lead.id);
  const displayId = displayLeadUid(lead.uid, lead.id);

  return (
    <div className="mx-auto w-full max-w-[1500px] font-sans">
      <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-xs text-[#67757c] sm:text-sm"><Link href="/dashboard" className="transition hover:text-[#20aee3]">Dashboard</Link><span aria-hidden>›</span><Link href="/leads" className="transition hover:text-[#20aee3]">Leads</Link><span aria-hidden>›</span><span aria-current="page">{displayId}</span></nav>
      <div className="mt-2 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-light capitalize text-[#20aee3] sm:text-[32px]">Lead Details</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs"><span className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-sky-600">{stageLabels[lead.stage]}</span><span className="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-gray-500">{priorityLabels[lead.priority]} priority</span></div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {canEdit ? <RefundCreateDialog pending={lead.refundRequested} lead={{ id: lead.id, clientName: lead.clientName ?? lead.client?.displayName ?? "", phone: lead.clientPhone ?? lead.client?.phone ?? "", cnic: lead.client?.cnic ?? "" }} /> : null}
          {canDeleteOperationalRecord(data.auth.membership.role) ? (
            <details className="relative">
            <summary aria-label="Lead actions" className="flex size-10 list-none cursor-pointer items-center justify-center rounded-full bg-[#ff5c6c] text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-red-500"><MoreVertical className="size-5" /></summary>
            <div className="dialog-enter absolute right-0 z-20 mt-2 w-48 rounded-lg border border-gray-200 bg-white p-2 shadow-xl">
              <form action={archiveAction}><button className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-red-500 hover:bg-gray-100"><Archive className="size-4" />Archive Lead</button></form>
            </div>
            </details>
          ) : null}
        </div>
      </div>

      <section className="surface-card my-4 w-full rounded-lg p-4 sm:p-5">
        <h2 className="text-xl font-normal text-[#ff5c6c]">Client Details</h2>
        <div className="my-2 hidden overflow-x-auto rounded border border-gray-100 md:block">
          <table className="w-full min-w-[650px]"><thead><tr className="border-b border-gray-200"><th className={headingCell}>Name</th><th className={headingCell}>Phone</th><th className={headingCell}>CNIC</th><th className={headingCell}>City</th><th className={headingCell}>Email</th></tr></thead>
            <tbody><tr><td className={valueCell}>{lead.clientName ?? lead.client?.displayName ?? "—"}</td><td className={valueCell}>{lead.clientPhone ?? lead.client?.phone ?? "—"}</td><td className={valueCell}>{lead.client?.cnic ?? "—"}</td><td className={valueCell}>{lead.client?.city ?? lead.city ?? "—"}</td><td className={valueCell}>{lead.client?.email ?? "—"}</td></tr></tbody>
          </table>
        </div>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2 md:hidden">
          {[
            ["Name", lead.clientName ?? lead.client?.displayName ?? "—"],
            ["Phone", lead.clientPhone ?? lead.client?.phone ?? "—"],
            ["CNIC", lead.client?.cnic ?? "—"],
            ["City", lead.client?.city ?? lead.city ?? "—"],
            ["Email", lead.client?.email ?? "—"],
          ].map(([label, value]) => <div key={label} className="rounded-md bg-[#f8fbfc] px-3 py-2.5"><dt className="text-[11px] uppercase tracking-wide text-gray-400">{label}</dt><dd className="mt-1 break-words text-sm text-gray-700">{value}</dd></div>)}
        </dl>

        <h2 className="mt-8 text-xl font-normal text-[#ff5c6c] sm:mt-10">Lead Details</h2>
        <div className="my-2 hidden overflow-x-auto rounded border border-gray-100 md:block">
          <table className="w-full min-w-[760px]"><thead><tr className="border-b border-gray-200"><th className={headingCell}>Allocated To</th><th className={headingCell}>Project</th><th className={headingCell}>Area</th><th className={headingCell}>Source</th><th className={headingCell}>Created</th><th className={headingCell}>Updated</th></tr></thead>
            <tbody><tr><td className={valueCell}>{lead.assignments.map(({ profile }) => personLabel(profile)).join(", ") || "—"}</td><td className={valueCell}>{lead.project?.title ?? "—"}</td><td className={valueCell}>{lead.area ? `${lead.area} Marla` : "—"}</td><td className={valueCell}>{lead.source ?? "—"}</td><td className={valueCell}>{lead.createdAt.toLocaleDateString("en-GB")}</td><td className={valueCell}>{lead.updatedAt.toLocaleDateString("en-GB")}</td></tr></tbody>
          </table>
        </div>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2 md:hidden">
          {[
            ["Allocated To", lead.assignments.map(({ profile }) => personLabel(profile)).join(", ") || "—"],
            ["Project", lead.project?.title ?? "—"],
            ["Area", lead.area ? `${lead.area} Marla` : "—"],
            ["Source", lead.source ?? "—"],
            ["Created", lead.createdAt.toLocaleDateString("en-GB")],
            ["Updated", lead.updatedAt.toLocaleDateString("en-GB")],
          ].map(([label, value]) => <div key={label} className="rounded-md bg-[#f8fbfc] px-3 py-2.5"><dt className="text-[11px] uppercase tracking-wide text-gray-400">{label}</dt><dd className="mt-1 break-words text-sm text-gray-700">{value}</dd></div>)}
        </dl>
      </section>

      {canEdit ? (
        <section className="grid gap-4 lg:grid-cols-2">
          <article className="surface-card rounded-lg p-4 sm:p-5"><h2 className="mb-4 text-xl font-normal text-[#ff5c6c]">Update Lead</h2><LeadProgressForm leadId={lead.id} projectId={lead.project?.id} priority={lead.priority} stage={lead.stage} projects={projectOptions} /></article>
          <article className="surface-card rounded-lg p-4 sm:p-5"><h2 className="mb-4 text-xl font-normal text-[#ff5c6c]">Create Follow Up</h2><FollowUpForm leadId={lead.id} stage={lead.stage} /></article>
        </section>
      ) : null}

      {canManage ? <section className="surface-card mt-4 rounded-lg p-4 sm:p-5"><h2 className="mb-4 text-xl font-normal text-[#ff5c6c]">Shift Lead</h2><div className="max-w-md"><AssignmentForm leadId={lead.id} staff={staffOptions} currentProfileId={lead.assignments[0]?.profile.id} /></div></section> : null}

      <section className="surface-card mt-4 rounded-lg p-4 sm:p-5">
        <div className="flex items-center gap-2"><Paperclip className="size-5 text-[#ff5c6c]" /><h2 className="text-xl font-normal text-[#ff5c6c]">Attachments</h2></div>
        {canEdit ? <div className="mt-4 max-w-2xl"><AttachmentUploader leadId={lead.id} /></div> : null}
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {lead.attachments.length === 0 ? <div className="col-span-full rounded-lg border border-dashed border-gray-200 px-4 py-10 text-center text-sm text-gray-400">No attachments uploaded.</div> : lead.attachments.map((attachment) => {
            const deleteAction = deleteLeadAttachmentAction.bind(null, attachment.id);
            return <article key={attachment.id} className="flex min-w-0 items-center gap-3 rounded-lg border border-gray-100 bg-[#f8fbfc] p-3"><span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-white text-[#20aee3] shadow-sm"><FileText className="size-5" /></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-gray-700">{attachment.originalName ?? "Attachment"}</p><p className="mt-1 truncate text-[11px] text-gray-400">{formatAttachmentSize(attachment.sizeBytes)} · {attachment.createdBy ? personLabel(attachment.createdBy) : "System"} · {attachment.createdAt.toLocaleDateString("en-GB")}</p></div><a href={`/api/attachments/${attachment.id}/download`} title="Download attachment" aria-label={`Download ${attachment.originalName ?? "attachment"}`} className="rounded-md p-2 text-[#20aee3] transition hover:bg-sky-50"><Download className="size-4" /></a>{canManage ? <form action={deleteAction}><button title="Delete attachment" aria-label={`Delete ${attachment.originalName ?? "attachment"}`} className="rounded-md p-2 text-rose-500 transition hover:bg-rose-50"><Trash2 className="size-4" /></button></form> : null}</article>;
          })}
        </div>
      </section>

      <section className="surface-card mt-4 rounded-lg p-4 sm:p-5">
        <h2 className="text-xl font-normal text-[#ff5c6c]">Follow Ups</h2>
        <div className="mt-3 hidden overflow-x-auto rounded border border-gray-100 md:block">
          <table className="w-full min-w-[720px]"><thead><tr className="border-b border-gray-200"><th className={headingCell}>Status</th><th className={headingCell}>Next Follow Up</th><th className={headingCell}>Remarks</th><th className={headingCell}>Created By</th><th className={headingCell}>Created</th></tr></thead>
            <tbody>{lead.followUps.length === 0 ? <tr><td colSpan={5} className="px-4 py-12 text-center text-sm text-gray-400">No follow-ups recorded.</td></tr> : lead.followUps.map((followUp) => <tr key={followUp.id} className="border-b border-gray-100"><td className={valueCell}>{stageLabels[followUp.stage]}</td><td className={valueCell}>{followUp.followUpAt?.toLocaleString() ?? "—"}</td><td className={`${valueCell} max-w-sm whitespace-normal`}>{followUp.remarks ?? "—"}</td><td className={valueCell}>{followUp.createdBy ? personLabel(followUp.createdBy) : "System"}</td><td className={valueCell}>{followUp.createdAt.toLocaleString()}</td></tr>)}</tbody>
          </table>
        </div>
        <div className="mt-4 grid gap-3 md:hidden">
          {lead.followUps.length === 0 ? <div className="rounded-lg border border-dashed border-gray-200 px-4 py-10 text-center text-sm text-gray-400">No follow-ups recorded.</div> : lead.followUps.map((followUp) => (
            <article key={followUp.id} className="rounded-lg border border-gray-100 bg-[#f8fbfc] p-4">
              <div className="flex items-center justify-between gap-3"><span className="rounded-full border border-sky-200 bg-white px-2 py-1 text-[10px] font-medium text-sky-600">{stageLabels[followUp.stage]}</span><time className="text-[10px] text-gray-400">{followUp.createdAt.toLocaleDateString("en-GB")}</time></div>
              <p className="mt-3 text-sm leading-6 text-gray-700">{followUp.remarks ?? "No remarks."}</p>
              <div className="mt-3 border-t border-gray-100 pt-3 text-xs text-gray-400"><p>By {followUp.createdBy ? personLabel(followUp.createdBy) : "System"}</p>{followUp.followUpAt ? <p className="mt-1 text-[#20aee3]">Next: {followUp.followUpAt.toLocaleString()}</p> : null}</div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

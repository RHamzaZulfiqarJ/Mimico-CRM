"use client";

import { CheckCircle2, LoaderCircle, NotepadText, UserRound, X } from "lucide-react";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { ModalViewport } from "@/components/ui/modal";
import {
  convertFacebookLeadAction,
  declineFacebookLeadAction,
} from "@/features/facebook/actions";
import {
  initialFacebookLeadFormState,
  type FacebookLeadFormState,
} from "@/features/facebook/schemas";
import {
  leadPriorities,
  leadStages,
  priorityLabels,
  stageLabels,
} from "@/features/leads/schemas";

type ProjectOption = { id: string; title: string };
type ConversionDefaults = {
  clientName: string | null;
  clientPhone: string | null;
  city: string | null;
  area: string | null;
  description: string;
};

const inputClass = "mt-1.5 h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-700 outline-none transition focus:border-[#20aee3] focus:ring-2 focus:ring-sky-100";
const areaClass = "mt-1.5 min-h-24 w-full resize-y rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 outline-none transition focus:border-[#20aee3] focus:ring-2 focus:ring-sky-100";

function Status({ state }: { state: FacebookLeadFormState }) {
  if (!state.message) return null;
  return <p role={state.status === "success" ? "status" : "alert"} className={`rounded-lg border px-3 py-2 text-xs ${state.status === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-rose-200 bg-rose-50 text-rose-600"}`}>{state.message}</p>;
}

function FieldError({ errors }: { errors?: string[] }) {
  return errors?.[0] ? <p className="mt-1 text-xs text-rose-600">{errors[0]}</p> : null;
}

function ConvertSubmit() {
  const status = useFormStatus();
  return <button disabled={status.pending} className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-medium text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-emerald-700 disabled:translate-y-0 disabled:opacity-60 sm:w-auto">{status.pending ? <LoaderCircle className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}{status.pending ? "Claiming…" : "Claim & create lead"}</button>;
}

function DeclineForm({ inboundLeadId }: { inboundLeadId: string }) {
  const action = declineFacebookLeadAction.bind(null, inboundLeadId);
  const [state, formAction] = useActionState(action, initialFacebookLeadFormState);
  return <form action={formAction} className="flex flex-col items-stretch gap-2 sm:items-end"><Status state={state} /><DeclineSubmit disabled={state.status === "success"} /></form>;
}

function DeclineSubmit({ disabled }: { disabled: boolean }) {
  const status = useFormStatus();
  return <button disabled={disabled || status.pending} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-rose-200 bg-white px-4 text-sm font-medium text-rose-600 transition hover:bg-rose-50 disabled:opacity-50">{status.pending ? <LoaderCircle className="size-4 animate-spin" /> : null}{status.pending ? "Declining…" : "Not interested"}</button>;
}

function ConversionForm({
  inboundLeadId,
  defaults,
  projects,
  suggestedProjectId,
}: {
  inboundLeadId: string;
  defaults: ConversionDefaults;
  projects: ProjectOption[];
  suggestedProjectId: string | null;
}) {
  const action = convertFacebookLeadAction.bind(null, inboundLeadId);
  const [state, formAction] = useActionState(action, initialFacebookLeadFormState);
  return (
    <form action={formAction} className="space-y-4">
      <Status state={state} />
      <div className="flex items-center gap-2 border-b border-gray-200 pb-2 text-lg text-gray-600"><UserRound className="size-5" />Client details</div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm text-gray-600">Client name<input name="clientName" required maxLength={160} defaultValue={defaults.clientName ?? ""} className={inputClass} /><FieldError errors={state.errors?.clientName} /></label>
        <label className="text-sm text-gray-600">Client phone<input name="clientPhone" required maxLength={50} defaultValue={defaults.clientPhone ?? ""} className={inputClass} /><FieldError errors={state.errors?.clientPhone} /></label>
      </div>
      <div className="flex items-center gap-2 border-b border-gray-200 pb-2 pt-2 text-lg text-gray-600"><NotepadText className="size-5" />Lead requirements</div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm text-gray-600">Project<select name="projectId" defaultValue={suggestedProjectId ?? ""} className={inputClass}><option value="">Unassigned</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}</select><FieldError errors={state.errors?.projectId} /></label>
        <label className="text-sm text-gray-600">City<input name="city" maxLength={100} defaultValue={defaults.city ?? ""} className={inputClass} /></label>
        <label className="text-sm text-gray-600">Area<input name="area" maxLength={120} defaultValue={defaults.area ?? ""} className={inputClass} /></label>
        <label className="text-sm text-gray-600">Priority<select name="priority" defaultValue="MODERATE" className={inputClass}>{leadPriorities.map((priority) => <option key={priority} value={priority}>{priorityLabels[priority]}</option>)}</select></label>
        <label className="text-sm text-gray-600">Stage<select name="stage" defaultValue="NEW_CLIENT" className={inputClass}>{leadStages.map((stage) => <option key={stage} value={stage}>{stageLabels[stage]}</option>)}</select></label>
        <label className="text-sm text-gray-600">Next follow-up<input name="followUpAt" type="datetime-local" className={inputClass} /><FieldError errors={state.errors?.followUpAt} /></label>
      </div>
      <label className="block text-sm text-gray-600">Facebook answers and notes<textarea name="description" maxLength={2000} defaultValue={defaults.description} className={areaClass} /><FieldError errors={state.errors?.description} /></label>
      <div className="flex justify-end"><ConvertSubmit /></div>
    </form>
  );
}

export function FacebookLeadActions(props: {
  inboundLeadId: string;
  defaults: ConversionDefaults;
  projects: ProjectOption[];
  suggestedProjectId: string | null;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
      <button type="button" onClick={() => setOpen(true)} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-medium text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-emerald-700"><CheckCircle2 className="size-4" />Review & claim</button>
      <DeclineForm inboundLeadId={props.inboundLeadId} />
      <ModalViewport open={open} onClose={() => setOpen(false)} labelledBy={`facebook-convert-${props.inboundLeadId}`} panelClassName="max-w-3xl">
        <div className="flex shrink-0 items-center justify-between border-b border-gray-200 px-4 py-4 sm:px-6"><div><h2 id={`facebook-convert-${props.inboundLeadId}`} className="text-xl text-[#20aee3]">Convert Facebook lead</h2><p className="mt-1 text-xs text-gray-400">The first successful submission claims the lead and creates its CRM record.</p></div><button type="button" onClick={() => setOpen(false)} className="rounded-md p-2 text-gray-500 hover:bg-gray-100" aria-label="Close"><X className="size-5" /></button></div>
        <div className="min-h-0 overflow-y-auto p-4 sm:p-6"><ConversionForm {...props} /></div>
      </ModalViewport>
    </div>
  );
}

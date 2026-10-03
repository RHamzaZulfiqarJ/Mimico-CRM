"use client";

import { LoaderCircle, NotepadText, Plus, UserRound, X } from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

import { ModalViewport } from "@/components/ui/modal";
import {
  assignLeadAction,
  createFollowUpAction,
  createLeadAction,
  updateLeadAction,
} from "@/features/leads/actions";
import {
  initialLeadFormState,
  leadPriorities,
  leadStages,
  priorityLabels,
  stageLabels,
  type LeadFormState,
} from "@/features/leads/schemas";

type Option = { id: string; label: string };

const inputClassName =
  "mt-1.5 h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-700 outline-none transition placeholder:text-gray-400 focus:border-[#20aee3] focus:ring-2 focus:ring-[#20aee3]/15";
const textAreaClassName =
  "mt-1.5 min-h-24 w-full resize-y rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 outline-none transition placeholder:text-gray-400 focus:border-[#20aee3] focus:ring-2 focus:ring-[#20aee3]/15";
const labelClassName = "text-sm font-normal text-gray-600";

function FieldError({ errors }: { errors?: string[] }) {
  return errors?.length ? <p className="mt-1 text-xs text-rose-600">{errors[0]}</p> : null;
}

function FormStatus({ state }: { state: LeadFormState }) {
  if (!state.message) return null;
  return (
    <p
      role={state.status === "success" ? "status" : "alert"}
      className={
        state.status === "success"
          ? "rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700"
          : "rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-600"
      }
    >
      {state.message}
    </p>
  );
}

function SubmitButton({ idle, pending }: { idle: string; pending: string }) {
  const status = useFormStatus();
  return (
    <button
      type="submit"
      disabled={status.pending}
      className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#ff5c6c] px-4 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-red-500 hover:shadow-md disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
    >
      {status.pending ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : null}
      {status.pending ? pending : idle}
    </button>
  );
}

function useResetOnSuccess(state: LeadFormState) {
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
  }, [state]);
  return formRef;
}

function StageSelect({ defaultValue = "NEW_CLIENT" }: { defaultValue?: string }) {
  return (
    <select name="stage" className={inputClassName} defaultValue={defaultValue}>
      {leadStages.map((stage) => <option key={stage} value={stage}>{stageLabels[stage]}</option>)}
    </select>
  );
}

function PrioritySelect({ defaultValue = "MODERATE" }: { defaultValue?: string }) {
  return (
    <select name="priority" className={inputClassName} defaultValue={defaultValue}>
      {leadPriorities.map((priority) => <option key={priority} value={priority}>{priorityLabels[priority]}</option>)}
    </select>
  );
}

export function LeadCreateForm({
  projects,
  staff,
  canChooseAssignee,
}: {
  projects: Option[];
  staff: Option[];
  canChooseAssignee: boolean;
}) {
  const [state, action] = useActionState(createLeadAction, initialLeadFormState);
  const formRef = useResetOnSuccess(state);

  return (
    <form ref={formRef} action={action} className="space-y-4">
      <FormStatus state={state} />
      <div className="flex items-center gap-2 border-b border-gray-200 pb-2 text-xl font-normal text-gray-500"><UserRound className="size-5" />Client Details</div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="lead-client-name" className={labelClassName}>Client name</label>
          <input id="lead-client-name" name="clientName" required maxLength={160} className={inputClassName} placeholder="Client name" />
          <FieldError errors={state.errors?.clientName} />
        </div>
        <div>
          <label htmlFor="lead-client-phone" className={labelClassName}>Client phone</label>
          <input id="lead-client-phone" name="clientPhone" required maxLength={50} className={inputClassName} placeholder="0300 0000000" />
          <FieldError errors={state.errors?.clientPhone} />
        </div>
      </div>
      <div className="flex items-center gap-2 border-b border-gray-200 pb-2 pt-3 text-xl font-normal text-gray-500"><NotepadText className="size-5" />Client Requirements</div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="lead-project" className={labelClassName}>Project</label>
          <select id="lead-project" name="projectId" className={inputClassName} defaultValue="">
            <option value="">Unassigned</option>
            {projects.map((project) => <option key={project.id} value={project.id}>{project.label}</option>)}
          </select>
          <FieldError errors={state.errors?.projectId} />
        </div>
        {canChooseAssignee ? (
          <div>
            <label htmlFor="lead-assignee" className={labelClassName}>Initial assignee</label>
            <select id="lead-assignee" name="assignedProfileId" className={inputClassName} defaultValue="">
              <option value="">Assign to me</option>
              {staff.map((member) => <option key={member.id} value={member.id}>{member.label}</option>)}
            </select>
            <FieldError errors={state.errors?.assignedProfileId} />
          </div>
        ) : null}
        <div>
          <label htmlFor="lead-city" className={labelClassName}>City</label>
          <input id="lead-city" name="city" maxLength={100} className={inputClassName} placeholder="Lahore" />
        </div>
        <div>
          <label htmlFor="lead-area" className={labelClassName}>Area</label>
          <input id="lead-area" name="area" maxLength={120} className={inputClassName} placeholder="Optional" />
        </div>
        <div>
          <label className={labelClassName}>Priority</label>
          <PrioritySelect />
        </div>
        <div>
          <label className={labelClassName}>Stage</label>
          <StageSelect />
        </div>
        <div>
          <label htmlFor="lead-source" className={labelClassName}>Source</label>
          <input id="lead-source" name="source" maxLength={100} className={inputClassName} placeholder="Referral, Facebook, direct call…" />
        </div>
      </div>
      <div>
        <label htmlFor="lead-description" className={labelClassName}>Description</label>
        <textarea id="lead-description" name="description" maxLength={2000} className={textAreaClassName} placeholder="Requirements and first-contact notes" />
      </div>
      <div className="flex items-center gap-2 border-b border-gray-200 pb-2 pt-3 text-xl font-normal text-gray-500"><NotepadText className="size-5" />Follow Up Details</div>
      <div>
        <label htmlFor="lead-follow-up" className={labelClassName}>Next Follow Up Date</label>
        <input id="lead-follow-up" name="followUpAt" type="datetime-local" className={inputClassName} />
        <FieldError errors={state.errors?.followUpAt} />
      </div>
      <div className="flex justify-end"><SubmitButton idle="Create" pending="Creating…" /></div>
    </form>
  );
}

export function LeadCreateDialog(props: {
  projects: Option[];
  staff: Option[];
  canChooseAssignee: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-haspopup="dialog" title="Add new lead" className="group flex size-11 shrink-0 items-center justify-center rounded-full bg-[#ff5c6c] text-white shadow-lg transition-all duration-200 hover:-translate-y-0.5 hover:bg-red-500 hover:shadow-xl"><Plus className="size-6 transition-transform duration-200 group-hover:rotate-90" /><span className="sr-only">Add new lead</span></button>
      <ModalViewport open={open} onClose={() => setOpen(false)} labelledBy="create-lead-title" panelClassName="max-w-3xl">
        <div className="flex shrink-0 items-center justify-between border-b border-gray-200 px-4 py-3 sm:px-6 sm:py-4">
          <div><h2 id="create-lead-title" className="text-xl font-normal text-[#20aee3]">Create Lead</h2><p className="mt-0.5 text-xs text-gray-400">Add the client, requirement, and next follow-up.</p></div>
          <button type="button" onClick={() => setOpen(false)} className="rounded-md p-2 text-gray-500 transition hover:bg-gray-100 hover:text-gray-700" aria-label="Close create lead dialog"><X className="size-5" /></button>
        </div>
        <div className="min-h-0 overflow-y-auto p-4 sm:p-6"><LeadCreateForm {...props} /></div>
        <div className="flex shrink-0 justify-end border-t border-gray-200 bg-slate-50/70 px-4 py-3 sm:px-6"><button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-600 transition hover:bg-gray-50">Cancel</button></div>
      </ModalViewport>
    </>
  );
}

export function LeadProgressForm({
  leadId,
  projectId,
  priority,
  stage,
  projects,
}: {
  leadId: string;
  projectId?: string;
  priority: string;
  stage: string;
  projects: Option[];
}) {
  const action = updateLeadAction.bind(null, leadId);
  const [state, formAction] = useActionState(action, initialLeadFormState);
  return (
    <form action={formAction} className="space-y-4">
      <FormStatus state={state} />
      <div>
        <label className={labelClassName}>Project</label>
        <select name="projectId" className={inputClassName} defaultValue={projectId ?? ""}>
          <option value="">Unassigned</option>
          {projects.map((project) => <option key={project.id} value={project.id}>{project.label}</option>)}
        </select>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div><label className={labelClassName}>Priority</label><PrioritySelect defaultValue={priority} /></div>
        <div><label className={labelClassName}>Stage</label><StageSelect defaultValue={stage} /></div>
      </div>
      <SubmitButton idle="Save progress" pending="Saving…" />
    </form>
  );
}

export function FollowUpForm({ leadId, stage }: { leadId: string; stage: string }) {
  const action = createFollowUpAction.bind(null, leadId);
  const [state, formAction] = useActionState(action, initialLeadFormState);
  const formRef = useResetOnSuccess(state);
  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      <FormStatus state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div><label className={labelClassName}>Stage after contact</label><StageSelect defaultValue={stage} /></div>
        <div>
          <label htmlFor="follow-up-at" className={labelClassName}>Next follow-up</label>
          <input id="follow-up-at" name="followUpAt" type="datetime-local" className={inputClassName} />
          <FieldError errors={state.errors?.followUpAt} />
        </div>
      </div>
      <div>
        <label htmlFor="follow-up-remarks" className={labelClassName}>Remarks</label>
        <textarea id="follow-up-remarks" name="remarks" required maxLength={2000} className={textAreaClassName} placeholder="Outcome, objections, and next step" />
        <FieldError errors={state.errors?.remarks} />
      </div>
      <SubmitButton idle="Add follow-up" pending="Adding…" />
    </form>
  );
}

export function AssignmentForm({ leadId, staff, currentProfileId }: { leadId: string; staff: Option[]; currentProfileId?: string }) {
  const action = assignLeadAction.bind(null, leadId);
  const [state, formAction] = useActionState(action, initialLeadFormState);
  return (
    <form action={formAction} className="space-y-4">
      <FormStatus state={state} />
      <div>
        <label htmlFor="lead-reassign" className={labelClassName}>Owner</label>
        <select id="lead-reassign" name="profileId" required className={inputClassName} defaultValue={currentProfileId ?? ""}>
          <option value="" disabled>Select a team member</option>
          {staff.map((member) => <option key={member.id} value={member.id}>{member.label}</option>)}
        </select>
        <FieldError errors={state.errors?.profileId} />
      </div>
      <SubmitButton idle="Reassign lead" pending="Assigning…" />
    </form>
  );
}

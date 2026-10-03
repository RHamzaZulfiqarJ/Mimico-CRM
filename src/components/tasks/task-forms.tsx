"use client";

import { LoaderCircle, Plus, X } from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

import { ModalViewport } from "@/components/ui/modal";
import { createTaskAction, updateTaskStatusAction } from "@/features/tasks/actions";
import {
  initialTaskFormState,
  taskOutcomeLabels,
  taskOutcomes,
  taskStatusLabels,
  taskStatuses,
  type TaskFormState,
} from "@/features/tasks/schemas";

type Option = { id: string; label: string };

const inputClassName =
  "mt-1.5 h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-700 outline-none transition placeholder:text-gray-400 focus:border-[#20aee3] focus:ring-2 focus:ring-[#20aee3]/15";
const textAreaClassName =
  "mt-1.5 min-h-24 w-full resize-y rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 outline-none transition placeholder:text-gray-400 focus:border-[#20aee3] focus:ring-2 focus:ring-[#20aee3]/15";
const labelClassName = "text-sm font-normal text-gray-600";

function FieldError({ errors }: { errors?: string[] }) {
  return errors?.length ? <p className="mt-1 text-xs text-rose-600">{errors[0]}</p> : null;
}

function FormStatus({ state }: { state: TaskFormState }) {
  if (!state.message) return null;
  return (
    <p
      role={state.status === "success" ? "status" : "alert"}
      className={state.status === "success"
        ? "rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700"
        : "rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-600"}
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
      className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#ff5c6c] px-4 text-sm font-medium text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-red-500 hover:shadow-md disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
    >
      {status.pending ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : null}
      {status.pending ? pending : idle}
    </button>
  );
}

export function TaskCreateForm({ staff, canChooseAssignee }: { staff: Option[]; canChooseAssignee: boolean }) {
  const [state, action] = useActionState(createTaskAction, initialTaskFormState);
  const formRef = useRef<HTMLFormElement>(null);
  const timezoneOffsetRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
  }, [state]);

  useEffect(() => {
    if (timezoneOffsetRef.current) {
      timezoneOffsetRef.current.value = String(new Date().getTimezoneOffset());
    }
  }, []);

  return (
    <form ref={formRef} action={action} className="space-y-4">
      <input ref={timezoneOffsetRef} type="hidden" name="timezoneOffset" defaultValue="0" />
      <FormStatus state={state} />
      <div>
        <label htmlFor="task-title" className={labelClassName}>Task title</label>
        <input id="task-title" name="title" required maxLength={160} className={inputClassName} placeholder="Call the client about the site visit" />
        <FieldError errors={state.errors?.title} />
      </div>
      <div>
        <label htmlFor="task-description" className={labelClassName}>Instructions</label>
        <textarea id="task-description" name="description" maxLength={2000} className={textAreaClassName} placeholder="Add context, expected outcome, or supporting details" />
        <FieldError errors={state.errors?.description} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="task-due-at" className={labelClassName}>Due date and time</label>
          <input id="task-due-at" name="dueAt" type="datetime-local" required className={inputClassName} />
          <FieldError errors={state.errors?.dueAt} />
        </div>
        {canChooseAssignee ? (
          <div>
            <label htmlFor="task-assignee" className={labelClassName}>Assign to</label>
            <select id="task-assignee" name="assignedProfileId" className={inputClassName} defaultValue="">
              <option value="">Assign to me</option>
              {staff.map((member) => <option key={member.id} value={member.id}>{member.label}</option>)}
            </select>
            <FieldError errors={state.errors?.assignedProfileId} />
          </div>
        ) : null}
      </div>
      <div className="flex justify-end"><SubmitButton idle="Create task" pending="Creating…" /></div>
    </form>
  );
}

export function TaskCreateDialog(props: { staff: Option[]; canChooseAssignee: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-haspopup="dialog" className="group inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#ff5c6c] px-4 text-sm font-medium text-white shadow-md transition-all hover:-translate-y-0.5 hover:bg-red-500 hover:shadow-lg">
        <Plus className="size-4 transition-transform group-hover:rotate-90" />New task
      </button>
      <ModalViewport open={open} onClose={() => setOpen(false)} labelledBy="create-task-title" panelClassName="max-w-2xl">
        <div className="flex shrink-0 items-center justify-between border-b border-gray-200 px-4 py-3 sm:px-6 sm:py-4">
          <div><h2 id="create-task-title" className="text-xl font-normal text-[#20aee3]">Create Task</h2><p className="mt-0.5 text-xs text-gray-400">Assign clear work with an accountable due date.</p></div>
          <button type="button" onClick={() => setOpen(false)} className="rounded-md p-2 text-gray-500 transition hover:bg-gray-100" aria-label="Close create task dialog"><X className="size-5" /></button>
        </div>
        <div className="min-h-0 overflow-y-auto p-4 sm:p-6"><TaskCreateForm {...props} /></div>
        <div className="flex shrink-0 justify-end border-t border-gray-200 bg-slate-50/70 px-4 py-3 sm:px-6"><button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-600 transition hover:bg-gray-50">Cancel</button></div>
      </ModalViewport>
    </>
  );
}

export function TaskStatusForm({ taskId, currentStatus, currentOutcome, currentComment }: { taskId: string; currentStatus: string; currentOutcome?: string | null; currentComment?: string | null }) {
  const action = updateTaskStatusAction.bind(null, taskId);
  const [state, formAction] = useActionState(action, initialTaskFormState);
  const [selectedStatus, setSelectedStatus] = useState(currentStatus);

  return (
    <form action={formAction} className="space-y-4">
      <FormStatus state={state} />
      <div>
        <label htmlFor="task-status" className={labelClassName}>Status</label>
        <select id="task-status" name="status" className={inputClassName} value={selectedStatus} onChange={(event) => setSelectedStatus(event.target.value)}>
          {taskStatuses.map((status) => <option key={status} value={status}>{taskStatusLabels[status]}</option>)}
        </select>
        <FieldError errors={state.errors?.status} />
      </div>
      {selectedStatus === "COMPLETED" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="task-outcome" className={labelClassName}>Outcome</label>
            <select id="task-outcome" name="outcome" required className={inputClassName} defaultValue={currentOutcome ?? ""}>
              <option value="" disabled>Choose an outcome</option>
              {taskOutcomes.map((outcome) => <option key={outcome} value={outcome}>{taskOutcomeLabels[outcome]}</option>)}
            </select>
            <FieldError errors={state.errors?.outcome} />
          </div>
        </div>
      ) : <input type="hidden" name="outcome" value="" />}
      <div>
        <label htmlFor="task-outcome-comment" className={labelClassName}>{selectedStatus === "COMPLETED" ? "Completion notes" : "Update notes"}</label>
        <textarea id="task-outcome-comment" name="outcomeComment" maxLength={1000} defaultValue={currentComment ?? ""} className={textAreaClassName} placeholder="Record the outcome or relevant status details" />
        <FieldError errors={state.errors?.outcomeComment} />
      </div>
      <SubmitButton idle="Save status" pending="Saving…" />
    </form>
  );
}

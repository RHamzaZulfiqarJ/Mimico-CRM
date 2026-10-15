"use client";

import { CalendarClock, LoaderCircle, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type DragEvent } from "react";

import { ModalViewport } from "@/components/ui/modal";
import { updateTaskStatusAction } from "@/features/tasks/actions";
import {
  initialTaskFormState,
  taskOutcomeLabels,
  taskOutcomes,
  taskStatusLabels,
  taskStatuses,
} from "@/features/tasks/schemas";

type TaskStatus = (typeof taskStatuses)[number];
type TaskOutcome = (typeof taskOutcomes)[number];

export type KanbanTask = {
  id: string;
  uid: string;
  title: string;
  description: string | null;
  due: string;
  overdue: boolean;
  status: TaskStatus;
  outcome: TaskOutcome | null;
  assignee: string;
  creator: string;
  canUpdate: boolean;
};

const columnColors: Record<TaskStatus, string> = {
  TODO: "border-t-slate-400",
  IN_PROGRESS: "border-t-sky-400",
  COMPLETED: "border-t-emerald-500",
  CANCELLED: "border-t-rose-400",
};

export function TaskKanban({ tasks }: { tasks: KanbanTask[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(tasks);
  const [message, setMessage] = useState("");
  const [completionTaskId, setCompletionTaskId] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<TaskOutcome | "">("");
  const [pending, startTransition] = useTransition();

  const completionTask = rows.find((task) => task.id === completionTaskId) ?? null;

  function persistMove(taskId: string, destination: TaskStatus, completionOutcome?: TaskOutcome) {
    if (pending) return;
    const current = rows.find((task) => task.id === taskId);
    if (!current || (current.status === destination && current.outcome === (completionOutcome ?? current.outcome))) return;

    const previous = { status: current.status, outcome: current.outcome };
    setMessage("");
    setRows((items) => items.map((task) => task.id === taskId
      ? { ...task, status: destination, outcome: destination === "COMPLETED" ? (completionOutcome ?? null) : null }
      : task));
    setCompletionTaskId(null);
    setOutcome("");

    startTransition(async () => {
      const formData = new FormData();
      formData.set("status", destination);
      formData.set("outcome", completionOutcome ?? "");
      formData.set("outcomeComment", "");

      try {
        const result = await updateTaskStatusAction(taskId, initialTaskFormState, formData);
        if (result.status !== "success") {
          setRows((items) => items.map((task) => task.id === taskId ? { ...task, ...previous } : task));
          setMessage(result.message ?? result.errors?.outcome?.[0] ?? "The task status could not be changed.");
        } else {
          router.refresh();
        }
      } catch {
        setRows((items) => items.map((task) => task.id === taskId ? { ...task, ...previous } : task));
        setMessage("The task status could not be changed. Please try again.");
      }
    });
  }

  function requestMove(taskId: string, destination: TaskStatus) {
    const current = rows.find((task) => task.id === taskId);
    if (!current || !current.canUpdate || current.status === destination || pending) return;
    if (destination === "COMPLETED") {
      setCompletionTaskId(taskId);
      setOutcome("");
      return;
    }
    persistMove(taskId, destination);
  }

  function startDrag(event: DragEvent<HTMLElement>, taskId: string) {
    if (pending) return;
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", taskId);
  }

  function drop(event: DragEvent<HTMLElement>, status: TaskStatus) {
    event.preventDefault();
    const taskId = event.dataTransfer.getData("text/plain");
    if (taskId) requestMove(taskId, status);
  }

  return (
    <section aria-label="Task Kanban board" className="min-w-0">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
        <p>{rows.length} {rows.length === 1 ? "task" : "tasks"} in this view · Drag a card to another status, or use its status selector.</p>
        {pending ? <p role="status" className="inline-flex items-center gap-1.5"><LoaderCircle className="size-3.5 animate-spin" />Saving status…</p> : null}
      </div>
      {message ? <p role="alert" className="mb-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">{message}</p> : null}
      <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-4" aria-busy={pending}>
        {taskStatuses.map((status) => {
          const columnTasks = rows.filter((task) => task.status === status);
          return (
            <section
              key={status}
              aria-label={`${taskStatusLabels[status]} tasks`}
              className={`min-h-[26rem] w-[min(86vw,19rem)] shrink-0 snap-start rounded-lg border border-gray-200 border-t-2 bg-[#ebf2f5] p-2.5 sm:w-[19rem] ${columnColors[status]}`}
              onDragOver={(event) => { if (!pending) event.preventDefault(); }}
              onDrop={(event) => drop(event, status)}
            >
              <header className="flex items-center justify-between gap-2 px-1 pb-3">
                <h2 className="text-sm font-medium text-gray-700">{taskStatusLabels[status]}</h2>
                <span className="rounded-full bg-white px-2 py-0.5 text-xs text-gray-500" aria-label={`${columnTasks.length} tasks in this column`}>{columnTasks.length}</span>
              </header>
              <div className="space-y-2">
                {columnTasks.length === 0 ? <p className="rounded-md border border-dashed border-gray-300 px-3 py-8 text-center text-xs text-gray-400">No tasks in this status</p> : null}
                {columnTasks.map((task) => (
                  <article key={task.id} draggable={task.canUpdate && !pending} onDragStart={(event) => startDrag(event, task.id)} className="rounded-md border border-gray-100 bg-white p-3 shadow-sm transition hover:border-sky-200 hover:shadow-md">
                    <div className="flex items-start justify-between gap-2">
                      <Link href={`/tasks/${task.id}`} className="min-w-0 text-sm font-medium text-[#20aee3] hover:underline">{task.title}</Link>
                      <span className="shrink-0 text-[10px] text-gray-400">{task.uid}</span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-gray-500">{task.description ?? "No instructions"}</p>
                    <dl className="mt-3 space-y-1.5 text-xs">
                      <div className="flex justify-between gap-2"><dt className="text-gray-400">Assignee</dt><dd className="truncate text-gray-700">{task.assignee}</dd></div>
                      <div className="flex justify-between gap-2"><dt className="text-gray-400">Created by</dt><dd className="truncate text-gray-700">{task.creator}</dd></div>
                      <div className="flex justify-between gap-2"><dt className="inline-flex items-center gap-1 text-gray-400"><CalendarClock className="size-3.5" />Due</dt><dd className={task.overdue ? "font-medium text-[#ff5c6c]" : "text-gray-700"}>{task.due}</dd></div>
                      {task.outcome ? <div className="flex justify-between gap-2"><dt className="text-gray-400">Outcome</dt><dd className="font-medium text-emerald-600">{taskOutcomeLabels[task.outcome]}</dd></div> : null}
                    </dl>
                    {task.canUpdate ? <label className="mt-3 block border-t border-gray-100 pt-2 text-xs text-gray-500">
                      Move to status
                      <select aria-label={`Move ${task.title} to status`} value={task.status} disabled={pending} onChange={(event) => requestMove(task.id, event.target.value as TaskStatus)} className="mt-1 w-full rounded-md border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-700">
                        {taskStatuses.map((option) => <option key={option} value={option}>{taskStatusLabels[option]}</option>)}
                      </select>
                    </label> : <p className="mt-3 border-t border-gray-100 pt-2 text-xs text-gray-400">Assigned team member updates this task</p>}
                  </article>
                ))}
              </div>
            </section>
          );
        })}
      </div>

      <ModalViewport open={Boolean(completionTask)} onClose={() => { if (!pending) setCompletionTaskId(null); }} labelledBy="complete-task-title" panelClassName="max-w-md">
        <div className="flex items-start justify-between gap-4 border-b border-gray-200 px-4 py-4 sm:px-6">
          <div><h2 id="complete-task-title" className="text-lg font-medium text-gray-700">Complete task</h2><p className="mt-1 text-xs text-gray-500">Choose the recorded outcome for {completionTask?.title ?? "this task"}.</p></div>
          <button type="button" disabled={pending} onClick={() => setCompletionTaskId(null)} className="rounded-md p-2 text-gray-500 transition hover:bg-gray-100" aria-label="Close completion dialog"><X className="size-5" /></button>
        </div>
        <form onSubmit={(event) => { event.preventDefault(); if (completionTask && outcome) persistMove(completionTask.id, "COMPLETED", outcome); }} className="space-y-4 p-4 sm:p-6">
          <fieldset>
            <legend className="text-sm text-gray-600">Completion outcome</legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {taskOutcomes.map((option) => (
                <label key={option} className={`cursor-pointer rounded-lg border p-3 text-sm transition ${outcome === option ? "border-[#20aee3] bg-sky-50 text-sky-700 ring-1 ring-sky-200" : "border-gray-200 bg-white text-gray-600 hover:border-sky-200"}`}>
                  <input type="radio" name="completionOutcome" value={option} checked={outcome === option} onChange={() => setOutcome(option)} className="mr-2 accent-[#20aee3]" />
                  {taskOutcomeLabels[option]}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="flex justify-end gap-2 border-t border-gray-100 pt-4">
            <button type="button" disabled={pending} onClick={() => setCompletionTaskId(null)} className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-600 transition hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={!outcome || pending} className="inline-flex items-center gap-2 rounded-lg bg-[#20aee3] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#179bd0] disabled:cursor-not-allowed disabled:opacity-50">{pending ? <LoaderCircle className="size-4 animate-spin" /> : null}Complete task</button>
          </div>
        </form>
      </ModalViewport>
    </section>
  );
}

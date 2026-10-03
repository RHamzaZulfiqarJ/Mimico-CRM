import { CalendarClock, CheckCircle2, UserRound } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { TaskStatusForm } from "@/components/tasks/task-forms";
import { getTaskDetails } from "@/features/tasks/queries";
import { taskOutcomeLabels, taskStatusLabels } from "@/features/tasks/schemas";
import { canUpdateTask } from "@/lib/auth/authorization";

export const metadata: Metadata = { title: "Task details" };

function personLabel(person: { firstName: string | null; lastName: string | null; username: string | null; email: string | null }) {
  return [person.firstName, person.lastName].filter(Boolean).join(" ") || person.username || person.email || "Team member";
}

export default async function TaskDetailsPage({ params }: { params: Promise<{ taskId: string }> }) {
  const { taskId } = await params;
  const data = await getTaskDetails(taskId);
  if (!data) redirect("/dashboard");
  if (!data.task) notFound();

  const task = data.task;
  const canUpdate = canUpdateTask({
    role: data.auth.membership.role,
    isAssigned: task.assignedTo.id === data.auth.profile.id,
    isCreator: task.createdBy?.id === data.auth.profile.id,
  });
  return (
    <div className="mx-auto w-full max-w-5xl">
      <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-xs text-gray-500 sm:text-sm"><Link href="/dashboard" className="hover:text-[#20aee3]">Dashboard</Link><span aria-hidden>›</span><Link href="/tasks" className="hover:text-[#20aee3]">Tasks</Link><span aria-hidden>›</span><span aria-current="page">{task.uid ?? "Details"}</span></nav>
      <div className="mt-2"><h1 className="text-[28px] font-light text-[#20aee3] sm:text-[32px]">Task Details</h1><span className="mt-2 inline-flex rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-600">{taskStatusLabels[task.status]}</span></div>

      <section className="surface-card mt-5 rounded-lg p-5 sm:p-6">
        <h2 className="text-xl font-normal text-[#ff5c6c]">{task.title}</h2>
        <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-gray-600">{task.description ?? "No additional instructions were provided."}</p>
        <dl className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-lg bg-[#f8fbfc] p-4"><dt className="flex items-center gap-2 text-xs text-gray-400"><UserRound className="size-4" />Assigned to</dt><dd className="mt-2 text-sm font-medium text-gray-700">{personLabel(task.assignedTo)}</dd></div>
          <div className="rounded-lg bg-[#f8fbfc] p-4"><dt className="flex items-center gap-2 text-xs text-gray-400"><CalendarClock className="size-4" />Due</dt><dd className="mt-2 text-sm font-medium text-gray-700">{task.dueAt?.toLocaleString() ?? "No due date"}</dd></div>
          <div className="rounded-lg bg-[#f8fbfc] p-4"><dt className="flex items-center gap-2 text-xs text-gray-400"><CheckCircle2 className="size-4" />Outcome</dt><dd className="mt-2 text-sm font-medium text-gray-700">{task.outcome ? taskOutcomeLabels[task.outcome] : "Not completed"}</dd></div>
        </dl>
        <p className="mt-4 text-xs text-gray-400">Created by {task.createdBy ? personLabel(task.createdBy) : "System"} on {task.createdAt.toLocaleString()}</p>
      </section>

      {canUpdate ? <section className="surface-card mt-4 rounded-lg p-5 sm:p-6">
        <h2 className="text-xl font-normal text-[#ff5c6c]">Update Status</h2>
        <p className="mb-5 mt-1 text-xs text-gray-400">Status changes notify the task creator and are recorded in the audit log.</p>
        <TaskStatusForm taskId={task.id} currentStatus={task.status} currentOutcome={task.outcome} currentComment={task.outcomeComment} />
      </section> : <p className="mt-4 rounded-lg border border-sky-100 bg-sky-50 px-4 py-3 text-sm text-sky-700">Only the assigned team member or a manager can update this task.</p>}
    </div>
  );
}

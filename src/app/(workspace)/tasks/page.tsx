import { CheckCircle2, ChevronRight, CircleAlert, Clock3, Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { TaskCreateDialog } from "@/components/tasks/task-forms";
import { getTaskWorkspace } from "@/features/tasks/queries";
import { taskStatusLabels, taskStatuses } from "@/features/tasks/schemas";
import { canManageOrganization } from "@/lib/auth/authorization";

export const metadata: Metadata = { title: "Tasks" };

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function personLabel(person: { firstName: string | null; lastName: string | null; username: string | null; email: string | null }) {
  return [person.firstName, person.lastName].filter(Boolean).join(" ") || person.username || person.email || "Team member";
}

const statusClass = {
  TODO: "border-slate-300 bg-slate-50 text-slate-600",
  IN_PROGRESS: "border-sky-200 bg-sky-50 text-sky-600",
  COMPLETED: "border-emerald-200 bg-emerald-50 text-emerald-700",
  CANCELLED: "border-rose-200 bg-rose-50 text-rose-600",
} as const;

export default async function TasksPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const raw = await searchParams;
  const data = await getTaskWorkspace({
    query: first(raw.query),
    status: first(raw.status),
    assignedProfileId: first(raw.assignedProfileId),
  });
  if (!data) redirect("/dashboard");

  const canManage = canManageOrganization(data.auth.membership.role);
  const staff = data.staff.map((profile) => ({ id: profile.id, label: personLabel(profile) }));
  const now = new Date();

  return (
    <div className="mx-auto w-full max-w-[1500px]">
      <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-xs text-gray-500 sm:text-sm"><Link href="/dashboard" className="transition hover:text-[#20aee3]">Dashboard</Link><span aria-hidden>›</span><span aria-current="page">To Do Tasks</span></nav>
      <div className="mt-2 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div><h1 className="text-[28px] font-light text-[#20aee3] sm:text-[32px]">To Do Tasks</h1><p className="mt-1 max-w-2xl text-sm text-gray-500">Plan, assign, and complete daily work without leaving the CRM.</p></div>
        <TaskCreateDialog staff={staff} canChooseAssignee={canManage} />
      </div>

      <section className="mt-6 grid gap-4 sm:grid-cols-3" aria-label="Task totals">
        {[
          { label: "Active tasks", value: data.counts.active, icon: Clock3, color: "text-[#20aee3]" },
          { label: "Overdue", value: data.counts.overdue, icon: CircleAlert, color: "text-[#ff5c6c]" },
          { label: "Completed", value: data.counts.completed, icon: CheckCircle2, color: "text-emerald-600" },
        ].map((item) => {
          const Icon = item.icon;
          return <article key={item.label} className="surface-card surface-card-interactive flex items-center gap-4 rounded-lg p-5"><span className={`flex size-11 items-center justify-center rounded-lg bg-[#ebf2f5] ${item.color}`}><Icon className="size-5" /></span><div><p className="text-2xl font-medium text-gray-700">{item.value}</p><p className="text-xs text-gray-500">{item.label}</p></div></article>;
        })}
      </section>

      <section className="surface-card mt-6 rounded-lg p-3 sm:p-5">
        <form action="/tasks" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(220px,1fr)_180px_220px_auto]">
          <label className="relative"><span className="sr-only">Search tasks</span><Search className="pointer-events-none absolute left-3 top-3 size-4 text-gray-400" /><input name="query" defaultValue={data.filters.query} placeholder="Search tasks" className="h-10 w-full rounded-md border border-gray-200 bg-[#f8fbfc] pl-9 pr-3 text-sm outline-none transition focus:border-[#20aee3] focus:bg-white focus:ring-2 focus:ring-sky-100" /></label>
          <select name="status" aria-label="Filter by status" defaultValue={data.filters.status ?? ""} className="h-10 rounded-md border border-gray-200 bg-white px-3 text-sm text-gray-600"><option value="">All statuses</option>{taskStatuses.map((status) => <option key={status} value={status}>{taskStatusLabels[status]}</option>)}</select>
          {canManage ? <select name="assignedProfileId" aria-label="Filter by assignee" defaultValue={data.filters.assignedProfileId ?? ""} className="h-10 rounded-md border border-gray-200 bg-white px-3 text-sm text-gray-600"><option value="">All team members</option>{staff.map((member) => <option key={member.id} value={member.id}>{member.label}</option>)}</select> : <div className="hidden lg:block" />}
          <div className="flex gap-2"><button className="h-10 flex-1 rounded-md bg-[#20aee3] px-4 text-sm font-medium text-white transition hover:bg-[#179bd0]">Apply</button><Link href="/tasks" className="inline-flex h-10 items-center justify-center rounded-md border border-gray-200 px-4 text-sm text-gray-600 transition hover:bg-gray-50">Clear</Link></div>
        </form>
      </section>

      <section className="surface-card mt-4 overflow-hidden rounded-lg p-3 sm:p-[15px]">
        <div className="hidden overflow-x-auto lg:block">
          <table className="w-full min-w-[900px] border-collapse text-left text-sm font-light text-gray-700">
            <thead><tr className="border-b border-gray-200 text-[#20aee3]"><th className="px-3 py-4 font-medium">ID</th><th className="px-3 py-4 font-medium">Task</th><th className="px-3 py-4 font-medium">Assignee</th><th className="px-3 py-4 font-medium">Due</th><th className="px-3 py-4 font-medium">Status</th><th className="px-3 py-4 font-medium">Created by</th><th className="px-3 py-4 font-medium">Action</th></tr></thead>
            <tbody>{data.tasks.length === 0 ? <tr><td colSpan={7} className="px-3 py-16 text-center text-gray-400">No tasks match this view.</td></tr> : data.tasks.map((task) => {
              const overdue = Boolean(task.dueAt && task.dueAt < now && task.status !== "COMPLETED" && task.status !== "CANCELLED");
              return <tr key={task.id} className="border-b border-gray-100 transition-colors hover:bg-[#f4fafc]"><td className="px-3 py-4">{task.uid ?? task.id.slice(0, 8)}</td><td className="max-w-xs px-3 py-4"><Link href={`/tasks/${task.id}`} className="font-medium text-[#20aee3] hover:text-sky-700">{task.title}</Link><p className="mt-1 truncate text-xs text-gray-400">{task.description ?? "No instructions"}</p></td><td className="px-3 py-4">{personLabel(task.assignedTo)}</td><td className={`px-3 py-4 ${overdue ? "font-medium text-[#ff5c6c]" : ""}`}>{task.dueAt?.toLocaleString() ?? "—"}</td><td className="px-3 py-4"><span className={`inline-flex rounded-full border px-2 py-1 text-xs font-medium ${statusClass[task.status]}`}>{taskStatusLabels[task.status]}</span></td><td className="px-3 py-4">{task.createdBy ? personLabel(task.createdBy) : "System"}</td><td className="px-3 py-4"><Link href={`/tasks/${task.id}`} className="text-[#20aee3] hover:text-sky-700">View</Link></td></tr>;
            })}</tbody>
          </table>
        </div>
        <div className="grid gap-3 lg:hidden">{data.tasks.length === 0 ? <div className="rounded-lg border border-dashed border-gray-200 px-4 py-14 text-center text-sm text-gray-400">No tasks match this view.</div> : data.tasks.map((task) => {
          const overdue = Boolean(task.dueAt && task.dueAt < now && task.status !== "COMPLETED" && task.status !== "CANCELLED");
          return <article key={task.id} className="rounded-lg border border-gray-100 bg-[#fbfdfe] p-4 transition hover:border-sky-200 hover:shadow-sm"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-medium text-gray-700">{task.title}</p><p className="mt-1 text-xs text-gray-400">{task.uid ?? task.id.slice(0, 8)}</p></div><span className={`shrink-0 rounded-full border px-2 py-1 text-[10px] font-medium ${statusClass[task.status]}`}>{taskStatusLabels[task.status]}</span></div><dl className="mt-4 grid grid-cols-2 gap-3 text-xs"><div><dt className="text-gray-400">Assignee</dt><dd className="mt-1 truncate text-gray-700">{personLabel(task.assignedTo)}</dd></div><div><dt className="text-gray-400">Due</dt><dd className={`mt-1 ${overdue ? "font-medium text-[#ff5c6c]" : "text-gray-700"}`}>{task.dueAt?.toLocaleString() ?? "—"}</dd></div></dl><Link href={`/tasks/${task.id}`} className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3 text-sm font-medium text-[#20aee3]">View task<ChevronRight className="size-4" /></Link></article>;
        })}</div>
        <div className="flex justify-end border-t border-gray-100 px-1 pt-4 text-xs text-gray-500">{data.tasks.length ? `1–${data.tasks.length}` : "0"} of {data.counts.total}</div>
      </section>
    </div>
  );
}

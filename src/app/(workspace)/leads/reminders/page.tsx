import {
  AlertTriangle,
  BellRing,
  CalendarClock,
  ChevronRight,
  Clock3,
  Search,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { displayLeadUid } from "@/features/leads/identifiers";
import { getLeadReminderWorkspace } from "@/features/leads/reminder-queries";
import {
  pakistanDateKey,
  reminderTiming,
} from "@/features/leads/reminder-policy";
import { stageLabels } from "@/features/leads/schemas";

export const metadata: Metadata = { title: "Call reminders" };

const pakistanDateFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Karachi",
  weekday: "long",
  day: "2-digit",
  month: "long",
  year: "numeric",
});

const pakistanDateTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Karachi",
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
});

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function personLabel(person: {
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  email: string | null;
}) {
  return (
    [person.firstName, person.lastName].filter(Boolean).join(" ") ||
    person.username ||
    person.email ||
    "Team member"
  );
}

function whatsappNumber(phone: string | null) {
  if (!phone) return "";
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.startsWith("00")) return cleaned.slice(2);
  if (cleaned.startsWith("0")) return `92${cleaned.slice(1)}`;
  return cleaned;
}

const timingStyles = {
  overdue: "border-rose-200 bg-rose-50 text-rose-700",
  today: "border-amber-200 bg-amber-50 text-amber-700",
  upcoming: "border-sky-200 bg-sky-50 text-sky-700",
} as const;

const viewOptions = [
  { value: "due", label: "Due now" },
  { value: "today", label: "Today" },
  { value: "upcoming", label: "Upcoming" },
  { value: "month", label: "This month" },
  { value: "all", label: "All scheduled" },
] as const;

export default async function LeadRemindersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const data = await getLeadReminderWorkspace({
    query: first(raw.query),
    view: first(raw.view),
    page: first(raw.page),
  });
  if (!data) redirect("/leads");

  const groups = new Map<string, typeof data.reminders>();
  for (const reminder of data.reminders) {
    const key = pakistanDateKey(reminder.followUpAt);
    groups.set(key, [...(groups.get(key) ?? []), reminder]);
  }

  const pageHref = (page: number) => {
    const query: Record<string, string> = { view: data.filters.view };
    if (data.filters.query) query.query = data.filters.query;
    if (page > 1) query.page = String(page);
    return { pathname: "/leads/reminders" as const, query };
  };
  const totalDue = data.summary.overdue + data.summary.today;

  return (
    <div className="mx-auto w-full max-w-[1500px] font-sans">
      <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-xs text-[#67757c] sm:text-sm">
        <Link href="/dashboard" className="transition hover:text-[#20aee3]">Dashboard</Link>
        <span aria-hidden>›</span>
        <Link href="/leads" className="transition hover:text-[#20aee3]">Leads</Link>
        <span aria-hidden>›</span>
        <span aria-current="page">Call reminders</span>
      </nav>

      <div className="mt-2 flex flex-col justify-between gap-4 pb-5 lg:flex-row lg:items-end lg:pb-7">
        <div className="flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-xl bg-sky-50 text-[#20aee3]"><BellRing className="size-5" /></span>
          <div>
            <h1 className="text-[28px] font-light text-[#20aee3] sm:text-[32px]">Call reminders</h1>
            <p className="mt-1 text-xs text-gray-400">The latest scheduled follow-up for each active lead.</p>
          </div>
        </div>
        <Link href="/leads" className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-gray-200 bg-white px-4 text-sm text-gray-600 transition hover:border-sky-200 hover:text-[#20aee3]">Back to leads<ChevronRight className="size-4" /></Link>
      </div>

      <section className="mb-4 grid gap-3 sm:grid-cols-3">
        <Link href="/leads/reminders?view=due" className="surface-card surface-card-interactive flex items-center justify-between rounded-lg p-4">
          <div><p className="text-xs uppercase tracking-wide text-gray-400">Due now</p><p className="mt-1 text-2xl font-light text-gray-700">{totalDue}</p></div>
          <span className="flex size-10 items-center justify-center rounded-lg bg-rose-50 text-rose-500"><AlertTriangle className="size-5" /></span>
        </Link>
        <Link href="/leads/reminders?view=today" className="surface-card surface-card-interactive flex items-center justify-between rounded-lg p-4">
          <div><p className="text-xs uppercase tracking-wide text-gray-400">Today</p><p className="mt-1 text-2xl font-light text-gray-700">{data.summary.today}</p></div>
          <span className="flex size-10 items-center justify-center rounded-lg bg-amber-50 text-amber-500"><Clock3 className="size-5" /></span>
        </Link>
        <Link href="/leads/reminders?view=upcoming" className="surface-card surface-card-interactive flex items-center justify-between rounded-lg p-4">
          <div><p className="text-xs uppercase tracking-wide text-gray-400">Upcoming</p><p className="mt-1 text-2xl font-light text-gray-700">{data.summary.upcoming}</p></div>
          <span className="flex size-10 items-center justify-center rounded-lg bg-sky-50 text-[#20aee3]"><CalendarClock className="size-5" /></span>
        </Link>
      </section>

      <section className="surface-card mb-4 rounded-lg p-3 sm:p-4">
        <form action="/leads/reminders" className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_200px_auto]">
          <label className="relative">
            <span className="sr-only">Search reminders</span>
            <Search className="pointer-events-none absolute left-3 top-3 size-4 text-gray-400" />
            <input name="query" defaultValue={data.filters.query} placeholder="Lead ID, client, phone, project or staff…" className="h-10 w-full rounded-md border border-gray-200 bg-[#f8fbfc] pl-9 pr-3 text-sm text-gray-700 outline-none transition focus:border-[#20aee3] focus:bg-white" />
          </label>
          <select name="view" aria-label="Reminder period" defaultValue={data.filters.view} className="h-10 rounded-md border border-gray-200 bg-white px-3 text-sm text-gray-600">
            {viewOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <div className="flex gap-2">
            <button className="h-10 flex-1 rounded-md bg-[#20aee3] px-4 text-sm font-medium text-white transition hover:bg-[#179bd0]">Apply</button>
            <Link href="/leads/reminders" className="inline-flex h-10 items-center rounded-md border border-gray-200 bg-white px-4 text-sm text-gray-600 transition hover:bg-gray-50">Clear</Link>
          </div>
        </form>
      </section>

      {data.reminders.length === 0 ? (
        <section className="surface-card rounded-lg px-4 py-16 text-center">
          <BellRing className="mx-auto size-9 text-gray-300" />
          <h2 className="mt-3 text-base font-medium text-gray-600">No reminders in this view</h2>
          <p className="mt-1 text-sm text-gray-400">Schedule the next follow-up from a lead’s detail page.</p>
        </section>
      ) : (
        <div className="grid gap-4">
          {[...groups.entries()].map(([dateKey, reminders]) => (
            <section key={dateKey} className="surface-card overflow-hidden rounded-lg">
              <header className="flex items-center justify-between border-b border-gray-100 bg-[#f8fbfc] px-4 py-3 sm:px-5">
                <h2 className="text-sm font-medium text-gray-700">{pakistanDateFormatter.format(reminders[0].followUpAt)}</h2>
                <span className="text-xs text-gray-400">{reminders.length} {reminders.length === 1 ? "call" : "calls"}</span>
              </header>
              <div className="hidden overflow-x-auto lg:block">
                <table className="w-full min-w-[1100px] border-collapse text-left text-sm text-gray-700">
                  <thead><tr className="border-b border-gray-100 text-xs uppercase tracking-wide text-gray-400"><th className="px-4 py-3 font-medium">Lead</th><th className="px-4 py-3 font-medium">Client</th><th className="px-4 py-3 font-medium">Phone</th><th className="px-4 py-3 font-medium">Staff</th><th className="px-4 py-3 font-medium">Project / city</th><th className="px-4 py-3 font-medium">Status</th><th className="px-4 py-3 font-medium">Reminder</th><th className="px-4 py-3 font-medium">Remarks</th><th className="px-4 py-3 font-medium">Action</th></tr></thead>
                  <tbody>
                    {reminders.map((reminder) => {
                      const timing = reminderTiming(reminder.followUpAt);
                      return <tr key={reminder.id} className="border-b border-gray-100 transition-colors last:border-0 hover:bg-[#f4fafc]"><td className="px-4 py-4 font-medium text-gray-600">{displayLeadUid(reminder.leadUid, reminder.leadId)}</td><td className="px-4 py-4 capitalize">{reminder.clientName ?? "—"}</td><td className="px-4 py-4">{reminder.clientPhone ? <a href={`https://wa.me/${whatsappNumber(reminder.clientPhone)}`} target="_blank" rel="noreferrer" className="transition hover:text-[#20aee3]">{reminder.clientPhone}</a> : "—"}</td><td className="px-4 py-4 capitalize">{reminder.assignments.map(personLabel).join(", ") || "Unassigned"}</td><td className="px-4 py-4"><p className="capitalize">{reminder.projectTitle ?? "—"}</p><p className="mt-1 text-xs text-gray-400">{reminder.city ?? "No city"}</p></td><td className="px-4 py-4">{stageLabels[reminder.stage]}</td><td className="px-4 py-4"><span className={`inline-flex rounded-full border px-2 py-1 text-xs font-medium capitalize ${timingStyles[timing]}`}>{timing}</span><p className="mt-1.5 whitespace-nowrap text-xs text-gray-500">{pakistanDateTimeFormatter.format(reminder.followUpAt)}</p></td><td className="max-w-[260px] px-4 py-4"><p className="line-clamp-2 text-sm text-gray-500">{reminder.remarks ?? "—"}</p></td><td className="px-4 py-4"><Link href={`/leads/${reminder.leadId}`} className="font-medium text-[#20aee3] transition hover:text-[#007bff]">Open</Link></td></tr>;
                    })}
                  </tbody>
                </table>
              </div>
              <div className="divide-y divide-gray-100 lg:hidden">
                {reminders.map((reminder) => {
                  const timing = reminderTiming(reminder.followUpAt);
                  return <article key={reminder.id} className="p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate font-medium capitalize text-gray-700">{reminder.clientName ?? "Unnamed lead"}</p><p className="mt-1 text-xs text-gray-400">{displayLeadUid(reminder.leadUid, reminder.leadId)} · {reminder.clientPhone ?? "No phone"}</p></div><span className={`shrink-0 rounded-full border px-2 py-1 text-[10px] font-medium capitalize ${timingStyles[timing]}`}>{timing}</span></div><dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-xs"><div><dt className="text-gray-400">Reminder</dt><dd className="mt-1 text-gray-700">{pakistanDateTimeFormatter.format(reminder.followUpAt)}</dd></div><div><dt className="text-gray-400">Status</dt><dd className="mt-1 text-gray-700">{stageLabels[reminder.stage]}</dd></div><div><dt className="text-gray-400">Staff</dt><dd className="mt-1 truncate capitalize text-gray-700">{reminder.assignments.map(personLabel).join(", ") || "Unassigned"}</dd></div><div><dt className="text-gray-400">Project</dt><dd className="mt-1 truncate capitalize text-gray-700">{reminder.projectTitle ?? "—"}</dd></div></dl>{reminder.remarks ? <p className="mt-3 line-clamp-2 text-xs leading-5 text-gray-500">{reminder.remarks}</p> : null}<Link href={`/leads/${reminder.leadId}`} className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3 text-sm font-medium text-[#20aee3]">Open lead<ChevronRight className="size-4" /></Link></article>;
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      <div className="mt-4 flex items-center justify-end gap-2 text-xs text-gray-500">
        {data.pagination.hasPrevious ? <Link href={pageHref(data.pagination.page - 1)} className="rounded-md border border-gray-200 bg-white px-3 py-2 transition hover:border-sky-200 hover:text-[#20aee3]">Previous</Link> : <span className="rounded-md border border-gray-100 px-3 py-2 text-gray-300">Previous</span>}
        <span>Page {data.pagination.page}</span>
        {data.pagination.hasNext ? <Link href={pageHref(data.pagination.page + 1)} className="rounded-md border border-gray-200 bg-white px-3 py-2 transition hover:border-sky-200 hover:text-[#20aee3]">Next</Link> : <span className="rounded-md border border-gray-100 px-3 py-2 text-gray-300">Next</span>}
      </div>
    </div>
  );
}

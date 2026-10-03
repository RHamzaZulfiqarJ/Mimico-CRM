import { CalendarDays, Clock3, Search, Trash2, UserRound } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { CalendarEventDialog } from "@/components/calendar/calendar-form";
import { deleteCalendarEventAction } from "@/features/calendar/actions";
import { getCalendarWorkspace } from "@/features/calendar/queries";

export const metadata: Metadata = { title: "Calendar" };

function first(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] : value; }
function personLabel(person: { firstName: string | null; lastName: string | null; username: string | null; email: string | null }) { return [person.firstName, person.lastName].filter(Boolean).join(" ") || person.username || person.email || "Team member"; }

export default async function CalendarPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const raw = await searchParams;
  const data = await getCalendarWorkspace({ query: first(raw.query), view: first(raw.view) });
  if (!data) redirect("/dashboard");

  return <div className="mx-auto w-full max-w-6xl">
    <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-xs text-gray-500 sm:text-sm"><Link href="/dashboard" className="hover:text-[#20aee3]">Dashboard</Link><span>›</span><span>Calendar</span></nav>
    <div className="mt-2 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><h1 className="text-[28px] font-light text-[#20aee3] sm:text-[32px]">Calendar</h1><p className="mt-1 text-sm text-gray-500">Keep meetings, visits, and follow-ups organized in one responsive agenda.</p></div><CalendarEventDialog /></div>

    <section className="surface-card mt-6 rounded-lg p-3 sm:p-5"><form action="/calendar" className="grid gap-3 sm:grid-cols-[1fr_170px_auto]"><label className="relative"><span className="sr-only">Search events</span><Search className="absolute left-3 top-3 size-4 text-gray-400" /><input name="query" defaultValue={data.filters.query} placeholder="Search events" className="h-10 w-full rounded-md border border-gray-200 bg-[#f8fbfc] pl-9 pr-3 text-sm outline-none focus:border-[#20aee3]" /></label><select name="view" defaultValue={data.filters.view} className="h-10 rounded-md border border-gray-200 bg-white px-3 text-sm text-gray-600"><option value="upcoming">Upcoming</option><option value="past">Past</option><option value="all">All events</option></select><div className="flex gap-2"><button className="h-10 flex-1 rounded-md bg-[#20aee3] px-4 text-sm font-medium text-white hover:bg-[#179bd0]">Apply</button><Link href="/calendar" className="inline-flex h-10 items-center rounded-md border border-gray-200 px-4 text-sm text-gray-600 hover:bg-gray-50">Clear</Link></div></form></section>

    <section className="mt-4 grid gap-3">
      {data.events.length === 0 ? <div className="surface-card rounded-lg px-5 py-16 text-center"><CalendarDays className="mx-auto size-9 text-gray-300" /><p className="mt-3 text-sm text-gray-400">No events match this view.</p></div> : data.events.map((event) => {
        const remove = deleteCalendarEventAction.bind(null, event.id);
        const canDelete = data.canManage || event.ownerProfileId === data.auth.profile.id;
        return <article key={event.id} className="surface-card surface-card-interactive rounded-lg p-4 sm:p-5"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start"><div className="flex min-w-0 gap-3"><span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-[#20aee3]"><CalendarDays className="size-5" /></span><div className="min-w-0"><h2 className="font-medium text-gray-700">{event.title}</h2><p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-gray-500">{event.description ?? "No additional details."}</p><div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-gray-500"><span className="inline-flex items-center gap-1.5"><Clock3 className="size-3.5 text-[#20aee3]" />{event.startsAt.toLocaleString()} – {event.endsAt.toLocaleString()}</span>{data.canManage ? <span className="inline-flex items-center gap-1.5"><UserRound className="size-3.5" />{personLabel(event.owner)}</span> : null}</div></div></div>{canDelete ? <details className="shrink-0"><summary className="cursor-pointer list-none rounded-md border border-gray-200 p-2 text-gray-400 transition hover:border-rose-200 hover:text-rose-500" aria-label="Delete event"><Trash2 className="size-4" /></summary><form action={remove} className="mt-2 rounded-lg border border-rose-100 bg-rose-50 p-3 text-xs text-rose-700"><p>Delete this event permanently?</p><button className="mt-2 rounded bg-[#ff5c6c] px-3 py-1.5 font-medium text-white">Confirm delete</button></form></details> : null}</div></article>;
      })}
    </section>
  </div>;
}

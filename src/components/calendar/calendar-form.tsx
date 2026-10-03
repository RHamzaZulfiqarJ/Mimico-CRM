"use client";

import { LoaderCircle, Plus, X } from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

import { ModalViewport } from "@/components/ui/modal";
import { createCalendarEventAction } from "@/features/calendar/actions";
import { initialCalendarFormState } from "@/features/calendar/schemas";

const inputClass = "mt-1.5 h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-700 outline-none transition focus:border-[#20aee3] focus:ring-2 focus:ring-[#20aee3]/15";

function Submit() {
  const { pending } = useFormStatus();
  return <button disabled={pending} className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#ff5c6c] px-4 text-sm font-medium text-white transition hover:-translate-y-0.5 hover:bg-red-500 disabled:opacity-60 sm:w-auto">{pending ? <LoaderCircle className="size-4 animate-spin" /> : null}{pending ? "Creating…" : "Create event"}</button>;
}

function CalendarEventForm() {
  const [state, action] = useActionState(createCalendarEventAction, initialCalendarFormState);
  const formRef = useRef<HTMLFormElement>(null);
  const offsetRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (offsetRef.current) offsetRef.current.value = String(new Date().getTimezoneOffset()); }, []);
  useEffect(() => { if (state.status === "success") formRef.current?.reset(); }, [state]);
  const error = (field: string) => state.errors?.[field]?.[0];

  return <form ref={formRef} action={action} className="space-y-4">
    <input ref={offsetRef} type="hidden" name="timezoneOffset" defaultValue="0" />
    {state.message ? <p role={state.status === "success" ? "status" : "alert"} className={`rounded-lg border px-3 py-2 text-xs ${state.status === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-rose-200 bg-rose-50 text-rose-600"}`}>{state.message}</p> : null}
    <label className="block text-sm text-gray-600">Event title<input name="title" required maxLength={160} placeholder="Client meeting" className={inputClass} />{error("title") ? <span className="mt-1 block text-xs text-rose-600">{error("title")}</span> : null}</label>
    <label className="block text-sm text-gray-600">Description<textarea name="description" maxLength={2000} placeholder="Location, purpose, or preparation notes" className="mt-1.5 min-h-24 w-full resize-y rounded-md border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-[#20aee3] focus:ring-2 focus:ring-sky-100" /></label>
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="block text-sm text-gray-600">Starts<input name="startsAt" type="datetime-local" required className={inputClass} />{error("startsAt") ? <span className="mt-1 block text-xs text-rose-600">{error("startsAt")}</span> : null}</label>
      <label className="block text-sm text-gray-600">Ends<input name="endsAt" type="datetime-local" required className={inputClass} />{error("endsAt") ? <span className="mt-1 block text-xs text-rose-600">{error("endsAt")}</span> : null}</label>
    </div>
    <div className="flex justify-end"><Submit /></div>
  </form>;
}

export function CalendarEventDialog() {
  const [open, setOpen] = useState(false);
  return <>
    <button type="button" onClick={() => setOpen(true)} className="group inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#ff5c6c] px-4 text-sm font-medium text-white shadow-md transition hover:-translate-y-0.5 hover:bg-red-500"><Plus className="size-4 transition-transform group-hover:rotate-90" />New event</button>
    <ModalViewport open={open} onClose={() => setOpen(false)} labelledBy="calendar-dialog-title" panelClassName="max-w-2xl">
      <div className="flex shrink-0 items-center justify-between border-b border-gray-200 px-4 py-4 sm:px-6"><div><h2 id="calendar-dialog-title" className="text-xl text-[#20aee3]">Create Event</h2><p className="mt-1 text-xs text-gray-400">Times are saved using your browser timezone.</p></div><button type="button" onClick={() => setOpen(false)} aria-label="Close" className="rounded-md p-2 text-gray-500 hover:bg-gray-100"><X className="size-5" /></button></div>
      <div className="min-h-0 overflow-y-auto p-4 sm:p-6"><CalendarEventForm /></div>
    </ModalViewport>
  </>;
}

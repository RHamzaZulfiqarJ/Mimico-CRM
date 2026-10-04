"use client";

import { Download, FileSpreadsheet, LoaderCircle, Upload, X } from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

import { ModalViewport } from "@/components/ui/modal";
import { initialLeadImportState } from "@/features/leads/csv-import";
import { importLeadsAction } from "@/features/leads/import-actions";

function ImportSubmit() {
  const { pending } = useFormStatus();
  return <button disabled={pending} className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#ff5c6c] px-4 text-sm font-medium text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-red-500 disabled:translate-y-0 disabled:opacity-60 sm:w-auto">{pending ? <LoaderCircle className="size-4 animate-spin" /> : <Upload className="size-4" />}{pending ? "Validating and importing…" : "Validate & import"}</button>;
}

export function LeadImportDialog({ buttonClassName }: { buttonClassName: string }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(importLeadsAction, initialLeadImportState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
  }, [state]);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-label="Import leads from CSV" title="Import leads from CSV" className={buttonClassName}><Upload className="size-5" /></button>
      <ModalViewport open={open} onClose={() => setOpen(false)} labelledBy="lead-import-title" panelClassName="max-w-3xl">
        <div className="flex shrink-0 items-center justify-between border-b border-gray-200 px-4 py-4 sm:px-6"><div><h2 id="lead-import-title" className="text-xl text-[#20aee3]">Import leads from CSV</h2><p className="mt-1 text-xs text-gray-400">The whole file is validated before any lead is created.</p></div><button type="button" onClick={() => setOpen(false)} className="rounded-md p-2 text-gray-500 transition hover:bg-gray-100" aria-label="Close"><X className="size-5" /></button></div>
        <div className="min-h-0 overflow-y-auto p-4 sm:p-6">
          <div className="mb-5 grid gap-3 rounded-lg border border-sky-100 bg-sky-50/60 p-4 text-xs leading-5 text-slate-600 sm:grid-cols-[1fr_auto] sm:items-center"><div><p className="font-medium text-slate-700">CSV format</p><p>Required: <code>client_name</code>, <code>client_phone</code>. Optional columns support project title/UID, priority, stage, source, follow-up time, and assignee email.</p></div><a href="/lead-import-template.csv" download className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-sky-200 bg-white px-3 font-medium text-[#20aee3] transition hover:bg-sky-50"><Download className="size-4" />Download template</a></div>

          <form ref={formRef} action={action} className="space-y-4">
            {state.message ? <p role={state.status === "success" ? "status" : "alert"} className={`rounded-lg border px-3 py-2 text-sm ${state.status === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-rose-200 bg-rose-50 text-rose-600"}`}>{state.message}</p> : null}
            <label className="group flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 bg-slate-50/60 px-4 text-center transition hover:border-sky-300 hover:bg-sky-50/50"><FileSpreadsheet className="size-9 text-[#20aee3]" /><span className="mt-3 text-sm font-medium text-gray-700">Choose a CSV file</span><span className="mt-1 text-xs text-gray-400">Maximum 1,000 rows and 750 KB</span><input name="file" type="file" accept=".csv,text/csv" required className="mt-4 block max-w-full text-xs text-gray-500 file:mr-3 file:rounded-md file:border-0 file:bg-white file:px-3 file:py-2 file:text-xs file:font-medium file:text-[#20aee3] file:shadow-sm" /></label>
            <div className="rounded-lg border border-gray-100 bg-white px-3 py-2 text-xs leading-5 text-gray-500"><p><strong>Priority:</strong> Very Cold, Cold, Moderate, Hot, Very Hot.</p><p><strong>Stage:</strong> New Client, Follow Up, Contacted Client, Call Not Attend, Visit Scheduled, Visit Done, Closed Won, Closed Lost.</p><p><strong>Dates:</strong> Use an ISO value such as <code>2026-10-10T14:30:00+05:00</code>.</p></div>

            {state.errors?.length ? <div className="overflow-hidden rounded-lg border border-rose-100"><div className="flex items-center justify-between bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700"><span>Import report</span><span>{state.errorCount ?? state.errors.length} issue{(state.errorCount ?? state.errors.length) === 1 ? "" : "s"}</span></div><div className="max-h-64 overflow-auto"><table className="w-full min-w-[520px] text-left text-xs"><thead className="sticky top-0 bg-white text-gray-400"><tr><th className="px-3 py-2 font-medium">Row</th><th className="px-3 py-2 font-medium">Column</th><th className="px-3 py-2 font-medium">Issue</th></tr></thead><tbody>{state.errors.map((error, index) => <tr key={`${error.row}-${error.field}-${index}`} className="border-t border-gray-100"><td className="px-3 py-2 text-gray-600">{error.row}</td><td className="px-3 py-2 font-mono text-gray-500">{error.field}</td><td className="px-3 py-2 text-rose-600">{error.message}</td></tr>)}</tbody></table></div>{state.errorCount && state.errorCount > state.errors.length ? <p className="border-t border-rose-100 px-3 py-2 text-xs text-rose-500">Showing the first {state.errors.length} issues.</p> : null}</div> : null}
            <div className="flex justify-end"><ImportSubmit /></div>
          </form>
        </div>
      </ModalViewport>
    </>
  );
}

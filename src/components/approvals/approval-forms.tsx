"use client";

import { LoaderCircle, Plus, X } from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

import { ModalViewport } from "@/components/ui/modal";
import { createApprovalAction, decideApprovalAction } from "@/features/approvals/actions";
import { initialApprovalFormState, type ApprovalFormState } from "@/features/approvals/schemas";

const inputClass = "mt-1.5 h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-700 outline-none transition focus:border-[#20aee3] focus:ring-2 focus:ring-sky-100";
const areaClass = "mt-1.5 min-h-28 w-full resize-y rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 outline-none transition focus:border-[#20aee3] focus:ring-2 focus:ring-sky-100";

function Status({ state }: { state: ApprovalFormState }) {
  return state.message ? <p role={state.status === "success" ? "status" : "alert"} className={`rounded-lg border px-3 py-2 text-xs ${state.status === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-rose-200 bg-rose-50 text-rose-600"}`}>{state.message}</p> : null;
}

function Submit({ idle, pending, tone = "red" }: { idle: string; pending: string; tone?: "red" | "green" }) {
  const state = useFormStatus();
  return <button disabled={state.pending} className={`inline-flex h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium text-white transition hover:-translate-y-0.5 disabled:opacity-60 ${tone === "green" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-[#ff5c6c] hover:bg-red-500"}`}>{state.pending ? <LoaderCircle className="size-4 animate-spin" /> : null}{state.pending ? pending : idle}</button>;
}

function DecisionButtons() {
  const state = useFormStatus();
  return <div className="flex flex-wrap gap-2"><button disabled={state.pending} name="status" value="ACCEPTED" className="inline-flex h-10 items-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-medium text-white transition hover:-translate-y-0.5 hover:bg-emerald-700 disabled:opacity-60">{state.pending ? <LoaderCircle className="size-4 animate-spin" /> : null}Approve request</button><button disabled={state.pending} name="status" value="REJECTED" className="inline-flex h-10 items-center rounded-lg bg-[#ff5c6c] px-4 text-sm font-medium text-white transition hover:-translate-y-0.5 hover:bg-red-500 disabled:opacity-60">Reject request</button></div>;
}

function RequestForm() {
  const [state, action] = useActionState(createApprovalAction, initialApprovalFormState);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state.status === "success") formRef.current?.reset(); }, [state]);
  return <form ref={formRef} action={action} className="space-y-4"><Status state={state} /><label className="block text-sm text-gray-600">Request title<input name="title" required maxLength={160} className={inputClass} placeholder="Approve the client site visit" />{state.errors?.title?.[0] ? <span className="mt-1 block text-xs text-rose-600">{state.errors.title[0]}</span> : null}</label><label className="block text-sm text-gray-600">Reason and details<textarea name="description" required maxLength={3000} className={areaClass} placeholder="Explain what is being requested and why it is needed." />{state.errors?.description?.[0] ? <span className="mt-1 block text-xs text-rose-600">{state.errors.description[0]}</span> : null}</label><div className="flex justify-end"><Submit idle="Submit request" pending="Submitting…" /></div></form>;
}

export function ApprovalRequestDialog() {
  const [open, setOpen] = useState(false);
  return <><button type="button" onClick={() => setOpen(true)} className="group inline-flex h-10 items-center gap-2 rounded-lg bg-[#ff5c6c] px-4 text-sm font-medium text-white shadow-md transition hover:-translate-y-0.5 hover:bg-red-500"><Plus className="size-4 transition-transform group-hover:rotate-90" />New request</button><ModalViewport open={open} onClose={() => setOpen(false)} labelledBy="approval-dialog-title" panelClassName="max-w-2xl"><div className="flex shrink-0 items-center justify-between border-b border-gray-200 px-4 py-4 sm:px-6"><div><h2 id="approval-dialog-title" className="text-xl text-[#20aee3]">Approval Request</h2><p className="mt-1 text-xs text-gray-400">Managers are notified as soon as you submit.</p></div><button type="button" onClick={() => setOpen(false)} className="rounded-md p-2 text-gray-500 hover:bg-gray-100" aria-label="Close"><X className="size-5" /></button></div><div className="min-h-0 overflow-y-auto p-4 sm:p-6"><RequestForm /></div></ModalViewport></>;
}

export function ApprovalDecisionForm({ approvalId }: { approvalId: string }) {
  const action = decideApprovalAction.bind(null, approvalId);
  const [state, formAction] = useActionState(action, initialApprovalFormState);
  return <form action={formAction} className="space-y-4"><Status state={state} /><label className="block text-sm text-gray-600">Decision note <span className="text-gray-400">(optional)</span><textarea name="note" maxLength={1000} className={areaClass} placeholder="Add context for the requester." /></label><DecisionButtons /></form>;
}

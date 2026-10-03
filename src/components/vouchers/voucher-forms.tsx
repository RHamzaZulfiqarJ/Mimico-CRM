"use client";

import { LoaderCircle, Plus, Trash2, X } from "lucide-react";
import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";

import { ModalViewport } from "@/components/ui/modal";
import { createVoucherAction, deleteVoucherAction } from "@/features/vouchers/actions";
import {
  initialVoucherFormState,
  voucherPaymentTypeLabels,
  voucherPaymentTypes,
  voucherPropertyTypeLabels,
  voucherPropertyTypes,
  type VoucherFormState,
} from "@/features/vouchers/schemas";

type Option = { id: string; label: string };
const inputClass = "mt-1.5 h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-700 outline-none transition focus:border-[#20aee3] focus:ring-2 focus:ring-sky-100";
const labelClass = "text-sm text-gray-600";

function ErrorText({ errors }: { errors?: string[] }) {
  return errors?.[0] ? <p className="mt-1 text-xs text-rose-600">{errors[0]}</p> : null;
}

function FormStatus({ state }: { state: VoucherFormState }) {
  return state.message ? (
    <p role={state.status === "success" ? "status" : "alert"} className={`rounded-lg border px-3 py-2 text-xs ${state.status === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-rose-200 bg-rose-50 text-rose-600"}`}>
      {state.message}
    </p>
  ) : null;
}

function SubmitButton() {
  const state = useFormStatus();
  return (
    <button disabled={state.pending} className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#ff5c6c] px-4 text-sm font-medium text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-red-500 disabled:opacity-60">
      {state.pending ? <LoaderCircle className="size-4 animate-spin" /> : null}
      {state.pending ? "Submitting…" : "Create voucher"}
    </button>
  );
}

function VoucherForm({
  staff,
  projects,
  canChooseStaff,
  issueDate,
  onSuccess,
}: {
  staff: Option[];
  projects: Option[];
  canChooseStaff: boolean;
  issueDate: string;
  onSuccess: () => void;
}) {
  const [state, action] = useActionState(createVoucherAction, initialVoucherFormState);
  const [paymentType, setPaymentType] = useState<(typeof voucherPaymentTypes)[number]>("cash");
  const [total, setTotal] = useState("");
  const [paid, setPaid] = useState("");
  useEffect(() => {
    if (state.status === "success") onSuccess();
  }, [onSuccess, state.status]);
  const numericTotal = Number(total);
  const numericPaid = Number(paid);
  const remaining = total && paid && Number.isFinite(numericTotal - numericPaid)
    ? Math.max(0, numericTotal - numericPaid).toFixed(2)
    : "Calculated automatically";

  return (
    <form action={action} className="space-y-5">
      <FormStatus state={state} />
      <fieldset className="space-y-4">
        <legend className="mb-3 text-base font-medium text-[#20aee3]">Voucher details</legend>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <label className={labelClass}>Issue date<input name="issuingDate" type="date" required defaultValue={issueDate} className={inputClass} /><ErrorText errors={state.errors?.issuingDate} /></label>
          <label className={labelClass}>Due date<input name="dueDate" type="date" required min={issueDate} defaultValue={issueDate} className={inputClass} /><ErrorText errors={state.errors?.dueDate} /></label>
          <label className={labelClass}>Branch<input name="branch" required maxLength={120} className={inputClass} /><ErrorText errors={state.errors?.branch} /></label>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={labelClass}>Customer name<input name="clientName" required maxLength={160} className={inputClass} /><ErrorText errors={state.errors?.clientName} /></label>
          <label className={labelClass}>Project<select name="projectId" required defaultValue="" className={inputClass}><option value="" disabled>Select project</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.label}</option>)}</select><ErrorText errors={state.errors?.projectId} /></label>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <label className={labelClass}>CNIC <span className="text-gray-400">(optional)</span><input name="cnic" maxLength={20} className={inputClass} placeholder="35202-1234567-1" /><ErrorText errors={state.errors?.cnic} /></label>
          <label className={labelClass}>Phone<input name="phone" type="tel" required maxLength={30} className={inputClass} /><ErrorText errors={state.errors?.phone} /></label>
          <label className={labelClass}>Email <span className="text-gray-400">(optional)</span><input name="email" type="email" maxLength={254} className={inputClass} /><ErrorText errors={state.errors?.email} /></label>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {canChooseStaff ? <label className={labelClass}>Allocated to<select name="allocatedToProfileId" defaultValue="" className={inputClass}><option value="">Assign to me</option>{staff.map((member) => <option key={member.id} value={member.id}>{member.label}</option>)}</select><ErrorText errors={state.errors?.allocatedToProfileId} /></label> : <input type="hidden" name="allocatedToProfileId" value="" />}
          <label className={labelClass}>Property type<select name="propertyType" defaultValue="residential" className={inputClass}>{voucherPropertyTypes.map((type) => <option key={type} value={type}>{voucherPropertyTypeLabels[type]}</option>)}</select><ErrorText errors={state.errors?.propertyType} /></label>
          <label className={labelClass}>Area<input name="area" required maxLength={100} className={inputClass} placeholder="5 Marla" /><ErrorText errors={state.errors?.area} /></label>
        </div>
      </fieldset>

      <fieldset className="space-y-4 border-t border-gray-100 pt-4">
        <legend className="pr-3 text-base font-medium text-[#20aee3]">Payment details</legend>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <label className={labelClass}>Payment type<select name="paymentType" value={paymentType} onChange={(event) => setPaymentType(event.target.value as (typeof voucherPaymentTypes)[number])} className={inputClass}>{voucherPaymentTypes.map((type) => <option key={type} value={type}>{voucherPaymentTypeLabels[type]}</option>)}</select><ErrorText errors={state.errors?.paymentType} /></label>
          {paymentType === "cheque" ? <label className={labelClass}>Cheque number<input name="cheque" required maxLength={100} className={inputClass} /><ErrorText errors={state.errors?.cheque} /></label> : <input type="hidden" name="cheque" value="" />}
          <label className={labelClass}>Total amount<input name="total" type="number" min="0.01" step="0.01" required value={total} onChange={(event) => setTotal(event.target.value)} className={inputClass} /><ErrorText errors={state.errors?.total} /></label>
          <label className={labelClass}>Amount paying<input name="paid" type="number" min="0" step="0.01" required value={paid} onChange={(event) => setPaid(event.target.value)} className={inputClass} /><ErrorText errors={state.errors?.paid} /></label>
          <label className={labelClass}>Remaining<output className="mt-1.5 flex h-10 items-center rounded-md border border-sky-100 bg-sky-50 px-3 text-sm font-medium text-[#20aee3]">{remaining}</output></label>
        </div>
        <label className={`${labelClass} block`}>Note <span className="text-gray-400">(optional)</span><textarea name="note" maxLength={1000} rows={3} className={`${inputClass} h-auto min-h-24 py-2`} /><ErrorText errors={state.errors?.note} /></label>
      </fieldset>
      <div className="flex justify-end"><SubmitButton /></div>
    </form>
  );
}

export function VoucherCreateDialog({ staff, projects, canChooseStaff, issueDate }: { staff: Option[]; projects: Option[]; canChooseStaff: boolean; issueDate: string }) {
  const [open, setOpen] = useState(false);
  return <><button type="button" onClick={() => setOpen(true)} className="group inline-flex h-10 items-center gap-2 rounded-lg bg-[#ff5c6c] px-4 text-sm font-medium text-white shadow-md transition hover:-translate-y-0.5 hover:bg-red-500"><Plus className="size-4 transition-transform group-hover:rotate-90" />New voucher</button><ModalViewport open={open} onClose={() => setOpen(false)} label="Add new voucher" panelClassName="max-w-5xl"><div className="flex shrink-0 items-center justify-between border-b border-gray-200 px-4 py-4 sm:px-6"><div><h2 className="text-xl text-[#20aee3]">Add New Voucher</h2><p className="mt-1 text-xs text-gray-400">The voucher will be submitted for manager approval.</p></div><button type="button" onClick={() => setOpen(false)} className="rounded-md p-2 text-gray-500 hover:bg-gray-100" aria-label="Close voucher dialog"><X className="size-5" /></button></div><div className="min-h-0 overflow-y-auto p-4 sm:p-6"><VoucherForm staff={staff} projects={projects} canChooseStaff={canChooseStaff} issueDate={issueDate} onSuccess={() => setOpen(false)} /></div></ModalViewport></>;
}

export function DeleteVoucherButton({ voucherId }: { voucherId: string }) {
  const [state, action] = useActionState(deleteVoucherAction.bind(null, voucherId), initialVoucherFormState);
  return <form action={action} onSubmit={(event) => { if (!window.confirm("Delete this voucher permanently? This action is audited.")) event.preventDefault(); }} className="inline-flex">{state.status === "error" && state.message ? <span role="alert" className="sr-only">{state.message}</span> : null}<button className="rounded-md p-2 text-rose-500 transition hover:bg-rose-50" title="Delete voucher" aria-label="Delete voucher"><Trash2 className="size-4" /></button></form>;
}

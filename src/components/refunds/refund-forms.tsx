"use client";

import { CircleDollarSign, LoaderCircle, X } from "lucide-react";
import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";

import { ModalViewport } from "@/components/ui/modal";
import { createRefundAction } from "@/features/refunds/actions";
import {
  initialRefundFormState,
  type RefundFormState,
} from "@/features/refunds/schemas";

const inputClass =
  "mt-1.5 h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-700 outline-none transition focus:border-[#20aee3] focus:ring-2 focus:ring-sky-100";
const areaClass = `${inputClass} h-auto min-h-28 resize-y py-2`;
const labelClass = "text-sm text-gray-600";

function ErrorText({ errors }: { errors?: string[] }) {
  return errors?.[0] ? <p className="mt-1 text-xs text-rose-600">{errors[0]}</p> : null;
}

function FormStatus({ state }: { state: RefundFormState }) {
  return state.message ? (
    <p
      role={state.status === "success" ? "status" : "alert"}
      className={`rounded-lg border px-3 py-2 text-xs ${
        state.status === "success"
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-rose-200 bg-rose-50 text-rose-600"
      }`}
    >
      {state.message}
    </p>
  ) : null;
}

function SubmitButton() {
  const state = useFormStatus();
  return (
    <button
      disabled={state.pending}
      className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#ff5c6c] px-4 text-sm font-medium text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-red-500 disabled:opacity-60"
    >
      {state.pending ? <LoaderCircle className="size-4 animate-spin" /> : null}
      {state.pending ? "Submitting…" : "Submit refund"}
    </button>
  );
}

function RefundForm({
  lead,
  onSuccess,
}: {
  lead: {
    id: string;
    clientName: string;
    phone: string;
    cnic: string;
  };
  onSuccess: () => void;
}) {
  const [state, action] = useActionState(createRefundAction, initialRefundFormState);
  useEffect(() => {
    if (state.status === "success") onSuccess();
  }, [onSuccess, state.status]);

  return (
    <form action={action} className="space-y-5">
      <FormStatus state={state} />
      <input type="hidden" name="leadId" value={lead.id} />
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={labelClass}>
          Branch
          <input name="branch" required maxLength={120} className={inputClass} />
          <ErrorText errors={state.errors?.branch} />
        </label>
        <label className={labelClass}>
          Refund amount
          <input
            name="amount"
            type="number"
            min="0.01"
            step="0.01"
            required
            className={inputClass}
          />
          <ErrorText errors={state.errors?.amount} />
        </label>
        <label className={labelClass}>
          Customer name
          <input
            name="clientName"
            required
            maxLength={160}
            defaultValue={lead.clientName}
            className={inputClass}
          />
          <ErrorText errors={state.errors?.clientName} />
        </label>
        <label className={labelClass}>
          Phone
          <input
            name="phone"
            type="tel"
            required
            maxLength={30}
            defaultValue={lead.phone}
            className={inputClass}
          />
          <ErrorText errors={state.errors?.phone} />
        </label>
        <label className={labelClass}>
          CNIC <span className="text-gray-400">(optional)</span>
          <input
            name="cnic"
            maxLength={20}
            defaultValue={lead.cnic}
            className={inputClass}
          />
          <ErrorText errors={state.errors?.cnic} />
        </label>
      </div>
      <label className={`${labelClass} block`}>
        Reason
        <textarea
          name="reason"
          required
          minLength={5}
          maxLength={2000}
          className={areaClass}
          placeholder="Explain why the refund is required."
        />
        <ErrorText errors={state.errors?.reason} />
      </label>
      <p className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-700">
        A manager must approve this request. Approval automatically records the amount as cash out.
      </p>
      <div className="flex justify-end">
        <SubmitButton />
      </div>
    </form>
  );
}

export function RefundCreateDialog({
  lead,
  pending,
}: {
  lead: {
    id: string;
    clientName: string;
    phone: string;
    cnic: string;
  };
  pending: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        disabled={pending}
        onClick={() => setOpen(true)}
        className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#ff5c6c] px-4 text-sm font-medium text-white shadow-md transition hover:-translate-y-0.5 hover:bg-red-500 disabled:translate-y-0 disabled:cursor-not-allowed disabled:bg-amber-100 disabled:text-amber-700 disabled:shadow-none"
      >
        <CircleDollarSign className="size-4" />
        {pending ? "Refund awaiting decision" : "Apply for refund"}
      </button>
      <ModalViewport
        open={open}
        onClose={() => setOpen(false)}
        labelledBy="refund-dialog-title"
        panelClassName="max-w-3xl"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-gray-200 px-4 py-4 sm:px-6">
          <div>
            <h2 id="refund-dialog-title" className="text-xl text-[#20aee3]">
              Apply For Refund
            </h2>
            <p className="mt-1 text-xs text-gray-400">
              Submit the amount and supporting reason for manager approval.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-md p-2 text-gray-500 hover:bg-gray-100"
            aria-label="Close refund dialog"
          >
            <X className="size-5" />
          </button>
        </div>
        <div className="min-h-0 overflow-y-auto p-4 sm:p-6">
          <RefundForm lead={lead} onSuccess={() => setOpen(false)} />
        </div>
      </ModalViewport>
    </>
  );
}

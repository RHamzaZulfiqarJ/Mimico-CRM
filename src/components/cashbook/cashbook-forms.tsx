"use client";

import { LoaderCircle, Plus, Trash2, X } from "lucide-react";
import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";

import { ModalViewport } from "@/components/ui/modal";
import {
  createCashbookEntryAction,
  deleteCashbookEntryAction,
} from "@/features/cashbook/actions";
import {
  cashDirectionLabels,
  cashDirections,
  cashPaymentTypeLabels,
  cashPaymentTypes,
  initialCashbookFormState,
  type CashbookFormState,
} from "@/features/cashbook/schemas";

type Option = { id: string; label: string };

const inputClassName =
  "mt-1.5 h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-700 outline-none transition placeholder:text-gray-400 focus:border-[#20aee3] focus:ring-2 focus:ring-[#20aee3]/15";
const labelClassName = "text-sm font-normal text-gray-600";

function FieldError({ errors }: { errors?: string[] }) {
  return errors?.length ? (
    <p className="mt-1 text-xs text-rose-600">{errors[0]}</p>
  ) : null;
}

function FormStatus({ state }: { state: CashbookFormState }) {
  if (!state.message) return null;
  return (
    <p
      role={state.status === "success" ? "status" : "alert"}
      className={
        state.status === "success"
          ? "rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700"
          : "rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-600"
      }
    >
      {state.message}
    </p>
  );
}

function SubmitButton() {
  const status = useFormStatus();
  return (
    <button
      type="submit"
      disabled={status.pending}
      className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#ff5c6c] px-4 text-sm font-medium text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-red-500 hover:shadow-md disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {status.pending ? <LoaderCircle className="size-4 animate-spin" /> : null}
      {status.pending ? "Saving…" : "Create entry"}
    </button>
  );
}

function CashbookForm({
  staff,
  projects,
  canChooseStaff,
  onSuccess,
}: {
  staff: Option[];
  projects: Option[];
  canChooseStaff: boolean;
  onSuccess: () => void;
}) {
  const [state, formAction] = useActionState(
    createCashbookEntryAction,
    initialCashbookFormState,
  );
  const [paymentType, setPaymentType] = useState<(typeof cashPaymentTypes)[number]>(
    "cash",
  );

  useEffect(() => {
    if (state.status === "success") onSuccess();
  }, [onSuccess, state.status]);

  return (
    <form action={formAction} className="space-y-4">
      <FormStatus state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="cashbook-client" className={labelClassName}>
            Customer name
          </label>
          <input
            id="cashbook-client"
            name="clientName"
            required
            maxLength={160}
            className={inputClassName}
          />
          <FieldError errors={state.errors?.clientName} />
        </div>
        <div>
          <label htmlFor="cashbook-project" className={labelClassName}>
            Project
          </label>
          <select
            id="cashbook-project"
            name="projectId"
            required
            defaultValue=""
            className={inputClassName}
          >
            <option value="" disabled>
              Select project
            </option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.label}
              </option>
            ))}
          </select>
          <FieldError errors={state.errors?.projectId} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {canChooseStaff ? (
          <div>
            <label htmlFor="cashbook-staff" className={labelClassName}>
              Staff
            </label>
            <select
              id="cashbook-staff"
              name="staffProfileId"
              defaultValue=""
              className={inputClassName}
            >
              <option value="">Assign to me</option>
              {staff.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.label}
                </option>
              ))}
            </select>
            <FieldError errors={state.errors?.staffProfileId} />
          </div>
        ) : (
          <input type="hidden" name="staffProfileId" value="" />
        )}
        <div>
          <label htmlFor="cashbook-branch" className={labelClassName}>
            Branch
          </label>
          <input
            id="cashbook-branch"
            name="branch"
            required
            maxLength={120}
            className={inputClassName}
          />
          <FieldError errors={state.errors?.branch} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="cashbook-payment" className={labelClassName}>
            Payment type
          </label>
          <select
            id="cashbook-payment"
            name="paymentType"
            value={paymentType}
            onChange={(event) =>
              setPaymentType(event.target.value as (typeof cashPaymentTypes)[number])
            }
            className={inputClassName}
          >
            {cashPaymentTypes.map((type) => (
              <option key={type} value={type}>
                {cashPaymentTypeLabels[type]}
              </option>
            ))}
          </select>
          <FieldError errors={state.errors?.paymentType} />
        </div>
        <div>
          <label htmlFor="cashbook-amount" className={labelClassName}>
            Amount
          </label>
          <input
            id="cashbook-amount"
            name="amount"
            type="number"
            min="0.01"
            step="0.01"
            required
            className={inputClassName}
          />
          <FieldError errors={state.errors?.amount} />
        </div>
        <div>
          <label htmlFor="cashbook-direction" className={labelClassName}>
            Direction
          </label>
          <select
            id="cashbook-direction"
            name="direction"
            defaultValue="IN"
            className={inputClassName}
          >
            {cashDirections.map((direction) => (
              <option key={direction} value={direction}>
                {cashDirectionLabels[direction]}
              </option>
            ))}
          </select>
          <FieldError errors={state.errors?.direction} />
        </div>
      </div>

      {paymentType !== "cash" ? (
        <div>
          <label htmlFor="cashbook-reference" className={labelClassName}>
            Reference number
          </label>
          <input
            id="cashbook-reference"
            name="referenceNumber"
            required
            maxLength={100}
            className={inputClassName}
            placeholder="Cheque or online transaction reference"
          />
          <FieldError errors={state.errors?.referenceNumber} />
        </div>
      ) : (
        <input type="hidden" name="referenceNumber" value="" />
      )}

      <div>
        <label htmlFor="cashbook-remarks" className={labelClassName}>
          Remarks
        </label>
        <textarea
          id="cashbook-remarks"
          name="remarks"
          required
          maxLength={500}
          rows={3}
          className={`${inputClassName} h-auto min-h-24 py-2`}
        />
        <FieldError errors={state.errors?.remarks} />
      </div>

      <div className="flex justify-end">
        <SubmitButton />
      </div>
    </form>
  );
}

export function CashbookCreateDialog({
  staff,
  projects,
  canChooseStaff,
}: {
  staff: Option[];
  projects: Option[];
  canChooseStaff: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#ff5c6c] px-4 text-sm font-medium text-white shadow-md transition-all hover:-translate-y-0.5 hover:bg-red-500 hover:shadow-lg"
      >
        <Plus className="size-4 transition-transform group-hover:rotate-90" />
        New entry
      </button>
      <ModalViewport
        open={open}
        onClose={() => setOpen(false)}
        label="Add cashbook entry"
        panelClassName="max-w-3xl"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-gray-200 px-4 py-3 sm:px-6 sm:py-4">
          <div>
            <h2 className="text-xl font-normal text-[#20aee3]">Add Cashbook Entry</h2>
            <p className="mt-0.5 text-xs text-gray-400">
              Record cash received or paid with an auditable reference.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-md p-2 text-gray-500 transition hover:bg-gray-100"
            aria-label="Close cashbook dialog"
          >
            <X className="size-5" />
          </button>
        </div>
        <div className="min-h-0 overflow-y-auto p-4 sm:p-6">
          <CashbookForm
            staff={staff}
            projects={projects}
            canChooseStaff={canChooseStaff}
            onSuccess={() => setOpen(false)}
          />
        </div>
      </ModalViewport>
    </>
  );
}

export function DeleteCashbookEntryButton({ entryId }: { entryId: string }) {
  const action = deleteCashbookEntryAction.bind(null, entryId);
  const [state, formAction] = useActionState(action, initialCashbookFormState);

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        if (!window.confirm("Delete this cashbook entry permanently? This action is audited.")) {
          event.preventDefault();
        }
      }}
      className="inline-flex items-center"
    >
      {state.status === "error" && state.message ? (
        <span className="sr-only" role="alert">
          {state.message}
        </span>
      ) : null}
      <button
        type="submit"
        className="rounded-md p-2 text-rose-500 transition hover:bg-rose-50 hover:text-rose-600"
        title="Delete entry"
        aria-label="Delete cashbook entry"
      >
        <Trash2 className="size-4" />
      </button>
    </form>
  );
}

"use client";

import { LoaderCircle, Pencil, Plus, Trash2, X } from "lucide-react";
import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";

import { ModalViewport } from "@/components/ui/modal";
import {
  createSaleAction,
  deleteSaleAction,
  updateSaleAction,
} from "@/features/sales/actions";
import {
  initialSaleFormState,
  paymentTypeLabels,
  paymentTypes,
  type SaleFormState,
} from "@/features/sales/schemas";

type Option = { id: string; label: string };
type SaleDefaults = {
  id: string;
  staffProfileId: string | null;
  leadId: string | null;
  clientName: string;
  paymentType: string;
  referenceNumber: string;
  netPrice: string;
  receivedAmount: string;
};

const inputClassName =
  "mt-1.5 h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-700 outline-none transition placeholder:text-gray-400 focus:border-[#20aee3] focus:ring-2 focus:ring-[#20aee3]/15";
const labelClassName = "text-sm font-normal text-gray-600";

function FieldError({ errors }: { errors?: string[] }) {
  return errors?.length ? (
    <p className="mt-1 text-xs text-rose-600">{errors[0]}</p>
  ) : null;
}

function FormStatus({ state }: { state: SaleFormState }) {
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

function SubmitButton({ idle, pending }: { idle: string; pending: string }) {
  const status = useFormStatus();
  return (
    <button
      type="submit"
      disabled={status.pending}
      className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#ff5c6c] px-4 text-sm font-medium text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-red-500 hover:shadow-md disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {status.pending ? <LoaderCircle className="size-4 animate-spin" /> : null}
      {status.pending ? pending : idle}
    </button>
  );
}

function SaleForm({
  action,
  staff,
  leads,
  canChooseStaff,
  defaults,
  onSuccess,
}: {
  action: (
    state: SaleFormState,
    formData: FormData,
  ) => Promise<SaleFormState>;
  staff: Option[];
  leads: Option[];
  canChooseStaff: boolean;
  defaults?: SaleDefaults;
  onSuccess: () => void;
}) {
  const [state, formAction] = useActionState(action, initialSaleFormState);
  const [netPrice, setNetPrice] = useState(defaults?.netPrice ?? "");
  const [receivedAmount, setReceivedAmount] = useState(
    defaults?.receivedAmount ?? "",
  );

  useEffect(() => {
    if (state.status === "success") onSuccess();
  }, [onSuccess, state.status]);

  const numericNet = Number(netPrice);
  const numericReceived = Number(receivedAmount);
  const profit =
    netPrice && receivedAmount && Number.isFinite(numericNet + numericReceived)
      ? numericReceived - numericNet
      : null;

  return (
    <form action={formAction} className="space-y-4">
      <FormStatus state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={`sale-client-${defaults?.id ?? "new"}`} className={labelClassName}>
            Client name
          </label>
          <input
            id={`sale-client-${defaults?.id ?? "new"}`}
            name="clientName"
            required
            maxLength={160}
            defaultValue={defaults?.clientName}
            className={inputClassName}
          />
          <FieldError errors={state.errors?.clientName} />
        </div>
        <div>
          <label htmlFor={`sale-payment-${defaults?.id ?? "new"}`} className={labelClassName}>
            Type of payment
          </label>
          <select
            id={`sale-payment-${defaults?.id ?? "new"}`}
            name="paymentType"
            required
            defaultValue={defaults?.paymentType ?? "cash"}
            className={inputClassName}
          >
            {paymentTypes.map((type) => (
              <option key={type} value={type}>
                {paymentTypeLabels[type]}
              </option>
            ))}
          </select>
          <FieldError errors={state.errors?.paymentType} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {canChooseStaff ? (
          <div>
            <label htmlFor={`sale-staff-${defaults?.id ?? "new"}`} className={labelClassName}>
              Staff
            </label>
            <select
              id={`sale-staff-${defaults?.id ?? "new"}`}
              name="staffProfileId"
              defaultValue={defaults?.staffProfileId ?? ""}
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
          <label htmlFor={`sale-lead-${defaults?.id ?? "new"}`} className={labelClassName}>
            Related lead
          </label>
          <select
            id={`sale-lead-${defaults?.id ?? "new"}`}
            name="leadId"
            defaultValue={defaults?.leadId ?? ""}
            className={inputClassName}
          >
            <option value="">No related lead</option>
            {leads.map((lead) => (
              <option key={lead.id} value={lead.id}>
                {lead.label}
              </option>
            ))}
          </select>
          <FieldError errors={state.errors?.leadId} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor={`sale-net-${defaults?.id ?? "new"}`} className={labelClassName}>
            Net price
          </label>
          <input
            id={`sale-net-${defaults?.id ?? "new"}`}
            name="netPrice"
            type="number"
            min="0"
            step="0.01"
            required
            value={netPrice}
            onChange={(event) => setNetPrice(event.target.value)}
            className={inputClassName}
          />
          <FieldError errors={state.errors?.netPrice} />
        </div>
        <div>
          <label htmlFor={`sale-received-${defaults?.id ?? "new"}`} className={labelClassName}>
            Received
          </label>
          <input
            id={`sale-received-${defaults?.id ?? "new"}`}
            name="receivedAmount"
            type="number"
            min="0"
            step="0.01"
            required
            value={receivedAmount}
            onChange={(event) => setReceivedAmount(event.target.value)}
            className={inputClassName}
          />
          <FieldError errors={state.errors?.receivedAmount} />
        </div>
        <div>
          <label className={labelClassName}>Profit</label>
          <output className="mt-1.5 flex h-10 items-center rounded-md border border-sky-100 bg-sky-50 px-3 text-sm font-medium text-[#20aee3]">
            {profit === null ? "Calculated automatically" : profit.toFixed(2)}
          </output>
        </div>
      </div>

      <div>
        <label htmlFor={`sale-reference-${defaults?.id ?? "new"}`} className={labelClassName}>
          Reference number
        </label>
        <input
          id={`sale-reference-${defaults?.id ?? "new"}`}
          name="referenceNumber"
          maxLength={100}
          defaultValue={defaults?.referenceNumber}
          className={inputClassName}
          placeholder="Cheque, card, or transfer reference"
        />
        <FieldError errors={state.errors?.referenceNumber} />
      </div>

      <div className="flex justify-end">
        <SubmitButton
          idle={defaults ? "Save changes" : "Create sale"}
          pending={defaults ? "Saving…" : "Creating…"}
        />
      </div>
    </form>
  );
}

function SaleDialog({
  title,
  description,
  open,
  onClose,
  children,
}: {
  title: string;
  description: string;
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <ModalViewport
      open={open}
      onClose={onClose}
      label={title}
      panelClassName="max-w-3xl"
    >
      <div className="flex shrink-0 items-center justify-between border-b border-gray-200 px-4 py-3 sm:px-6 sm:py-4">
        <div>
          <h2 className="text-xl font-normal text-[#20aee3]">{title}</h2>
          <p className="mt-0.5 text-xs text-gray-400">{description}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-2 text-gray-500 transition hover:bg-gray-100"
          aria-label="Close sale dialog"
        >
          <X className="size-5" />
        </button>
      </div>
      <div className="min-h-0 overflow-y-auto p-4 sm:p-6">{children}</div>
    </ModalViewport>
  );
}

export function SaleCreateDialog({
  staff,
  leads,
  canChooseStaff,
}: {
  staff: Option[];
  leads: Option[];
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
        New sale
      </button>
      <SaleDialog
        title="Add New Sale"
        description="Record the transaction details. Profit is calculated on the server."
        open={open}
        onClose={() => setOpen(false)}
      >
        <SaleForm
          action={createSaleAction}
          staff={staff}
          leads={leads}
          canChooseStaff={canChooseStaff}
          onSuccess={() => setOpen(false)}
        />
      </SaleDialog>
    </>
  );
}

function DeleteSaleForm({ saleId, onSuccess }: { saleId: string; onSuccess: () => void }) {
  const action = deleteSaleAction.bind(null, saleId);
  const [state, formAction] = useActionState(action, initialSaleFormState);

  useEffect(() => {
    if (state.status === "success") onSuccess();
  }, [onSuccess, state.status]);

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        if (!window.confirm("Delete this sale permanently? This action is audited.")) {
          event.preventDefault();
        }
      }}
    >
      {state.status === "error" ? <FormStatus state={state} /> : null}
      <button
        type="submit"
        className="rounded-md p-2 text-rose-500 transition hover:bg-rose-50 hover:text-rose-600"
        title="Delete sale"
        aria-label="Delete sale"
      >
        <Trash2 className="size-4" />
      </button>
    </form>
  );
}

export function SaleRowActions({
  sale,
  staff,
  leads,
  canChooseStaff,
  canEdit,
  canDelete,
}: {
  sale: SaleDefaults;
  staff: Option[];
  leads: Option[];
  canChooseStaff: boolean;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const [open, setOpen] = useState(false);
  const action = updateSaleAction.bind(null, sale.id);

  if (!canEdit && !canDelete) return <span className="text-gray-300">—</span>;
  return (
    <div className="flex items-center gap-1">
      {canEdit ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-md p-2 text-emerald-500 transition hover:bg-emerald-50 hover:text-emerald-600"
          title="Edit sale"
          aria-label="Edit sale"
        >
          <Pencil className="size-4" />
        </button>
      ) : null}
      {canDelete ? <DeleteSaleForm saleId={sale.id} onSuccess={() => setOpen(false)} /> : null}
      <SaleDialog
        title="Edit Sale"
        description="Update the transaction while preserving its audit history."
        open={open}
        onClose={() => setOpen(false)}
      >
        <SaleForm
          action={action}
          staff={staff}
          leads={leads}
          canChooseStaff={canChooseStaff}
          defaults={sale}
          onSuccess={() => setOpen(false)}
        />
      </SaleDialog>
    </div>
  );
}

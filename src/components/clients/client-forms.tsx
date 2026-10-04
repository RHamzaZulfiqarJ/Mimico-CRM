"use client";

import { LoaderCircle, Pencil, Plus, X } from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

import { ModalViewport } from "@/components/ui/modal";
import { createClientAction, updateClientAction } from "@/features/clients/actions";
import {
  initialClientFormState,
  type ClientFormState,
} from "@/features/clients/schemas";

type PortalProfile = { id: string; label: string; linkedClientId: string | null };
type ClientValues = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string;
  city: string | null;
  cnic: string | null;
  portalProfileId: string | null;
};

const inputClassName =
  "mt-1.5 h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-700 outline-none transition placeholder:text-gray-400 focus:border-[#20aee3] focus:ring-2 focus:ring-[#20aee3]/15";
const labelClassName = "text-xs font-medium text-gray-600";

function FieldError({ errors }: { errors?: string[] }) {
  return errors?.length ? <p className="mt-1 text-xs text-rose-600">{errors[0]}</p> : null;
}

function SaveButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#ff5c6c] px-4 text-sm font-medium text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-red-500 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60">
      {pending ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : null}
      {pending ? "Saving…" : label}
    </button>
  );
}

function ClientForm({
  action,
  initialValues,
  portalProfiles,
  canLinkPortal,
  submitLabel,
}: {
  action: (state: ClientFormState, formData: FormData) => Promise<ClientFormState>;
  initialValues?: ClientValues;
  portalProfiles: PortalProfile[];
  canLinkPortal: boolean;
  submitLabel: string;
}) {
  const [state, formAction] = useActionState(action, initialClientFormState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "success" && !initialValues) formRef.current?.reset();
  }, [initialValues, state.status]);

  const availableProfiles = portalProfiles.filter(
    (profile) => !profile.linkedClientId || profile.linkedClientId === initialValues?.id,
  );

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      {state.message ? (
        <p role={state.status === "success" ? "status" : "alert"} className={state.status === "success" ? "rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700" : "rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-600"}>{state.message}</p>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={labelClassName}>First name<input name="firstName" required maxLength={100} defaultValue={initialValues?.firstName ?? ""} className={inputClassName} placeholder="Ayesha" /><FieldError errors={state.errors?.firstName} /></label>
        <label className={labelClassName}>Last name<input name="lastName" required maxLength={100} defaultValue={initialValues?.lastName ?? ""} className={inputClassName} placeholder="Khan" /><FieldError errors={state.errors?.lastName} /></label>
        <label className={labelClassName}>Phone<input name="phone" required maxLength={50} defaultValue={initialValues?.phone ?? ""} className={inputClassName} placeholder="0300 0000000" /><FieldError errors={state.errors?.phone} /></label>
        <label className={labelClassName}>Email<input name="email" type="email" defaultValue={initialValues?.email ?? ""} className={inputClassName} placeholder="client@example.com" /><FieldError errors={state.errors?.email} /></label>
        <label className={labelClassName}>City<input name="city" maxLength={100} defaultValue={initialValues?.city ?? ""} className={inputClassName} placeholder="Lahore" /><FieldError errors={state.errors?.city} /></label>
        <label className={labelClassName}>CNIC<input name="cnic" maxLength={30} defaultValue={initialValues?.cnic ?? ""} className={inputClassName} placeholder="35202-0000000-0" /><FieldError errors={state.errors?.cnic} /></label>
      </div>
      {canLinkPortal ? (
        <label className={`block ${labelClassName}`}>Portal account<select name="portalProfileId" defaultValue={initialValues?.portalProfileId ?? ""} className={inputClassName}><option value="">No portal access</option>{availableProfiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.label}</option>)}</select><FieldError errors={state.errors?.portalProfileId} /><span className="mt-1 block text-[11px] font-normal leading-5 text-gray-400">Only active organization members with the Client role are available.</span></label>
      ) : null}
      <SaveButton label={submitLabel} />
    </form>
  );
}

function DialogFrame({ title, open, onClose, children }: { title: string; open: boolean; onClose: () => void; children: React.ReactNode }) {
  return (
    <ModalViewport open={open} onClose={onClose} labelledBy="client-dialog-title" panelClassName="max-w-2xl">
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-4 sm:px-6"><div><p className="text-xs font-medium text-[#20aee3]">Client directory</p><h2 id="client-dialog-title" className="mt-1 text-xl font-light text-gray-700">{title}</h2></div><button type="button" onClick={onClose} aria-label="Close client form" className="rounded-full p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"><X className="size-5" /></button></div>
      <div className="overflow-y-auto px-4 py-5 sm:px-6">{children}</div>
    </ModalViewport>
  );
}

export function ClientCreateDialog({ portalProfiles, canLinkPortal }: { portalProfiles: PortalProfile[]; canLinkPortal: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#ff5c6c] px-4 text-sm font-medium text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-red-500"><Plus className="size-4" />Add client</button>
      <DialogFrame title="Add client" open={open} onClose={() => setOpen(false)}><ClientForm action={createClientAction} portalProfiles={portalProfiles} canLinkPortal={canLinkPortal} submitLabel="Create client" /></DialogFrame>
    </>
  );
}

export function ClientEditDialog({ client, portalProfiles, canLinkPortal }: { client: ClientValues; portalProfiles: PortalProfile[]; canLinkPortal: boolean }) {
  const [open, setOpen] = useState(false);
  const action = updateClientAction.bind(null, client.id);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} title="Edit client" aria-label={`Edit ${client.firstName ?? "client"}`} className="rounded-md p-2 text-[#20aee3] transition hover:bg-sky-50"><Pencil className="size-4" /></button>
      <DialogFrame title="Edit client" open={open} onClose={() => setOpen(false)}><ClientForm action={action} initialValues={client} portalProfiles={portalProfiles} canLinkPortal={canLinkPortal} submitLabel="Save changes" /></DialogFrame>
    </>
  );
}

"use client";

import { LoaderCircle } from "lucide-react";
import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";

import {
  createInventoryAction,
  createProjectAction,
  createSocietyAction,
} from "@/features/reference-data/actions";
import {
  initialReferenceFormState,
  type ReferenceFormState,
} from "@/features/reference-data/schemas";

const inputClassName =
  "mt-1.5 h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-700 outline-none transition placeholder:text-gray-400 focus:border-[#20aee3] focus:ring-2 focus:ring-[#20aee3]/15";
const textAreaClassName =
  "mt-1.5 min-h-24 w-full resize-y rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 outline-none transition placeholder:text-gray-400 focus:border-[#20aee3] focus:ring-2 focus:ring-[#20aee3]/15";
const labelClassName = "text-xs font-medium text-gray-600";

function FieldError({ errors }: { errors?: string[] }) {
  return errors?.length ? (
    <p className="mt-1 text-xs text-rose-600">{errors[0]}</p>
  ) : null;
}

function FormStatus({ state }: { state: ReferenceFormState }) {
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

function SaveButton({ label }: { label: string }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#ff5c6c] px-4 text-sm font-medium text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-red-500 hover:shadow-md disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
    >
      {pending ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : null}
      {pending ? "Saving…" : label}
    </button>
  );
}

function useResetOnSuccess(state: ReferenceFormState) {
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
  }, [state]);

  return formRef;
}

export function SocietyForm() {
  const [state, action] = useActionState(createSocietyAction, initialReferenceFormState);
  const formRef = useResetOnSuccess(state);

  return (
    <form ref={formRef} action={action} className="space-y-4">
      <FormStatus state={state} />
      <div>
        <label htmlFor="society-title" className={labelClassName}>Society title</label>
        <input id="society-title" name="title" required maxLength={120} className={inputClassName} placeholder="Green Valley" />
        <FieldError errors={state.errors?.title} />
      </div>
      <div>
        <label htmlFor="society-description" className={labelClassName}>Description</label>
        <textarea id="society-description" name="description" required maxLength={2000} className={textAreaClassName} placeholder="Location and development notes" />
        <FieldError errors={state.errors?.description} />
      </div>
      <SaveButton label="Create society" />
    </form>
  );
}

export function ProjectForm({ societies }: { societies: Array<{ id: string; title: string }> }) {
  const [state, action] = useActionState(createProjectAction, initialReferenceFormState);
  const formRef = useResetOnSuccess(state);

  return (
    <form ref={formRef} action={action} className="space-y-4">
      <FormStatus state={state} />
      <div>
        <label htmlFor="project-society" className={labelClassName}>Society</label>
        <select id="project-society" name="societyId" required className={inputClassName} defaultValue="">
          <option value="" disabled>Select a society</option>
          {societies.map((society) => <option key={society.id} value={society.id}>{society.title}</option>)}
        </select>
        <FieldError errors={state.errors?.societyId} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="project-title" className={labelClassName}>Project title</label>
          <input id="project-title" name="title" required maxLength={120} className={inputClassName} placeholder="Phase One" />
          <FieldError errors={state.errors?.title} />
        </div>
        <div>
          <label htmlFor="project-city" className={labelClassName}>City</label>
          <input id="project-city" name="city" required maxLength={100} className={inputClassName} placeholder="Lahore" />
          <FieldError errors={state.errors?.city} />
        </div>
      </div>
      <div>
        <label htmlFor="project-description" className={labelClassName}>Description</label>
        <textarea id="project-description" name="description" required maxLength={2000} className={textAreaClassName} placeholder="Project scope and location details" />
        <FieldError errors={state.errors?.description} />
      </div>
      <SaveButton label="Create project" />
    </form>
  );
}

export function InventoryForm({ projects }: { projects: Array<{ id: string; title: string }> }) {
  const [state, action] = useActionState(createInventoryAction, initialReferenceFormState);
  const formRef = useResetOnSuccess(state);

  return (
    <form ref={formRef} action={action} className="space-y-4">
      <FormStatus state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="inventory-project" className={labelClassName}>Project</label>
          <select id="inventory-project" name="projectId" className={inputClassName} defaultValue="">
            <option value="">Unassigned</option>
            {projects.map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}
          </select>
          <FieldError errors={state.errors?.projectId} />
        </div>
        <div>
          <label htmlFor="inventory-status" className={labelClassName}>Status</label>
          <select id="inventory-status" name="status" className={inputClassName} defaultValue="UNSOLD">
            <option value="UNSOLD">Unsold</option>
            <option value="UNDER_PROCESS">Under process</option>
            <option value="SOLD">Sold</option>
          </select>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="seller-name" className={labelClassName}>Seller name</label>
          <input id="seller-name" name="sellerName" required maxLength={160} className={inputClassName} placeholder="Seller or owner" />
          <FieldError errors={state.errors?.sellerName} />
        </div>
        <div>
          <label htmlFor="seller-phone" className={labelClassName}>Seller phone</label>
          <input id="seller-phone" name="sellerPhone" maxLength={50} className={inputClassName} placeholder="0300 0000000" />
        </div>
        <div>
          <label htmlFor="seller-email" className={labelClassName}>Seller email</label>
          <input id="seller-email" name="sellerEmail" type="email" className={inputClassName} placeholder="seller@example.com" />
          <FieldError errors={state.errors?.sellerEmail} />
        </div>
        <div>
          <label htmlFor="seller-company" className={labelClassName}>Company</label>
          <input id="seller-company" name="sellerCompanyName" maxLength={160} className={inputClassName} placeholder="Optional" />
        </div>
        <div>
          <label htmlFor="seller-city" className={labelClassName}>Seller city</label>
          <input id="seller-city" name="sellerCity" maxLength={100} className={inputClassName} placeholder="Optional" />
        </div>
        <div>
          <label htmlFor="inventory-price" className={labelClassName}>Price</label>
          <input id="inventory-price" name="price" inputMode="decimal" className={inputClassName} placeholder="0.00" />
          <FieldError errors={state.errors?.price} />
        </div>
        <div>
          <label htmlFor="street-number" className={labelClassName}>Street number</label>
          <input id="street-number" name="propertyStreetNumber" maxLength={100} className={inputClassName} placeholder="Optional" />
        </div>
        <div>
          <label htmlFor="property-number" className={labelClassName}>Property number</label>
          <input id="property-number" name="propertyNumber" maxLength={100} className={inputClassName} placeholder="Plot or unit number" />
        </div>
      </div>
      <div>
        <label htmlFor="inventory-remarks" className={labelClassName}>Remarks</label>
        <textarea id="inventory-remarks" name="remarks" maxLength={2000} className={textAreaClassName} placeholder="Optional property notes" />
      </div>
      <SaveButton label="Create inventory" />
    </form>
  );
}

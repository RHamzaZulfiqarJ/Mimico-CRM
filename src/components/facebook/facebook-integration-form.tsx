"use client";

import { CheckCircle2, Copy, LoaderCircle } from "lucide-react";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { saveFacebookIntegrationAction } from "@/features/facebook/actions";
import {
  initialFacebookIntegrationFormState,
} from "@/features/facebook/schemas";

const inputClass = "mt-1.5 h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-700 outline-none transition focus:border-[#20aee3] focus:ring-2 focus:ring-sky-100";

function SaveButton() {
  const { pending } = useFormStatus();
  return <button disabled={pending} className="inline-flex h-10 items-center gap-2 rounded-md bg-[#20aee3] px-4 text-sm font-medium text-white transition hover:bg-sky-600 disabled:opacity-60">{pending ? <LoaderCircle className="size-4 animate-spin" /> : null}{pending ? "Saving…" : "Save integration"}</button>;
}

export function CopyCallbackButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return <button type="button" onClick={async () => { await navigator.clipboard.writeText(value); setCopied(true); window.setTimeout(() => setCopied(false), 1_500); }} className="inline-flex h-9 shrink-0 items-center gap-2 rounded-md border border-sky-200 bg-white px-3 text-xs font-medium text-[#20aee3] hover:bg-sky-50">{copied ? <CheckCircle2 className="size-4" /> : <Copy className="size-4" />}{copied ? "Copied" : "Copy"}</button>;
}

export function FacebookIntegrationForm() {
  const [state, action] = useActionState(saveFacebookIntegrationAction, initialFacebookIntegrationFormState);
  const error = (name: string) => state.errors?.[name]?.[0];
  return (
    <form action={action} className="space-y-5">
      {state.message ? <p role={state.status === "success" ? "status" : "alert"} className={`rounded-md border px-3 py-2 text-xs ${state.status === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-rose-200 bg-rose-50 text-rose-600"}`}>{state.message}</p> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-xs font-medium text-gray-600">Facebook Page ID<input name="pageId" required maxLength={100} className={inputClass} placeholder="1234567890" />{error("pageId") ? <span className="mt-1 block text-rose-600">{error("pageId")}</span> : null}</label>
        <label className="text-xs font-medium text-gray-600">Facebook App ID<input name="appId" required maxLength={100} className={inputClass} placeholder="1234567890" />{error("appId") ? <span className="mt-1 block text-rose-600">{error("appId")}</span> : null}</label>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <label className="text-xs font-medium text-gray-600">Verify-token variable<input name="verifyTokenSecretName" required defaultValue="FACEBOOK_VERIFY_TOKEN" className={inputClass} />{error("verifyTokenSecretName") ? <span className="mt-1 block text-rose-600">{error("verifyTokenSecretName")}</span> : null}</label>
        <label className="text-xs font-medium text-gray-600">App-secret variable<input name="appSecretName" required defaultValue="FACEBOOK_APP_SECRET" className={inputClass} />{error("appSecretName") ? <span className="mt-1 block text-rose-600">{error("appSecretName")}</span> : null}</label>
        <label className="text-xs font-medium text-gray-600">Page-token variable<input name="pageAccessTokenSecretName" required defaultValue="FACEBOOK_PAGE_ACCESS_TOKEN" className={inputClass} />{error("pageAccessTokenSecretName") ? <span className="mt-1 block text-rose-600">{error("pageAccessTokenSecretName")}</span> : null}</label>
      </div>
      <p className="rounded-md border border-amber-100 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-700">Enter environment-variable names only. Add their secret values in Vercel; this application never stores Facebook secrets in PostgreSQL.</p>
      <SaveButton />
    </form>
  );
}

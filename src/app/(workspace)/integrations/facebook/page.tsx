import { CheckCircle2, ShieldCheck, Webhook } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { CopyCallbackButton, FacebookConnectionCheck, FacebookIntegrationForm } from "@/components/facebook/facebook-integration-form";
import { getFacebookIntegrationWorkspace } from "@/features/facebook/queries";

export const metadata: Metadata = { title: "Facebook integration" };

export default async function FacebookIntegrationPage() {
  const data = await getFacebookIntegrationWorkspace();
  if (!data) redirect("/dashboard");

  return <div className="mx-auto w-full max-w-6xl">
    <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-xs text-gray-500 sm:text-sm"><Link href="/dashboard" className="hover:text-[#20aee3]">Dashboard</Link><span aria-hidden>›</span><span>Facebook integration</span></nav>
    <div className="mt-2"><div className="flex items-center gap-3"><span className="flex size-11 items-center justify-center rounded-lg bg-sky-50 text-[#20aee3]"><Webhook className="size-5" /></span><div><h1 className="text-[28px] font-light text-[#20aee3] sm:text-[32px]">Facebook Lead Ads</h1><p className="mt-1 text-sm text-gray-500">Connect page webhooks without storing provider secrets in the CRM database.</p></div></div></div>

    <section className="surface-card mt-6 rounded-lg p-4 sm:p-6"><div className="mb-5 flex items-center gap-2 text-sm font-medium text-gray-700"><ShieldCheck className="size-4 text-[#20aee3]" />Add or update a page</div><FacebookIntegrationForm /></section>

    <section className="surface-card mt-6 overflow-hidden rounded-lg"><div className="border-b border-gray-100 px-4 py-4 sm:px-6"><h2 className="text-sm font-medium text-gray-700">Configured pages</h2><p className="mt-1 text-xs text-gray-400">Use the callback URL and your verify-token value when configuring the Meta webhook.</p></div><div className="divide-y divide-gray-100">{data.integrations.length === 0 ? <div className="px-6 py-12 text-center text-sm text-gray-400">No Facebook page is configured yet.</div> : data.integrations.map((integration) => <article key={integration.id} className="grid gap-4 px-4 py-5 sm:px-6 xl:grid-cols-[1fr_1.6fr_auto] xl:items-start"><div><p className="text-sm font-medium text-gray-700">Page {integration.pageId}</p><p className="mt-1 text-xs text-gray-400">App {integration.appId} · updated {integration.updatedAt.toLocaleDateString("en-GB")}</p></div><div className="min-w-0"><p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">Callback URL</p><code className="mt-1 block truncate rounded bg-slate-50 px-2 py-1.5 text-xs text-slate-600">{integration.callbackUrl}</code></div><div className="flex flex-wrap items-start gap-2"><span className={`inline-flex h-9 items-center gap-1 rounded-md border px-2 text-xs ${integration.isActive ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-gray-200 text-gray-400"}`}><CheckCircle2 className="size-3.5" />{integration.isActive ? "Active" : "Inactive"}</span><CopyCallbackButton value={integration.callbackUrl} /><FacebookConnectionCheck integrationId={integration.id} /></div></article>)}</div></section>
  </div>;
}

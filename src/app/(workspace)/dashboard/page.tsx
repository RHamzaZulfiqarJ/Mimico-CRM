import {
  ArrowRight,
  Bell,
  CalendarDays,
  CheckCircle2,
  ContactRound,
  ClipboardCheck,
  Database,
  KeyRound,
  ListChecks,
  ShieldCheck,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { getAuthContext } from "@/lib/auth/session";
import { isStaff } from "@/lib/auth/authorization";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const auth = await getAuthContext();

  if (!auth) {
    return null;
  }

  const readiness = [
    {
      icon: KeyRound,
      label: "Verified session",
      description: "Supabase Auth identity is active and server-verified.",
    },
    {
      icon: ShieldCheck,
      label: "Organization access",
      description: `${auth.organization.name} membership resolved with ${auth.membership.role.toLowerCase().replace("_", " ")} permissions.`,
    },
    {
      icon: Database,
      label: "Data boundary",
      description: "All upcoming records will be scoped to this organization.",
    },
  ];

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-medium text-[#20aee3]">Dashboard</p>
          <h1 className="mt-2 text-[28px] font-light tracking-tight text-[#20aee3] sm:text-3xl">
            Welcome, {auth.profile.displayName}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-500">
            Your authenticated profile, organization, and role are resolved on
            the server before this workspace is rendered.
          </p>
        </div>
        <span className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 shadow-sm">
          <CheckCircle2 className="size-4" />
          Access verified
        </span>
      </div>

      <section className="mt-8 grid gap-4 md:grid-cols-3" aria-label="Access status">
        {readiness.map((item) => {
          const Icon = item.icon;
          return (
            <article
              key={item.label}
              className="surface-card surface-card-interactive rounded-lg p-5"
            >
              <span className="flex size-10 items-center justify-center rounded-lg bg-[#ebf2f5] text-[#20aee3]">
                <Icon className="size-5" />
              </span>
              <h2 className="mt-5 text-sm font-medium text-gray-700">
                {item.label}
              </h2>
              <p className="mt-2 text-sm leading-6 text-gray-500">
                {item.description}
              </p>
            </article>
          );
        })}
      </section>

      <section className="mt-8 grid gap-4 md:grid-cols-2">
        <article className="surface-card surface-card-interactive rounded-lg p-5 sm:p-7">
          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
            <div>
              <p className="text-sm font-medium text-gray-700">Lead CRM</p>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-500">
                Lead tracking is available with role-scoped visibility, relational
                assignments, and a complete follow-up timeline.
              </p>
            </div>
            <Link href="/leads" className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-md bg-sky-50 px-4 text-sm font-medium text-[#20aee3] transition-all hover:-translate-y-0.5 hover:bg-sky-100 hover:text-sky-600">
              <ContactRound className="size-4" />Open lead CRM<ArrowRight className="size-4" />
            </Link>
          </div>
        </article>
        {isStaff(auth.membership.role) ? (
          <article className="surface-card surface-card-interactive rounded-lg p-5 sm:p-7">
            <div className="flex h-full flex-col justify-between gap-5">
              <div>
                <p className="text-sm font-medium text-gray-700">Work management</p>
                <p className="mt-2 text-sm leading-6 text-gray-500">Assign daily work, track deadlines, and receive status notifications with a complete audit trail.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link href="/tasks" className="inline-flex min-h-10 items-center gap-2 rounded-md bg-sky-50 px-4 text-sm font-medium text-[#20aee3] transition-all hover:-translate-y-0.5 hover:bg-sky-100"><ListChecks className="size-4" />Open tasks<ArrowRight className="size-4" /></Link>
                <Link href="/calendar" className="inline-flex min-h-10 items-center gap-2 rounded-md border border-gray-200 px-4 text-sm text-gray-600 transition hover:bg-gray-50"><CalendarDays className="size-4" />Calendar</Link>
                <Link href="/approvals" className="inline-flex min-h-10 items-center gap-2 rounded-md border border-gray-200 px-4 text-sm text-gray-600 transition hover:bg-gray-50"><ClipboardCheck className="size-4" />Approvals</Link>
                <Link href="/notifications" className="inline-flex min-h-10 items-center gap-2 rounded-md border border-gray-200 px-4 text-sm text-gray-600 transition hover:bg-gray-50"><Bell className="size-4" />Notifications</Link>
              </div>
            </div>
          </article>
        ) : null}
      </section>
    </div>
  );
}

import {
  ArrowRight,
  Banknote,
  Bell,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  ContactRound,
  ListChecks,
  PhoneCall,
  TrendingUp,
  UserPlus,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Metadata, Route } from "next";
import Link from "next/link";

import {
  metricBarHeight,
  metricPercentage,
} from "@/features/dashboard/metrics";
import { getDashboardWorkspace } from "@/features/dashboard/queries";
import { displayLeadUid } from "@/features/leads/identifiers";
import { stageLabels } from "@/features/leads/schemas";

export const metadata: Metadata = { title: "Dashboard" };

const pakistanDate = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Karachi",
  weekday: "long",
  day: "2-digit",
  month: "long",
  year: "numeric",
});

const pakistanDateTime = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Karachi",
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
});

const moneyFormatter = new Intl.NumberFormat("en-PK", {
  style: "currency",
  currency: "PKR",
  notation: "compact",
  maximumFractionDigits: 1,
});

const databaseStageLabels: Record<string, string> = {
  newClient: "New client",
  followUp: "Follow up",
  contactedClient: "Contacted client",
  callNotAttend: "Call not attended",
  visitSchedule: "Visit scheduled",
  visitDone: "Visit done",
  closedWon: "Closed won",
  closedLost: "Closed lost",
};

const databasePriorityLabels: Record<string, string> = {
  veryCold: "Very cold",
  cold: "Cold",
  moderate: "Moderate",
  hot: "Hot",
  veryHot: "Very hot",
};

const roleLabels = {
  CLIENT: "Client",
  EMPLOYEE: "Employee",
  MANAGER: "Manager",
  SUPER_ADMIN: "Super admin",
} as const;

type StatCardProps = {
  label: string;
  value: string | number;
  detail: string;
  href: Route;
  icon: LucideIcon;
  tone: string;
};

function StatCard({ label, value, detail, href, icon: Icon, tone }: StatCardProps) {
  return (
    <Link href={href} className="surface-card surface-card-interactive group flex min-w-0 items-center justify-between gap-3 rounded-xl border-b-[3px] p-4 sm:p-5">
      <div className="min-w-0">
        <p className="truncate text-2xl font-semibold text-[#455a64]">{value}</p>
        <p className="mt-1 text-sm text-gray-500">{label}</p>
        <p className="mt-1 truncate text-[11px] text-gray-400">{detail}</p>
      </div>
      <span className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${tone}`}><Icon className="size-5 transition-transform group-hover:scale-110" /></span>
    </Link>
  );
}

function money(value: string) {
  return moneyFormatter.format(Number(value));
}

export default async function DashboardPage() {
  const data = await getDashboardWorkspace();
  if (!data) return null;

  const { auth, leadMetrics, staffMetrics } = data;
  const closedLeads = leadMetrics.wonLeads + leadMetrics.lostLeads;
  const conversion = metricPercentage(leadMetrics.wonLeads, closedLeads);
  const monthlyMaximum = Math.max(
    1,
    ...leadMetrics.monthlyLeads.map((bucket) => bucket.count),
  );
  const stageMaximum = Math.max(
    1,
    ...leadMetrics.stages.map((bucket) => bucket.count),
  );
  const cashMaximum = Math.max(
    1,
    ...(staffMetrics?.cashflow.flatMap((bucket) => [
      Number(bucket.income),
      Number(bucket.expense),
    ]) ?? []),
  );
  const primaryCards: StatCardProps[] = data.isStaff
    ? [
        { label: "Active leads", value: leadMetrics.activeLeads, detail: `${leadMetrics.newThisMonth} added this month`, href: "/leads", icon: ContactRound, tone: "bg-sky-50 text-[#20aee3]" },
        { label: "New this month", value: leadMetrics.newThisMonth, detail: "Pakistan calendar month", href: "/leads", icon: UserPlus, tone: "bg-emerald-50 text-emerald-600" },
        { label: "Calls due", value: leadMetrics.dueCalls, detail: "Overdue and due today", href: "/leads/reminders", icon: PhoneCall, tone: "bg-rose-50 text-[#ff5c6c]" },
        { label: "Open tasks", value: staffMetrics?.openTasks ?? 0, detail: `${staffMetrics?.tasksDueToday ?? 0} due today`, href: "/tasks", icon: ListChecks, tone: "bg-amber-50 text-amber-600" },
      ]
    : [
        { label: "Active leads", value: leadMetrics.activeLeads, detail: "Linked to your client profile", href: "/leads", icon: ContactRound, tone: "bg-sky-50 text-[#20aee3]" },
        { label: "New this month", value: leadMetrics.newThisMonth, detail: "Recently added opportunities", href: "/leads", icon: UserPlus, tone: "bg-emerald-50 text-emerald-600" },
        { label: "Closed won", value: leadMetrics.wonLeads, detail: "Successful opportunities", href: "/leads?stage=CLOSED_WON", icon: CheckCircle2, tone: "bg-emerald-50 text-emerald-600" },
        { label: "Conversion", value: `${conversion}%`, detail: "Across closed opportunities", href: "/leads", icon: TrendingUp, tone: "bg-violet-50 text-violet-600" },
      ];

  return (
    <div className="mx-auto w-full max-w-[1500px]">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-gray-400">{pakistanDate.format(new Date())}</p>
          <h1 className="mt-2 text-[28px] font-light tracking-tight text-[#20aee3] sm:text-[32px]">Welcome, {auth.profile.displayName}</h1>
          <p className="mt-1 text-sm text-gray-500">Here is what is happening across {auth.organization.name}.</p>
        </div>
        <span className="inline-flex w-fit items-center gap-2 rounded-full border border-sky-100 bg-white px-3 py-1.5 text-xs font-medium text-[#20aee3] shadow-sm"><CheckCircle2 className="size-4" />{roleLabels[auth.membership.role]} workspace</span>
      </header>

      <section className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Dashboard summary">
        {primaryCards.map((card) => <StatCard key={card.label} {...card} />)}
      </section>

      {staffMetrics ? (
        <>
          <section className="mt-4 grid gap-3 sm:grid-cols-3" aria-label="Payment summary">
            {[
              { label: "Payments today", value: staffMetrics.receivedToday, tone: "border-b-emerald-300 text-emerald-500" },
              { label: "Payments this month", value: staffMetrics.receivedMonth, tone: "border-b-sky-400 text-[#20aee3]" },
              { label: "Payments this year", value: staffMetrics.receivedYear, tone: "border-b-amber-400 text-amber-500" },
            ].map((item) => (
              <Link key={item.label} href="/cashbook" className={`surface-card surface-card-interactive flex items-center justify-between rounded-xl border-b-[3px] p-4 ${item.tone}`}><div><p className="text-xl font-semibold text-[#455a64] sm:text-2xl">{money(item.value)}</p><p className="mt-1 text-sm text-gray-500">{item.label}</p></div><CircleDollarSign className="size-9 opacity-70" /></Link>
            ))}
          </section>

          <section className="mt-4 flex flex-wrap gap-2" aria-label="Attention required">
            <Link href="/tasks" className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-medium transition hover:-translate-y-0.5 ${staffMetrics.overdueTasks ? "border-rose-200 bg-rose-50 text-rose-700" : "border-gray-200 bg-white text-gray-500"}`}><Clock3 className="size-3.5" />{staffMetrics.overdueTasks} overdue tasks</Link>
            <Link href="/approvals?status=UNDER_PROCESS" className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-medium transition hover:-translate-y-0.5 ${staffMetrics.pendingApprovals ? "border-amber-200 bg-amber-50 text-amber-700" : "border-gray-200 bg-white text-gray-500"}`}><CheckCircle2 className="size-3.5" />{staffMetrics.pendingApprovals} pending approvals</Link>
            <Link href="/notifications" className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-medium transition hover:-translate-y-0.5 ${staffMetrics.unreadNotifications ? "border-sky-200 bg-sky-50 text-sky-700" : "border-gray-200 bg-white text-gray-500"}`}><Bell className="size-3.5" />{staffMetrics.unreadNotifications} unread notifications</Link>
          </section>
        </>
      ) : null}

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(300px,0.8fr)]">
        <div className="grid min-w-0 gap-4 lg:grid-cols-2">
          <section className="surface-card rounded-xl p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3"><div><h2 className="font-medium text-gray-700">Lead activity</h2><p className="mt-1 text-xs text-gray-400">New leads during the last six months</p></div><TrendingUp className="size-5 text-[#20aee3]" /></div>
            <div className="mt-6 flex h-52 items-end gap-2 border-b border-gray-100 px-1" role="img" aria-label="New leads by month">
              {leadMetrics.monthlyLeads.map((bucket) => <div key={bucket.key} className="group flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2"><span className="text-xs font-medium text-gray-500 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">{bucket.count}</span><div title={`${bucket.label}: ${bucket.count} leads`} className="w-full max-w-12 rounded-t-md bg-gradient-to-t from-[#20aee3] to-sky-300 transition-all duration-500 group-hover:from-sky-500" style={{ height: `${metricBarHeight(bucket.count, monthlyMaximum)}%` }} /><span className="pb-2 text-[10px] text-gray-400 sm:text-xs">{bucket.label}</span></div>)}
            </div>
          </section>

          <section className="surface-card rounded-xl p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3"><div><h2 className="font-medium text-gray-700">Lead pipeline</h2><p className="mt-1 text-xs text-gray-400">Current status distribution</p></div><Link href="/leads" className="inline-flex items-center gap-1 text-xs font-medium text-[#20aee3]">View leads<ArrowRight className="size-3.5" /></Link></div>
            <div className="mt-5 grid gap-3">
              {leadMetrics.stages.length === 0 ? <p className="py-16 text-center text-sm text-gray-400">No lead activity yet.</p> : leadMetrics.stages.map((bucket) => <div key={bucket.key}><div className="mb-1.5 flex items-center justify-between gap-3 text-xs"><span className="truncate text-gray-500">{databaseStageLabels[bucket.key] ?? bucket.label}</span><span className="font-medium text-gray-700">{bucket.count}</span></div><div className="h-2 overflow-hidden rounded-full bg-[#edf3f5]"><div className="h-full rounded-full bg-gradient-to-r from-[#20aee3] to-sky-300 transition-[width] duration-500" style={{ width: `${Math.max(4, Math.round((bucket.count / stageMaximum) * 100))}%` }} /></div></div>)}
            </div>
          </section>

          {staffMetrics ? (
            <section className="surface-card rounded-xl p-4 sm:p-5 lg:col-span-2">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><h2 className="font-medium text-gray-700">Income and expense</h2><p className="mt-1 text-xs text-gray-400">Six-month cash movement in PKR</p></div><div className="flex gap-4 text-xs"><span className="inline-flex items-center gap-1.5 text-gray-500"><i className="size-2.5 rounded-sm bg-emerald-400" />Income</span><span className="inline-flex items-center gap-1.5 text-gray-500"><i className="size-2.5 rounded-sm bg-rose-300" />Expense</span></div></div>
              <div className="mt-6 flex h-64 items-end gap-3 overflow-x-auto border-b border-gray-100 px-1 pb-0" role="img" aria-label="Monthly income and expense">
                {staffMetrics.cashflow.map((bucket) => <div key={bucket.key} className="flex h-full min-w-14 flex-1 flex-col items-center justify-end"><div className="flex h-[calc(100%_-_28px)] w-full items-end justify-center gap-1"><div title={`${bucket.label} income: ${money(bucket.income)}`} className="w-[38%] max-w-8 rounded-t bg-emerald-400 transition-all duration-500 hover:bg-emerald-500" style={{ height: `${metricBarHeight(Number(bucket.income), cashMaximum)}%` }} /><div title={`${bucket.label} expense: ${money(bucket.expense)}`} className="w-[38%] max-w-8 rounded-t bg-rose-300 transition-all duration-500 hover:bg-rose-400" style={{ height: `${metricBarHeight(Number(bucket.expense), cashMaximum)}%` }} /></div><span className="py-2 text-xs text-gray-400">{bucket.label}</span></div>)}
              </div>
            </section>
          ) : (
            <section className="surface-card rounded-xl p-4 sm:p-5 lg:col-span-2">
              <div className="flex items-center justify-between gap-3"><div><h2 className="font-medium text-gray-700">Lead priorities</h2><p className="mt-1 text-xs text-gray-400">Your active portfolio by priority</p></div><Link href="/leads" className="text-xs font-medium text-[#20aee3]">Open CRM</Link></div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{leadMetrics.priorities.map((bucket) => <article key={bucket.key} className="rounded-lg border border-gray-100 bg-[#f8fbfc] p-4"><p className="text-xl font-medium text-gray-700">{bucket.count}</p><p className="mt-1 text-xs text-gray-400">{databasePriorityLabels[bucket.key] ?? bucket.label}</p></article>)}</div>
            </section>
          )}
        </div>

        <aside className="grid content-start gap-4">
          <section className="surface-card overflow-hidden rounded-xl">
            <header className="flex items-center justify-between border-b border-gray-100 px-4 py-4"><div><h2 className="font-medium text-gray-700">Recent leads</h2><p className="mt-1 text-xs text-gray-400">Latest portfolio updates</p></div><ContactRound className="size-5 text-[#20aee3]" /></header>
            <div className="divide-y divide-gray-100">{data.recentLeads.length === 0 ? <p className="px-4 py-12 text-center text-sm text-gray-400">No active leads yet.</p> : data.recentLeads.map((lead) => <Link key={lead.id} href={`/leads/${lead.id}`} className="group flex items-center justify-between gap-3 px-4 py-3.5 transition hover:bg-[#f8fbfc]"><div className="min-w-0"><p className="truncate text-sm font-medium capitalize text-gray-700 group-hover:text-[#20aee3]">{lead.clientName ?? "Unnamed lead"}</p><p className="mt-1 truncate text-[11px] text-gray-400">{displayLeadUid(lead.uid, lead.id)} · {lead.project?.title ?? "No project"}</p></div><div className="shrink-0 text-right"><p className="text-[10px] font-medium text-gray-500">{stageLabels[lead.stage]}</p><p className="mt-1 text-[10px] text-gray-300">{pakistanDateTime.format(lead.updatedAt)}</p></div></Link>)}</div>
            <Link href="/leads" className="flex items-center justify-center gap-1 border-t border-gray-100 px-4 py-3 text-xs font-medium text-[#20aee3] transition hover:bg-sky-50">View all leads<ArrowRight className="size-3.5" /></Link>
          </section>

          {data.isStaff ? (
            <section className="surface-card overflow-hidden rounded-xl">
              <header className="flex items-center justify-between border-b border-gray-100 px-4 py-4"><div><h2 className="font-medium text-gray-700">Upcoming schedule</h2><p className="mt-1 text-xs text-gray-400">Your next calendar events</p></div><CalendarDays className="size-5 text-[#20aee3]" /></header>
              <div className="divide-y divide-gray-100">{data.upcomingEvents.length === 0 ? <p className="px-4 py-10 text-center text-sm text-gray-400">Your schedule is clear.</p> : data.upcomingEvents.map((event) => <article key={event.id} className="flex gap-3 px-4 py-3.5"><span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-[#20aee3]"><CalendarDays className="size-4" /></span><div className="min-w-0"><p className="truncate text-sm font-medium text-gray-700">{event.title}</p><time dateTime={event.startsAt.toISOString()} className="mt-1 block text-[11px] text-gray-400">{pakistanDateTime.format(event.startsAt)}</time></div></article>)}</div>
              <Link href="/calendar" className="flex items-center justify-center gap-1 border-t border-gray-100 px-4 py-3 text-xs font-medium text-[#20aee3] transition hover:bg-sky-50">Open calendar<ArrowRight className="size-3.5" /></Link>
            </section>
          ) : null}

          {staffMetrics ? <section className="rounded-xl bg-gradient-to-br from-[#20aee3] to-sky-500 p-5 text-white shadow-lg shadow-sky-200/40"><div className="flex items-center gap-2 text-sm font-medium"><Banknote className="size-4" />Quick access</div><p className="mt-2 text-xs leading-5 text-sky-50">Review operational records without leaving your daily workspace.</p><div className="mt-4 grid grid-cols-2 gap-2"><Link href="/sales" className="rounded-lg bg-white/15 px-3 py-2 text-center text-xs font-medium transition hover:bg-white/25">Sales</Link><Link href="/cashbook" className="rounded-lg bg-white/15 px-3 py-2 text-center text-xs font-medium transition hover:bg-white/25">Cash book</Link></div></section> : null}
        </aside>
      </div>
    </div>
  );
}

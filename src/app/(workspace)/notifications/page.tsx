import { Bell, CheckCheck, ClipboardCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { markAllNotificationsReadAction, markNotificationReadAction } from "@/features/notifications/actions";
import { getNotificationCenter } from "@/features/notifications/queries";

export const metadata: Metadata = { title: "Notifications" };

function notificationTarget(payload: unknown): { href: `/tasks/${string}` | `/approvals/${string}`; label: string } | null {
  if (!payload || typeof payload !== "object") return null;
  if ("taskId" in payload && typeof (payload as { taskId?: unknown }).taskId === "string") {
    return { href: `/tasks/${(payload as { taskId: string }).taskId}`, label: "Open task" };
  }
  if ("approvalId" in payload && typeof (payload as { approvalId?: unknown }).approvalId === "string") {
    return { href: `/approvals/${(payload as { approvalId: string }).approvalId}`, label: "Open request" };
  }
  return null;
}

export default async function NotificationsPage() {
  const data = await getNotificationCenter();
  if (!data) redirect("/login?next=/notifications");

  return (
    <div className="mx-auto w-full max-w-5xl">
      <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-xs text-gray-500 sm:text-sm"><Link href="/dashboard" className="hover:text-[#20aee3]">Dashboard</Link><span aria-hidden>›</span><span aria-current="page">Notifications</span></nav>
      <div className="mt-2 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div><h1 className="text-[28px] font-light text-[#20aee3] sm:text-[32px]">Notifications</h1><p className="mt-1 text-sm text-gray-500">Task, approval, and important CRM updates for your account.</p></div>
        {data.unreadCount ? <form action={markAllNotificationsReadAction}><button className="inline-flex h-10 items-center gap-2 rounded-md border border-sky-200 bg-white px-4 text-sm font-medium text-[#20aee3] transition hover:bg-sky-50"><CheckCheck className="size-4" />Mark all read</button></form> : null}
      </div>

      <section className="surface-card mt-6 overflow-hidden rounded-lg">
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 sm:px-5"><div className="flex items-center gap-2 text-sm font-medium text-gray-700"><Bell className="size-4 text-[#20aee3]" />Recent notifications</div><span className="rounded-full bg-sky-50 px-2.5 py-1 text-xs text-[#20aee3]">{data.unreadCount} unread</span></div>
        <div className="divide-y divide-gray-100">
          {data.notifications.length === 0 ? <div className="px-5 py-16 text-center"><Bell className="mx-auto size-8 text-gray-300" /><p className="mt-3 text-sm text-gray-400">No notifications yet.</p></div> : data.notifications.map((notification) => {
            const target = notificationTarget(notification.payload);
            const markRead = markNotificationReadAction.bind(null, notification.id);
            return <article key={notification.id} className={`flex gap-3 px-4 py-4 transition hover:bg-[#f8fbfc] sm:px-5 ${notification.readAt ? "bg-white" : "bg-sky-50/45"}`}><span className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full ${notification.readAt ? "bg-gray-100 text-gray-400" : "bg-sky-100 text-[#20aee3]"}`}><ClipboardCheck className="size-4" /></span><div className="min-w-0 flex-1"><div className="flex flex-col justify-between gap-1 sm:flex-row sm:items-start"><div><h2 className="text-sm font-medium text-gray-700">{notification.title ?? "CRM update"}</h2><p className="mt-1 text-sm leading-6 text-gray-500">{notification.description}</p></div><time className="shrink-0 text-[11px] text-gray-400">{notification.createdAt.toLocaleString()}</time></div><div className="mt-3 flex items-center gap-3">{target ? <Link href={target.href} className="text-xs font-medium text-[#20aee3] hover:text-sky-700">{target.label}</Link> : null}{!notification.readAt ? <form action={markRead}><button className="text-xs font-medium text-gray-500 hover:text-[#20aee3]">Mark as read</button></form> : <span className="text-[11px] text-gray-400">Read</span>}</div></div></article>;
          })}
        </div>
      </section>
    </div>
  );
}

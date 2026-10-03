"use client";

import { Bell, Clock3, LogOut, Menu, X } from "lucide-react";
import Link from "next/link";
import { type ReactNode, useEffect, useState } from "react";

import { signOutAction } from "@/app/auth/actions";
import { BrandWordmark } from "@/components/brand-wordmark";
import { WorkspaceNavigation } from "@/components/workspace-navigation";
import type { AuthContext } from "@/lib/auth/session";

const roleLabels = {
  CLIENT: "Client",
  EMPLOYEE: "Employee",
  MANAGER: "Manager",
  SUPER_ADMIN: "Super admin",
} as const;

function Clock() {
  const [time, setTime] = useState("");

  useEffect(() => {
    const update = () => setTime(new Date().toLocaleTimeString());
    update();
    const timer = window.setInterval(update, 1_000);
    return () => window.clearInterval(timer);
  }, []);

  return <span suppressHydrationWarning>{time}</span>;
}

export function AppShell({ auth, children }: { auth: AuthContext; children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!sidebarOpen) return;

    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSidebarOpen(false);
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [sidebarOpen]);

  return (
    <div className="min-h-screen bg-[#f6f9fa] font-sans text-[#67757c] md:flex">
      <a
        href="#main-content"
        className="fixed left-4 top-3 z-[200] -translate-y-20 rounded-md bg-[#20aee3] px-4 py-2 text-sm font-medium text-white shadow-lg transition-transform focus:translate-y-0"
      >
        Skip to content
      </a>
      {sidebarOpen ? (
        <button type="button" aria-label="Close navigation" onClick={() => setSidebarOpen(false)} className="overlay-enter fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-[1px] md:hidden" />
      ) : null}

      <aside className={`fixed inset-y-0 left-0 z-50 flex w-[min(82vw,240px)] flex-col border-r border-[#eeeff0] bg-white shadow-2xl transition-transform duration-300 ease-out md:sticky md:top-0 md:h-screen md:w-[220px] md:translate-x-0 md:shadow-none ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-[#eeeff0] px-4">
          <Link href="/dashboard" onClick={() => setSidebarOpen(false)} className="flex flex-1 justify-center">
            <BrandWordmark className="text-xl" />
          </Link>
          <button type="button" onClick={() => setSidebarOpen(false)} className="rounded-md p-2 text-slate-500 transition hover:bg-slate-50 hover:text-[#20aee3] md:hidden" aria-label="Close navigation"><X className="size-5" /></button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto py-[5px]">
          <WorkspaceNavigation role={auth.membership.role} onNavigate={() => setSidebarOpen(false)} />
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-[#eeeff0] bg-white/95 px-2 shadow-[0_1px_10px_rgba(30,60,75,0.035)] backdrop-blur sm:px-5">
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setSidebarOpen(true)} className="rounded-md p-2 text-slate-600 transition hover:bg-[#ebf2f5] hover:text-[#20aee3] md:hidden" aria-label="Open navigation"><Menu className="size-6" /></button>
            <p className="hidden items-center gap-1.5 text-lg font-light tabular-nums text-[#20aee3] min-[400px]:flex sm:text-xl"><Clock3 className="size-5 sm:size-6" /><Clock /></p>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <Link href="/notifications" title="Notifications" aria-label="Open notifications" className="relative rounded-full p-2 text-slate-500 transition hover:bg-[#ebf2f5] hover:text-[#20aee3]"><Bell className="size-5 sm:size-6" /></Link>
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium capitalize text-slate-700">{auth.profile.displayName}</p>
              <p className="text-xs text-slate-400">{roleLabels[auth.membership.role]}</p>
            </div>
            <span title={auth.profile.displayName} className="flex size-9 items-center justify-center rounded-full bg-[#ebf2f5] text-sm font-medium text-[#20aee3] ring-2 ring-white">{auth.profile.displayName.slice(0, 1).toUpperCase()}</span>
            <form action={signOutAction}>
              <button type="submit" title="Sign out" className="rounded-md p-2 text-slate-500 transition hover:bg-[#ebf2f5] hover:text-[#20aee3]"><LogOut className="size-5" /><span className="sr-only">Sign out</span></button>
            </form>
          </div>
        </header>
        <main id="main-content" tabIndex={-1} className="page-enter w-full p-3 outline-none sm:p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}

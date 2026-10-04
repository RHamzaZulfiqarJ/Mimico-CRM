"use client";

import {
  Banknote,
  CalendarDays,
  ChevronDown,
  CircleDollarSign,
  ClipboardCheck,
  ContactRound,
  FileText,
  FolderKanban,
  House,
  ListChecks,
  ReceiptText,
  Settings,
  ShoppingCart,
  UserRound,
  UsersRound,
  Warehouse,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

import type { MembershipRole } from "@/lib/auth/authorization";

type NavigationProps = { role: MembershipRole; onNavigate?: () => void };
const itemClass = "group flex min-h-11 w-full items-center gap-2 border-l-[3px] px-4 text-left text-sm font-light transition-all duration-200";

function NavigationGroup({ name, icon: Icon, open, onToggle, children }: { name: string; icon: LucideIcon; open: boolean; onToggle: () => void; children: ReactNode }) {
  return (
    <div>
      <button type="button" aria-expanded={open} onClick={onToggle} className={`${itemClass} justify-between ${open ? "border-l-[#20aee3] bg-sky-50/70 font-medium text-[#20aee3]" : "border-l-transparent text-gray-700 hover:border-l-[#20aee3] hover:bg-slate-50 hover:text-[#20aee3]"}`}>
        <span className="flex min-w-0 items-center gap-2"><Icon className="size-[21px] shrink-0 stroke-[1.4] transition-transform group-hover:scale-105" />{name}</span><ChevronDown className={`size-4 shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>
      <div className={`grid transition-[grid-template-rows,opacity] duration-200 ${open ? "visible grid-rows-[1fr] opacity-100" : "invisible grid-rows-[0fr] opacity-0"}`} aria-hidden={!open}>
        <div className="overflow-hidden pl-4">{children}</div>
      </div>
    </div>
  );
}

export function WorkspaceNavigation({ role, onNavigate }: NavigationProps) {
  const pathname = usePathname();
  const [openGroup, setOpenGroup] = useState<string | null>(() => {
    if (pathname.startsWith("/team") || pathname.startsWith("/clients")) return "User";
    if (pathname.startsWith("/reference-data")) return "Inventory";
    if ((pathname.startsWith("/approvals") || pathname.startsWith("/refunds")) && (role === "MANAGER" || role === "SUPER_ADMIN")) return "Authorization";
    if (pathname.startsWith("/cashbook")) return "Cash Book";
    return null;
  });
  const management = role === "MANAGER" || role === "SUPER_ADMIN";
  const staff = role !== "CLIENT";
  const linkClass = (active: boolean) => `${itemClass} ${active ? "border-l-[#20aee3] bg-sky-50/70 font-medium text-[#20aee3]" : "border-l-transparent text-gray-700 hover:border-l-[#20aee3] hover:bg-slate-50 hover:text-[#20aee3]"}`;

  return (
    <nav className="flex flex-col gap-1 py-1">
      <Link href="/dashboard" aria-current={pathname === "/dashboard" ? "page" : undefined} onClick={onNavigate} className={linkClass(pathname === "/dashboard")}><House className="size-[21px] stroke-[1.4] transition-transform group-hover:scale-105" />Dashboard</Link>
      <Link href="/leads" aria-current={pathname.startsWith("/leads") ? "page" : undefined} onClick={onNavigate} className={linkClass(pathname.startsWith("/leads"))}><ContactRound className="size-[21px] stroke-[1.4] transition-transform group-hover:scale-105" />Leads</Link>
      {staff ? <><Link href="/tasks" aria-current={pathname.startsWith("/tasks") ? "page" : undefined} onClick={onNavigate} className={linkClass(pathname.startsWith("/tasks"))}><ListChecks className="size-[21px] stroke-[1.4] transition-transform group-hover:scale-105" />To Do Tasks</Link><Link href="/calendar" aria-current={pathname.startsWith("/calendar") ? "page" : undefined} onClick={onNavigate} className={linkClass(pathname.startsWith("/calendar"))}><CalendarDays className="size-[21px] stroke-[1.4] transition-transform group-hover:scale-105" />Calendar</Link></> : null}
      {staff ? <NavigationGroup name="User" icon={UserRound} open={openGroup === "User"} onToggle={() => setOpenGroup(openGroup === "User" ? null : "User")}>
        <Link href="/clients" onClick={onNavigate} className={linkClass(pathname.startsWith("/clients"))}><UsersRound className="size-[22px] stroke-[1.4]" />Clients</Link>
        {management ? <Link href="/team" onClick={onNavigate} className={linkClass(pathname.startsWith("/team"))}><UsersRound className="size-[22px] stroke-[1.4]" />Employees</Link> : null}
      </NavigationGroup> : null}
      {management ? <NavigationGroup name="Authorization" icon={ClipboardCheck} open={openGroup === "Authorization"} onToggle={() => setOpenGroup(openGroup === "Authorization" ? null : "Authorization")}><Link href="/approvals" onClick={onNavigate} className={linkClass(pathname.startsWith("/approvals"))}><ClipboardCheck className="size-[22px] stroke-[1.4]" />Approvals</Link><Link href="/refunds" onClick={onNavigate} className={linkClass(pathname.startsWith("/refunds"))}><CircleDollarSign className="size-[22px] stroke-[1.4]" />Refunds</Link></NavigationGroup> : staff ? <><Link href="/approvals" aria-current={pathname.startsWith("/approvals") ? "page" : undefined} onClick={onNavigate} className={linkClass(pathname.startsWith("/approvals"))}><ClipboardCheck className="size-[21px] stroke-[1.4]" />Approvals</Link><Link href="/refunds" aria-current={pathname.startsWith("/refunds") ? "page" : undefined} onClick={onNavigate} className={linkClass(pathname.startsWith("/refunds"))}><CircleDollarSign className="size-[21px] stroke-[1.4]" />Refunds</Link></> : null}
      {management ? (
        <NavigationGroup name="Inventory" icon={Warehouse} open={openGroup === "Inventory"} onToggle={() => setOpenGroup(openGroup === "Inventory" ? null : "Inventory")}>
          <Link href="/reference-data#societies" onClick={onNavigate} className={linkClass(false)}><FolderKanban className="size-[22px] stroke-[1.4]" />Societies</Link>
          <Link href="/reference-data#projects" onClick={onNavigate} className={linkClass(false)}><FolderKanban className="size-[22px] stroke-[1.4]" />Projects</Link>
          <Link href="/reference-data#inventories" onClick={onNavigate} className={linkClass(false)}><Warehouse className="size-[22px] stroke-[1.4]" />Inventories</Link>
        </NavigationGroup>
      ) : <Link href="/reference-data" onClick={onNavigate} className={linkClass(pathname.startsWith("/reference-data"))}><Warehouse className="size-[22px] stroke-[1.4]" />Inventories</Link>}
      {staff ? <Link href="/sales" aria-current={pathname.startsWith("/sales") ? "page" : undefined} onClick={onNavigate} className={linkClass(pathname.startsWith("/sales"))}><ShoppingCart className="size-[21px] stroke-[1.4] transition-transform group-hover:scale-105" />Sales</Link> : null}
      {management ? <Link href="/payroll" aria-current={pathname.startsWith("/payroll") ? "page" : undefined} onClick={onNavigate} className={linkClass(pathname.startsWith("/payroll"))}><FileText className="size-[21px] stroke-[1.4] transition-transform group-hover:scale-105" />Transcript</Link> : null}
      {staff ? <NavigationGroup name="Cash Book" icon={Banknote} open={openGroup === "Cash Book"} onToggle={() => setOpenGroup(openGroup === "Cash Book" ? null : "Cash Book")}><Link href="/cashbook" onClick={onNavigate} className={linkClass(pathname.startsWith("/cashbook"))}><CircleDollarSign className="size-[22px] stroke-[1.4]" />All Cash Book</Link><Link href={{ pathname: "/cashbook", hash: "filters" }} onClick={onNavigate} className={linkClass(false)}><ClipboardCheck className="size-[22px] stroke-[1.4]" />View Cash Book</Link></NavigationGroup> : null}
      {staff ? <Link href="/vouchers" aria-current={pathname.startsWith("/vouchers") ? "page" : undefined} onClick={onNavigate} className={linkClass(pathname.startsWith("/vouchers"))}><ReceiptText className="size-[21px] stroke-[1.4] transition-transform group-hover:scale-105" />Vouchers</Link> : null}
      {management ? <Link href="/integrations/facebook" aria-current={pathname.startsWith("/integrations") ? "page" : undefined} onClick={onNavigate} className={linkClass(pathname.startsWith("/integrations"))}><Settings className="size-[21px] stroke-[1.4] transition-transform group-hover:rotate-12" />Integrations</Link> : null}
    </nav>
  );
}

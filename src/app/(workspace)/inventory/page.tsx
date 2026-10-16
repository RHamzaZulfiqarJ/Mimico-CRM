import { Archive, CheckCircle2, Clock3, Filter, LayoutGrid, List, PackageOpen, Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { InventoryCreateDialog } from "@/components/inventory/inventory-create-dialog";
import { InventoryKanban } from "@/components/inventory/inventory-kanban";
import { archiveReferenceRecordAction } from "@/features/reference-data/actions";
import { getInventoryWorkspace } from "@/features/reference-data/queries";
import { inventoryStatusLabels, inventoryStatuses } from "@/features/reference-data/schemas";
import { canDeleteOperationalRecord } from "@/lib/auth/authorization";

export const metadata: Metadata = { title: "Inventory" };

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function money(value: { toString(): string } | null) {
  if (!value) return "—";
  return new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: "PKR",
    minimumFractionDigits: 2,
  }).format(Number(value.toString()));
}

function personLabel(person: { firstName: string | null; lastName: string | null; username: string | null; email: string | null } | null) {
  if (!person) return "System";
  return [person.firstName, person.lastName].filter(Boolean).join(" ") || person.username || person.email || "Team member";
}

const statusClass = {
  UNSOLD: "border-sky-200 bg-sky-50 text-sky-600",
  UNDER_PROCESS: "border-amber-200 bg-amber-50 text-amber-700",
  SOLD: "border-emerald-200 bg-emerald-50 text-emerald-700",
} as const;

function ArchiveInventoryButton({ inventoryId }: { inventoryId: string }) {
  return (
    <form action={archiveReferenceRecordAction.bind(null, "inventory", inventoryId)}>
      <button type="submit" title="Archive inventory" aria-label="Archive inventory" className="inline-flex size-8 items-center justify-center rounded-md border border-gray-200 text-gray-500 transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-500"><Archive className="size-4" /></button>
    </form>
  );
}

export default async function InventoryPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const raw = await searchParams;
  const data = await getInventoryWorkspace({
    query: first(raw.query),
    view: first(raw.view),
    status: first(raw.status),
    projectId: first(raw.projectId),
  });
  if (!data) redirect("/dashboard");

  const canArchive = canDeleteOperationalRecord(data.auth.membership.role);
  const activeFilterCount = [data.filters.status, data.filters.projectId].filter(Boolean).length;
  const inventoryHref = (view: "list" | "board") => {
    const query: Record<string, string> = {};
    if (view === "board") query.view = "board";
    if (data.filters.query) query.query = data.filters.query;
    if (data.filters.status) query.status = data.filters.status;
    if (data.filters.projectId) query.projectId = data.filters.projectId;
    return { pathname: "/inventory" as const, query };
  };
  const clearFilterHref = {
    pathname: "/inventory" as const,
    query: {
      ...(data.filters.view === "board" ? { view: "board" } : {}),
      ...(data.filters.query ? { query: data.filters.query } : {}),
    },
  };
  const boardInventories = data.inventories.map((inventory) => ({
    id: inventory.id,
    uid: inventory.uid ?? inventory.id.slice(0, 8),
    property: inventory.propertyNumber ?? inventory.propertyStreetNumber ?? "Property",
    project: inventory.project?.title ?? "Unassigned",
    seller: inventory.sellerName ?? "Unknown seller",
    sellerPhone: inventory.sellerPhone,
    sellerCity: inventory.sellerCity,
    price: money(inventory.price),
    status: inventory.status,
    created: inventory.createdAt.toLocaleDateString("en-GB"),
  }));

  return (
    <div className="mx-auto w-full max-w-[1500px] font-sans">
      <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-xs text-[#67757c] sm:text-sm"><Link href="/dashboard" className="transition hover:text-[#20aee3]">Dashboard</Link><span aria-hidden>›</span><span aria-current="page">Inventory</span></nav>

      <div className="mt-2 flex flex-col justify-between gap-4 pb-5 lg:flex-row lg:items-center lg:pb-8">
        <div><h1 className="text-[28px] font-light text-[#20aee3] sm:text-[32px]">Inventory</h1><p className="mt-1 text-xs text-gray-400">{data.total} {data.total === 1 ? "property" : "properties"} in this view</p></div>
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
          <form action="/inventory" className="relative w-full sm:w-56">
            <input type="hidden" name="view" value={data.filters.view} />
            {data.filters.status ? <input type="hidden" name="status" value={data.filters.status} /> : null}
            {data.filters.projectId ? <input type="hidden" name="projectId" value={data.filters.projectId} /> : null}
            <Search className="pointer-events-none absolute left-2 top-2.5 size-5 text-[#a6b5bd]" />
            <input name="query" aria-label="Search inventory" defaultValue={data.filters.query} placeholder="Search inventory" className="h-10 w-full rounded-md bg-[#ebf2f5] pl-9 pr-2 text-sm text-gray-700 outline-none transition focus:bg-white focus:ring-2 focus:ring-[#20aee3]/25" />
          </form>
          <div className="flex items-center gap-2">
            <Link href={inventoryHref(data.filters.view === "board" ? "list" : "board")} role="button" aria-pressed={data.filters.view === "board"} aria-label={data.filters.view === "board" ? "Switch to list view" : "Switch to Kanban view"} title={data.filters.view === "board" ? "Switch to list view" : "Switch to Kanban view"} className={`flex size-10 shrink-0 items-center justify-center rounded-md bg-[#ebf2f5] text-[#82949d] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#dfe6e8] hover:text-[#20aee3] hover:shadow-sm ${data.filters.view === "board" ? "bg-sky-50 text-[#20aee3] ring-1 ring-sky-200" : ""}`}>{data.filters.view === "board" ? <List className="size-5" /> : <LayoutGrid className="size-5" />}</Link>
            <details className="relative shrink-0">
              <summary aria-label="Filter inventory" title="Filter inventory" className="relative flex size-10 cursor-pointer list-none items-center justify-center rounded-md bg-[#ebf2f5] text-[#82949d] transition hover:bg-[#dfe6e8] hover:text-[#20aee3]"><Filter className="size-5" />{activeFilterCount ? <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-[#ff5c6c] text-[9px] font-semibold text-white">{activeFilterCount}</span> : null}</summary>
              <form action="/inventory" className="dialog-enter fixed left-3 right-3 top-20 z-50 grid gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-2xl sm:absolute sm:left-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-72">
                <div className="flex items-center justify-between"><p className="text-sm font-medium text-gray-700">Filter inventory</p>{activeFilterCount ? <span className="text-xs text-[#20aee3]">{activeFilterCount} active</span> : null}</div>
                <input type="hidden" name="query" value={data.filters.query ?? ""} /><input type="hidden" name="view" value={data.filters.view} />
                <select name="status" defaultValue={data.filters.status ?? ""} className="h-10 rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-700"><option value="">All statuses</option>{inventoryStatuses.map((status) => <option key={status} value={status}>{inventoryStatusLabels[status]}</option>)}</select>
                <select name="projectId" defaultValue={data.filters.projectId ?? ""} className="h-10 rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-700"><option value="">All projects</option>{data.projects.map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}</select>
                <div className="flex justify-end gap-2"><Link href={clearFilterHref} className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 transition hover:bg-gray-50">Clear</Link><button className="rounded-md bg-[#20aee3] px-3 py-2 text-sm text-white transition hover:bg-[#179bd0]">Apply</button></div>
              </form>
            </details>
            <InventoryCreateDialog projects={data.projects} />
          </div>
        </div>
      </div>

      <section className="mb-5 grid gap-3 sm:grid-cols-3" aria-label="Inventory totals">
        {[{ label: "Unsold", value: data.counts.unsold, icon: PackageOpen, color: "text-sky-500" }, { label: "Under process", value: data.counts.underProcess, icon: Clock3, color: "text-amber-500" }, { label: "Sold", value: data.counts.sold, icon: CheckCircle2, color: "text-emerald-600" }].map((item) => { const Icon = item.icon; return <article key={item.label} className="surface-card surface-card-interactive flex items-center gap-4 rounded-lg p-5"><span className={`flex size-11 items-center justify-center rounded-lg bg-[#ebf2f5] ${item.color}`}><Icon className="size-5" /></span><div><p className="text-2xl font-medium text-gray-700">{item.value}</p><p className="text-xs text-gray-500">{item.label}</p></div></article>; })}
      </section>

      <section className="surface-card overflow-hidden rounded-lg p-3 sm:p-[15px]">
        {data.filters.view === "board" ? <InventoryKanban key={data.inventories.map((inventory) => `${inventory.id}:${inventory.updatedAt.getTime()}`).join("|")} inventories={boardInventories} /> : <>
          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full min-w-[1050px] border-collapse text-left text-sm font-light text-gray-700">
              <thead><tr className="border-b border-gray-200 text-[#20aee3]"><th className="px-3 py-4 font-medium">ID</th><th className="px-3 py-4 font-medium">Property</th><th className="px-3 py-4 font-medium">Seller</th><th className="px-3 py-4 font-medium">Phone</th><th className="px-3 py-4 font-medium">Project</th><th className="px-3 py-4 font-medium">Price</th><th className="px-3 py-4 font-medium">Status</th><th className="px-3 py-4 font-medium">Created by</th><th className="px-3 py-4 font-medium">Action</th></tr></thead>
              <tbody>{data.inventories.length === 0 ? <tr><td colSpan={9} className="px-3 py-16 text-center text-gray-400">No inventory matches this view.</td></tr> : data.inventories.map((inventory) => <tr key={inventory.id} className="border-b border-gray-100 transition-colors hover:bg-[#f4fafc]"><td className="px-3 py-4">{inventory.uid ?? inventory.id.slice(0, 8)}</td><td className="px-3 py-4 font-medium text-gray-700">{inventory.propertyNumber ?? inventory.propertyStreetNumber ?? "Property"}</td><td className="px-3 py-4">{inventory.sellerName ?? "—"}</td><td className="px-3 py-4">{inventory.sellerPhone ?? "—"}</td><td className="px-3 py-4">{inventory.project?.title ?? "Unassigned"}</td><td className="px-3 py-4">{money(inventory.price)}</td><td className="px-3 py-4"><span className={`inline-flex rounded-full border px-2 py-1 text-xs font-medium ${statusClass[inventory.status]}`}>{inventoryStatusLabels[inventory.status]}</span></td><td className="px-3 py-4">{personLabel(inventory.ownerProfile)}</td><td className="px-3 py-4">{canArchive ? <ArchiveInventoryButton inventoryId={inventory.id} /> : "—"}</td></tr>)}</tbody>
            </table>
          </div>
          <div className="grid gap-3 lg:hidden">{data.inventories.length === 0 ? <div className="rounded-lg border border-dashed border-gray-200 px-4 py-14 text-center text-sm text-gray-400">No inventory matches this view.</div> : data.inventories.map((inventory) => <article key={inventory.id} className="rounded-lg border border-gray-100 bg-[#fbfdfe] p-4 transition hover:border-sky-200 hover:shadow-sm"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-medium text-gray-700">{inventory.propertyNumber ?? inventory.propertyStreetNumber ?? "Property"}</p><p className="mt-1 text-xs text-gray-400">{inventory.uid ?? inventory.id.slice(0, 8)} · {inventory.project?.title ?? "Unassigned"}</p></div><span className={`shrink-0 rounded-full border px-2 py-1 text-[10px] font-medium ${statusClass[inventory.status]}`}>{inventoryStatusLabels[inventory.status]}</span></div><dl className="mt-4 grid grid-cols-2 gap-3 text-xs"><div><dt className="text-gray-400">Seller</dt><dd className="mt-1 truncate text-gray-700">{inventory.sellerName ?? "—"}</dd></div><div><dt className="text-gray-400">Phone</dt><dd className="mt-1 truncate text-gray-700">{inventory.sellerPhone ?? "—"}</dd></div><div><dt className="text-gray-400">Price</dt><dd className="mt-1 text-gray-700">{money(inventory.price)}</dd></div><div><dt className="text-gray-400">Created</dt><dd className="mt-1 text-gray-700">{inventory.createdAt.toLocaleDateString("en-GB")}</dd></div></dl>{canArchive ? <div className="mt-3 flex justify-end border-t border-gray-100 pt-3"><ArchiveInventoryButton inventoryId={inventory.id} /></div> : null}</article>)}</div>
        </>}
        <div className="flex justify-end border-t border-gray-100 px-1 pt-4 text-xs text-gray-500">{data.inventories.length ? `1–${data.inventories.length}` : "0"} of {data.total}{data.total > 100 ? " · Refine filters to see a smaller set" : ""}</div>
      </section>
    </div>
  );
}

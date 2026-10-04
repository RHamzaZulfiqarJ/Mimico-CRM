import { Archive, ChevronRight, RefreshCw, RotateCcw, Search, UserCheck, UsersRound } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { ClientCreateDialog, ClientEditDialog } from "@/components/clients/client-forms";
import { setClientStatusAction } from "@/features/clients/actions";
import { displayClientUid } from "@/features/clients/identifiers";
import { getClientWorkspace } from "@/features/clients/queries";
import { canManageOrganization } from "@/lib/auth/authorization";

export const metadata: Metadata = { title: "Clients" };

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function personLabel(person: { firstName: string | null; lastName: string | null; username: string | null; email: string | null } | null) {
  if (!person) return "Not linked";
  return [person.firstName, person.lastName].filter(Boolean).join(" ") || person.username || person.email || "Portal account";
}

export default async function ClientsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const raw = await searchParams;
  const data = await getClientWorkspace({ query: first(raw.query), status: first(raw.status), page: first(raw.page) });
  if (!data) redirect("/dashboard");
  const canManage = canManageOrganization(data.auth.membership.role);
  const pageHref = (page: number) => ({
    pathname: "/clients" as const,
    query: {
      ...(data.filters.query ? { query: data.filters.query } : {}),
      ...(data.filters.status !== "active" ? { status: data.filters.status } : {}),
      ...(page > 1 ? { page: String(page) } : {}),
    },
  });
  const firstResult = data.clients.length ? (data.pagination.page - 1) * data.pagination.pageSize + 1 : 0;
  const lastResult = data.clients.length ? firstResult + data.clients.length - 1 : 0;

  return (
    <div className="mx-auto w-full max-w-[1500px] font-sans">
      <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-xs text-[#67757c] sm:text-sm"><Link href="/dashboard" className="transition hover:text-[#20aee3]">Dashboard</Link><span aria-hidden>›</span><span>User</span><span aria-hidden>›</span><span aria-current="page">Clients</span></nav>
      <div className="mt-2 flex flex-col justify-between gap-4 pb-6 lg:flex-row lg:items-center">
        <div><h1 className="text-[28px] font-light text-[#20aee3] sm:text-[32px]">Clients</h1><p className="mt-1 text-xs text-gray-400">Organization-scoped client records and portal access</p></div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <form action="/clients" className="flex min-w-0 flex-1 gap-2 sm:flex-none">
            <div className="relative min-w-0 flex-1 sm:w-56"><Search className="pointer-events-none absolute left-2 top-2.5 size-5 text-[#a6b5bd]" /><input name="query" aria-label="Search clients" defaultValue={data.filters.query} placeholder="Search clients" className="h-10 w-full rounded-md bg-[#ebf2f5] pl-9 pr-2 text-sm text-gray-700 outline-none transition focus:bg-white focus:ring-2 focus:ring-[#20aee3]/25" /></div>
            <select name="status" aria-label="Client status" defaultValue={data.filters.status} className="h-10 rounded-md border border-gray-200 bg-white px-3 text-sm text-gray-600"><option value="active">Active</option><option value="inactive">Inactive</option><option value="all">All</option></select>
            <button className="sr-only">Apply filters</button>
          </form>
          <Link href="/clients" aria-label="Refresh clients" title="Refresh" className="flex size-10 shrink-0 items-center justify-center rounded-md bg-[#ebf2f5] text-[#82949d] transition hover:-translate-y-0.5 hover:text-[#20aee3]"><RefreshCw className="size-5" /></Link>
          <ClientCreateDialog portalProfiles={data.portalProfiles} canLinkPortal={canManage} />
        </div>
      </div>

      <section className="surface-card overflow-hidden rounded-lg p-3 sm:p-[15px]">
        <div className="hidden overflow-x-auto lg:block">
          <table className="w-full min-w-[1050px] border-collapse text-left text-sm font-light text-gray-700">
            <thead><tr className="border-b border-gray-200 text-[#20aee3]"><th className="px-3 py-4 font-medium">ID</th><th className="px-3 py-4 font-medium">Client Name</th><th className="px-3 py-4 font-medium">Phone</th><th className="px-3 py-4 font-medium">Email</th><th className="px-3 py-4 font-medium">City</th><th className="px-3 py-4 font-medium">Leads</th><th className="px-3 py-4 font-medium">Portal</th><th className="px-3 py-4 font-medium">Status</th><th className="px-3 py-4 font-medium">Action</th></tr></thead>
            <tbody>{data.clients.length === 0 ? <tr><td colSpan={9} className="px-3 py-16 text-center text-gray-400">No clients found.</td></tr> : data.clients.map((client) => {
              const statusAction = setClientStatusAction.bind(null, client.id, String(!client.isActive));
              return <tr key={client.id} className="border-b border-gray-100 transition-colors hover:bg-[#f4fafc]"><td className="px-3 py-4 font-medium text-gray-600">{displayClientUid(client.uid, client.id)}</td><td className="px-3 py-4 capitalize text-[#20aee3]">{client.displayName}</td><td className="px-3 py-4">{client.phone}</td><td className="px-3 py-4">{client.email ?? "—"}</td><td className="px-3 py-4 capitalize">{client.city ?? "—"}</td><td className="px-3 py-4">{client._count.leads}</td><td className="px-3 py-4">{personLabel(client.portalProfile)}</td><td className="px-3 py-4"><span className={client.isActive ? "rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs text-emerald-700" : "rounded-full border border-gray-200 bg-gray-50 px-2 py-1 text-xs text-gray-500"}>{client.isActive ? "Active" : "Inactive"}</span></td><td className="px-3 py-4"><div className="flex items-center gap-1"><ClientEditDialog client={client} portalProfiles={data.portalProfiles} canLinkPortal={canManage} />{canManage ? <form action={statusAction}><button title={client.isActive ? "Deactivate client" : "Reactivate client"} aria-label={`${client.isActive ? "Deactivate" : "Reactivate"} ${client.displayName}`} className={client.isActive ? "rounded-md p-2 text-rose-500 transition hover:bg-rose-50" : "rounded-md p-2 text-emerald-600 transition hover:bg-emerald-50"}>{client.isActive ? <Archive className="size-4" /> : <RotateCcw className="size-4" />}</button></form> : null}</div></td></tr>;
            })}</tbody>
          </table>
        </div>
        <div className="grid gap-3 lg:hidden">
          {data.clients.length === 0 ? <div className="rounded-lg border border-dashed border-gray-200 px-4 py-14 text-center text-sm text-gray-400">No clients match this view.</div> : data.clients.map((client) => {
            const statusAction = setClientStatusAction.bind(null, client.id, String(!client.isActive));
            return <article key={client.id} className="rounded-lg border border-gray-100 bg-[#fbfdfe] p-4 transition hover:border-sky-200 hover:shadow-sm"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-medium capitalize text-gray-700">{client.displayName}</p><p className="mt-1 text-xs text-gray-400">{displayClientUid(client.uid, client.id)} · {client.createdAt.toLocaleDateString("en-GB")}</p></div><span className={client.isActive ? "shrink-0 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] text-emerald-700" : "shrink-0 rounded-full border border-gray-200 bg-gray-50 px-2 py-1 text-[10px] text-gray-500"}>{client.isActive ? "Active" : "Inactive"}</span></div><dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-xs"><div><dt className="text-gray-400">Phone</dt><dd className="mt-1 truncate text-gray-700">{client.phone}</dd></div><div><dt className="text-gray-400">Email</dt><dd className="mt-1 truncate text-gray-700">{client.email ?? "—"}</dd></div><div><dt className="text-gray-400">Leads</dt><dd className="mt-1 text-gray-700">{client._count.leads}</dd></div><div><dt className="text-gray-400">Portal</dt><dd className="mt-1 truncate text-gray-700">{personLabel(client.portalProfile)}</dd></div></dl><div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3"><span className="inline-flex items-center gap-1 text-xs text-gray-400">{client.portalProfile ? <UserCheck className="size-4 text-emerald-500" /> : <UsersRound className="size-4" />}{client.city ?? "No city"}</span><div className="flex items-center"><ClientEditDialog client={client} portalProfiles={data.portalProfiles} canLinkPortal={canManage} />{canManage ? <form action={statusAction}><button className={client.isActive ? "rounded-md p-2 text-xs text-rose-500 hover:bg-rose-50" : "rounded-md p-2 text-xs text-emerald-600 hover:bg-emerald-50"}>{client.isActive ? "Deactivate" : "Reactivate"}</button></form> : null}<ChevronRight className="size-4 text-gray-300" /></div></div></article>;
          })}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 px-1 pt-4 text-xs text-gray-500"><span>Showing {firstResult}–{lastResult}</span><div className="flex items-center gap-2">{data.pagination.page > 1 ? <Link href={pageHref(data.pagination.page - 1)} className="rounded-md border border-gray-200 bg-white px-3 py-2 transition hover:border-sky-200 hover:text-[#20aee3]">Previous</Link> : <span className="rounded-md border border-gray-100 px-3 py-2 text-gray-300">Previous</span>}<span>Page {data.pagination.page}</span>{data.pagination.hasNext ? <Link href={pageHref(data.pagination.page + 1)} className="rounded-md border border-gray-200 bg-white px-3 py-2 transition hover:border-sky-200 hover:text-[#20aee3]">Next</Link> : <span className="rounded-md border border-gray-100 px-3 py-2 text-gray-300">Next</span>}</div></div>
      </section>
    </div>
  );
}

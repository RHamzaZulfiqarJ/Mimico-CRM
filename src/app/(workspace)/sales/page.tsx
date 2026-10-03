import { Filter, Search, TrendingUp, WalletCards } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import {
  SaleCreateDialog,
  SaleRowActions,
} from "@/components/sales/sale-forms";
import { getSalesWorkspace } from "@/features/sales/queries";
import {
  paymentTypeLabels,
  paymentTypes,
} from "@/features/sales/schemas";
import {
  canDeleteOperationalRecord,
  canManageOrganization,
  canManageSale,
} from "@/lib/auth/authorization";

export const metadata: Metadata = { title: "Sales" };

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function personLabel(person: {
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  email: string | null;
}) {
  return (
    [person.firstName, person.lastName].filter(Boolean).join(" ") ||
    person.username ||
    person.email ||
    "Team member"
  );
}

function money(value: { toString(): string } | null) {
  if (!value) return "PKR 0.00";
  return new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: "PKR",
    minimumFractionDigits: 2,
  }).format(Number(value.toString()));
}

function paymentLabel(value: string | null) {
  if (!value) return "—";
  return paymentTypes.includes(value as (typeof paymentTypes)[number])
    ? paymentTypeLabels[value as (typeof paymentTypes)[number]]
    : value.replaceAll("_", " ");
}

export default async function SalesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const data = await getSalesWorkspace({
    query: first(raw.query),
    staffProfileId: first(raw.staffProfileId),
    paymentType: first(raw.paymentType),
    minProfit: first(raw.minProfit),
    maxProfit: first(raw.maxProfit),
    from: first(raw.from),
    to: first(raw.to),
  });
  if (!data) redirect("/dashboard");

  const canChooseStaff = canManageOrganization(data.auth.membership.role);
  const canDelete = canDeleteOperationalRecord(data.auth.membership.role);
  const staffOptions = data.staff.map((profile) => ({
    id: profile.id,
    label: personLabel(profile),
  }));
  const leadOptions = data.leads.map((lead) => ({
    id: lead.id,
    label: `${lead.uid ? `${lead.uid} · ` : ""}${lead.clientName ?? "Unnamed lead"}`,
  }));
  const activeFilterCount = [
    data.filters.staffProfileId,
    data.filters.paymentType,
    data.filters.minProfit,
    data.filters.maxProfit,
    data.filters.from,
    data.filters.to,
  ].filter(Boolean).length;

  return (
    <div className="mx-auto w-full max-w-[1500px] font-sans">
      <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-xs text-[#67757c] sm:text-sm">
        <Link href="/dashboard" className="transition hover:text-[#20aee3]">Dashboard</Link>
        <span aria-hidden>›</span>
        <span aria-current="page">Sales</span>
      </nav>

      <div className="mt-2 flex flex-col justify-between gap-4 pb-5 lg:flex-row lg:items-center lg:pb-8">
        <div>
          <h1 className="text-[28px] font-light text-[#20aee3] sm:text-[32px]">Sales</h1>
          <p className="mt-1 text-xs text-gray-400">
            {data.total} {data.total === 1 ? "transaction" : "transactions"} in this view
          </p>
        </div>
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
          <form action="/sales" className="relative w-full sm:w-56">
            <Search className="pointer-events-none absolute left-2 top-2.5 size-5 text-[#a6b5bd]" />
            <input
              name="query"
              aria-label="Search sales"
              defaultValue={data.filters.query}
              placeholder="Search sales"
              className="h-10 w-full rounded-md bg-[#ebf2f5] pl-9 pr-2 text-sm text-gray-700 outline-none transition focus:bg-white focus:ring-2 focus:ring-[#20aee3]/25"
            />
          </form>
          <details className="relative shrink-0">
            <summary className="relative flex size-10 cursor-pointer list-none items-center justify-center rounded-md bg-[#ebf2f5] text-[#82949d] transition hover:bg-[#dfe6e8] hover:text-[#20aee3]" aria-label="Filter sales">
              <Filter className="size-5" />
              {activeFilterCount ? (
                <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-[#ff5c6c] text-[9px] font-semibold text-white">
                  {activeFilterCount}
                </span>
              ) : null}
            </summary>
            <form action="/sales" className="dialog-enter fixed left-3 right-3 top-20 z-50 grid gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-2xl sm:absolute sm:left-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-80">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-700">Filter sales</p>
                {activeFilterCount ? <span className="text-xs text-[#20aee3]">{activeFilterCount} active</span> : null}
              </div>
              <input type="hidden" name="query" value={data.filters.query ?? ""} />
              <select name="staffProfileId" defaultValue={data.filters.staffProfileId ?? ""} className="h-10 rounded-md border border-gray-300 bg-white px-3 text-sm">
                <option value="">All staff</option>
                {staffOptions.map((member) => <option key={member.id} value={member.id}>{member.label}</option>)}
              </select>
              <select name="paymentType" defaultValue={data.filters.paymentType ?? ""} className="h-10 rounded-md border border-gray-300 bg-white px-3 text-sm">
                <option value="">All payment types</option>
                {paymentTypes.map((type) => <option key={type} value={type}>{paymentTypeLabels[type]}</option>)}
              </select>
              <div className="grid grid-cols-2 gap-2">
                <input name="minProfit" type="number" min="0" step="0.01" defaultValue={data.filters.minProfit} placeholder="Min profit" className="h-10 min-w-0 rounded-md border border-gray-300 px-3 text-sm" />
                <input name="maxProfit" type="number" min="0" step="0.01" defaultValue={data.filters.maxProfit} placeholder="Max profit" className="h-10 min-w-0 rounded-md border border-gray-300 px-3 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs text-gray-500">From<input name="from" type="date" defaultValue={data.filters.from} className="mt-1 h-10 w-full min-w-0 rounded-md border border-gray-300 px-2 text-sm" /></label>
                <label className="text-xs text-gray-500">To<input name="to" type="date" defaultValue={data.filters.to} className="mt-1 h-10 w-full min-w-0 rounded-md border border-gray-300 px-2 text-sm" /></label>
              </div>
              <div className="flex justify-end gap-2">
                <Link href="/sales" className="rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-600 transition hover:bg-gray-50">Clear</Link>
                <button className="rounded-md bg-[#20aee3] px-3 py-2 text-sm text-white transition hover:bg-[#179bd0]">Apply</button>
              </div>
            </form>
          </details>
          <SaleCreateDialog staff={staffOptions} leads={leadOptions} canChooseStaff={canChooseStaff} />
        </div>
      </div>

      <section className="mb-5 grid gap-3 sm:grid-cols-3">
        <article className="surface-card rounded-lg p-4">
          <div className="flex items-center justify-between text-xs text-gray-400"><span>Net value</span><WalletCards className="size-4 text-[#20aee3]" /></div>
          <p className="mt-2 truncate text-xl font-light text-gray-700">{money(data.totals.netPrice)}</p>
        </article>
        <article className="surface-card rounded-lg p-4">
          <div className="flex items-center justify-between text-xs text-gray-400"><span>Amount received</span><WalletCards className="size-4 text-emerald-500" /></div>
          <p className="mt-2 truncate text-xl font-light text-gray-700">{money(data.totals.receivedAmount)}</p>
        </article>
        <article className="surface-card rounded-lg p-4">
          <div className="flex items-center justify-between text-xs text-gray-400"><span>Profit</span><TrendingUp className="size-4 text-[#ff5c6c]" /></div>
          <p className="mt-2 truncate text-xl font-light text-gray-700">{money(data.totals.profit)}</p>
        </article>
      </section>

      <section className="surface-card overflow-hidden rounded-lg p-3 sm:p-[15px]">
        <div className="hidden overflow-x-auto lg:block">
          <table className="w-full min-w-[1050px] border-collapse text-left text-sm font-light text-gray-700">
            <thead>
              <tr className="border-b border-gray-200 text-[#20aee3]">
                <th className="px-3 py-4 font-medium">ID</th>
                <th className="px-3 py-4 font-medium">Client Name</th>
                <th className="px-3 py-4 font-medium">Profit</th>
                <th className="px-3 py-4 font-medium">Created At</th>
                <th className="px-3 py-4 font-medium">Net Worth</th>
                <th className="px-3 py-4 font-medium">Amount Received</th>
                <th className="px-3 py-4 font-medium">Type of Payment</th>
                <th className="px-3 py-4 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {data.sales.length === 0 ? (
                <tr><td colSpan={8} className="px-3 py-16 text-center text-gray-400">No sales found.</td></tr>
              ) : data.sales.map((sale) => {
                const canEdit = canManageSale({
                  role: data.auth.membership.role,
                  isOwner: sale.staffProfileId === data.auth.profile.id,
                });
                const formPaymentType = paymentTypes.includes(sale.paymentType as (typeof paymentTypes)[number])
                  ? sale.paymentType!
                  : "other";
                return (
                  <tr key={sale.id} className="border-b border-gray-100 transition-colors hover:bg-[#f4fafc]">
                    <td className="px-3 py-4">{sale.uid ?? "—"}</td>
                    <td className="px-3 py-4 capitalize">{sale.clientName ?? "—"}</td>
                    <td className="px-3 py-4 font-medium text-emerald-600">{money(sale.profit)}</td>
                    <td className="px-3 py-4">{sale.createdAt.toLocaleDateString("en-GB")}</td>
                    <td className="px-3 py-4">{money(sale.netPrice)}</td>
                    <td className="px-3 py-4">{money(sale.receivedAmount)}</td>
                    <td className="px-3 py-4 capitalize">{paymentLabel(sale.paymentType)}</td>
                    <td className="px-3 py-4">
                      <SaleRowActions
                        sale={{
                          id: sale.id,
                          staffProfileId: sale.staffProfileId,
                          leadId: sale.lead?.id ?? null,
                          clientName: sale.clientName ?? "",
                          paymentType: formPaymentType,
                          referenceNumber: sale.referenceNumber ?? "",
                          netPrice: sale.netPrice?.toFixed(2) ?? "0.00",
                          receivedAmount: sale.receivedAmount?.toFixed(2) ?? "0.00",
                        }}
                        staff={staffOptions}
                        leads={leadOptions}
                        canChooseStaff={canChooseStaff}
                        canEdit={canEdit}
                        canDelete={canDelete}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="grid gap-3 lg:hidden">
          {data.sales.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-200 px-4 py-14 text-center text-sm text-gray-400">No sales match this view.</div>
          ) : data.sales.map((sale) => {
            const canEdit = canManageSale({ role: data.auth.membership.role, isOwner: sale.staffProfileId === data.auth.profile.id });
            const formPaymentType = paymentTypes.includes(sale.paymentType as (typeof paymentTypes)[number]) ? sale.paymentType! : "other";
            return (
              <article key={sale.id} className="rounded-lg border border-gray-100 bg-[#fbfdfe] p-4 transition hover:border-sky-200 hover:shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0"><p className="truncate text-sm font-medium capitalize text-gray-700">{sale.clientName ?? "Unnamed client"}</p><p className="mt-1 text-xs text-gray-400">{sale.uid ?? "No sale ID"} · {sale.createdAt.toLocaleDateString("en-GB")}</p></div>
                  <span className="rounded-full border border-sky-200 bg-sky-50 px-2 py-1 text-[10px] font-medium capitalize text-[#20aee3]">{paymentLabel(sale.paymentType)}</span>
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
                  <div><dt className="text-gray-400">Net worth</dt><dd className="mt-1 text-gray-700">{money(sale.netPrice)}</dd></div>
                  <div><dt className="text-gray-400">Received</dt><dd className="mt-1 text-gray-700">{money(sale.receivedAmount)}</dd></div>
                  <div><dt className="text-gray-400">Profit</dt><dd className="mt-1 font-medium text-emerald-600">{money(sale.profit)}</dd></div>
                  <div><dt className="text-gray-400">Staff</dt><dd className="mt-1 truncate text-gray-700">{sale.staffName ?? "—"}</dd></div>
                </dl>
                <div className="mt-3 flex justify-end border-t border-gray-100 pt-2">
                  <SaleRowActions
                    sale={{ id: sale.id, staffProfileId: sale.staffProfileId, leadId: sale.lead?.id ?? null, clientName: sale.clientName ?? "", paymentType: formPaymentType, referenceNumber: sale.referenceNumber ?? "", netPrice: sale.netPrice?.toFixed(2) ?? "0.00", receivedAmount: sale.receivedAmount?.toFixed(2) ?? "0.00" }}
                    staff={staffOptions}
                    leads={leadOptions}
                    canChooseStaff={canChooseStaff}
                    canEdit={canEdit}
                    canDelete={canDelete}
                  />
                </div>
              </article>
            );
          })}
        </div>
        <div className="flex justify-between border-t border-gray-100 px-1 pt-4 text-xs text-gray-500 sm:justify-end"><span className="sm:hidden">Results</span><span>{data.sales.length ? `1–${data.sales.length}` : "0"} of {data.total}</span></div>
      </section>
    </div>
  );
}

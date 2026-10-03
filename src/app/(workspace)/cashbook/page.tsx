import { Banknote, CalendarClock, Filter, Search, WalletCards } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import {
  CashbookCreateDialog,
  DeleteCashbookEntryButton,
} from "@/components/cashbook/cashbook-forms";
import { displayCashbookUid } from "@/features/cashbook/identifiers";
import { getCashbookWorkspace } from "@/features/cashbook/queries";
import {
  cashDirectionLabels,
  cashDirections,
  cashPaymentTypeLabels,
  cashPaymentTypes,
} from "@/features/cashbook/schemas";
import {
  canDeleteOperationalRecord,
  canManageOrganization,
} from "@/lib/auth/authorization";

export const metadata: Metadata = { title: "Cash Book" };

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

function money(value: { toString(): string } | string | null) {
  return new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: "PKR",
    minimumFractionDigits: 2,
  }).format(Number(value?.toString() ?? 0));
}

function paymentLabel(value: string | null) {
  if (!value) return "—";
  return cashPaymentTypes.includes(value as (typeof cashPaymentTypes)[number])
    ? cashPaymentTypeLabels[value as (typeof cashPaymentTypes)[number]]
    : value.replaceAll("_", " ");
}

function occurredAtLabel(value: Date) {
  return value.toLocaleString("en-PK", {
    timeZone: "Asia/Karachi",
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default async function CashbookPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const data = await getCashbookWorkspace({
    query: first(raw.query),
    direction: first(raw.direction),
    paymentType: first(raw.paymentType),
    date: first(raw.date),
    page: first(raw.page),
  });
  if (!data) redirect("/dashboard");

  const canChooseStaff = canManageOrganization(data.auth.membership.role);
  const canDelete = canDeleteOperationalRecord(data.auth.membership.role);
  const staffOptions = data.staff.map((profile) => ({
    id: profile.id,
    label: personLabel(profile),
  }));
  const projectOptions = data.projects.map((project) => ({
    id: project.id,
    label: `${project.uid ? `${project.uid} · ` : ""}${project.title}`,
  }));
  const activeFilterCount = [
    data.filters.direction,
    data.filters.paymentType,
    data.filters.date,
  ].filter(Boolean).length;
  const incoming = data.entries.filter((entry) => entry.direction === "IN");
  const outgoing = data.entries.filter((entry) => entry.direction === "OUT");

  const pageHref = (page: number) => {
    return {
      pathname: "/cashbook",
      query: {
        query: data.filters.query,
        direction: data.filters.direction,
        paymentType: data.filters.paymentType,
        date: data.filters.date,
        page: page > 1 ? String(page) : undefined,
      },
    };
  };

  const renderEntries = (
    title: string,
    direction: (typeof cashDirections)[number],
    entries: typeof data.entries,
  ) => (
    <section className="surface-card overflow-hidden rounded-lg p-3 sm:p-[15px]">
      <div className="flex items-center justify-between border-b border-gray-100 px-1 pb-3">
        <div>
          <h2 className="text-lg font-normal text-[#20aee3]">{title}</h2>
          <p className="mt-0.5 text-xs text-gray-400">
            {entries.length} on this page
          </p>
        </div>
        <span
          className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${
            direction === "IN"
              ? "bg-emerald-50 text-emerald-600"
              : "bg-rose-50 text-rose-600"
          }`}
        >
          {cashDirectionLabels[direction]}
        </span>
      </div>

      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full min-w-[1100px] border-collapse text-left text-sm font-light text-gray-700">
          <thead>
            <tr className="border-b border-gray-200 text-[#20aee3]">
              <th className="px-3 py-4 font-medium">ID</th>
              <th className="px-3 py-4 font-medium">Customer</th>
              <th className="px-3 py-4 font-medium">Date</th>
              <th className="px-3 py-4 font-medium">Project</th>
              <th className="px-3 py-4 font-medium">Payment</th>
              <th className="px-3 py-4 font-medium">Amount</th>
              <th className="px-3 py-4 font-medium">Branch</th>
              <th className="px-3 py-4 font-medium">Staff</th>
              <th className="px-3 py-4 font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-3 py-12 text-center text-gray-400">
                  No {direction === "IN" ? "cash-in" : "cash-out"} entries found.
                </td>
              </tr>
            ) : (
              entries.map((entry) => (
                <tr
                  key={entry.id}
                  className="border-b border-gray-100 transition-colors hover:bg-[#f4fafc]"
                >
                  <td className="whitespace-nowrap px-3 py-4 font-medium text-gray-600">
                    {displayCashbookUid(entry.uid, entry.id)}
                  </td>
                  <td className="px-3 py-4 capitalize">{entry.clientName ?? "—"}</td>
                  <td className="whitespace-nowrap px-3 py-4">
                    {occurredAtLabel(entry.occurredAt)}
                  </td>
                  <td className="px-3 py-4">{entry.project?.title ?? "—"}</td>
                  <td className="px-3 py-4 capitalize">
                    {paymentLabel(entry.paymentType)}
                    {entry.referenceNumber ? (
                      <span className="mt-0.5 block text-[10px] text-gray-400">
                        {entry.referenceNumber}
                      </span>
                    ) : null}
                  </td>
                  <td
                    className={`whitespace-nowrap px-3 py-4 font-medium ${
                      direction === "IN" ? "text-emerald-600" : "text-rose-600"
                    }`}
                  >
                    {money(entry.amount)}
                  </td>
                  <td className="px-3 py-4">{entry.branch ?? "—"}</td>
                  <td className="px-3 py-4">{entry.staffName ?? "—"}</td>
                  <td className="px-3 py-4">
                    {canDelete ? (
                      <DeleteCashbookEntryButton entryId={entry.id} />
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-3 grid gap-3 lg:hidden">
        {entries.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-200 px-4 py-10 text-center text-sm text-gray-400">
            No {direction === "IN" ? "cash-in" : "cash-out"} entries found.
          </div>
        ) : (
          entries.map((entry) => (
            <article
              key={entry.id}
              className="rounded-lg border border-gray-100 bg-[#fbfdfe] p-4 transition hover:border-sky-200 hover:shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium capitalize text-gray-700">
                    {entry.clientName ?? "Unnamed customer"}
                  </p>
                  <p className="mt-1 text-xs text-gray-400">
                    {displayCashbookUid(entry.uid, entry.id)} · {occurredAtLabel(entry.occurredAt)}
                  </p>
                </div>
                <p
                  className={`shrink-0 text-sm font-semibold ${
                    direction === "IN" ? "text-emerald-600" : "text-rose-600"
                  }`}
                >
                  {money(entry.amount)}
                </p>
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
                <div>
                  <dt className="text-gray-400">Project</dt>
                  <dd className="mt-1 truncate text-gray-700">{entry.project?.title ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-gray-400">Payment</dt>
                  <dd className="mt-1 capitalize text-gray-700">
                    {paymentLabel(entry.paymentType)}
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-400">Branch</dt>
                  <dd className="mt-1 truncate text-gray-700">{entry.branch ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-gray-400">Staff</dt>
                  <dd className="mt-1 truncate text-gray-700">{entry.staffName ?? "—"}</dd>
                </div>
              </dl>
              {entry.remarks ? (
                <p className="mt-3 border-t border-gray-100 pt-3 text-xs text-gray-500">
                  {entry.remarks}
                </p>
              ) : null}
              {canDelete ? (
                <div className="mt-2 flex justify-end">
                  <DeleteCashbookEntryButton entryId={entry.id} />
                </div>
              ) : null}
            </article>
          ))
        )}
      </div>
    </section>
  );

  return (
    <div className="mx-auto w-full max-w-[1500px] font-sans">
      <nav
        aria-label="Breadcrumb"
        className="flex items-center gap-1 text-xs text-[#67757c] sm:text-sm"
      >
        <Link href="/dashboard" className="transition hover:text-[#20aee3]">
          Dashboard
        </Link>
        <span aria-hidden>›</span>
        <span aria-current="page">Cash Book</span>
      </nav>

      <div className="mt-2 flex flex-col justify-between gap-4 pb-5 lg:flex-row lg:items-center lg:pb-8">
        <div>
          <h1 className="text-[28px] font-light text-[#20aee3] sm:text-[32px]">
            Cash Book
          </h1>
          <p className="mt-1 text-xs text-gray-400">
            Fast, auditable cash-in and cash-out tracking
          </p>
        </div>
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
          <form action="/cashbook" className="relative w-full sm:w-56">
            <Search className="pointer-events-none absolute left-2 top-2.5 size-5 text-[#a6b5bd]" />
            <input
              name="query"
              aria-label="Search cashbook"
              defaultValue={data.filters.query}
              placeholder="Search cashbook"
              className="h-10 w-full rounded-md bg-[#ebf2f5] pl-9 pr-2 text-sm text-gray-700 outline-none transition focus:bg-white focus:ring-2 focus:ring-[#20aee3]/25"
            />
          </form>
          <details id="filters" className="relative shrink-0">
            <summary
              className="relative flex size-10 cursor-pointer list-none items-center justify-center rounded-md bg-[#ebf2f5] text-[#82949d] transition hover:bg-[#dfe6e8] hover:text-[#20aee3]"
              aria-label="Filter cashbook"
            >
              <Filter className="size-5" />
              {activeFilterCount ? (
                <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-[#ff5c6c] text-[9px] font-semibold text-white">
                  {activeFilterCount}
                </span>
              ) : null}
            </summary>
            <form
              action="/cashbook"
              className="dialog-enter fixed left-3 right-3 top-20 z-50 grid gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-2xl sm:absolute sm:left-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-80"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-700">Filter cashbook</p>
                {activeFilterCount ? (
                  <span className="text-xs text-[#20aee3]">{activeFilterCount} active</span>
                ) : null}
              </div>
              <input type="hidden" name="query" value={data.filters.query ?? ""} />
              <select
                name="direction"
                defaultValue={data.filters.direction ?? ""}
                className="h-10 rounded-md border border-gray-300 bg-white px-3 text-sm"
              >
                <option value="">Cash in and out</option>
                {cashDirections.map((direction) => (
                  <option key={direction} value={direction}>
                    {cashDirectionLabels[direction]}
                  </option>
                ))}
              </select>
              <select
                name="paymentType"
                defaultValue={data.filters.paymentType ?? ""}
                className="h-10 rounded-md border border-gray-300 bg-white px-3 text-sm"
              >
                <option value="">All payment types</option>
                {cashPaymentTypes.map((type) => (
                  <option key={type} value={type}>
                    {cashPaymentTypeLabels[type]}
                  </option>
                ))}
              </select>
              <label className="text-xs text-gray-500">
                Entry date
                <input
                  name="date"
                  type="date"
                  defaultValue={data.filters.date}
                  className="mt-1 h-10 w-full rounded-md border border-gray-300 px-3 text-sm"
                />
              </label>
              <div className="flex justify-end gap-2">
                <Link
                  href="/cashbook"
                  className="rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-600 transition hover:bg-gray-50"
                >
                  Clear
                </Link>
                <button className="rounded-md bg-[#20aee3] px-3 py-2 text-sm text-white transition hover:bg-[#179bd0]">
                  Apply
                </button>
              </div>
            </form>
          </details>
          <CashbookCreateDialog
            staff={staffOptions}
            projects={projectOptions}
            canChooseStaff={canChooseStaff}
          />
        </div>
      </div>

      <section className="mb-5 grid gap-3 sm:grid-cols-3">
        {[
          { label: "Net today", value: data.summary.today, icon: CalendarClock },
          { label: "Net this month", value: data.summary.month, icon: WalletCards },
          { label: "Net this year", value: data.summary.year, icon: Banknote },
        ].map(({ label, value, icon: Icon }) => (
          <article key={label} className="surface-card rounded-lg p-4">
            <div className="flex items-center justify-between text-xs text-gray-400">
              <span>{label}</span>
              <Icon className="size-4 text-[#20aee3]" />
            </div>
            <p
              className={`mt-2 truncate text-xl font-light ${
                Number(value) < 0 ? "text-rose-600" : "text-gray-700"
              }`}
            >
              {money(value)}
            </p>
          </article>
        ))}
      </section>

      <div id="entries" className="grid gap-5">
        {renderEntries("Amounts In", "IN", incoming)}
        {renderEntries("Amounts Out", "OUT", outgoing)}
      </div>

      <nav
        aria-label="Cashbook pagination"
        className="mt-5 flex items-center justify-between rounded-lg border border-gray-100 bg-white px-4 py-3 text-sm shadow-sm"
      >
        <span className="text-xs text-gray-500">Page {data.pagination.page}</span>
        <div className="flex gap-2">
          {data.pagination.hasPrevious ? (
            <Link
              href={pageHref(data.pagination.page - 1)}
              className="rounded-md border border-gray-200 px-3 py-2 text-gray-600 transition hover:border-sky-200 hover:text-[#20aee3]"
            >
              Previous
            </Link>
          ) : (
            <span className="cursor-not-allowed rounded-md border border-gray-100 px-3 py-2 text-gray-300">
              Previous
            </span>
          )}
          {data.pagination.hasNext ? (
            <Link
              href={pageHref(data.pagination.page + 1)}
              className="rounded-md border border-gray-200 px-3 py-2 text-gray-600 transition hover:border-sky-200 hover:text-[#20aee3]"
            >
              Next
            </Link>
          ) : (
            <span className="cursor-not-allowed rounded-md border border-gray-100 px-3 py-2 text-gray-300">
              Next
            </span>
          )}
        </div>
      </nav>
    </div>
  );
}

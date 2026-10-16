"use client";

import { CalendarDays, CreditCard, ReceiptText, UserRound } from "lucide-react";

import { SaleRowActions } from "@/components/sales/sale-forms";
import { paymentTypeLabels, paymentTypes } from "@/features/sales/schemas";

type PaymentType = (typeof paymentTypes)[number];
type Option = { id: string; label: string };

type SaleDefaults = {
  id: string;
  staffProfileId: string | null;
  leadId: string | null;
  clientName: string;
  paymentType: string;
  referenceNumber: string;
  netPrice: string;
  receivedAmount: string;
};

export type KanbanSale = {
  id: string;
  uid: string;
  clientName: string;
  paymentType: PaymentType;
  staffName: string;
  referenceNumber: string | null;
  netPrice: string;
  receivedAmount: string;
  profit: string;
  created: string;
  defaults: SaleDefaults;
  canEdit: boolean;
  canDelete: boolean;
};

const columnColors: Record<PaymentType, string> = {
  cash: "border-t-emerald-500",
  card: "border-t-sky-400",
  cheque: "border-t-amber-400",
  bank_transfer: "border-t-indigo-400",
  other: "border-t-slate-400",
};

export function SaleKanban({ sales, staff, leads, canChooseStaff }: { sales: KanbanSale[]; staff: Option[]; leads: Option[]; canChooseStaff: boolean }) {
  return (
    <section aria-label="Sales Kanban board" className="min-w-0">
      <p className="mb-3 text-xs text-gray-500">{sales.length} {sales.length === 1 ? "sale" : "sales"} in this view · Financial records are grouped by payment method and remain editable through their audited actions.</p>
      <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-4">
        {paymentTypes.map((paymentType) => {
          const columnSales = sales.filter((sale) => sale.paymentType === paymentType);
          return (
            <section key={paymentType} aria-label={`${paymentTypeLabels[paymentType]} sales`} className={`min-h-[28rem] w-[min(86vw,20rem)] shrink-0 snap-start rounded-lg border border-gray-200 border-t-2 bg-[#ebf2f5] p-2.5 sm:w-[20rem] ${columnColors[paymentType]}`}>
              <header className="flex items-center justify-between gap-2 px-1 pb-3"><h2 className="text-sm font-medium text-gray-700">{paymentTypeLabels[paymentType]}</h2><span className="rounded-full bg-white px-2 py-0.5 text-xs text-gray-500" aria-label={`${columnSales.length} sales in this column`}>{columnSales.length}</span></header>
              <div className="space-y-2">
                {columnSales.length === 0 ? <p className="rounded-md border border-dashed border-gray-300 px-3 py-8 text-center text-xs text-gray-400">No sales with this payment method</p> : null}
                {columnSales.map((sale) => (
                  <article key={sale.id} className="rounded-md border border-gray-100 bg-white p-3 shadow-sm transition hover:border-sky-200 hover:shadow-md">
                    <div className="flex items-start justify-between gap-2"><p className="min-w-0 truncate text-sm font-medium capitalize text-gray-700">{sale.clientName}</p><span className="shrink-0 text-[10px] text-gray-400">{sale.uid}</span></div>
                    <p className="mt-1 text-sm font-medium text-emerald-600">Profit {sale.profit}</p>
                    <dl className="mt-3 space-y-1.5 text-xs">
                      <div className="flex justify-between gap-2"><dt className="inline-flex items-center gap-1 text-gray-400"><CreditCard className="size-3.5" />Net value</dt><dd className="text-gray-700">{sale.netPrice}</dd></div>
                      <div className="flex justify-between gap-2"><dt className="text-gray-400">Received</dt><dd className="text-gray-700">{sale.receivedAmount}</dd></div>
                      <div className="flex justify-between gap-2"><dt className="inline-flex items-center gap-1 text-gray-400"><UserRound className="size-3.5" />Staff</dt><dd className="truncate text-gray-700">{sale.staffName}</dd></div>
                      <div className="flex justify-between gap-2"><dt className="inline-flex items-center gap-1 text-gray-400"><ReceiptText className="size-3.5" />Reference</dt><dd className="truncate text-gray-700">{sale.referenceNumber ?? "—"}</dd></div>
                      <div className="flex justify-between gap-2"><dt className="inline-flex items-center gap-1 text-gray-400"><CalendarDays className="size-3.5" />Created</dt><dd className="text-gray-700">{sale.created}</dd></div>
                    </dl>
                    {(sale.canEdit || sale.canDelete) ? <div className="mt-3 flex justify-end border-t border-gray-100 pt-2"><SaleRowActions sale={sale.defaults} staff={staff} leads={leads} canChooseStaff={canChooseStaff} canEdit={sale.canEdit} canDelete={sale.canDelete} /></div> : null}
                  </article>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </section>
  );
}

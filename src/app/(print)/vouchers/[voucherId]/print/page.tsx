import Image from "next/image";
import { notFound, redirect } from "next/navigation";

import { PrintVoucherButton } from "@/components/vouchers/print-voucher-button";
import { displayVoucherUid } from "@/features/vouchers/identifiers";
import { getPrintableVoucher } from "@/features/vouchers/queries";

function money(value: { toString(): string } | null) { return new Intl.NumberFormat("en-PK", { style: "currency", currency: "PKR", minimumFractionDigits: 2 }).format(Number(value?.toString() ?? 0)); }
function date(value: Date | null) { return value?.toLocaleDateString("en-GB", { timeZone: "UTC", dateStyle: "long" }) ?? "—"; }

export default async function PrintableVoucherPage({ params }: { params: Promise<{ voucherId: string }> }) {
  const { voucherId } = await params;
  const data = await getPrintableVoucher(voucherId);
  if (!data) redirect("/dashboard");
  if (!data.voucher) notFound();
  const voucher = data.voucher;
  const cell = "border border-slate-300 px-4 py-3";
  return <main className="min-h-screen bg-slate-100 px-3 py-6 print:bg-white print:p-0"><div className="mx-auto mb-4 flex max-w-[900px] justify-end print:hidden"><PrintVoucherButton /></div><article className="mx-auto min-h-[1100px] max-w-[900px] bg-white p-8 text-slate-800 shadow-xl print:min-h-0 print:max-w-none print:p-0 print:shadow-none sm:p-12"><header className="flex items-start justify-between gap-8 border-b-2 border-slate-800 pb-6"><Image src="/images/Logo.png" alt="mimico" width={2172} height={724} className="h-auto w-44 object-contain" priority /><table className="text-sm"><tbody><tr><th className={`${cell} bg-slate-100 text-left`}>Voucher No.</th><td className={cell}>{displayVoucherUid(voucher.uid, voucher.id)}</td></tr><tr><th className={`${cell} bg-slate-100 text-left`}>Dated</th><td className={cell}>{date(voucher.issuingDate)}</td></tr></tbody></table></header>
      <h1 className="my-8 text-center text-2xl font-semibold uppercase tracking-[0.18em]">Payment Voucher</h1>
      <table className="w-full table-fixed border-collapse text-sm"><tbody><tr>{["Name", "CNIC", "Phone"].map((title) => <th key={title} className={`${cell} bg-slate-100`}>{title}</th>)}</tr><tr><td className={`${cell} text-center capitalize`}>{voucher.clientName ?? "—"}</td><td className={`${cell} text-center`}>{voucher.cnic ?? "—"}</td><td className={`${cell} text-center`}>{voucher.phone ?? "—"}</td></tr></tbody></table>
      {voucher.note ? <p className="border-x border-b border-slate-300 px-4 py-3 text-center text-sm text-rose-700">* {voucher.note}</p> : null}
      <table className="mt-6 w-full table-fixed border-collapse text-sm"><tbody><tr>{["Type of Payment", "Amount Paid", "Due Date"].map((title) => <th key={title} className={`${cell} bg-slate-100`}>{title}</th>)}</tr><tr><td className={`${cell} text-center capitalize`}>{voucher.type ?? "—"}{voucher.cheque ? ` (${voucher.cheque})` : ""}</td><td className={`${cell} text-center`}>{money(voucher.paid)}</td><td className={`${cell} text-center`}>{date(voucher.dueDate)}</td></tr></tbody></table>
      <table className="mt-6 w-full table-fixed border-collapse text-sm"><tbody><tr>{["Project", "Property Type", "Area"].map((title) => <th key={title} className={`${cell} bg-slate-100`}>{title}</th>)}</tr><tr><td className={`${cell} text-center capitalize`}>{voucher.project?.title ?? "—"}</td><td className={`${cell} text-center capitalize`}>{voucher.propertyType ?? "—"}</td><td className={`${cell} text-center`}>{voucher.area ?? "—"}</td></tr></tbody></table>
      <section className="mt-8 grid grid-cols-3 gap-4 text-center"><div><p className="text-sm font-semibold">Total</p><p className="mt-2 border border-slate-300 px-3 py-3">{money(voucher.total)}</p></div><div><p className="text-sm font-semibold">Paying</p><p className="mt-2 border border-slate-300 px-3 py-3">{money(voucher.paid)}</p></div><div><p className="text-sm font-semibold">Remaining</p><p className="mt-2 border border-slate-300 px-3 py-3">{money(voucher.remaining)}</p></div></section>
      <section className="mt-20 grid grid-cols-2 gap-16 text-center text-sm"><div className="border-t border-slate-700 pt-2">Authorized signature</div><div className="border-t border-slate-700 pt-2">Customer signature</div></section>
      <footer className="mt-20 border-t border-slate-200 pt-5 text-center text-xs leading-5 text-slate-500"><p>crm.mimico.live</p><p>info@marcablesolution.com · 301, 2nd Floor, Gulberg III, Lahore, Pakistan</p></footer>
    </article></main>;
}

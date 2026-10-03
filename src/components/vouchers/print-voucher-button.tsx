"use client";

import { Printer } from "lucide-react";

export function PrintVoucherButton() {
  return <button type="button" onClick={() => window.print()} className="print:hidden inline-flex h-10 items-center gap-2 rounded-lg bg-[#20aee3] px-4 text-sm font-medium text-white shadow-sm transition hover:bg-[#179bd0]"><Printer className="size-4" />Print / Save PDF</button>;
}

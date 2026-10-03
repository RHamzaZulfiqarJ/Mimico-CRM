import { Prisma } from "@/generated/prisma/client";

export function calculateVoucherAmounts(totalValue: string, paidValue: string) {
  const total = new Prisma.Decimal(totalValue);
  const paid = new Prisma.Decimal(paidValue);
  return { total, paid, remaining: total.minus(paid) };
}

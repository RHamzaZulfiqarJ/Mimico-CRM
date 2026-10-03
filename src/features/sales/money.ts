import { Prisma } from "@/generated/prisma/client";

export function calculateSaleAmounts(netPrice: string, receivedAmount: string) {
  const net = new Prisma.Decimal(netPrice);
  const received = new Prisma.Decimal(receivedAmount);

  return {
    netPrice: net,
    receivedAmount: received,
    profit: received.minus(net),
  };
}

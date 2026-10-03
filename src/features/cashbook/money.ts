import { Prisma } from "@/generated/prisma/client";

export function cashAmount(value: string) {
  return new Prisma.Decimal(value);
}

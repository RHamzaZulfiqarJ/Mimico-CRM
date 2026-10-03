import { Prisma } from "@/generated/prisma/client";

export function calculatePayroll(input: {
  totalSalary: string;
  lateArrivals: number;
  halfDays: number;
  daysOff: number;
  lateArrivalRate: number;
  halfDayRate: number;
  dayOffRate: string;
}) {
  const totalSalary = new Prisma.Decimal(input.totalSalary);
  const lateArrivalDeduction = new Prisma.Decimal(input.lateArrivalRate).mul(input.lateArrivals);
  const halfDayDeduction = new Prisma.Decimal(input.halfDayRate).mul(input.halfDays);
  const dayOffDeduction = new Prisma.Decimal(input.dayOffRate).mul(input.daysOff);
  const totalDeductions = lateArrivalDeduction.add(halfDayDeduction).add(dayOffDeduction);
  return {
    totalSalary,
    lateArrivalDeduction,
    halfDayDeduction,
    dayOffDeduction,
    totalDeductions,
    netSalary: totalSalary.sub(totalDeductions),
  };
}

import { z } from "zod";

const optionalText = (maximum: number) =>
  z.preprocess(
    (value) => value == null || (typeof value === "string" && value.trim() === "") ? undefined : value,
    z.string().trim().max(maximum).optional(),
  );
const positiveMoney = z.string().trim().regex(/^(?!0+(?:\.0{1,2})?$)\d{1,16}(?:\.\d{1,2})?$/, "Enter an amount greater than zero with up to 2 decimal places.");
const nonNegativeMoney = z.string().trim().regex(/^\d{1,16}(?:\.\d{1,2})?$/, "Enter a non-negative amount with up to 2 decimal places.");
const occurrenceCount = z.coerce.number().int().min(0).max(366);
const wholeRupees = z.coerce.number().int().min(0).max(100_000_000);

export const deductionPolicySchema = z.object({
  effectiveFrom: z.iso.date("Select a valid effective date."),
  lateArrivals: wholeRupees,
  halfDays: wholeRupees,
  daysOff: wholeRupees,
});

export const payrollTranscriptSchema = z.object({
  profileId: z.uuid("Select a valid employee."),
  designation: optionalText(120),
  phone: optionalText(30),
  payPeriod: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Select a valid salary month."),
  salaryType: z.enum(["STANDARD", "COMMISSION"]),
  totalSalary: positiveMoney,
  lateArrivals: occurrenceCount,
  halfDays: occurrenceCount,
  daysOff: occurrenceCount,
  amountPerDayOff: nonNegativeMoney,
});

export const payrollFiltersSchema = z.object({
  query: optionalText(120).catch(undefined),
  profileId: z.uuid().optional().catch(undefined),
  payPeriod: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(100_000).catch(1),
});

export type PayrollFormState = {
  status: "idle" | "error" | "success";
  message?: string;
  errors?: Record<string, string[]>;
};

export const initialPayrollFormState: PayrollFormState = { status: "idle" };

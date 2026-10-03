import { z } from "zod";

export const voucherPaymentTypes = ["cash", "cheque", "card", "online"] as const;
export const voucherPaymentTypeLabels: Record<(typeof voucherPaymentTypes)[number], string> = {
  cash: "Cash",
  cheque: "Cheque",
  card: "Card",
  online: "Online",
};

export const voucherPropertyTypes = [
  "residential",
  "commercial",
  "industrial",
  "agricultural",
  "other",
] as const;

export const voucherPropertyTypeLabels: Record<
  (typeof voucherPropertyTypes)[number],
  string
> = {
  residential: "Residential",
  commercial: "Commercial",
  industrial: "Industrial",
  agricultural: "Agricultural",
  other: "Other",
};

const optionalUuid = (message: string) =>
  z.preprocess((value) => (value === "" ? undefined : value), z.uuid(message).optional());
const optionalText = (maximum: number) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().trim().max(maximum).optional(),
  );
const positiveMoney = z
  .string()
  .trim()
  .regex(/^(?!0+(?:\.0{1,2})?$)\d{1,16}(?:\.\d{1,2})?$/, "Enter an amount greater than zero with up to 2 decimal places.");
const nonNegativeMoney = z
  .string()
  .trim()
  .regex(/^\d{1,16}(?:\.\d{1,2})?$/, "Enter a non-negative amount with up to 2 decimal places.");

function minorUnits(value: string) {
  const [whole, decimal = ""] = value.split(".");
  return BigInt(whole) * BigInt(100) + BigInt(decimal.padEnd(2, "0"));
}

export const voucherSchema = z
  .object({
    allocatedToProfileId: optionalUuid("Select a valid staff member."),
    projectId: z.uuid("Select a valid project."),
    issuingDate: z.iso.date("Select a valid issue date."),
    dueDate: z.iso.date("Select a valid due date."),
    branch: z.string().trim().min(2, "Branch is required.").max(120),
    clientName: z.string().trim().min(2, "Customer name is required.").max(160),
    cnic: optionalText(20),
    phone: z.string().trim().min(7, "Enter a valid phone number.").max(30),
    email: z.preprocess(
      (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
      z.email("Enter a valid email address.").max(254).optional(),
    ),
    paymentType: z.enum(voucherPaymentTypes),
    cheque: optionalText(100),
    propertyType: z.enum(voucherPropertyTypes),
    area: z.string().trim().min(1, "Area is required.").max(100),
    total: positiveMoney,
    paid: nonNegativeMoney,
    note: optionalText(1000),
  })
  .superRefine((value, context) => {
    if (value.dueDate < value.issuingDate) {
      context.addIssue({ code: "custom", path: ["dueDate"], message: "Due date cannot be before the issue date." });
    }
    if (value.paymentType === "cheque" && (!value.cheque || value.cheque.length < 2)) {
      context.addIssue({ code: "custom", path: ["cheque"], message: "Cheque number is required." });
    }
    if (positiveMoney.safeParse(value.total).success && nonNegativeMoney.safeParse(value.paid).success && minorUnits(value.paid) > minorUnits(value.total)) {
      context.addIssue({ code: "custom", path: ["paid"], message: "Paid amount cannot exceed the total." });
    }
  });

export const voucherFiltersSchema = z.object({
  query: optionalText(120).catch(undefined),
  status: z.enum(["UNDER_PROCESS", "ACCEPTED", "REJECTED"]).optional().catch(undefined),
  projectId: z.uuid().optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(100_000).catch(1),
});

export type VoucherFormState = {
  status: "idle" | "error" | "success";
  message?: string;
  errors?: Record<string, string[]>;
};

export const initialVoucherFormState: VoucherFormState = { status: "idle" };

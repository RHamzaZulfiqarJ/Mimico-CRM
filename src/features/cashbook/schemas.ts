import { z } from "zod";

export const cashDirections = ["IN", "OUT"] as const;
export const cashDirectionLabels: Record<(typeof cashDirections)[number], string> = {
  IN: "Cash in",
  OUT: "Cash out",
};

export const cashPaymentTypes = ["cash", "cheque", "online"] as const;
export const cashPaymentTypeLabels: Record<
  (typeof cashPaymentTypes)[number],
  string
> = {
  cash: "Cash",
  cheque: "Cheque",
  online: "Online",
};

const optionalUuid = (message: string) =>
  z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.uuid(message).optional(),
  );

const optionalText = (max: number) =>
  z.preprocess(
    (value) =>
      typeof value === "string" && value.trim() === "" ? undefined : value,
    z.string().trim().max(max).optional(),
  );

export const cashbookEntrySchema = z
  .object({
    staffProfileId: optionalUuid("Select a valid staff member."),
    projectId: z.uuid("Select a valid project."),
    clientName: z
      .string()
      .trim()
      .min(2, "Customer name must contain at least 2 characters.")
      .max(160),
    branch: z.string().trim().min(2, "Branch is required.").max(120),
    paymentType: z.enum(cashPaymentTypes),
    referenceNumber: optionalText(100),
    amount: z
      .string()
      .trim()
      .regex(
        /^(?!0+(?:\.0{1,2})?$)\d{1,16}(?:\.\d{1,2})?$/,
        "Amount must be greater than zero with up to 2 decimal places.",
      ),
    direction: z.enum(cashDirections),
    remarks: z.string().trim().min(2, "Remarks are required.").max(500),
  })
  .superRefine((value, context) => {
    if (
      value.paymentType !== "cash" &&
      (!value.referenceNumber || value.referenceNumber.length < 2)
    ) {
      context.addIssue({
        code: "custom",
        path: ["referenceNumber"],
        message: "A reference number is required for cheque and online payments.",
      });
    }
  });

export const cashbookFiltersSchema = z.object({
  query: z.string().trim().max(120).optional().catch(undefined),
  direction: z.enum(cashDirections).optional().catch(undefined),
  paymentType: z.enum(cashPaymentTypes).optional().catch(undefined),
  date: z.iso.date().optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(100_000).catch(1),
});

export type CashbookFormState = {
  status: "idle" | "error" | "success";
  message?: string;
  errors?: Record<string, string[]>;
};

export const initialCashbookFormState: CashbookFormState = { status: "idle" };

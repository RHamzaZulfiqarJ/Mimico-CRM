import { z } from "zod";

const optionalText = (maximum: number) =>
  z.preprocess(
    (value) =>
      value == null || (typeof value === "string" && value.trim() === "")
        ? undefined
        : value,
    z.string().trim().max(maximum).optional(),
  );

export const refundSchema = z.object({
  leadId: z.uuid("Select a valid lead."),
  branch: z.string().trim().min(2, "Branch is required.").max(120),
  amount: z
    .string()
    .trim()
    .regex(
      /^(?!0+(?:\.0{1,2})?$)\d{1,16}(?:\.\d{1,2})?$/,
      "Enter an amount greater than zero with up to 2 decimal places.",
    ),
  clientName: z.string().trim().min(2, "Customer name is required.").max(160),
  cnic: optionalText(20),
  phone: z.string().trim().min(7, "Enter a valid phone number.").max(30),
  reason: z.string().trim().min(5, "Explain the reason for the refund.").max(2_000),
});

export const refundFiltersSchema = z.object({
  query: optionalText(120).catch(undefined),
  status: z
    .enum(["UNDER_PROCESS", "ACCEPTED", "REJECTED"])
    .optional()
    .catch(undefined),
  page: z.coerce.number().int().min(1).max(100_000).catch(1),
});

export type RefundFormState = {
  status: "idle" | "error" | "success";
  message?: string;
  errors?: Record<string, string[]>;
};

export const initialRefundFormState: RefundFormState = { status: "idle" };

import { z } from "zod";

export const paymentTypes = [
  "cash",
  "card",
  "cheque",
  "bank_transfer",
  "other",
] as const;

export const paymentTypeLabels: Record<(typeof paymentTypes)[number], string> = {
  cash: "Cash",
  card: "Card",
  cheque: "Cheque",
  bank_transfer: "Bank transfer",
  other: "Other",
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

const money = (label: string) =>
  z
    .string()
    .trim()
    .regex(
      /^\d{1,16}(?:\.\d{1,2})?$/,
      `${label} must be a positive amount with up to 2 decimal places.`,
    );

const optionalMoney = z.preprocess(
  (value) => (value === "" ? undefined : value),
  money("Amount").optional(),
);

export const saleSchema = z.object({
  staffProfileId: optionalUuid("Select a valid staff member."),
  leadId: optionalUuid("Select a valid lead."),
  clientName: z
    .string()
    .trim()
    .min(2, "Client name must contain at least 2 characters.")
    .max(160),
  paymentType: z.enum(paymentTypes),
  referenceNumber: optionalText(100),
  netPrice: money("Net price"),
  receivedAmount: money("Received amount"),
});

export const saleFiltersSchema = z.object({
  query: z.string().trim().max(120).optional().catch(undefined),
  staffProfileId: z.uuid().optional().catch(undefined),
  paymentType: z.enum(paymentTypes).optional().catch(undefined),
  minProfit: optionalMoney.catch(undefined),
  maxProfit: optionalMoney.catch(undefined),
  from: z.iso.date().optional().catch(undefined),
  to: z.iso.date().optional().catch(undefined),
});

export type SaleFormState = {
  status: "idle" | "error" | "success";
  message?: string;
  errors?: Record<string, string[]>;
};

export const initialSaleFormState: SaleFormState = { status: "idle" };

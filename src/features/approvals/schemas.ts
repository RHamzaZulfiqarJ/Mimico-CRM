import { z } from "zod";

const optionalText = (maximum: number) => z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().trim().max(maximum).optional(),
);

export const createApprovalSchema = z.object({
  title: z.string().trim().min(2, "Enter a request title.").max(160),
  description: z.string().trim().min(5, "Explain what needs approval.").max(3000),
});

export const approvalDecisionSchema = z.object({
  status: z.enum(["ACCEPTED", "REJECTED"]),
  note: optionalText(1000),
});

export const approvalFiltersSchema = z.object({
  query: optionalText(120),
  status: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.enum(["UNDER_PROCESS", "ACCEPTED", "REJECTED"]).optional(),
  ),
});

export const approvalStatusLabels = {
  UNDER_PROCESS: "Under process",
  ACCEPTED: "Accepted",
  REJECTED: "Rejected",
} as const;

export type ApprovalFormState = { status: "idle" | "error" | "success"; message?: string; errors?: Record<string, string[]> };
export const initialApprovalFormState: ApprovalFormState = { status: "idle" };

import { describe, expect, it } from "vitest";

import { approvalDecisionSchema, approvalFiltersSchema, createApprovalSchema } from "@/features/approvals/schemas";

describe("approval schemas", () => {
  it("normalizes a request", () => {
    expect(createApprovalSchema.parse({ title: "  Site visit ", description: "  Please approve the visit. " })).toEqual({ title: "Site visit", description: "Please approve the visit." });
  });

  it("accepts only terminal decisions", () => {
    expect(approvalDecisionSchema.safeParse({ status: "UNDER_PROCESS" }).success).toBe(false);
    expect(approvalDecisionSchema.safeParse({ status: "ACCEPTED", note: "Approved." }).success).toBe(true);
  });

  it("rejects unsupported status filters", () => {
    expect(approvalFiltersSchema.safeParse({ status: "PENDING" }).success).toBe(false);
  });
});

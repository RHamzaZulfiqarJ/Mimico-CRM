import { describe, expect, it } from "vitest";

import { refundFiltersSchema, refundSchema } from "./schemas";

describe("refund schemas", () => {
  it("normalizes a valid refund without converting money to a number", () => {
    const result = refundSchema.parse({
      leadId: "12345678-90ab-4def-9234-567890abcdef",
      branch: " Gulberg ",
      amount: "125000.50",
      clientName: " Sana Ahmed ",
      cnic: "",
      phone: "0300 1234567",
      reason: "Customer requested cancellation.",
    });

    expect(result).toMatchObject({
      branch: "Gulberg",
      amount: "125000.50",
      clientName: "Sana Ahmed",
      cnic: undefined,
    });
  });

  it("rejects zero, negative, and over-precise amounts", () => {
    const base = {
      leadId: "12345678-90ab-4def-9234-567890abcdef",
      branch: "Gulberg",
      clientName: "Sana Ahmed",
      cnic: null,
      phone: "03001234567",
      reason: "Customer requested cancellation.",
    };
    expect(refundSchema.safeParse({ ...base, amount: "0" }).success).toBe(false);
    expect(refundSchema.safeParse({ ...base, amount: "-1" }).success).toBe(false);
    expect(refundSchema.safeParse({ ...base, amount: "10.999" }).success).toBe(false);
  });

  it("drops invalid optional filters and normalizes pagination", () => {
    expect(refundFiltersSchema.parse({ status: "invalid", page: "2" })).toEqual({
      page: 2,
    });
  });
});

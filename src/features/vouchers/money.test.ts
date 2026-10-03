import { describe, expect, it } from "vitest";

import { calculateVoucherAmounts } from "@/features/vouchers/money";

describe("voucher money", () => {
  it("calculates remaining value with decimal precision", () => {
    const result = calculateVoucherAmounts("100000.10", "25000.09");
    expect(result.remaining.toFixed(2)).toBe("75000.01");
  });
});

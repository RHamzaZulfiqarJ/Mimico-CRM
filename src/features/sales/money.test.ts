import { describe, expect, it } from "vitest";

import { calculateSaleAmounts } from "@/features/sales/money";

describe("sale money calculations", () => {
  it("uses decimal arithmetic instead of floating point", () => {
    const amounts = calculateSaleAmounts("0.20", "0.30");

    expect(amounts.netPrice.toFixed(2)).toBe("0.20");
    expect(amounts.receivedAmount.toFixed(2)).toBe("0.30");
    expect(amounts.profit.toFixed(2)).toBe("0.10");
  });

  it("preserves two-decimal precision for large values", () => {
    const amounts = calculateSaleAmounts("99999999999999.99", "100000000000000.00");

    expect(amounts.profit.toFixed(2)).toBe("0.01");
  });
});

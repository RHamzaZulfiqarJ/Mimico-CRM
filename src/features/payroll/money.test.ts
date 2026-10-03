import { describe, expect, it } from "vitest";

import { calculatePayroll } from "./money";

describe("payroll calculations", () => {
  it("calculates exact deductions without floating point drift", () => {
    const result = calculatePayroll({
      totalSalary: "100000.10",
      lateArrivals: 2,
      halfDays: 1,
      daysOff: 3,
      lateArrivalRate: 500,
      halfDayRate: 1500,
      dayOffRate: "2500.05",
    });

    expect(result.lateArrivalDeduction.toFixed(2)).toBe("1000.00");
    expect(result.halfDayDeduction.toFixed(2)).toBe("1500.00");
    expect(result.dayOffDeduction.toFixed(2)).toBe("7500.15");
    expect(result.netSalary.toFixed(2)).toBe("89999.95");
  });
});

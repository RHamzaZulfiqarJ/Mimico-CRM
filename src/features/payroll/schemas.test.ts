import { describe, expect, it } from "vitest";

import { deductionPolicySchema, payrollTranscriptSchema } from "./schemas";

describe("payroll schemas", () => {
  it("accepts policy rates and transcript counts", () => {
    expect(deductionPolicySchema.parse({ effectiveFrom: "2026-10-01", lateArrivals: "500", halfDays: "1500", daysOff: "2500" })).toMatchObject({ lateArrivals: 500, halfDays: 1500, daysOff: 2500 });
    expect(payrollTranscriptSchema.safeParse({ profileId: "12345678-90ab-4def-9234-567890abcdef", designation: "Sales executive", phone: "03001234567", payPeriod: "2026-10", salaryType: "STANDARD", totalSalary: "100000.00", lateArrivals: "2", halfDays: "1", daysOff: "0", amountPerDayOff: "2500" }).success).toBe(true);
  });

  it("rejects negative counts and over-precise money", () => {
    expect(payrollTranscriptSchema.safeParse({ profileId: "12345678-90ab-4def-9234-567890abcdef", payPeriod: "2026-10", salaryType: "STANDARD", totalSalary: "10.999", lateArrivals: "-1", halfDays: "0", daysOff: "0", amountPerDayOff: "0" }).success).toBe(false);
  });
});

import { describe, expect, it } from "vitest";

import { buildStage6Plan, staffLookupKey } from "./legacy-stage6";

const createdAt = { $date: "2026-10-06T08:00:00.000Z" };
const profiles = new Set(["employee-1"]);
const leads = new Set(["lead-1"]);
const projects = new Set(["project-1"]);
const staff = new Map([[staffLookupKey("hamza"), "employee-1"]]);

describe("buildStage6Plan", () => {
  it("maps finance records and calculates exact reconciliation totals", () => {
    const plan = buildStage6Plan({
      sales: [{
        _id: "sale-1", uid: "S-1", leadId: "lead-1", staff: "Hamza",
        netPrice: 100, receivedAmount: 125.5, profit: 25.5, createdAt,
      }],
      cashbooks: [{
        _id: "cash-1", uid: "C-1", type: "in", project: "project-1",
        staff: "Hamza", amount: 50, createdAt,
      }],
      vouchers: [{
        _id: "voucher-1", uid: "V-1", allocatedTo: "employee-1", project: "project-1",
        total: "100.00", paid: "40", remained: "60", status: "accepted",
        issuingDate: "2026-10-01", dueDate: "2026-10-31", createdAt,
      }],
      approvals: [{
        _id: "approval-1", type: "voucher", status: "accepted", data: { uid: "V-1" },
      }],
    }, {
      knownProfileLegacyIds: profiles,
      knownLeadLegacyIds: leads,
      knownProjectLegacyIds: projects,
      staffLegacyIdByName: staff,
    });

    expect(plan.rejected).toEqual([]);
    expect(plan.sales[0]).toMatchObject({
      staffLegacyProfileId: "employee-1", netPrice: "100.00",
      receivedAmount: "125.50", profit: "25.50",
    });
    expect(plan.cashbookEntries[0]).toMatchObject({ direction: "IN", amount: "50.00" });
    expect(plan.vouchers[0]).toMatchObject({
      approvalLegacyMongoId: "approval-1", status: "ACCEPTED", remaining: "60.00",
    });
    expect(plan.totals).toMatchObject({
      salesNetPrice: "100.00", salesReceivedAmount: "125.50", salesProfit: "25.50",
      cashIn: "50.00", cashOut: "0.00", voucherTotal: "100.00",
      voucherPaid: "40.00", voucherRemaining: "60.00",
    });
  });

  it("rejects inconsistent arithmetic and broken references", () => {
    const plan = buildStage6Plan({
      sales: [{
        _id: "sale-1", netPrice: 100, receivedAmount: 120, profit: 10, createdAt,
      }],
      cashbooks: [{
        _id: "cash-1", type: "out", project: "missing-project", amount: 50, createdAt,
      }],
      vouchers: [{
        _id: "voucher-1", total: 100, paid: 80, remained: 30, createdAt,
      }],
    }, { knownProjectLegacyIds: projects });

    expect(plan.sales).toEqual([]);
    expect(plan.cashbookEntries).toEqual([]);
    expect(plan.vouchers).toEqual([]);
    expect(plan.rejected).toEqual(expect.arrayContaining([
      expect.objectContaining({ reason: "Profit 10.00 does not equal receivedAmount - netPrice (20.00)." }),
      expect.objectContaining({ reason: "Project missing-project is missing from its reference export." }),
      expect.objectContaining({ reason: "Remaining 30.00 does not equal total - paid (20.00)." }),
    ]));
  });

  it("infers historical payroll years and links employees by legacy username", () => {
    const plan = buildStage6Plan({
      deductions: [{
        _id: "policy-1", lateArrivals: 500, halfDays: 1000, dayOffs: 2000,
        createdAt: "2025-01-01T08:00:00.000Z",
      }],
      transcripts: [{
        _id: "transcript-1", uid: "P-1", employeeName: "Hamza", salaryMonth: "December",
        totalSalary: 100000, netSalary: 95000, lateArrivals: 2, halfDays: 1,
        dayOffs: 1, amountPerDayOff: 2000, createdAt: "2026-01-05T08:00:00.000Z",
      }],
    }, { knownProfileLegacyIds: profiles, staffLegacyIdByName: staff });

    expect(plan.rejected).toEqual([]);
    expect(plan.deductionPolicies[0]).toMatchObject({
      lateArrivals: 500, halfDays: 1000, daysOff: 2000, effectiveFrom: "2025-01-01",
    });
    expect(plan.payrollTranscripts[0]).toMatchObject({
      profileLegacyMongoId: "employee-1", payPeriodStart: "2025-12-01",
      totalSalary: "100000.00", netSalary: "95000.00",
    });
    expect(plan.warnings).toContain(
      "transcripts:transcript-1 inferred pay-period year from createdAt as 2025.",
    );
  });

  it("links refund approvals and infers the requester from one lead assignee", () => {
    const plan = buildStage6Plan({
      refunds: [{
        _id: "refund-1", uid: "R-1", leadId: "lead-1", amount: "2500",
        clientName: "Client One", phone: "03001234567", reason: "Cancelled",
        status: "underProcess", createdAt,
      }],
      approvals: [{
        _id: "approval-1", type: "refund", status: "underProcess",
        data: { leadId: "lead-1", amount: 2500, clientName: "Client One" },
      }],
    }, {
      knownProfileLegacyIds: profiles,
      knownLeadLegacyIds: leads,
      leadAssigneesById: new Map([["lead-1", ["employee-1"]]]),
    });

    expect(plan.rejected).toEqual([]);
    expect(plan.refunds[0]).toMatchObject({
      requestedByLegacyProfileId: "employee-1",
      approvalLegacyMongoId: "approval-1",
      amount: "2500.00",
      status: "UNDER_PROCESS",
    });
  });
});

import { describe, expect, it } from "vitest";

import { cashbookEntrySchema, cashbookFiltersSchema } from "@/features/cashbook/schemas";

const validEntry = {
  staffProfileId: "",
  projectId: "4e3ee49d-a2fd-47f5-9ac5-cc876c9f981d",
  clientName: "  Acme Client  ",
  branch: "  Lahore  ",
  paymentType: "cash",
  referenceNumber: "",
  amount: "125000.50",
  direction: "IN",
  remarks: "  Booking payment  ",
};

describe("cashbook schemas", () => {
  it("normalizes a valid cash entry", () => {
    expect(cashbookEntrySchema.parse(validEntry)).toEqual({
      staffProfileId: undefined,
      projectId: validEntry.projectId,
      clientName: "Acme Client",
      branch: "Lahore",
      paymentType: "cash",
      referenceNumber: undefined,
      amount: "125000.50",
      direction: "IN",
      remarks: "Booking payment",
    });
  });

  it("requires a reference for non-cash payments", () => {
    expect(
      cashbookEntrySchema.safeParse({
        ...validEntry,
        paymentType: "online",
      }).success,
    ).toBe(false);
  });

  it("rejects zero, negative, and imprecise amounts", () => {
    for (const amount of ["0", "0.00", "-1", "12.345"]) {
      expect(cashbookEntrySchema.safeParse({ ...validEntry, amount }).success).toBe(
        false,
      );
    }
  });

  it("sanitizes unsupported filters and invalid pages", () => {
    expect(
      cashbookFiltersSchema.parse({
        direction: "SIDEWAYS",
        paymentType: "crypto",
        date: "not-a-date",
        page: "0",
      }),
    ).toEqual({
      direction: undefined,
      paymentType: undefined,
      date: undefined,
      page: 1,
    });
  });
});

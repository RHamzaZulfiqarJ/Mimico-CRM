import { describe, expect, it } from "vitest";

import { voucherSchema } from "@/features/vouchers/schemas";

const validVoucher = {
  allocatedToProfileId: "",
  projectId: "4e3ee49d-a2fd-47f5-9ac5-cc876c9f981d",
  issuingDate: "2026-10-02",
  dueDate: "2026-10-10",
  branch: "Lahore",
  clientName: "Acme Client",
  cnic: "35202-1234567-1",
  phone: "+92 300 1234567",
  email: "",
  paymentType: "cash",
  cheque: "",
  propertyType: "commercial",
  area: "5 Marla",
  total: "150000.00",
  paid: "50000.50",
  note: "Booking payment",
};

describe("voucher schema", () => {
  it("normalizes optional voucher fields", () => {
    expect(voucherSchema.parse(validVoucher)).toMatchObject({
      allocatedToProfileId: undefined,
      email: undefined,
      cheque: undefined,
      clientName: "Acme Client",
    });
  });

  it("rejects payment above the total", () => {
    expect(voucherSchema.safeParse({ ...validVoucher, paid: "150000.01" }).success).toBe(false);
  });

  it("requires a cheque number for cheque payments", () => {
    expect(voucherSchema.safeParse({ ...validVoucher, paymentType: "cheque" }).success).toBe(false);
  });

  it("rejects a due date before the issue date", () => {
    expect(voucherSchema.safeParse({ ...validVoucher, dueDate: "2026-10-01" }).success).toBe(false);
  });
});

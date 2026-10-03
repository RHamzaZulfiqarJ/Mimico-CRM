import { describe, expect, it } from "vitest";

import { saleFiltersSchema, saleSchema } from "@/features/sales/schemas";

describe("sale schemas", () => {
  it("normalizes a valid sale without optional relations", () => {
    expect(
      saleSchema.parse({
        staffProfileId: "",
        leadId: "",
        clientName: "  Acme Client ",
        paymentType: "cash",
        referenceNumber: "",
        netPrice: "125000.50",
        receivedAmount: "150000.00",
      }),
    ).toEqual({
      staffProfileId: undefined,
      leadId: undefined,
      clientName: "Acme Client",
      paymentType: "cash",
      referenceNumber: undefined,
      netPrice: "125000.50",
      receivedAmount: "150000.00",
    });
  });

  it("rejects imprecise and negative money values", () => {
    expect(
      saleSchema.safeParse({
        clientName: "Client",
        paymentType: "cash",
        netPrice: "12.345",
        receivedAmount: "-1",
      }).success,
    ).toBe(false);
  });

  it("drops unsupported filters instead of leaking them into queries", () => {
    expect(
      saleFiltersSchema.parse({
        paymentType: "crypto",
        staffProfileId: "not-a-uuid",
      }),
    ).toEqual({ paymentType: undefined, staffProfileId: undefined });
  });
});

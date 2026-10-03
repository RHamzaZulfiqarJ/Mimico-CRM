import { describe, expect, it } from "vitest";

import {
  inventorySchema,
  projectSchema,
  societySchema,
} from "@/features/reference-data/schemas";

describe("reference data schemas", () => {
  it("trims society fields", () => {
    expect(
      societySchema.parse({
        title: "  Green Valley  ",
        description: "  Primary society  ",
      }),
    ).toEqual({
      title: "Green Valley",
      description: "Primary society",
    });
  });

  it("requires projects to identify a society", () => {
    expect(
      projectSchema.safeParse({
        societyId: "not-a-uuid",
        title: "Phase One",
        description: "Initial development",
        city: "Lahore",
      }).success,
    ).toBe(false);
  });

  it.each(["10", "10.5", "10.50", "9999999999999999.99"])(
    "accepts the decimal price %s without converting it to a float",
    (price) => {
      const result = inventorySchema.parse({
        projectId: "",
        sellerName: "Example Seller",
        sellerPhone: "",
        sellerEmail: "",
        sellerCompanyName: "",
        sellerCity: "",
        propertyStreetNumber: "",
        propertyNumber: "",
        price,
        remarks: "",
        status: "UNSOLD",
      });

      expect(result.price).toBe(price);
    },
  );

  it.each(["10.999", "1,000", "-1", "not-money"])(
    "rejects the invalid decimal price %s",
    (price) => {
      expect(
        inventorySchema.safeParse({
          projectId: "",
          sellerName: "Example Seller",
          price,
          status: "UNSOLD",
        }).success,
      ).toBe(false);
    },
  );
});

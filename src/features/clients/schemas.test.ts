import { describe, expect, it } from "vitest";

import { clientFiltersSchema, clientFormSchema, clientStatusSchema } from "@/features/clients/schemas";

describe("client schemas", () => {
  it("normalizes valid client input", () => {
    const result = clientFormSchema.parse({
      firstName: " Ayesha ",
      lastName: " Khan ",
      email: " AYESHA@EXAMPLE.COM ",
      phone: "0300 0000000",
      city: " Lahore ",
      cnic: "",
      portalProfileId: "",
    });
    expect(result).toEqual({
      firstName: "Ayesha",
      lastName: "Khan",
      email: "ayesha@example.com",
      phone: "0300 0000000",
      city: "Lahore",
      cnic: undefined,
      portalProfileId: undefined,
    });
  });

  it("rejects invalid contact and identifier values", () => {
    expect(clientFormSchema.safeParse({ firstName: "A", lastName: "K", email: "bad", phone: "12" }).success).toBe(false);
    expect(clientStatusSchema.safeParse({ clientId: "bad", active: "true" }).success).toBe(false);
  });

  it("uses safe list filter defaults", () => {
    expect(clientFiltersSchema.parse({ status: "unknown", page: "bad" })).toEqual({
      status: "active",
      page: 1,
    });
  });
});

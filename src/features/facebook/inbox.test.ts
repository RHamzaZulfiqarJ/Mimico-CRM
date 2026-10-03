import { describe, expect, it } from "vitest";

import {
  facebookFields,
  facebookLeadDefaults,
  facebookLeadDisplayStatus,
} from "@/features/facebook/inbox";

describe("Facebook lead inbox helpers", () => {
  it("safely normalizes provider fields and derives conversion defaults", () => {
    const defaults = facebookLeadDefaults([
      { name: "first_name", values: ["Ayesha"] },
      { name: "last_name", values: ["Khan"] },
      { name: "phone_number", values: ["0300 1234567"] },
      { name: "project", values: ["Garden Villas"] },
      { name: "budget", values: ["12 million"] },
      { name: 42, values: ["ignored"] },
    ]);

    expect(defaults.clientName).toBe("Ayesha Khan");
    expect(defaults.clientPhone).toBe("0300 1234567");
    expect(defaults.requestedProject).toBe("Garden Villas");
    expect(defaults.description).toContain("budget: 12 million");
    expect(defaults.fields).toHaveLength(5);
  });

  it("returns no fields for malformed provider data", () => {
    expect(facebookFields({ name: "full_name" })).toEqual([]);
  });

  it("treats elapsed pending leads as expired", () => {
    expect(
      facebookLeadDisplayStatus({
        inboundStatus: "PENDING",
        claimStatus: "PENDING",
        expiresAt: new Date("2026-01-01T00:00:00Z"),
        now: new Date("2026-01-02T00:00:00Z"),
      }),
    ).toBe("expired");
  });
});

import { describe, expect, it } from "vitest";

import { clientUidFromId, displayClientUid } from "@/features/clients/identifiers";

describe("client identifiers", () => {
  it("creates a stable readable identifier from a UUID", () => {
    expect(clientUidFromId("12345678-90ab-cdef-1234-567890abcdef")).toBe(
      "CLIENT-1234567890AB",
    );
  });

  it("prefers an existing migrated identifier", () => {
    expect(displayClientUid("C-104", "12345678-90ab-cdef-1234-567890abcdef")).toBe("C-104");
  });
});

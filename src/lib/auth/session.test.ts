import { describe, expect, it } from "vitest";

import { normalizeAuthUserId } from "@/lib/auth/identity";

describe("normalizeAuthUserId", () => {
  it("accepts a Supabase UUID", () => {
    expect(normalizeAuthUserId("a3bb189e-8bf9-4c60-9f46-18f5880f1b13")).toBe(
      "a3bb189e-8bf9-4c60-9f46-18f5880f1b13",
    );
  });

  it("rejects missing and malformed forwarded identities", () => {
    expect(normalizeAuthUserId(null)).toBeNull();
    expect(normalizeAuthUserId("not-a-user-id")).toBeNull();
  });
});

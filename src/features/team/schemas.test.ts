import { describe, expect, it } from "vitest";

import {
  inviteMemberSchema,
  membershipChangeSchema,
  membershipStatusSchema,
} from "@/features/team/schemas";

describe("team schemas", () => {
  it("normalizes an invitation", () => {
    expect(
      inviteMemberSchema.parse({
        firstName: "  Ayesha ",
        lastName: " Khan  ",
        email: " AYESHA@EXAMPLE.COM ",
        role: "EMPLOYEE",
      }),
    ).toEqual({
      firstName: "Ayesha",
      lastName: "Khan",
      email: "ayesha@example.com",
      role: "EMPLOYEE",
    });
  });

  it("rejects unsupported roles and invalid membership IDs", () => {
    expect(
      membershipChangeSchema.safeParse({ membershipId: "bad", role: "OWNER" })
        .success,
    ).toBe(false);
  });

  it("parses explicit membership status values", () => {
    expect(
      membershipStatusSchema.parse({
        membershipId: "7da3c6a2-b890-4a36-894b-68c8e84122be",
        active: "false",
      }).active,
    ).toBe(false);
  });
});

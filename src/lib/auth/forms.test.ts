import { describe, expect, it } from "vitest";

import {
  emailSchema,
  loginSchema,
  safeNextPath,
  updatePasswordSchema,
} from "@/lib/auth/forms";

describe("auth form validation", () => {
  it("normalizes login email addresses", () => {
    const result = loginSchema.parse({
      email: "  USER@EXAMPLE.COM ",
      password: "password",
    });

    expect(result.email).toBe("user@example.com");
  });

  it("rejects invalid recovery email addresses", () => {
    expect(emailSchema.safeParse({ email: "not-an-email" }).success).toBe(
      false,
    );
  });

  it("requires a strong matching password", () => {
    expect(
      updatePasswordSchema.safeParse({
        password: "StrongPass1",
        confirmPassword: "StrongPass1",
      }).success,
    ).toBe(true);
    expect(
      updatePasswordSchema.safeParse({
        password: "StrongPass1",
        confirmPassword: "different",
      }).success,
    ).toBe(false);
  });
});

describe("safeNextPath", () => {
  it.each([
    [null, "/dashboard"],
    ["https://attacker.example", "/dashboard"],
    ["//attacker.example", "/dashboard"],
    ["/\\attacker.example", "/dashboard"],
    ["/%5C%5Cattacker.example", "/dashboard"],
    ["dashboard", "/dashboard"],
    ["/dashboard", "/dashboard"],
    ["/dashboard?view=mine", "/dashboard?view=mine"],
  ])("maps %s to %s", (input, expected) => {
    expect(safeNextPath(input)).toBe(expected);
  });

  it("supports a flow-specific fallback", () => {
    expect(safeNextPath(null, "/update-password")).toBe("/update-password");
    expect(safeNextPath("https://attacker.example", "/update-password")).toBe(
      "/update-password",
    );
  });
});

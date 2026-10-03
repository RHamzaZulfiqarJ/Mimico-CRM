import { createHmac } from "node:crypto";

import { describe, expect, test } from "vitest";

import { secureStringEqual, verifyFacebookSignature } from "@/features/facebook/security";

describe("Facebook webhook security", () => {
  test("accepts a valid SHA-256 signature", () => {
    const body = JSON.stringify({ object: "page" });
    const secret = "test-app-secret";
    const signature = `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
    expect(verifyFacebookSignature(body, signature, secret)).toBe(true);
  });

  test("rejects malformed or incorrect signatures", () => {
    expect(verifyFacebookSignature("body", null, "secret")).toBe(false);
    expect(verifyFacebookSignature("body", "sha256=wrong", "secret")).toBe(false);
    expect(secureStringEqual("same", "same")).toBe(true);
    expect(secureStringEqual("same", "different")).toBe(false);
  });
});

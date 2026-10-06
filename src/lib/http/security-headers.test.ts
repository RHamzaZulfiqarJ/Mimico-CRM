import { describe, expect, it } from "vitest";

import { getSecurityHeaders } from "@/lib/http/security-headers";

describe("getSecurityHeaders", () => {
  it("sets browser hardening headers on every environment", () => {
    expect(Object.fromEntries(getSecurityHeaders(false).map((header) => [header.key, header.value])))
      .toEqual(expect.objectContaining({
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
        "Referrer-Policy": "strict-origin-when-cross-origin",
      }));
  });

  it("enables HSTS only for production responses", () => {
    expect(getSecurityHeaders(false).some((header) => header.key === "Strict-Transport-Security")).toBe(false);
    expect(getSecurityHeaders(true)).toContainEqual({
      key: "Strict-Transport-Security",
      value: "max-age=31536000; includeSubDomains",
    });
  });
});

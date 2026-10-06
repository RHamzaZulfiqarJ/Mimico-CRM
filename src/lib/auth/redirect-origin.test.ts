import { describe, expect, it } from "vitest";

import { resolveAuthRedirectOrigin } from "@/lib/auth/redirect-origin";

describe("resolveAuthRedirectOrigin", () => {
  it("prefers the CRM request origin over a stale deployment URL", () => {
    expect(resolveAuthRedirectOrigin({
      configuredUrl: "https://mimico-crm-example.vercel.app",
      origin: "https://crm.mimico.live",
    })).toBe("https://crm.mimico.live");
  });

  it("uses Vercel forwarded headers when Origin is unavailable", () => {
    expect(resolveAuthRedirectOrigin({
      configuredUrl: "https://mimico-crm-example.vercel.app",
      forwardedHost: "crm.mimico.live",
      forwardedProto: "https",
    })).toBe("https://crm.mimico.live");
  });

  it("falls back to the configured URL when request headers are unusable", () => {
    expect(resolveAuthRedirectOrigin({
      configuredUrl: "https://crm.mimico.live/path",
      origin: "javascript:alert(1)",
    })).toBe("https://crm.mimico.live");
  });

  it("allows an HTTP localhost origin for development", () => {
    expect(resolveAuthRedirectOrigin({
      configuredUrl: "https://crm.mimico.live",
      host: "localhost:3000",
    })).toBe("http://localhost:3000");
  });
});

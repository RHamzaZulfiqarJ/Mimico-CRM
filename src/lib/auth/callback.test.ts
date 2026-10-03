import { describe, expect, it } from "vitest";

import { authCallbackDestination, isPasswordSetupFlow } from "@/lib/auth/callback";

describe("auth callback routing", () => {
  it("routes invitations and recovery sessions to password setup", () => {
    expect(authCallbackDestination("invite", null)).toBe("/update-password?flow=invite");
    expect(authCallbackDestination("recovery", null)).toBe("/update-password?flow=recovery");
  });

  it("keeps a safe requested password route and annotates the flow", () => {
    expect(authCallbackDestination("invite", "/update-password")).toBe(
      "/update-password?flow=invite",
    );
  });

  it("rejects unsafe next paths without skipping password setup", () => {
    expect(authCallbackDestination("recovery", "https://attacker.example")).toBe(
      "/update-password?flow=recovery",
    );
  });

  it("uses the dashboard for non-password flows", () => {
    expect(authCallbackDestination("email", null)).toBe("/dashboard");
    expect(isPasswordSetupFlow("invite")).toBe(true);
    expect(isPasswordSetupFlow("email")).toBe(false);
  });
});

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AppShell } from "@/components/app-shell";

vi.mock("@/app/auth/actions", () => ({
  signOutAction: vi.fn(),
}));

describe("AppShell client portal", () => {
  it("shows only client information navigation", () => {
    render(
      <AppShell auth={{
        authUserId: "auth-user",
        organization: { id: "organization", name: "Mimico", slug: "mimico" },
        profile: { id: "profile", displayName: "Client User", email: "client@example.com" },
        membership: { id: "membership", role: "CLIENT" },
      }}>
        <p>Client content</p>
      </AppShell>,
    );

    expect(screen.getByRole("link", { name: "Overview" })).toHaveAttribute("href", "/dashboard");
    expect(screen.getByRole("link", { name: "My records" })).toHaveAttribute("href", "/leads");
    expect(screen.getByText("Secure read-only access")).toBeInTheDocument();
    expect(screen.queryByText("Inventory")).not.toBeInTheDocument();
    expect(screen.queryByText("Cash Book")).not.toBeInTheDocument();
    expect(screen.queryByText("Facebook leads")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Open notifications")).not.toBeInTheDocument();
  });
});

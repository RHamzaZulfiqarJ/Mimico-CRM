import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  updateInbound: vi.fn(),
  updateClaims: vi.fn(),
  createAudit: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/lib/database", () => ({
  getDatabase: () => ({
    facebookInboundLead: { findMany: mocks.findMany },
    $transaction: mocks.transaction,
  }),
}));

import {
  isFacebookMaintenanceRequestAuthorized,
  runFacebookMaintenance,
} from "@/features/facebook/maintenance";

describe("Facebook maintenance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findMany
      .mockResolvedValueOnce([
        { id: "lead-1", organizationId: "organization-1" },
        { id: "lead-2", organizationId: "organization-1" },
      ])
      .mockResolvedValueOnce([]);
    mocks.updateInbound.mockResolvedValue({ count: 1 });
    mocks.updateClaims.mockResolvedValue({ count: 4 });
    mocks.createAudit.mockResolvedValue({ id: "audit-1" });
    mocks.transaction.mockImplementation(async (callback) => callback({
      facebookInboundLead: { updateMany: mocks.updateInbound },
      facebookLeadClaim: { updateMany: mocks.updateClaims },
      auditLog: { create: mocks.createAudit },
    }));
  });

  it("expires eligible leads and dismisses their pending claims", async () => {
    const now = new Date("2026-10-03T12:00:00.000Z");
    await expect(runFacebookMaintenance(now)).resolves.toMatchObject({
      matched: 2,
      expired: 2,
      claimsDismissed: 4,
      skipped: 0,
    });
    expect(mocks.updateInbound).toHaveBeenCalledTimes(2);
    expect(mocks.updateClaims).toHaveBeenCalledWith({
      where: { inboundLeadId: { in: ["lead-1", "lead-2"] }, status: "PENDING" },
      data: { status: "DISMISSED", respondedAt: now },
    });
    expect(mocks.createAudit).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: "facebook_leads.expired" }),
    }));
  });

  it("requires the exact bearer secret", () => {
    const secret = "facebook-maintenance-secret-long-enough";
    expect(isFacebookMaintenanceRequestAuthorized(`Bearer ${secret}`, secret)).toBe(true);
    expect(isFacebookMaintenanceRequestAuthorized("Bearer wrong", secret)).toBe(false);
    expect(isFacebookMaintenanceRequestAuthorized(null, secret)).toBe(false);
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findIntegrations: vi.fn(),
  findMemberships: vi.fn(),
  fetchIdentity: vi.fn(),
  createNotifications: vi.fn(),
  createAudit: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/features/facebook/graph", () => ({
  fetchFacebookPageIdentity: mocks.fetchIdentity,
}));

vi.mock("@/lib/database", () => ({
  getDatabase: () => ({
    facebookIntegration: { findMany: mocks.findIntegrations },
    organizationMembership: { findMany: mocks.findMemberships },
    $transaction: mocks.transaction,
  }),
}));

import { runFacebookHealthCheck } from "@/features/facebook/health";

describe("Facebook integration health monitoring", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.FACEBOOK_PAGE_TOKEN_TEST = "private-token";
    mocks.findIntegrations.mockResolvedValue([
      {
        id: "integration-1",
        organizationId: "organization-1",
        pageId: "page-1",
        pageAccessTokenSecretName: "FACEBOOK_PAGE_TOKEN_TEST",
      },
    ]);
    mocks.findMemberships.mockResolvedValue([
      { organizationId: "organization-1", profileId: "manager-1" },
    ]);
    mocks.createNotifications.mockResolvedValue({ count: 1 });
    mocks.createAudit.mockResolvedValue({ id: "audit-1" });
    mocks.transaction.mockImplementation(async (callback) => callback({
      notification: { createMany: mocks.createNotifications },
      auditLog: { create: mocks.createAudit },
    }));
  });

  afterEach(() => {
    delete process.env.FACEBOOK_PAGE_TOKEN_TEST;
  });

  it("reports a healthy integration without creating warnings", async () => {
    mocks.fetchIdentity.mockResolvedValue({ id: "page-1", name: "Mimico" });
    await expect(
      runFacebookHealthCheck(new Date("2026-10-03T12:00:00.000Z")),
    ).resolves.toMatchObject({ checked: 1, connected: 1, failures: 0 });
    expect(mocks.findMemberships).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("warns managers idempotently when the token belongs to another Page", async () => {
    mocks.fetchIdentity.mockResolvedValue({ id: "page-2", name: "Another Page" });
    const now = new Date("2026-10-03T12:00:00.000Z");
    await expect(runFacebookHealthCheck(now)).resolves.toMatchObject({
      checked: 1,
      connected: 0,
      failures: 1,
      notificationsCreated: 1,
    });
    expect(mocks.createNotifications).toHaveBeenCalledWith(expect.objectContaining({
      skipDuplicates: true,
      data: [expect.objectContaining({
        recipientProfileId: "manager-1",
        uid: "facebook-health:integration-1:PAGE_MISMATCH:2026-10-03:manager-1",
        payload: expect.objectContaining({ actualPageId: "page-2" }),
      })],
    }));
  });

  it("does not expose a missing secret and still records the warning", async () => {
    delete process.env.FACEBOOK_PAGE_TOKEN_TEST;
    await runFacebookHealthCheck(new Date("2026-10-03T12:00:00.000Z"));
    expect(mocks.fetchIdentity).not.toHaveBeenCalled();
    expect(mocks.createNotifications).toHaveBeenCalledWith(expect.objectContaining({
      data: [expect.objectContaining({
        description: expect.stringContaining("missing its configured Page-token"),
        payload: expect.objectContaining({ status: "MISSING_SECRET" }),
      })],
    }));
  });
});

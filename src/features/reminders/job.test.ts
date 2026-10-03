import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  createMany: vi.fn(),
  createAudit: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/lib/database", () => ({
  getDatabase: () => ({
    task: { findMany: mocks.findMany },
    $transaction: mocks.transaction,
  }),
}));

import { runTaskReminderJob } from "@/features/reminders/job";

describe("runTaskReminderJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findMany.mockResolvedValue([
      {
        id: "task-1",
        organizationId: "organization-1",
        assignedToProfileId: "profile-1",
        title: "Call client",
        dueAt: new Date("2026-10-02T10:30:00.000Z"),
      },
      {
        id: "task-2",
        organizationId: "organization-1",
        assignedToProfileId: "profile-2",
        title: "Prepare report",
        dueAt: new Date("2026-10-02T11:00:00.000Z"),
      },
    ]);
    mocks.createMany.mockResolvedValue({ count: 1 });
    mocks.createAudit.mockResolvedValue({ id: "audit-1" });
    mocks.transaction.mockImplementation(async (callback) => callback({
      notification: { createMany: mocks.createMany },
      auditLog: { create: mocks.createAudit },
    }));
  });

  it("creates idempotent reminders and reports skipped duplicates", async () => {
    const result = await runTaskReminderJob(new Date("2026-10-02T10:00:00.000Z"));

    expect(result).toMatchObject({ matched: 2, created: 1, skipped: 1 });
    expect(mocks.createMany).toHaveBeenCalledWith(expect.objectContaining({
      skipDuplicates: true,
      data: expect.arrayContaining([
        expect.objectContaining({
          uid: "task-reminder:task-1:1790937000000",
          recipientProfileId: "profile-1",
          payload: { taskId: "task-1", dueAt: "2026-10-02T10:30:00.000Z" },
        }),
      ]),
    }));
    expect(mocks.createAudit).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        action: "task.reminders_dispatched",
        metadata: expect.objectContaining({ matched: 2, created: 1 }),
      }),
    }));
  });
});

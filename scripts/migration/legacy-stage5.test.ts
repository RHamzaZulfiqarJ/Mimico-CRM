import { describe, expect, it } from "vitest";

import { buildStage5Plan } from "./legacy-stage5";

const profiles = new Set(["employee-1", "manager-1"]);
const leads = new Set(["lead-1"]);

describe("buildStage5Plan", () => {
  it("maps completed tasks and Mongo extended dates", () => {
    const plan = buildStage5Plan({ tasks: [{
      _id: { $oid: "task-1" }, userId: { $oid: "employee-1" }, uid: "T-1",
      newTask: "Call the client", newTaskDeadline: { $date: { $numberLong: "1790937000000" } },
      completedTask: "Call the client", completedTaskDate: "2026-10-02T10:00:00.000Z",
      completedTaskStatus: "successful", completedTaskComment: "Confirmed.",
    }] }, { knownProfileLegacyIds: profiles });

    expect(plan.rejected).toEqual([]);
    expect(plan.tasks[0]).toMatchObject({
      legacyMongoId: "task-1", assignedToLegacyProfileId: "employee-1",
      title: "Call the client", status: "COMPLETED", outcome: "SUCCESSFUL",
      dueAt: "2026-10-02T10:30:00.000Z", completedAt: "2026-10-02T10:00:00.000Z",
    });
  });

  it("rejects invalid events and missing identity references", () => {
    const plan = buildStage5Plan({ events: [
      { _id: "event-1", userId: "missing", title: "Visit", start: "2026-10-02", end: "2026-10-03" },
      { _id: "event-2", userId: "employee-1", title: "Visit", start: "2026-10-03", end: "2026-10-02" },
    ] }, { knownProfileLegacyIds: profiles });

    expect(plan.calendarEvents).toEqual([]);
    expect(plan.rejected).toEqual(expect.arrayContaining([
      expect.objectContaining({ reason: "Profile missing is missing from the identity export." }),
      expect.objectContaining({ reason: "Event end must be after its start." }),
    ]));
  });

  it("maps approvals and routes their legacy notifications to management", () => {
    const plan = buildStage5Plan({
      approvals: [{
        _id: "approval-1", uid: "A-1", description: "Need approval for the refund",
        type: "refund", status: "underProcess", leadId: "lead-1", data: { amount: 5000 },
      }],
      notifications: [{
        _id: "notification-1", type: "refund-approval", description: "Refund approval needed.",
        approvalID: "approval-1", isRead: false,
      }],
    }, { knownProfileLegacyIds: profiles, knownLeadLegacyIds: leads });

    expect(plan.rejected).toEqual([]);
    expect(plan.approvals[0]).toMatchObject({ type: "REFUND", status: "UNDER_PROCESS", leadLegacyMongoId: "lead-1" });
    expect(plan.notifications[0]).toMatchObject({
      type: "legacy_refund_approval", approvalLegacyMongoId: "approval-1",
      recipient: { kind: "management" },
    });
  });

  it("routes urgent task notifications to the task owner", () => {
    const plan = buildStage5Plan({
      tasks: [{ _id: "task-1", userId: "employee-1", newTask: "Call client" }],
      notifications: [{
        _id: "notification-1", type: "urgent-task", description: "Task is due soon.",
        data: { _id: "task-1", userId: "employee-1" },
      }],
    }, { knownProfileLegacyIds: profiles });

    expect(plan.rejected).toEqual([]);
    expect(plan.notifications[0]).toMatchObject({
      taskLegacyMongoId: "task-1",
      recipient: { kind: "profile", legacyProfileId: "employee-1" },
    });
  });

  it("rejects orphaned approval notifications and duplicate IDs", () => {
    const plan = buildStage5Plan({ notifications: [
      { _id: "notice-1", type: "voucher-approval", description: "Approve", approvalID: "missing" },
      { _id: "notice-1", type: "refund-approval", description: "Approve" },
    ] }, { knownProfileLegacyIds: profiles });

    expect(plan.notifications).toEqual([]);
    expect(plan.rejected).toEqual(expect.arrayContaining([
      expect.objectContaining({ reason: "Approval missing is missing or rejected." }),
      expect.objectContaining({ reason: "Duplicate legacy ID: notice-1." }),
    ]));
  });
});

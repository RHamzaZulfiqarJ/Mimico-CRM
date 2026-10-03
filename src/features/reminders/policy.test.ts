import { describe, expect, it } from "vitest";

import {
  getTaskReminderWindow,
  isTaskReminderRequestAuthorized,
  taskReminderDescription,
  taskReminderUid,
} from "@/features/reminders/policy";

describe("task reminder policy", () => {
  it("uses a bounded lookback and upcoming window", () => {
    const now = new Date("2026-10-02T10:00:00.000Z");
    expect(getTaskReminderWindow(now)).toEqual({
      startsAt: new Date("2026-10-02T09:00:00.000Z"),
      endsAt: new Date("2026-10-03T10:00:00.000Z"),
    });
  });

  it("builds deterministic identifiers for idempotent delivery", () => {
    const dueAt = new Date("2026-10-02T10:30:00.000Z");
    expect(taskReminderUid("task-1", dueAt)).toBe("task-reminder:task-1:1790937000000");
    expect(taskReminderDescription("Call client", dueAt)).toBe(
      "Call client is due 2026-10-02T10:30:00.000Z.",
    );
  });

  it("accepts only the exact bearer secret", () => {
    const secret = "a-secure-reminder-secret-with-32-characters";
    expect(isTaskReminderRequestAuthorized(`Bearer ${secret}`, secret)).toBe(true);
    expect(isTaskReminderRequestAuthorized("Bearer wrong", secret)).toBe(false);
    expect(isTaskReminderRequestAuthorized(null, secret)).toBe(false);
  });
});

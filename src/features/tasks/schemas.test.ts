import { describe, expect, it } from "vitest";

import {
  createTaskSchema,
  localDateTimeToUtc,
  taskFiltersSchema,
  updateTaskStatusSchema,
} from "@/features/tasks/schemas";

describe("task schemas", () => {
  it("normalizes a task and optional assignment", () => {
    expect(
      createTaskSchema.parse({
        title: "  Call the client ",
        description: "  Confirm the site visit. ",
        dueAt: "2026-10-02T10:30",
        timezoneOffset: "-300",
        assignedProfileId: "",
      }),
    ).toEqual({
      title: "Call the client",
      description: "Confirm the site visit.",
      dueAt: "2026-10-02T10:30",
      timezoneOffset: -300,
      assignedProfileId: undefined,
    });
  });

  it("converts a browser-local deadline to UTC", () => {
    expect(localDateTimeToUtc("2026-10-02T10:30", -300).toISOString()).toBe("2026-10-02T05:30:00.000Z");
  });

  it("requires an outcome when a task is completed", () => {
    expect(
      updateTaskStatusSchema.safeParse({
        status: "COMPLETED",
        outcome: "",
        outcomeComment: "Done",
      }).success,
    ).toBe(false);
  });

  it("accepts a completed task with an outcome", () => {
    expect(
      updateTaskStatusSchema.safeParse({
        status: "COMPLETED",
        outcome: "SUCCESSFUL",
        outcomeComment: "Client confirmed.",
      }).success,
    ).toBe(true);
  });

  it("rejects unsupported task filters", () => {
    expect(taskFiltersSchema.safeParse({ status: "BLOCKED" }).success).toBe(false);
  });

  it("defaults task views to list and accepts the board view", () => {
    expect(taskFiltersSchema.parse({}).view).toBe("list");
    expect(taskFiltersSchema.parse({ view: "board" }).view).toBe("board");
    expect(taskFiltersSchema.parse({ view: "unsupported" }).view).toBe("list");
  });
});

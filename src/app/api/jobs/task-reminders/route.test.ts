import { afterEach, describe, expect, it } from "vitest";

import { POST } from "@/app/api/jobs/task-reminders/route";

const originalSecret = process.env.TASK_REMINDER_SECRET;

afterEach(() => {
  if (originalSecret === undefined) delete process.env.TASK_REMINDER_SECRET;
  else process.env.TASK_REMINDER_SECRET = originalSecret;
});

describe("task reminder route", () => {
  it("stays unavailable until a strong server secret is configured", async () => {
    delete process.env.TASK_REMINDER_SECRET;
    const response = await POST(new Request("http://localhost/api/jobs/task-reminders", { method: "POST" }));
    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("rejects an invalid bearer token before opening the database", async () => {
    process.env.TASK_REMINDER_SECRET = "a-secure-reminder-secret-with-32-characters";
    const response = await POST(new Request("http://localhost/api/jobs/task-reminders", {
      method: "POST",
      headers: { Authorization: "Bearer incorrect" },
    }));
    expect(response.status).toBe(401);
  });
});

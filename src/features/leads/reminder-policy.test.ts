import { describe, expect, it } from "vitest";

import { pakistanDateKey, reminderTiming } from "./reminder-policy";

describe("lead reminder policy", () => {
  it("uses the Pakistan calendar date around UTC midnight", () => {
    expect(pakistanDateKey(new Date("2026-10-04T19:30:00.000Z"))).toBe(
      "2026-10-05",
    );
  });

  it("classifies reminders by their Pakistan calendar date", () => {
    const now = new Date("2026-10-05T07:00:00.000Z");

    expect(reminderTiming(new Date("2026-10-04T18:59:59.000Z"), now)).toBe(
      "overdue",
    );
    expect(reminderTiming(new Date("2026-10-05T15:00:00.000Z"), now)).toBe(
      "today",
    );
    expect(reminderTiming(new Date("2026-10-05T19:00:00.000Z"), now)).toBe(
      "upcoming",
    );
  });
});

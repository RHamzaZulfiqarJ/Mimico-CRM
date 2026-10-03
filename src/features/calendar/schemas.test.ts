import { describe, expect, it } from "vitest";

import { calendarEventSchema, calendarFiltersSchema } from "@/features/calendar/schemas";

describe("calendar schemas", () => {
  it("normalizes a valid event", () => {
    expect(calendarEventSchema.parse({
      title: "  Client visit ", description: "  Plot 12 ",
      startsAt: "2026-10-02T10:30", endsAt: "2026-10-02T11:00", timezoneOffset: "-300",
    })).toMatchObject({ title: "Client visit", description: "Plot 12", timezoneOffset: -300 });
  });

  it("rejects an event that ends before it starts", () => {
    expect(calendarEventSchema.safeParse({
      title: "Client visit", startsAt: "2026-10-02T11:00", endsAt: "2026-10-02T10:30", timezoneOffset: 0,
    }).success).toBe(false);
  });

  it("defaults to the upcoming view", () => {
    expect(calendarFiltersSchema.parse({}).view).toBe("upcoming");
  });
});

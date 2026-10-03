import { describe, expect, it } from "vitest";

import {
  createLeadSchema,
  followUpSchema,
  leadFiltersSchema,
  updateLeadSchema,
} from "./schemas";

describe("lead schemas", () => {
  it("normalizes a valid lead and optional fields", () => {
    const result = createLeadSchema.parse({
      clientName: "  Sana Ahmed  ",
      clientPhone: " 0300 1234567 ",
      projectId: "",
      assignedProfileId: "",
      area: "",
      city: "Lahore",
      priority: "HOT",
      stage: "NEW_CLIENT",
      source: "Referral",
      description: "",
      followUpAt: "",
    });

    expect(result).toMatchObject({
      clientName: "Sana Ahmed",
      clientPhone: "0300 1234567",
      projectId: undefined,
      area: undefined,
      priority: "HOT",
    });
  });

  it("accepts the employee form when the hidden assignee field is absent", () => {
    const result = createLeadSchema.safeParse({
      clientName: "Sana Ahmed",
      clientPhone: "0300 1234567",
      projectId: "",
      assignedProfileId: null,
      area: "",
      city: "Lahore",
      priority: "HOT",
      stage: "NEW_CLIENT",
      source: "Referral",
      description: "",
      followUpAt: "",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.assignedProfileId).toBeUndefined();
    }
  });

  it("rejects malformed lead inputs", () => {
    const result = createLeadSchema.safeParse({
      clientName: "S",
      clientPhone: "1",
      priority: "urgent",
      stage: "new",
    });
    expect(result.success).toBe(false);
  });

  it("accepts a progress update and follow-up", () => {
    expect(
      updateLeadSchema.safeParse({
        projectId: "",
        priority: "MODERATE",
        stage: "FOLLOW_UP",
      }).success,
    ).toBe(true);
    expect(
      followUpSchema.safeParse({
        stage: "VISIT_SCHEDULED",
        followUpAt: "2026-10-01T10:30",
        remarks: "Client confirmed a site visit.",
      }).success,
    ).toBe(true);
  });

  it("drops invalid optional URL filters", () => {
    expect(
      leadFiltersSchema.parse({
        query: " ali ",
        stage: "invalid",
        priority: "HOT",
        projectId: "invalid",
      }),
    ).toEqual({ query: "ali", priority: "HOT", page: 1 });
  });

  it("normalizes lead pagination", () => {
    expect(leadFiltersSchema.parse({ page: "3" }).page).toBe(3);
    expect(leadFiltersSchema.parse({ page: "-1" }).page).toBe(1);
    expect(leadFiltersSchema.parse({ page: "not-a-page" }).page).toBe(1);
  });
});

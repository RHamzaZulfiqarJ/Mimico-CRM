import { describe, expect, test } from "vitest";

import {
  facebookFieldValue,
  facebookInboxFiltersSchema,
  facebookIntegrationSchema,
  facebookLeadConversionSchema,
  facebookPageIdentitySchema,
  facebookWebhookSchema,
} from "@/features/facebook/schemas";

describe("Facebook integration schemas", () => {
  test("accepts secret references without accepting secret values", () => {
    expect(
      facebookIntegrationSchema.safeParse({
        pageId: "123",
        appId: "456",
        verifyTokenSecretName: "FACEBOOK_VERIFY_TOKEN",
        appSecretName: "FACEBOOK_APP_SECRET",
        pageAccessTokenSecretName: "FACEBOOK_PAGE_ACCESS_TOKEN",
      }).success,
    ).toBe(true);
    expect(
      facebookIntegrationSchema.safeParse({
        pageId: "123",
        appId: "456",
        verifyTokenSecretName: "actual secret value",
        appSecretName: "secret",
        pageAccessTokenSecretName: "token",
      }).success,
    ).toBe(false);
  });

  test("parses leadgen entries and extracts field values", () => {
    const payload = facebookWebhookSchema.parse({
      object: "page",
      entry: [{ id: "123", changes: [{ field: "leadgen", value: { leadgen_id: "lead-1" } }] }],
    });
    expect(payload.entry[0].changes[0].value.leadgen_id).toBe("lead-1");
    expect(facebookFieldValue([{ name: "full_name", values: [" Ayesha Khan "] }], "full_name")).toBe("Ayesha Khan");
  });

  test("validates inbox filters and falls back safely", () => {
    expect(facebookInboxFiltersSchema.parse({ view: "unknown", page: "bad" })).toEqual({
      view: "available",
      page: 1,
    });
  });

  test("validates a conversion payload", () => {
    expect(
      facebookLeadConversionSchema.parse({
        clientName: "Ayesha Khan",
        clientPhone: "03001234567",
        projectId: "",
        area: "",
        city: "Lahore",
        priority: "HOT",
        stage: "NEW_CLIENT",
        description: "Facebook inquiry",
        followUpAt: "",
      }),
    ).toMatchObject({ clientName: "Ayesha Khan", city: "Lahore", priority: "HOT" });
  });

  test("accepts a Graph page identity without depending on extra fields", () => {
    expect(
      facebookPageIdentitySchema.parse({ id: "123", name: "Mimico", category: "Business" }),
    ).toMatchObject({ id: "123", name: "Mimico" });
  });
});

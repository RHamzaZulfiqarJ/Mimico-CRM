import { describe, expect, test } from "vitest";

import {
  facebookFieldValue,
  facebookIntegrationSchema,
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
});

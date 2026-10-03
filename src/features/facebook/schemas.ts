import { z } from "zod";

const environmentVariableName = z
  .string()
  .trim()
  .min(3)
  .max(100)
  .regex(/^[A-Z][A-Z0-9_]*$/, "Use an uppercase environment-variable name.");

export const facebookIntegrationSchema = z.object({
  pageId: z.string().trim().min(2, "Page ID is required.").max(100),
  appId: z.string().trim().min(2, "App ID is required.").max(100),
  verifyTokenSecretName: environmentVariableName,
  appSecretName: environmentVariableName,
  pageAccessTokenSecretName: environmentVariableName,
});

const facebookLeadChangeSchema = z.object({
  field: z.literal("leadgen"),
  value: z
    .object({
      leadgen_id: z.string().min(1),
      page_id: z.string().optional(),
      form_id: z.string().optional(),
      created_time: z.number().optional(),
    })
    .passthrough(),
});

export const facebookWebhookSchema = z
  .object({
    object: z.literal("page"),
    entry: z.array(
      z
        .object({
          id: z.string().min(1),
          changes: z.array(facebookLeadChangeSchema).default([]),
        })
        .passthrough(),
    ),
  })
  .passthrough();

export const facebookGraphLeadSchema = z
  .object({
    id: z.string().min(1),
    created_time: z.string().min(1),
    field_data: z
      .array(
        z.object({
          name: z.string().min(1),
          values: z.array(z.string()),
        }),
      )
      .default([]),
  })
  .passthrough();

export type FacebookIntegrationFormState = {
  status: "idle" | "error" | "success";
  message?: string;
  errors?: Record<string, string[]>;
};

export const initialFacebookIntegrationFormState: FacebookIntegrationFormState = {
  status: "idle",
};

export function facebookFieldValue(
  fields: Array<{ name: string; values: string[] }>,
  name: string,
) {
  return fields.find((field) => field.name === name)?.values[0]?.trim() || null;
}

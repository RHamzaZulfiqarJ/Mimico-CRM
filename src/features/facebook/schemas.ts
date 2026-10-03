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

const optionalText = (max: number) =>
  z.preprocess(
    (value) =>
      value == null || (typeof value === "string" && value.trim() === "")
        ? undefined
        : value,
    z.string().trim().max(max).optional(),
  );

const optionalUuid = z.preprocess(
  (value) => (value == null || value === "" ? undefined : value),
  z.uuid("Select a valid project.").optional(),
);

export const facebookLeadConversionSchema = z.object({
  clientName: z.string().trim().min(2, "Client name is required.").max(160),
  clientPhone: z.string().trim().min(2, "Client phone is required.").max(50),
  projectId: optionalUuid,
  area: optionalText(120),
  city: optionalText(100),
  priority: z.enum(["VERY_COLD", "COLD", "MODERATE", "HOT", "VERY_HOT"]),
  stage: z.enum([
    "NEW_CLIENT",
    "FOLLOW_UP",
    "CONTACTED_CLIENT",
    "CALL_NOT_ATTEND",
    "VISIT_SCHEDULED",
    "VISIT_DONE",
    "CLOSED_WON",
    "CLOSED_LOST",
  ]),
  description: optionalText(2_000),
  followUpAt: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.iso.datetime({ local: true }).optional(),
  ),
});

export const facebookInboxFiltersSchema = z.object({
  view: z.enum(["available", "converted", "declined", "all"]).catch("available"),
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
});

export type FacebookIntegrationFormState = {
  status: "idle" | "error" | "success";
  message?: string;
  errors?: Record<string, string[]>;
};

export const initialFacebookIntegrationFormState: FacebookIntegrationFormState = {
  status: "idle",
};

export type FacebookLeadFormState = {
  status: "idle" | "error" | "success";
  message?: string;
  errors?: Record<string, string[]>;
};

export const initialFacebookLeadFormState: FacebookLeadFormState = {
  status: "idle",
};

export function facebookFieldValue(
  fields: Array<{ name: string; values: string[] }>,
  name: string,
) {
  return fields.find((field) => field.name === name)?.values[0]?.trim() || null;
}

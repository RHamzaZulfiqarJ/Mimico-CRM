import { z } from "zod";

export const leadPriorities = [
  "VERY_COLD",
  "COLD",
  "MODERATE",
  "HOT",
  "VERY_HOT",
] as const;

export const leadStages = [
  "NEW_CLIENT",
  "FOLLOW_UP",
  "CONTACTED_CLIENT",
  "CALL_NOT_ATTEND",
  "VISIT_SCHEDULED",
  "VISIT_DONE",
  "CLOSED_WON",
  "CLOSED_LOST",
] as const;

const optionalText = (max: number) =>
  z.preprocess(
    (value) =>
      value == null || (typeof value === "string" && value.trim() === "")
        ? undefined
        : value,
    z.string().trim().max(max).optional(),
  );

const optionalUuid = (message: string) =>
  z.preprocess(
    (value) => (value == null || value === "" ? undefined : value),
    z.uuid(message).optional(),
  );

const requiredText = (label: string, max: number) =>
  z
    .string()
    .trim()
    .min(2, `${label} must contain at least 2 characters.`)
    .max(max, `${label} must contain at most ${max} characters.`);

export const createLeadSchema = z.object({
  clientName: requiredText("Client name", 160),
  clientPhone: requiredText("Client phone", 50),
  projectId: optionalUuid("Select a valid project."),
  assignedProfileId: optionalUuid("Select a valid assignee."),
  area: optionalText(120),
  city: optionalText(100),
  priority: z.enum(leadPriorities),
  stage: z.enum(leadStages),
  source: optionalText(100),
  description: optionalText(2_000),
  followUpAt: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.iso.datetime({ local: true }).optional(),
  ),
});

export const updateLeadSchema = z.object({
  projectId: optionalUuid("Select a valid project."),
  priority: z.enum(leadPriorities),
  stage: z.enum(leadStages),
});

export const followUpSchema = z.object({
  stage: z.enum(leadStages),
  followUpAt: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.iso.datetime({ local: true }).optional(),
  ),
  remarks: requiredText("Remarks", 2_000),
});

export const assignmentSchema = z.object({
  profileId: z.uuid("Select a valid team member."),
});

export const leadFiltersSchema = z.object({
  query: z.string().trim().max(120).optional().catch(undefined),
  stage: z.enum(leadStages).optional().catch(undefined),
  priority: z.enum(leadPriorities).optional().catch(undefined),
  projectId: z.uuid().optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
});

export type LeadFormState = {
  status: "idle" | "error" | "success";
  message?: string;
  errors?: Record<string, string[]>;
};

export const initialLeadFormState: LeadFormState = { status: "idle" };

export const priorityLabels: Record<(typeof leadPriorities)[number], string> = {
  VERY_COLD: "Very cold",
  COLD: "Cold",
  MODERATE: "Moderate",
  HOT: "Hot",
  VERY_HOT: "Very hot",
};

export const stageLabels: Record<(typeof leadStages)[number], string> = {
  NEW_CLIENT: "New client",
  FOLLOW_UP: "Follow up",
  CONTACTED_CLIENT: "Contacted client",
  CALL_NOT_ATTEND: "Call not attended",
  VISIT_SCHEDULED: "Visit scheduled",
  VISIT_DONE: "Visit done",
  CLOSED_WON: "Closed won",
  CLOSED_LOST: "Closed lost",
};

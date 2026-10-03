import { z } from "zod";

export { localDateTimeToUtc } from "@/lib/datetime";

export const taskStatuses = ["TODO", "IN_PROGRESS", "COMPLETED", "CANCELLED"] as const;
export const taskOutcomes = ["SUCCESSFUL", "UNSUCCESSFUL"] as const;

export const taskStatusSchema = z.enum(taskStatuses);
export const taskOutcomeSchema = z.enum(taskOutcomes);

const optionalText = (maximum: number) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().trim().max(maximum).optional(),
  );

const optionalUuid = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.uuid().optional(),
);

const dateTimeString = z
  .string()
  .trim()
  .min(1, "Choose a due date and time.")
  .refine((value) => !Number.isNaN(Date.parse(value)), "Choose a valid due date and time.");

export const createTaskSchema = z.object({
  title: z.string().trim().min(2, "Enter a task title.").max(160),
  description: optionalText(2000),
  dueAt: dateTimeString,
  timezoneOffset: z.coerce.number().int().min(-840).max(840),
  assignedProfileId: optionalUuid,
});

export const updateTaskStatusSchema = z
  .object({
    status: taskStatusSchema,
    outcome: z.preprocess(
      (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
      taskOutcomeSchema.optional(),
    ),
    outcomeComment: optionalText(1000),
  })
  .superRefine((value, context) => {
    if (value.status === "COMPLETED" && !value.outcome) {
      context.addIssue({
        code: "custom",
        path: ["outcome"],
        message: "Choose the completion outcome.",
      });
    }
  });

export const taskFiltersSchema = z.object({
  query: optionalText(120),
  status: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    taskStatusSchema.optional(),
  ),
  assignedProfileId: optionalUuid,
});

export const taskStatusLabels: Record<(typeof taskStatuses)[number], string> = {
  TODO: "To do",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export const taskOutcomeLabels: Record<(typeof taskOutcomes)[number], string> = {
  SUCCESSFUL: "Successful",
  UNSUCCESSFUL: "Unsuccessful",
};

export type TaskFormState = {
  status: "idle" | "error" | "success";
  message?: string;
  errors?: Record<string, string[]>;
};

export const initialTaskFormState: TaskFormState = { status: "idle" };

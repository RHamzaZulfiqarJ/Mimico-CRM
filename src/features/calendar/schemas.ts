import { z } from "zod";

import { localDateTimeToUtc } from "@/lib/datetime";

const optionalText = (maximum: number) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().trim().max(maximum).optional(),
  );

const dateTimeString = z
  .string()
  .trim()
  .min(1, "Choose a date and time.")
  .refine((value) => !Number.isNaN(Date.parse(value)), "Choose a valid date and time.");

export const calendarEventSchema = z
  .object({
    title: z.string().trim().min(2, "Enter an event title.").max(160),
    description: optionalText(2000),
    startsAt: dateTimeString,
    endsAt: dateTimeString,
    timezoneOffset: z.coerce.number().int().min(-840).max(840),
  })
  .superRefine((value, context) => {
    const startsAt = localDateTimeToUtc(value.startsAt, value.timezoneOffset);
    const endsAt = localDateTimeToUtc(value.endsAt, value.timezoneOffset);
    if (endsAt <= startsAt) {
      context.addIssue({ code: "custom", path: ["endsAt"], message: "End time must be after the start time." });
    }
  });

export const calendarFiltersSchema = z.object({
  query: optionalText(120),
  view: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.enum(["upcoming", "past", "all"]).optional().default("upcoming"),
  ),
});

export type CalendarFormState = {
  status: "idle" | "error" | "success";
  message?: string;
  errors?: Record<string, string[]>;
};

export const initialCalendarFormState: CalendarFormState = { status: "idle" };

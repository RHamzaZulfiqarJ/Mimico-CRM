const pakistanDateKeyFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Karachi",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export type ReminderTiming = "overdue" | "today" | "upcoming";

export function pakistanDateKey(value: Date) {
  const parts = pakistanDateKeyFormatter.formatToParts(value);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  return `${year}-${month}-${day}`;
}

export function reminderTiming(
  followUpAt: Date,
  now: Date = new Date(),
): ReminderTiming {
  const reminderDate = pakistanDateKey(followUpAt);
  const currentDate = pakistanDateKey(now);

  if (reminderDate < currentDate) return "overdue";
  if (reminderDate === currentDate) return "today";
  return "upcoming";
}

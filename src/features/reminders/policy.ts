import { timingSafeEqual } from "node:crypto";

export const reminderLookbackMinutes = 60;
export const reminderWindowHours = 24;

export function getTaskReminderWindow(now: Date) {
  return {
    startsAt: new Date(now.getTime() - reminderLookbackMinutes * 60_000),
    endsAt: new Date(now.getTime() + reminderWindowHours * 60 * 60_000),
  };
}

export function taskReminderUid(taskId: string, dueAt: Date) {
  return `task-reminder:${taskId}:${dueAt.getTime()}`;
}

export function taskReminderDescription(title: string, dueAt: Date) {
  return `${title} is due ${dueAt.toISOString()}.`;
}

export function isTaskReminderRequestAuthorized(
  authorizationHeader: string | null,
  secret: string,
) {
  if (!authorizationHeader?.startsWith("Bearer ")) return false;
  const supplied = Buffer.from(authorizationHeader.slice("Bearer ".length), "utf8");
  const expected = Buffer.from(secret, "utf8");
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

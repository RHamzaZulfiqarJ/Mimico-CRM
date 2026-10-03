"use server";

import { revalidatePath } from "next/cache";

import { calendarEventSchema, type CalendarFormState } from "@/features/calendar/schemas";
import { canManageOrganization, isStaff } from "@/lib/auth/authorization";
import { getAuthContext } from "@/lib/auth/session";
import { getDatabase } from "@/lib/database";
import { localDateTimeToUtc } from "@/lib/datetime";

function revalidateCalendar() {
  revalidatePath("/calendar");
  revalidatePath("/dashboard");
}

function parseEvent(formData: FormData) {
  return calendarEventSchema.safeParse({
    title: formData.get("title"), description: formData.get("description"),
    startsAt: formData.get("startsAt"), endsAt: formData.get("endsAt"), timezoneOffset: formData.get("timezoneOffset"),
  });
}

export async function createCalendarEventAction(_state: CalendarFormState, formData: FormData): Promise<CalendarFormState> {
  const parsed = parseEvent(formData);
  if (!parsed.success) return { status: "error", errors: parsed.error.flatten().fieldErrors };
  const auth = await getAuthContext();
  if (!auth || !isStaff(auth.membership.role)) return { status: "error", message: "You are not authorized to create events." };

  const startsAt = localDateTimeToUtc(parsed.data.startsAt, parsed.data.timezoneOffset);
  const endsAt = localDateTimeToUtc(parsed.data.endsAt, parsed.data.timezoneOffset);
  try {
    const database = getDatabase();
    await database.$transaction(async (transaction) => {
      const event = await transaction.calendarEvent.create({ data: {
        organizationId: auth.organization.id, ownerProfileId: auth.profile.id,
        uid: `EVT-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
        title: parsed.data.title, description: parsed.data.description, startsAt, endsAt,
      } });
      await transaction.auditLog.create({ data: {
        organizationId: auth.organization.id, actorProfileId: auth.profile.id,
        action: "calendar_event.created", entityType: "CalendarEvent", entityId: event.id,
        metadata: { startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString() },
      } });
    });
  } catch { return { status: "error", message: "The event could not be saved. Please try again." }; }
  revalidateCalendar();
  return { status: "success", message: "Event created." };
}

export async function deleteCalendarEventAction(eventId: string) {
  const auth = await getAuthContext();
  if (!auth || !isStaff(auth.membership.role)) return;
  const database = getDatabase();
  await database.$transaction(async (transaction) => {
    const event = await transaction.calendarEvent.findFirst({
      where: { id: eventId, organizationId: auth.organization.id, ...(canManageOrganization(auth.membership.role) ? {} : { ownerProfileId: auth.profile.id }) },
      select: { id: true, title: true },
    });
    if (!event) return;
    await transaction.calendarEvent.delete({ where: { id: event.id } });
    await transaction.auditLog.create({ data: {
      organizationId: auth.organization.id, actorProfileId: auth.profile.id,
      action: "calendar_event.deleted", entityType: "CalendarEvent", entityId: event.id,
      metadata: { title: event.title },
    } });
  });
  revalidateCalendar();
}

import { calendarFiltersSchema } from "@/features/calendar/schemas";
import { canManageOrganization, isStaff } from "@/lib/auth/authorization";
import { getAuthContext } from "@/lib/auth/session";
import { getDatabase } from "@/lib/database";

const personSelect = { id: true, firstName: true, lastName: true, username: true, email: true } as const;

export async function getCalendarWorkspace(rawFilters: { query?: string; view?: string }) {
  const auth = await getAuthContext();
  if (!auth || !isStaff(auth.membership.role)) return null;

  const filters = calendarFiltersSchema.parse(rawFilters);
  const now = new Date();
  const database = getDatabase();
  const manager = canManageOrganization(auth.membership.role);
  const events = await database.calendarEvent.findMany({
    where: {
      organizationId: auth.organization.id,
      ownerProfileId: manager ? undefined : auth.profile.id,
      ...(filters.view === "upcoming" ? { endsAt: { gte: now } } : filters.view === "past" ? { endsAt: { lt: now } } : {}),
      ...(filters.query ? { OR: [
        { title: { contains: filters.query, mode: "insensitive" } },
        { description: { contains: filters.query, mode: "insensitive" } },
      ] } : {}),
    },
    orderBy: filters.view === "past" ? { startsAt: "desc" } : { startsAt: "asc" },
    take: 150,
    select: { id: true, uid: true, title: true, description: true, startsAt: true, endsAt: true, ownerProfileId: true, owner: { select: personSelect } },
  });

  return { auth, filters, events, canManage: manager };
}

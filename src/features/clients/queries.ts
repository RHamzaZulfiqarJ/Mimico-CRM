import { canManageOrganization, isStaff } from "@/lib/auth/authorization";
import { getAuthContext } from "@/lib/auth/session";
import { getDatabase } from "@/lib/database";
import { clientFiltersSchema } from "@/features/clients/schemas";

export async function getClientWorkspace(rawFilters: {
  query?: string;
  status?: string;
  page?: string;
}) {
  const auth = await getAuthContext();
  if (!auth || !isStaff(auth.membership.role)) return null;

  const filters = clientFiltersSchema.parse(rawFilters);
  const database = getDatabase();
  const organizationId = auth.organization.id;
  const pageSize = 30;
  const where = {
    organizationId,
    ...(filters.status === "all" ? {} : { isActive: filters.status === "active" }),
    ...(filters.query
      ? {
          OR: [
            { uid: { contains: filters.query, mode: "insensitive" as const } },
            { displayName: { contains: filters.query, mode: "insensitive" as const } },
            { email: { contains: filters.query, mode: "insensitive" as const } },
            { phone: { contains: filters.query, mode: "insensitive" as const } },
            { city: { contains: filters.query, mode: "insensitive" as const } },
            { cnic: { contains: filters.query, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [rows, portalMemberships] = await Promise.all([
    database.client.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }],
      skip: (filters.page - 1) * pageSize,
      take: pageSize + 1,
      select: {
        id: true,
        uid: true,
        firstName: true,
        lastName: true,
        displayName: true,
        email: true,
        phone: true,
        city: true,
        cnic: true,
        isActive: true,
        createdAt: true,
        portalProfileId: true,
        portalProfile: {
          select: { firstName: true, lastName: true, username: true, email: true },
        },
        _count: { select: { leads: true } },
      },
    }),
    canManageOrganization(auth.membership.role)
      ? database.organizationMembership.findMany({
          where: {
            organizationId,
            role: "CLIENT",
            isActive: true,
            profile: { isActive: true },
          },
          orderBy: [{ profile: { firstName: "asc" } }],
          select: {
            profile: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                username: true,
                email: true,
                portalClients: {
                  where: { organizationId },
                  take: 1,
                  select: { id: true },
                },
              },
            },
          },
        })
      : Promise.resolve([]),
  ]);

  const hasNext = rows.length > pageSize;
  return {
    auth,
    filters,
    clients: hasNext ? rows.slice(0, pageSize) : rows,
    portalProfiles: portalMemberships.map(({ profile }) => ({
      id: profile.id,
      label:
        [profile.firstName, profile.lastName].filter(Boolean).join(" ") ||
        profile.username ||
        profile.email ||
        "Client account",
      linkedClientId: profile.portalClients[0]?.id ?? null,
    })),
    pagination: { page: filters.page, pageSize, hasNext },
  };
}

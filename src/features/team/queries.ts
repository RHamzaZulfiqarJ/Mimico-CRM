import { canManageOrganization } from "@/lib/auth/authorization";
import { getAuthContext } from "@/lib/auth/session";
import { getDatabase } from "@/lib/database";
import { hasAdminEnvironment } from "@/lib/env";

export async function getTeamData() {
  const auth = await getAuthContext();
  if (!auth || !canManageOrganization(auth.membership.role)) return null;

  const database = getDatabase();
  const memberships = await database.organizationMembership.findMany({
    where: { organizationId: auth.organization.id },
    orderBy: [
      { isActive: "desc" },
      { role: "desc" },
      { profile: { firstName: "asc" } },
    ],
    select: {
      id: true,
      role: true,
      isActive: true,
      joinedAt: true,
      profile: {
        select: {
          id: true,
          authUserId: true,
          firstName: true,
          lastName: true,
          username: true,
          email: true,
        },
      },
    },
  });

  return {
    auth,
    memberships,
    invitationsConfigured: hasAdminEnvironment(),
  };
}

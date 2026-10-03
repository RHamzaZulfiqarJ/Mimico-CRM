import { getAuthContext } from "@/lib/auth/session";
import { getDatabase } from "@/lib/database";

export async function getNotificationCenter() {
  const auth = await getAuthContext();
  if (!auth) return null;

  const database = getDatabase();
  const where = {
    organizationId: auth.organization.id,
    recipientProfileId: auth.profile.id,
  };
  const [notifications, unreadCount] = await Promise.all([
    database.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        type: true,
        title: true,
        description: true,
        payload: true,
        readAt: true,
        createdAt: true,
      },
    }),
    database.notification.count({ where: { ...where, readAt: null } }),
  ]);

  return { auth, notifications, unreadCount };
}

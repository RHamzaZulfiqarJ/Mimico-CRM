"use server";

import { revalidatePath } from "next/cache";

import { getAuthContext } from "@/lib/auth/session";
import { getDatabase } from "@/lib/database";

function revalidateNotificationViews() {
  revalidatePath("/notifications");
  revalidatePath("/dashboard");
}

export async function markNotificationReadAction(notificationId: string) {
  const auth = await getAuthContext();
  if (!auth) return;

  const database = getDatabase();
  const result = await database.notification.updateMany({
    where: {
      id: notificationId,
      organizationId: auth.organization.id,
      recipientProfileId: auth.profile.id,
      readAt: null,
    },
    data: { readAt: new Date() },
  });

  if (result.count === 1) revalidateNotificationViews();
}

export async function markAllNotificationsReadAction() {
  const auth = await getAuthContext();
  if (!auth) return;

  const database = getDatabase();
  await database.notification.updateMany({
    where: {
      organizationId: auth.organization.id,
      recipientProfileId: auth.profile.id,
      readAt: null,
    },
    data: { readAt: new Date() },
  });
  revalidateNotificationViews();
}

import { canManageOrganization } from "@/lib/auth/authorization";
import { getAuthContext } from "@/lib/auth/session";
import { getDatabase } from "@/lib/database";

export async function getFacebookIntegrationWorkspace() {
  const auth = await getAuthContext();
  if (!auth || !canManageOrganization(auth.membership.role)) return null;

  const integrations = await getDatabase().facebookIntegration.findMany({
    where: { organizationId: auth.organization.id },
    orderBy: [{ isActive: "desc" }, { updatedAt: "desc" }],
    select: {
      id: true,
      pageId: true,
      appId: true,
      verifyTokenSecretName: true,
      appSecretName: true,
      pageAccessTokenSecretName: true,
      isActive: true,
      updatedAt: true,
    },
  });
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
  return {
    auth,
    integrations: integrations.map((integration) => ({
      ...integration,
      callbackUrl: `${baseUrl}/api/facebook/webhook/${integration.id}`,
    })),
  };
}

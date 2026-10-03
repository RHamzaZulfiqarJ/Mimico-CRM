import { fetchFacebookPageIdentity } from "@/features/facebook/graph";
import { getNamedServerSecret } from "@/features/facebook/security";
import { getDatabase } from "@/lib/database";

type IntegrationHealth = {
  integrationId: string;
  organizationId: string;
  pageId: string;
  status: "CONNECTED" | "MISSING_SECRET" | "REJECTED" | "PAGE_MISMATCH";
  actualPageId?: string;
};

function healthDescription(result: IntegrationHealth) {
  if (result.status === "MISSING_SECRET") {
    return `Facebook Page ${result.pageId} is missing its configured Page-token environment variable.`;
  }
  if (result.status === "PAGE_MISMATCH") {
    return `Facebook Page ${result.pageId} is configured with a token for Page ${result.actualPageId ?? "unknown"}.`;
  }
  return `Facebook rejected the configured token for Page ${result.pageId}, or Graph API could not be reached.`;
}

async function checkIntegration(integration: {
  id: string;
  organizationId: string;
  pageId: string;
  pageAccessTokenSecretName: string;
}): Promise<IntegrationHealth> {
  const pageAccessToken = getNamedServerSecret(integration.pageAccessTokenSecretName);
  if (!pageAccessToken) {
    return {
      integrationId: integration.id,
      organizationId: integration.organizationId,
      pageId: integration.pageId,
      status: "MISSING_SECRET",
    };
  }

  try {
    const identity = await fetchFacebookPageIdentity(pageAccessToken);
    if (identity.id !== integration.pageId) {
      return {
        integrationId: integration.id,
        organizationId: integration.organizationId,
        pageId: integration.pageId,
        status: "PAGE_MISMATCH",
        actualPageId: identity.id,
      };
    }
    return {
      integrationId: integration.id,
      organizationId: integration.organizationId,
      pageId: integration.pageId,
      status: "CONNECTED",
    };
  } catch {
    return {
      integrationId: integration.id,
      organizationId: integration.organizationId,
      pageId: integration.pageId,
      status: "REJECTED",
    };
  }
}

export async function runFacebookHealthCheck(now = new Date()) {
  const database = getDatabase();
  const integrations = await database.facebookIntegration.findMany({
    where: { isActive: true, organization: { status: "ACTIVE" } },
    orderBy: { id: "asc" },
    select: {
      id: true,
      organizationId: true,
      pageId: true,
      pageAccessTokenSecretName: true,
    },
  });

  const results: IntegrationHealth[] = [];
  for (let index = 0; index < integrations.length; index += 4) {
    results.push(
      ...(await Promise.all(integrations.slice(index, index + 4).map(checkIntegration))),
    );
  }
  const failures = results.filter((result) => result.status !== "CONNECTED");
  if (!failures.length) {
    return {
      checkedAt: now.toISOString(),
      checked: results.length,
      connected: results.length,
      failures: 0,
      notificationsCreated: 0,
    };
  }

  const organizationIds = [...new Set(failures.map(({ organizationId }) => organizationId))];
  const memberships = await database.organizationMembership.findMany({
    where: {
      organizationId: { in: organizationIds },
      isActive: true,
      role: { in: ["MANAGER", "SUPER_ADMIN"] },
      profile: { isActive: true },
    },
    select: { organizationId: true, profileId: true },
  });
  const dateKey = now.toISOString().slice(0, 10);
  let notificationsCreated = 0;

  for (const organizationId of organizationIds) {
    const organizationFailures = failures.filter(
      (result) => result.organizationId === organizationId,
    );
    const recipients = memberships.filter(
      (membership) => membership.organizationId === organizationId,
    );
    const created = await database.$transaction(async (transaction) => {
      const notifications = recipients.length
        ? await transaction.notification.createMany({
            data: organizationFailures.flatMap((failure) =>
              recipients.map(({ profileId }) => ({
                organizationId,
                recipientProfileId: profileId,
                uid: `facebook-health:${failure.integrationId}:${failure.status}:${dateKey}:${profileId}`,
                type: "facebook_integration.health_warning",
                title: "Facebook integration needs attention",
                description: healthDescription(failure),
                payload: {
                  integrationId: failure.integrationId,
                  pageId: failure.pageId,
                  status: failure.status,
                  actualPageId: failure.actualPageId ?? null,
                },
              })),
            ),
            skipDuplicates: true,
          })
        : { count: 0 };
      if (notifications.count > 0 || recipients.length === 0) {
        await transaction.auditLog.create({
          data: {
            organizationId,
            action: "facebook_integrations.health_warning",
            entityType: "Organization",
            entityId: organizationId,
            metadata: {
              checkedAt: now.toISOString(),
              notificationsCreated: notifications.count,
              failures: organizationFailures.map((failure) => ({
                integrationId: failure.integrationId,
                pageId: failure.pageId,
                status: failure.status,
                actualPageId: failure.actualPageId ?? null,
              })),
            },
          },
        });
      }
      return notifications.count;
    });
    notificationsCreated += created;
  }

  return {
    checkedAt: now.toISOString(),
    checked: results.length,
    connected: results.length - failures.length,
    failures: failures.length,
    notificationsCreated,
  };
}

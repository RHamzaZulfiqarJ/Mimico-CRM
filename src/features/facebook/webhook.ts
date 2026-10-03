import { Prisma } from "@/generated/prisma/client";

import { facebookGraphApiVersion } from "@/features/facebook/graph";
import {
  facebookFieldValue,
  facebookGraphLeadSchema,
  facebookWebhookSchema,
} from "@/features/facebook/schemas";
import { getDatabase } from "@/lib/database";

type FacebookIntegration = {
  id: string;
  organizationId: string;
  pageId: string;
};

async function fetchFacebookLead(providerLeadId: string, pageAccessToken: string) {
  const url = new URL(
    `https://graph.facebook.com/${facebookGraphApiVersion()}/${encodeURIComponent(providerLeadId)}`,
  );
  url.searchParams.set("fields", "id,created_time,field_data");

  const response = await fetch(url, {
    cache: "no-store",
    headers: { Authorization: `Bearer ${pageAccessToken}` },
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error(`FACEBOOK_GRAPH_${response.status}`);
  return facebookGraphLeadSchema.parse(await response.json());
}

function providerCreatedAt(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

async function persistFacebookLead(
  integration: FacebookIntegration,
  graphLead: ReturnType<typeof facebookGraphLeadSchema.parse>,
  webhookChange: Record<string, unknown>,
) {
  const database = getDatabase();
  return database.$transaction(async (transaction) => {
    const existing = await transaction.facebookInboundLead.findUnique({
      where: {
        organizationId_providerLeadId: {
          organizationId: integration.organizationId,
          providerLeadId: graphLead.id,
        },
      },
      select: { id: true },
    });
    if (existing) return false;

    const staff = await transaction.organizationMembership.findMany({
      where: {
        organizationId: integration.organizationId,
        isActive: true,
        role: { in: ["EMPLOYEE", "MANAGER", "SUPER_ADMIN"] },
        profile: { isActive: true },
      },
      select: { profileId: true },
    });
    const createdAt = providerCreatedAt(graphLead.created_time);
    const expiresAt = new Date(createdAt.getTime() + 24 * 60 * 60 * 1_000);
    const inboundLead = await transaction.facebookInboundLead.create({
      data: {
        organizationId: integration.organizationId,
        integrationId: integration.id,
        providerLeadId: graphLead.id,
        providerCreatedAt: createdAt,
        expiresAt,
        fieldData: graphLead.field_data as Prisma.InputJsonValue,
        rawPayload: {
          webhook: webhookChange,
          graph: graphLead,
        } as Prisma.InputJsonValue,
        claims: {
          create: staff.map(({ profileId }) => ({
            organizationId: integration.organizationId,
            profileId,
          })),
        },
      },
    });

    const clientName = facebookFieldValue(graphLead.field_data, "full_name") ?? "A new contact";
    if (staff.length) {
      await transaction.notification.createMany({
        data: staff.map(({ profileId }) => ({
          organizationId: integration.organizationId,
          recipientProfileId: profileId,
          type: "facebook_lead.received",
          title: "New Facebook lead",
          description: `${clientName} is ready to review and expires in 24 hours.`,
          payload: { facebookInboundLeadId: inboundLead.id },
        })),
      });
    }
    await transaction.auditLog.create({
      data: {
        organizationId: integration.organizationId,
        action: "facebook_lead.received",
        entityType: "FacebookInboundLead",
        entityId: inboundLead.id,
        metadata: {
          providerLeadId: graphLead.id,
          integrationId: integration.id,
          claimCount: staff.length,
        },
      },
    });
    return true;
  });
}

export async function ingestFacebookWebhook(
  integration: FacebookIntegration,
  rawPayload: unknown,
  pageAccessToken: string,
) {
  const payload = facebookWebhookSchema.parse(rawPayload);
  const changes = payload.entry.flatMap((entry) =>
    entry.changes
      .filter(
        ({ value }) =>
          entry.id === integration.pageId || value.page_id === integration.pageId,
      )
      .map(({ value }) => value),
  );
  const uniqueChanges = [
    ...new Map(changes.map((change) => [change.leadgen_id, change])).values(),
  ];

  let created = 0;
  for (const change of uniqueChanges) {
    const graphLead = await fetchFacebookLead(change.leadgen_id, pageAccessToken);
    if (
      await persistFacebookLead(
        integration,
        graphLead,
        change as Record<string, unknown>,
      )
    ) {
      created += 1;
    }
  }
  return { received: uniqueChanges.length, created };
}

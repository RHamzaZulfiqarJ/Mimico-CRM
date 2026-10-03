import { secureStringEqual } from "@/features/facebook/security";
import { getDatabase } from "@/lib/database";

const batchSize = 50;

export function isFacebookMaintenanceRequestAuthorized(
  authorizationHeader: string | null,
  secret: string,
) {
  if (!authorizationHeader?.startsWith("Bearer ")) return false;
  return secureStringEqual(authorizationHeader.slice("Bearer ".length), secret);
}

export async function runFacebookMaintenance(now = new Date()) {
  const database = getDatabase();
  let batches = 0;
  let matched = 0;
  let expired = 0;
  let claimsDismissed = 0;

  while (batches < 1_000) {
    const candidates = await database.facebookInboundLead.findMany({
      where: {
        status: "PENDING",
        expiresAt: { lte: now },
        organization: { status: "ACTIVE" },
      },
      orderBy: { id: "asc" },
      take: batchSize,
      select: { id: true, organizationId: true },
    });
    if (!candidates.length) break;
    batches += 1;
    matched += candidates.length;

    const byOrganization = new Map<string, string[]>();
    for (const candidate of candidates) {
      const ids = byOrganization.get(candidate.organizationId) ?? [];
      ids.push(candidate.id);
      byOrganization.set(candidate.organizationId, ids);
    }

    for (const [organizationId, candidateIds] of byOrganization) {
      const result = await database.$transaction(async (transaction) => {
        const expiredIds: string[] = [];
        for (const id of candidateIds) {
          const update = await transaction.facebookInboundLead.updateMany({
            where: {
              id,
              organizationId,
              status: "PENDING",
              expiresAt: { lte: now },
            },
            data: { status: "EXPIRED" },
          });
          if (update.count === 1) expiredIds.push(id);
        }
        if (!expiredIds.length) return { expired: 0, claimsDismissed: 0 };

        const claims = await transaction.facebookLeadClaim.updateMany({
          where: { inboundLeadId: { in: expiredIds }, status: "PENDING" },
          data: { status: "DISMISSED", respondedAt: now },
        });
        await transaction.auditLog.create({
          data: {
            organizationId,
            action: "facebook_leads.expired",
            entityType: "Organization",
            entityId: organizationId,
            metadata: {
              expired: expiredIds.length,
              claimsDismissed: claims.count,
              processedAt: now.toISOString(),
            },
          },
        });
        return { expired: expiredIds.length, claimsDismissed: claims.count };
      });
      expired += result.expired;
      claimsDismissed += result.claimsDismissed;
    }
  }

  return {
    processedAt: now.toISOString(),
    batches,
    matched,
    expired,
    skipped: matched - expired,
    claimsDismissed,
  };
}

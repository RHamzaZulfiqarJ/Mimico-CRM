import { Prisma } from "@/generated/prisma/client";

import { facebookLeadDefaults, facebookLeadDisplayStatus } from "@/features/facebook/inbox";
import { facebookInboxFiltersSchema } from "@/features/facebook/schemas";
import { canManageOrganization } from "@/lib/auth/authorization";
import { isStaff } from "@/lib/auth/authorization";
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

export async function getFacebookLeadInbox(rawFilters: {
  view?: string;
  page?: string;
}) {
  const auth = await getAuthContext();
  if (!auth || !isStaff(auth.membership.role)) return null;

  const filters = facebookInboxFiltersSchema.parse(rawFilters);
  const management = canManageOrganization(auth.membership.role);
  const now = new Date();
  const pageSize = 24;
  const accessWhere: Prisma.FacebookInboundLeadWhereInput = management
    ? {}
    : { claims: { some: { profileId: auth.profile.id } } };
  let viewWhere: Prisma.FacebookInboundLeadWhereInput = {};

  if (filters.view === "available") {
    viewWhere = {
      status: "PENDING",
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      ...(management
        ? {}
        : { claims: { some: { profileId: auth.profile.id, status: "PENDING" } } }),
    };
  } else if (filters.view === "converted") {
    viewWhere = {
      status: "CONVERTED",
      ...(management
        ? {}
        : { claims: { some: { profileId: auth.profile.id, status: "ACCEPTED" } } }),
    };
  } else if (filters.view === "declined") {
    viewWhere = management
      ? {
          status: "PENDING",
          claims: { none: { status: "PENDING" } },
        }
      : { claims: { some: { profileId: auth.profile.id, status: "REJECTED" } } };
  }

  const database = getDatabase();
  const [rows, projects] = await Promise.all([
    database.facebookInboundLead.findMany({
      where: {
        organizationId: auth.organization.id,
        ...accessWhere,
        ...viewWhere,
      },
      orderBy: [{ providerCreatedAt: "desc" }, { createdAt: "desc" }],
      skip: (filters.page - 1) * pageSize,
      take: pageSize + 1,
      select: {
        id: true,
        providerLeadId: true,
        eventTitle: true,
        fieldData: true,
        status: true,
        providerCreatedAt: true,
        expiresAt: true,
        acceptedAt: true,
        convertedLeadId: true,
        integration: { select: { pageId: true } },
        acceptedBy: {
          select: { firstName: true, lastName: true, username: true, email: true },
        },
        claims: {
          select: { profileId: true, status: true },
        },
      },
    }),
    database.project.findMany({
      where: {
        organizationId: auth.organization.id,
        status: "ACTIVE",
        isArchived: false,
      },
      orderBy: { title: "asc" },
      select: { id: true, title: true },
    }),
  ]);
  const hasNext = rows.length > pageSize;
  const visibleRows = hasNext ? rows.slice(0, pageSize) : rows;

  return {
    auth,
    filters,
    projects,
    leads: visibleRows.map((lead) => {
      const defaults = facebookLeadDefaults(lead.fieldData);
      const ownClaim = lead.claims.find(({ profileId }) => profileId === auth.profile.id);
      const displayStatus = facebookLeadDisplayStatus({
        inboundStatus: lead.status,
        claimStatus: ownClaim?.status,
        expiresAt: lead.expiresAt,
        now,
      });
      const matchingProject = defaults.requestedProject
        ? projects.find(
            ({ title }) =>
              title.trim().toLocaleLowerCase() ===
              defaults.requestedProject?.trim().toLocaleLowerCase(),
          )
        : undefined;
      return {
        ...lead,
        defaults,
        claimStatus: ownClaim?.status ?? null,
        displayStatus,
        canAct:
          displayStatus === "available" &&
          (management || ownClaim?.status === "PENDING"),
        suggestedProjectId: matchingProject?.id ?? null,
      };
    }),
    pagination: { page: filters.page, pageSize, hasNext },
  };
}

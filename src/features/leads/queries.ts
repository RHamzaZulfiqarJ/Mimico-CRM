import type { AuthContext } from "@/lib/auth/session";
import { getAuthContext } from "@/lib/auth/session";
import { getDatabase } from "@/lib/database";
import { canManageOrganization, isStaff } from "@/lib/auth/authorization";
import { leadFiltersSchema } from "@/features/leads/schemas";

function accessWhere(auth: AuthContext) {
  if (canManageOrganization(auth.membership.role)) return {};
  if (auth.membership.role === "EMPLOYEE") {
    return { assignments: { some: { profileId: auth.profile.id } } };
  }
  return { client: { portalProfileId: auth.profile.id, isActive: true } };
}

export async function getLeadWorkspace(rawFilters: {
  query?: string;
  stage?: string;
  priority?: string;
  projectId?: string;
  page?: string;
}) {
  const auth = await getAuthContext();
  if (!auth) return null;

  const filters = leadFiltersSchema.parse(rawFilters);
  const database = getDatabase();
  const organizationId = auth.organization.id;
  const roleAccess = accessWhere(auth);
  const pageSize = 30;
  const where = {
    organizationId,
    isArchived: false,
    ...roleAccess,
    stage: filters.stage,
    priority: filters.priority,
    projectId: filters.projectId,
    ...(filters.query
      ? {
          OR: [
            { clientName: { contains: filters.query, mode: "insensitive" as const } },
            { clientPhone: { contains: filters.query, mode: "insensitive" as const } },
            { city: { contains: filters.query, mode: "insensitive" as const } },
            { area: { contains: filters.query, mode: "insensitive" as const } },
            { source: { contains: filters.query, mode: "insensitive" as const } },
            { uid: { contains: filters.query, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };
  const [leadRows, projects, staffMemberships] = await Promise.all([
    database.lead.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }],
      skip: (filters.page - 1) * pageSize,
      take: pageSize + 1,
      select: {
        id: true,
        uid: true,
        clientName: true,
        clientPhone: true,
        priority: true,
        stage: true,
        createdAt: true,
        project: { select: { id: true, title: true } },
        assignments: {
          orderBy: { assignedAt: "asc" },
          select: {
            profile: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                username: true,
                email: true,
              },
            },
          },
        },
      },
    }),
    database.project.findMany({
      where: {
        organizationId,
        isArchived: false,
        status: "ACTIVE",
        ...(auth.membership.role === "CLIENT"
          ? { leads: { some: { organizationId, isArchived: false, ...roleAccess } } }
          : {}),
      },
      orderBy: { title: "asc" },
      select: { id: true, title: true },
    }),
    canManageOrganization(auth.membership.role)
      ? database.organizationMembership.findMany({
          where: {
            organizationId,
            isActive: true,
            role: { in: ["EMPLOYEE", "MANAGER", "SUPER_ADMIN"] },
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
              },
            },
          },
        })
      : Promise.resolve([]),
  ]);
  const hasNext = leadRows.length > pageSize;
  const leads = hasNext ? leadRows.slice(0, pageSize) : leadRows;

  return {
    auth,
    filters,
    leads,
    projects,
    staff: staffMemberships.map(({ profile }) => profile),
    pagination: {
      page: filters.page,
      pageSize,
      hasNext,
    },
  };
}

export async function getLeadDetails(leadId: string) {
  const auth = await getAuthContext();
  if (!auth) return null;

  const database = getDatabase();
  const organizationId = auth.organization.id;
  const roleAccess = accessWhere(auth);
  const [lead, projects, staffMemberships] = await Promise.all([
    database.lead.findFirst({
      where: { id: leadId, organizationId, isArchived: false, ...roleAccess },
      select: {
        id: true,
        uid: true,
        clientName: true,
        clientPhone: true,
        area: true,
        city: true,
        priority: true,
        stage: true,
        source: true,
        description: true,
        refundRequested: true,
        createdAt: true,
        updatedAt: true,
        project: { select: { id: true, title: true } },
        client: { select: { id: true, displayName: true, email: true, phone: true, city: true, cnic: true } },
        assignments: {
          orderBy: { assignedAt: "asc" },
          select: {
            assignedAt: true,
            profile: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                username: true,
                email: true,
              },
            },
          },
        },
        followUps: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            stage: true,
            followUpAt: true,
            remarks: true,
            createdAt: true,
            createdBy: {
              select: { firstName: true, lastName: true, username: true, email: true },
            },
          },
        },
        attachments: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            originalName: true,
            contentType: true,
            sizeBytes: true,
            createdAt: true,
            createdBy: {
              select: { firstName: true, lastName: true, username: true, email: true },
            },
          },
        },
      },
    }),
    isStaff(auth.membership.role)
      ? database.project.findMany({
          where: { organizationId, isArchived: false, status: "ACTIVE" },
          orderBy: { title: "asc" },
          select: { id: true, title: true },
        })
      : Promise.resolve([]),
    canManageOrganization(auth.membership.role)
      ? database.organizationMembership.findMany({
          where: {
            organizationId,
            isActive: true,
            role: { in: ["EMPLOYEE", "MANAGER", "SUPER_ADMIN"] },
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
              },
            },
          },
        })
      : Promise.resolve([]),
  ]);

  return {
    auth,
    lead,
    projects,
    staff: staffMemberships.map(({ profile }) => profile),
  };
}

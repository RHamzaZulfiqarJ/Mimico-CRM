import { taskFiltersSchema } from "@/features/tasks/schemas";
import { canManageOrganization, isStaff } from "@/lib/auth/authorization";
import type { AuthContext } from "@/lib/auth/session";
import { getAuthContext } from "@/lib/auth/session";
import { getDatabase } from "@/lib/database";

function taskAccessWhere(auth: AuthContext) {
  if (canManageOrganization(auth.membership.role)) return [];
  return [
    {
      OR: [
        { assignedToProfileId: auth.profile.id },
        { createdByProfileId: auth.profile.id },
      ],
    },
  ];
}

const personSelect = {
  id: true,
  firstName: true,
  lastName: true,
  username: true,
  email: true,
} as const;

export async function getTaskWorkspace(rawFilters: {
  query?: string;
  status?: string;
  assignedProfileId?: string;
}) {
  const auth = await getAuthContext();
  if (!auth || !isStaff(auth.membership.role)) return null;

  const filters = taskFiltersSchema.parse(rawFilters);
  const database = getDatabase();
  const organizationId = auth.organization.id;
  const roleAccess = taskAccessWhere(auth);
  const assignedProfileId = canManageOrganization(auth.membership.role)
    ? filters.assignedProfileId
    : undefined;
  const where = {
    organizationId,
    isArchived: false,
    status: filters.status,
    assignedToProfileId: assignedProfileId,
    AND: [
      ...roleAccess,
      ...(filters.query
        ? [{
            OR: [
            { title: { contains: filters.query, mode: "insensitive" as const } },
            { description: { contains: filters.query, mode: "insensitive" as const } },
            { uid: { contains: filters.query, mode: "insensitive" as const } },
            ],
          }]
        : []),
    ],
  };
  const baseWhere = {
    organizationId,
    isArchived: false,
    AND: roleAccess,
  };
  const now = new Date();

  const [tasks, staffMemberships, total, active, completed, overdue] = await Promise.all([
    database.task.findMany({
      where,
      orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
      take: 100,
      select: {
        id: true,
        uid: true,
        title: true,
        description: true,
        dueAt: true,
        status: true,
        outcome: true,
        outcomeComment: true,
        completedAt: true,
        createdAt: true,
        updatedAt: true,
        assignedTo: { select: personSelect },
        createdBy: { select: personSelect },
      },
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
          select: { profile: { select: personSelect } },
        })
      : Promise.resolve([]),
    database.task.count({ where: baseWhere }),
    database.task.count({ where: { ...baseWhere, status: { in: ["TODO", "IN_PROGRESS"] } } }),
    database.task.count({ where: { ...baseWhere, status: "COMPLETED" } }),
    database.task.count({
      where: {
        ...baseWhere,
        dueAt: { lt: now },
        status: { in: ["TODO", "IN_PROGRESS"] },
      },
    }),
  ]);

  return {
    auth,
    filters: { ...filters, assignedProfileId },
    tasks,
    staff: staffMemberships.map(({ profile }) => profile),
    counts: { total, active, completed, overdue },
  };
}

export async function getTaskDetails(taskId: string) {
  const auth = await getAuthContext();
  if (!auth || !isStaff(auth.membership.role)) return null;

  const database = getDatabase();
  const task = await database.task.findFirst({
    where: {
      id: taskId,
      organizationId: auth.organization.id,
      isArchived: false,
      AND: taskAccessWhere(auth),
    },
    select: {
      id: true,
      uid: true,
      title: true,
      description: true,
      dueAt: true,
      status: true,
      outcome: true,
      outcomeComment: true,
      completedAt: true,
      createdAt: true,
      updatedAt: true,
      assignedTo: { select: personSelect },
      createdBy: { select: personSelect },
    },
  });

  return { auth, task };
}

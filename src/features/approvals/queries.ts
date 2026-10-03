import { approvalFiltersSchema } from "@/features/approvals/schemas";
import { canDecideApproval, isStaff } from "@/lib/auth/authorization";
import { getAuthContext } from "@/lib/auth/session";
import { getDatabase } from "@/lib/database";

const personSelect = { id: true, firstName: true, lastName: true, username: true, email: true } as const;

export async function getApprovalWorkspace(rawFilters: { query?: string; status?: string }) {
  const auth = await getAuthContext();
  if (!auth || !isStaff(auth.membership.role)) return null;
  const filters = approvalFiltersSchema.parse(rawFilters);
  const canDecide = canDecideApproval(auth.membership.role);
  const database = getDatabase();
  const where = {
    organizationId: auth.organization.id,
    requestedByProfileId: canDecide ? undefined : auth.profile.id,
    status: filters.status,
    ...(filters.query ? { OR: [
      { title: { contains: filters.query, mode: "insensitive" as const } },
      { description: { contains: filters.query, mode: "insensitive" as const } },
      { uid: { contains: filters.query, mode: "insensitive" as const } },
    ] } : {}),
  };
  const [approvals, total, pending] = await Promise.all([
    database.approval.findMany({
      where, orderBy: { createdAt: "desc" }, take: 100,
      select: { id: true, uid: true, title: true, description: true, type: true, status: true, createdAt: true, decidedAt: true, requestedBy: { select: personSelect }, decidedBy: { select: personSelect } },
    }),
    database.approval.count({ where: { organizationId: auth.organization.id, requestedByProfileId: canDecide ? undefined : auth.profile.id } }),
    database.approval.count({ where: { organizationId: auth.organization.id, requestedByProfileId: canDecide ? undefined : auth.profile.id, status: "UNDER_PROCESS" } }),
  ]);
  return { auth, filters, canDecide, approvals, counts: { total, pending } };
}

export async function getApprovalDetails(approvalId: string) {
  const auth = await getAuthContext();
  if (!auth || !isStaff(auth.membership.role)) return null;
  const canDecide = canDecideApproval(auth.membership.role);
  const database = getDatabase();
  const approval = await database.approval.findFirst({
    where: { id: approvalId, organizationId: auth.organization.id, requestedByProfileId: canDecide ? undefined : auth.profile.id },
    select: { id: true, uid: true, title: true, description: true, type: true, status: true, payload: true, createdAt: true, decidedAt: true, requestedBy: { select: personSelect }, decidedBy: { select: personSelect } },
  });
  return { auth, approval, canDecide };
}

import { Prisma } from "@/generated/prisma/client";
import { refundFiltersSchema } from "@/features/refunds/schemas";
import { canManageOrganization, isStaff } from "@/lib/auth/authorization";
import { getAuthContext } from "@/lib/auth/session";
import { getDatabase } from "@/lib/database";

export const REFUND_PAGE_SIZE = 30;

const personSelect = {
  id: true,
  firstName: true,
  lastName: true,
  username: true,
  email: true,
} as const;

export async function getRefundWorkspace(rawFilters: {
  query?: string;
  status?: string;
  page?: string;
}) {
  const auth = await getAuthContext();
  if (!auth || !isStaff(auth.membership.role)) return null;

  const filters = refundFiltersSchema.parse(rawFilters);
  const database = getDatabase();
  const organizationId = auth.organization.id;
  const management = canManageOrganization(auth.membership.role);
  const accessWhere: Prisma.RefundWhereInput = management
    ? {}
    : { requestedByProfileId: auth.profile.id };
  const where: Prisma.RefundWhereInput = {
    organizationId,
    ...accessWhere,
    status: filters.status,
    ...(filters.query
      ? {
          OR: [
            { uid: { contains: filters.query, mode: "insensitive" } },
            { clientName: { contains: filters.query, mode: "insensitive" } },
            { phone: { contains: filters.query, mode: "insensitive" } },
            { branch: { contains: filters.query, mode: "insensitive" } },
            { reason: { contains: filters.query, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [rows, statusCounts] = await Promise.all([
    database.refund.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (filters.page - 1) * REFUND_PAGE_SIZE,
      take: REFUND_PAGE_SIZE + 1,
      select: {
        id: true,
        uid: true,
        branch: true,
        amount: true,
        clientName: true,
        cnic: true,
        phone: true,
        reason: true,
        status: true,
        decidedAt: true,
        createdAt: true,
        lead: { select: { id: true, uid: true } },
        requestedBy: { select: personSelect },
        decidedBy: { select: personSelect },
      },
    }),
    database.refund.groupBy({
      by: ["status"],
      where: { organizationId, ...accessWhere },
      _count: { _all: true },
    }),
  ]);

  const hasNext = rows.length > REFUND_PAGE_SIZE;
  const refunds = hasNext ? rows.slice(0, REFUND_PAGE_SIZE) : rows;
  const refundIds = refunds.map(({ id }) => id);
  const approvals = refundIds.length
    ? await database.approval.findMany({
        where: {
          organizationId,
          type: "REFUND",
          OR: refundIds.map((refundId) => ({
            payload: { path: ["refundId"], equals: refundId },
          })),
        },
        orderBy: { createdAt: "desc" },
        select: { id: true, payload: true },
      })
    : [];
  const approvalByRefundId = new Map<string, { id: string }>();
  for (const approval of approvals) {
    const payload =
      approval.payload && typeof approval.payload === "object" && !Array.isArray(approval.payload)
        ? approval.payload
        : null;
    const refundId = typeof payload?.refundId === "string" ? payload.refundId : null;
    if (refundId && !approvalByRefundId.has(refundId)) {
      approvalByRefundId.set(refundId, { id: approval.id });
    }
  }

  return {
    auth,
    filters,
    canDecide: management,
    refunds: refunds.map((refund) => ({
      ...refund,
      approval: approvalByRefundId.get(refund.id) ?? null,
    })),
    counts: {
      total: statusCounts.reduce((sum, row) => sum + row._count._all, 0),
      pending:
        statusCounts.find((row) => row.status === "UNDER_PROCESS")?._count._all ?? 0,
      accepted: statusCounts.find((row) => row.status === "ACCEPTED")?._count._all ?? 0,
      rejected: statusCounts.find((row) => row.status === "REJECTED")?._count._all ?? 0,
    },
    pagination: {
      page: filters.page,
      hasPrevious: filters.page > 1,
      hasNext,
    },
  };
}

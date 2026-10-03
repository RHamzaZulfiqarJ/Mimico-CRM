import { Prisma } from "@/generated/prisma/client";
import { voucherFiltersSchema } from "@/features/vouchers/schemas";
import { canManageOrganization, isStaff } from "@/lib/auth/authorization";
import { getAuthContext } from "@/lib/auth/session";
import { getDatabase } from "@/lib/database";

export const VOUCHER_PAGE_SIZE = 30;

const personSelect = {
  id: true,
  firstName: true,
  lastName: true,
  username: true,
  email: true,
} as const;

function voucherAccessWhere(auth: NonNullable<Awaited<ReturnType<typeof getAuthContext>>>) {
  return canManageOrganization(auth.membership.role)
    ? {}
    : { allocatedToProfileId: auth.profile.id };
}

export async function getVoucherWorkspace(rawFilters: {
  query?: string;
  status?: string;
  projectId?: string;
  page?: string;
}) {
  const auth = await getAuthContext();
  if (!auth || !isStaff(auth.membership.role)) return null;

  const filters = voucherFiltersSchema.parse(rawFilters);
  const database = getDatabase();
  const organizationId = auth.organization.id;
  const canChooseStaff = canManageOrganization(auth.membership.role);
  const accessWhere = voucherAccessWhere(auth);
  const where: Prisma.VoucherWhereInput = {
    organizationId,
    ...accessWhere,
    status: filters.status,
    projectId: filters.projectId,
    ...(filters.query
      ? {
          OR: [
            { uid: { contains: filters.query, mode: "insensitive" } },
            { clientName: { contains: filters.query, mode: "insensitive" } },
            { phone: { contains: filters.query, mode: "insensitive" } },
            { branch: { contains: filters.query, mode: "insensitive" } },
            { project: { title: { contains: filters.query, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const [voucherRows, statusCounts, projects, staffMemberships] = await Promise.all([
    database.voucher.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (filters.page - 1) * VOUCHER_PAGE_SIZE,
      take: VOUCHER_PAGE_SIZE + 1,
      select: {
        id: true,
        uid: true,
        issuingDate: true,
        dueDate: true,
        branch: true,
        clientName: true,
        phone: true,
        type: true,
        total: true,
        paid: true,
        remaining: true,
        status: true,
        createdAt: true,
        allocatedTo: { select: personSelect },
        project: { select: { id: true, uid: true, title: true } },
      },
    }),
    database.voucher.groupBy({
      by: ["status"],
      where: { organizationId, ...accessWhere },
      _count: { _all: true },
    }),
    database.project.findMany({
      where: { organizationId, status: "ACTIVE", isArchived: false },
      orderBy: { title: "asc" },
      select: { id: true, uid: true, title: true },
    }),
    canChooseStaff
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
  ]);

  const hasNext = voucherRows.length > VOUCHER_PAGE_SIZE;
  return {
    auth,
    filters,
    vouchers: hasNext ? voucherRows.slice(0, VOUCHER_PAGE_SIZE) : voucherRows,
    projects,
    staff: staffMemberships.map(({ profile }) => profile),
    counts: {
      total: statusCounts.reduce((sum, row) => sum + row._count._all, 0),
      pending: statusCounts.find((row) => row.status === "UNDER_PROCESS")?._count._all ?? 0,
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

export async function getVoucherDetails(voucherId: string) {
  const auth = await getAuthContext();
  if (!auth || !isStaff(auth.membership.role)) return null;
  const database = getDatabase();
  const voucher = await database.voucher.findFirst({
    where: {
      id: voucherId,
      organizationId: auth.organization.id,
      ...voucherAccessWhere(auth),
    },
    include: {
      allocatedTo: { select: personSelect },
      project: { select: { id: true, uid: true, title: true } },
    },
  });
  if (!voucher) return { auth, voucher: null, approval: null };

  const approval = await database.approval.findFirst({
    where: {
      organizationId: auth.organization.id,
      type: "VOUCHER",
      payload: { path: ["voucherId"], equals: voucher.id },
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, status: true },
  });
  return { auth, voucher, approval };
}

export async function getPrintableVoucher(voucherId: string) {
  const auth = await getAuthContext();
  if (!auth || !isStaff(auth.membership.role)) return null;
  const database = getDatabase();
  const voucher = await database.voucher.findFirst({
    where: {
      id: voucherId,
      organizationId: auth.organization.id,
      status: "ACCEPTED",
      ...voucherAccessWhere(auth),
    },
    include: {
      allocatedTo: { select: personSelect },
      project: { select: { id: true, uid: true, title: true } },
    },
  });
  return { auth, voucher };
}

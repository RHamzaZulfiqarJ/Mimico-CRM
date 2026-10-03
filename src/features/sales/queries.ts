import { saleFiltersSchema } from "@/features/sales/schemas";
import { canManageOrganization, isStaff } from "@/lib/auth/authorization";
import { getAuthContext } from "@/lib/auth/session";
import { getDatabase } from "@/lib/database";

function nextUtcDay(date: string) {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + 1);
  return value;
}

export async function getSalesWorkspace(rawFilters: {
  query?: string;
  staffProfileId?: string;
  paymentType?: string;
  minProfit?: string;
  maxProfit?: string;
  from?: string;
  to?: string;
}) {
  const auth = await getAuthContext();
  if (!auth || !isStaff(auth.membership.role)) return null;

  const filters = saleFiltersSchema.parse(rawFilters);
  const database = getDatabase();
  const organizationId = auth.organization.id;
  const where = {
    organizationId,
    staffProfileId: filters.staffProfileId,
    paymentType: filters.paymentType,
    profit: {
      gte: filters.minProfit,
      lte: filters.maxProfit,
    },
    createdAt:
      filters.from || filters.to
        ? {
            gte: filters.from
              ? new Date(`${filters.from}T00:00:00.000Z`)
              : undefined,
            lt: filters.to ? nextUtcDay(filters.to) : undefined,
          }
        : undefined,
    ...(filters.query
      ? {
          OR: [
            { uid: { contains: filters.query, mode: "insensitive" as const } },
            {
              clientName: {
                contains: filters.query,
                mode: "insensitive" as const,
              },
            },
            {
              staffName: {
                contains: filters.query,
                mode: "insensitive" as const,
              },
            },
            {
              referenceNumber: {
                contains: filters.query,
                mode: "insensitive" as const,
              },
            },
          ],
        }
      : {}),
  };

  const leadWhere = canManageOrganization(auth.membership.role)
    ? { organizationId, isArchived: false }
    : {
        organizationId,
        isArchived: false,
        assignments: { some: { profileId: auth.profile.id } },
      };

  const [sales, totals, total, staffMemberships, leads] = await Promise.all([
    database.sale.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        uid: true,
        staffProfileId: true,
        staffName: true,
        clientName: true,
        paymentType: true,
        referenceNumber: true,
        netPrice: true,
        receivedAmount: true,
        profit: true,
        createdAt: true,
        lead: { select: { id: true, uid: true, clientName: true } },
      },
    }),
    database.sale.aggregate({
      where,
      _sum: { netPrice: true, receivedAmount: true, profit: true },
    }),
    database.sale.count({ where }),
    database.organizationMembership.findMany({
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
    }),
    database.lead.findMany({
      where: leadWhere,
      orderBy: { updatedAt: "desc" },
      take: 100,
      select: { id: true, uid: true, clientName: true },
    }),
  ]);

  return {
    auth,
    filters,
    sales,
    totals: totals._sum,
    total,
    staff: staffMemberships.map(({ profile }) => profile),
    leads,
  };
}

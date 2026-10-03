import { Prisma } from "@/generated/prisma/client";
import { cashbookFiltersSchema } from "@/features/cashbook/schemas";
import { canManageOrganization, isStaff } from "@/lib/auth/authorization";
import { getAuthContext } from "@/lib/auth/session";
import { getDatabase } from "@/lib/database";

export const CASHBOOK_PAGE_SIZE = 30;

type SummaryRow = {
  today: string;
  month: string;
  year: string;
};

function pakistanDateRange(date: string) {
  const start = new Date(`${date}T00:00:00+05:00`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { gte: start, lt: end };
}

export async function getCashbookWorkspace(rawFilters: {
  query?: string;
  direction?: string;
  paymentType?: string;
  date?: string;
  page?: string;
}) {
  const auth = await getAuthContext();
  if (!auth || !isStaff(auth.membership.role)) return null;

  const filters = cashbookFiltersSchema.parse(rawFilters);
  const database = getDatabase();
  const organizationId = auth.organization.id;
  const canChooseStaff = canManageOrganization(auth.membership.role);
  const where: Prisma.CashbookEntryWhereInput = {
    organizationId,
    direction: filters.direction,
    paymentType: filters.paymentType,
    occurredAt: filters.date ? pakistanDateRange(filters.date) : undefined,
    ...(filters.query
      ? {
          OR: [
            { uid: { contains: filters.query, mode: "insensitive" } },
            { clientName: { contains: filters.query, mode: "insensitive" } },
            { staffName: { contains: filters.query, mode: "insensitive" } },
            { branch: { contains: filters.query, mode: "insensitive" } },
            { remarks: { contains: filters.query, mode: "insensitive" } },
            {
              referenceNumber: {
                contains: filters.query,
                mode: "insensitive",
              },
            },
          ],
        }
      : {}),
  };

  const entriesPromise = database.cashbookEntry.findMany({
    where,
    orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
    skip: (filters.page - 1) * CASHBOOK_PAGE_SIZE,
    take: CASHBOOK_PAGE_SIZE + 1,
    select: {
      id: true,
      uid: true,
      direction: true,
      branch: true,
      staffName: true,
      clientName: true,
      remarks: true,
      paymentType: true,
      referenceNumber: true,
      amount: true,
      occurredAt: true,
      project: { select: { id: true, uid: true, title: true } },
    },
  });

  const summaryPromise = database.$queryRaw<SummaryRow[]>(Prisma.sql`
    SELECT
      COALESCE(SUM(
        CASE WHEN occurred_at >= (date_trunc('day', now() AT TIME ZONE 'Asia/Karachi') AT TIME ZONE 'Asia/Karachi')
          THEN CASE WHEN direction = 'in'::cash_direction THEN amount ELSE -amount END
          ELSE 0 END
      ), 0)::text AS today,
      COALESCE(SUM(
        CASE WHEN occurred_at >= (date_trunc('month', now() AT TIME ZONE 'Asia/Karachi') AT TIME ZONE 'Asia/Karachi')
          THEN CASE WHEN direction = 'in'::cash_direction THEN amount ELSE -amount END
          ELSE 0 END
      ), 0)::text AS month,
      COALESCE(SUM(
        CASE WHEN occurred_at >= (date_trunc('year', now() AT TIME ZONE 'Asia/Karachi') AT TIME ZONE 'Asia/Karachi')
          THEN CASE WHEN direction = 'in'::cash_direction THEN amount ELSE -amount END
          ELSE 0 END
      ), 0)::text AS year
    FROM cashbook_entries
    WHERE organization_id = ${organizationId}::uuid
  `);

  const projectsPromise = database.project.findMany({
    where: { organizationId, status: "ACTIVE", isArchived: false },
    orderBy: { title: "asc" },
    select: { id: true, uid: true, title: true },
  });

  const staffPromise = canChooseStaff
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
    : Promise.resolve([]);

  const [entryRows, summaryRows, projects, staffMemberships] = await Promise.all([
    entriesPromise,
    summaryPromise,
    projectsPromise,
    staffPromise,
  ]);
  const hasNext = entryRows.length > CASHBOOK_PAGE_SIZE;
  const entries = hasNext ? entryRows.slice(0, CASHBOOK_PAGE_SIZE) : entryRows;

  return {
    auth,
    filters,
    entries,
    projects,
    staff: staffMemberships.map(({ profile }) => profile),
    summary: summaryRows[0] ?? { today: "0", month: "0", year: "0" },
    pagination: {
      page: filters.page,
      hasPrevious: filters.page > 1,
      hasNext,
    },
  };
}

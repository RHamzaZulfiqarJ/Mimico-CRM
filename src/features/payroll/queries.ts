import { Prisma } from "@/generated/prisma/client";
import { payrollFiltersSchema } from "@/features/payroll/schemas";
import { canManageOrganization } from "@/lib/auth/authorization";
import { getAuthContext } from "@/lib/auth/session";
import { getDatabase } from "@/lib/database";

export const PAYROLL_PAGE_SIZE = 30;

const personSelect = { id: true, firstName: true, lastName: true, username: true, email: true, phone: true } as const;

function monthRange(payPeriod?: string) {
  if (!payPeriod) return undefined;
  const start = new Date(`${payPeriod}-01T00:00:00.000Z`);
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
  return { gte: start, lt: end };
}

export async function getPayrollWorkspace(rawFilters: { query?: string; profileId?: string; payPeriod?: string; page?: string }) {
  const auth = await getAuthContext();
  if (!auth || !canManageOrganization(auth.membership.role)) return null;
  const filters = payrollFiltersSchema.parse(rawFilters);
  const database = getDatabase();
  const organizationId = auth.organization.id;
  const where: Prisma.PayrollTranscriptWhereInput = {
    organizationId,
    profileId: filters.profileId,
    payPeriodStart: monthRange(filters.payPeriod),
    ...(filters.query ? { OR: [
      { uid: { contains: filters.query, mode: "insensitive" } },
      { employeeName: { contains: filters.query, mode: "insensitive" } },
      { designation: { contains: filters.query, mode: "insensitive" } },
      { phone: { contains: filters.query, mode: "insensitive" } },
    ] } : {}),
  };
  const [rows, totals, policy, memberships] = await Promise.all([
    database.payrollTranscript.findMany({ where, orderBy: [{ payPeriodStart: "desc" }, { createdAt: "desc" }], skip: (filters.page - 1) * PAYROLL_PAGE_SIZE, take: PAYROLL_PAGE_SIZE + 1, select: { id: true, uid: true, employeeName: true, designation: true, phone: true, payPeriodStart: true, salaryType: true, totalSalary: true, netSalary: true, createdAt: true, profile: { select: personSelect } } }),
    database.payrollTranscript.aggregate({ where: { organizationId }, _count: { _all: true }, _sum: { totalSalary: true, netSalary: true } }),
    database.payrollDeductionPolicy.findFirst({ where: { organizationId }, orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }] }),
    database.organizationMembership.findMany({ where: { organizationId, isActive: true, role: { in: ["EMPLOYEE", "MANAGER", "SUPER_ADMIN"] }, profile: { isActive: true } }, orderBy: [{ profile: { firstName: "asc" } }], select: { profile: { select: personSelect } } }),
  ]);
  const hasNext = rows.length > PAYROLL_PAGE_SIZE;
  return { auth, filters, transcripts: hasNext ? rows.slice(0, PAYROLL_PAGE_SIZE) : rows, policy, staff: memberships.map(({ profile }) => profile), totals: { count: totals._count._all, gross: totals._sum.totalSalary, net: totals._sum.netSalary }, pagination: { page: filters.page, hasPrevious: filters.page > 1, hasNext } };
}

export async function getPrintablePayrollTranscript(transcriptId: string) {
  const auth = await getAuthContext();
  if (!auth || !canManageOrganization(auth.membership.role)) return null;
  const database = getDatabase();
  const transcript = await database.payrollTranscript.findFirst({ where: { id: transcriptId, organizationId: auth.organization.id }, include: { profile: { select: personSelect } } });
  if (!transcript) return { auth, transcript: null, calculation: null };
  const audit = await database.auditLog.findFirst({ where: { organizationId: auth.organization.id, entityType: "PayrollTranscript", entityId: transcript.id, action: "payroll.transcript.created" }, orderBy: { createdAt: "asc" }, select: { metadata: true } });
  const metadata = audit?.metadata && typeof audit.metadata === "object" && !Array.isArray(audit.metadata) ? audit.metadata : null;
  const value = (key: string) => typeof metadata?.[key] === "string" || typeof metadata?.[key] === "number" ? String(metadata[key]) : null;
  return { auth, transcript, calculation: { lateArrivalRate: value("lateArrivalRate"), halfDayRate: value("halfDayRate"), dayOffRate: value("dayOffRate"), lateArrivalDeduction: value("lateArrivalDeduction"), halfDayDeduction: value("halfDayDeduction"), dayOffDeduction: value("dayOffDeduction"), totalDeductions: value("totalDeductions") } };
}

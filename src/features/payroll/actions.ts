"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { calculatePayroll } from "@/features/payroll/money";
import { payrollUidFromId } from "@/features/payroll/identifiers";
import { deductionPolicySchema, payrollTranscriptSchema, type PayrollFormState } from "@/features/payroll/schemas";
import { canManageOrganization } from "@/lib/auth/authorization";
import { getAuthContext } from "@/lib/auth/session";
import { getDatabase } from "@/lib/database";

const transcriptIdSchema = z.uuid();

function unauthorized(): PayrollFormState {
  return { status: "error", message: "Only organization management can change payroll." };
}

function refreshPayroll(id?: string) {
  revalidatePath("/payroll");
  if (id) revalidatePath(`/payroll/${id}/print`);
  revalidatePath("/dashboard");
}

export async function createDeductionPolicyAction(_state: PayrollFormState, formData: FormData): Promise<PayrollFormState> {
  const parsed = deductionPolicySchema.safeParse({ effectiveFrom: formData.get("effectiveFrom"), lateArrivals: formData.get("lateArrivals"), halfDays: formData.get("halfDays"), daysOff: formData.get("daysOff") });
  if (!parsed.success) return { status: "error", errors: parsed.error.flatten().fieldErrors };
  const auth = await getAuthContext();
  if (!auth || !canManageOrganization(auth.membership.role)) return unauthorized();
  const database = getDatabase();
  const effectiveFrom = new Date(`${parsed.data.effectiveFrom}T00:00:00.000Z`);
  try {
    const existing = await database.payrollDeductionPolicy.findFirst({ where: { organizationId: auth.organization.id, effectiveFrom }, select: { id: true } });
    if (existing) return { status: "error", message: "A deduction policy already starts on this date." };
    const policyId = crypto.randomUUID();
    await database.$transaction([
      database.payrollDeductionPolicy.create({ data: { id: policyId, organizationId: auth.organization.id, effectiveFrom, lateArrivals: parsed.data.lateArrivals, halfDays: parsed.data.halfDays, daysOff: parsed.data.daysOff } }),
      database.auditLog.create({ data: { organizationId: auth.organization.id, actorProfileId: auth.profile.id, action: "payroll.policy.created", entityType: "PayrollDeductionPolicy", entityId: policyId, metadata: parsed.data } }),
    ]);
    refreshPayroll();
    return { status: "success", message: "New deduction rates saved." };
  } catch {
    return { status: "error", message: "The deduction policy could not be saved." };
  }
}

export async function createPayrollTranscriptAction(_state: PayrollFormState, formData: FormData): Promise<PayrollFormState> {
  const parsed = payrollTranscriptSchema.safeParse({ profileId: formData.get("profileId"), designation: formData.get("designation"), phone: formData.get("phone"), payPeriod: formData.get("payPeriod"), salaryType: formData.get("salaryType"), totalSalary: formData.get("totalSalary"), lateArrivals: formData.get("lateArrivals"), halfDays: formData.get("halfDays"), daysOff: formData.get("daysOff"), amountPerDayOff: formData.get("amountPerDayOff") });
  if (!parsed.success) return { status: "error", errors: parsed.error.flatten().fieldErrors };
  const auth = await getAuthContext();
  if (!auth || !canManageOrganization(auth.membership.role)) return unauthorized();
  const database = getDatabase();
  const payPeriodStart = new Date(`${parsed.data.payPeriod}-01T00:00:00.000Z`);
  try {
    const [membership, policy, duplicate] = await Promise.all([
      database.organizationMembership.findFirst({ where: { organizationId: auth.organization.id, profileId: parsed.data.profileId, isActive: true, role: { in: ["EMPLOYEE", "MANAGER", "SUPER_ADMIN"] }, profile: { isActive: true } }, select: { profile: { select: { id: true, firstName: true, lastName: true, username: true, email: true } } } }),
      database.payrollDeductionPolicy.findFirst({ where: { organizationId: auth.organization.id, effectiveFrom: { lte: payPeriodStart } }, orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }] }),
      database.payrollTranscript.findFirst({ where: { organizationId: auth.organization.id, profileId: parsed.data.profileId, payPeriodStart }, select: { id: true } }),
    ]);
    if (!membership) return { status: "error", message: "The selected employee is unavailable." };
    if (!policy) return { status: "error", message: "Create deduction rates effective for this salary month first." };
    if (duplicate) return { status: "error", message: "This employee already has a transcript for the selected month." };
    const totals = calculatePayroll({ totalSalary: parsed.data.totalSalary, lateArrivals: parsed.data.lateArrivals, halfDays: parsed.data.halfDays, daysOff: parsed.data.daysOff, lateArrivalRate: policy.lateArrivals, halfDayRate: policy.halfDays, dayOffRate: parsed.data.amountPerDayOff });
    if (totals.netSalary.isNegative()) return { status: "error", message: "Deductions cannot exceed the total salary." };
    const id = crypto.randomUUID();
    const uid = payrollUidFromId(id);
    const employeeName = [membership.profile.firstName, membership.profile.lastName].filter(Boolean).join(" ") || membership.profile.username || membership.profile.email || "Employee";
    await database.$transaction([
      database.payrollTranscript.create({ data: { id, organizationId: auth.organization.id, profileId: membership.profile.id, uid, employeeName, designation: parsed.data.designation, phone: parsed.data.phone, payPeriodStart, salaryType: parsed.data.salaryType, totalSalary: totals.totalSalary, lateArrivals: parsed.data.lateArrivals, halfDays: parsed.data.halfDays, daysOff: parsed.data.daysOff, amountPerDayOff: parsed.data.amountPerDayOff, netSalary: totals.netSalary } }),
      database.auditLog.create({ data: { organizationId: auth.organization.id, actorProfileId: auth.profile.id, action: "payroll.transcript.created", entityType: "PayrollTranscript", entityId: id, metadata: { uid, profileId: membership.profile.id, payPeriod: parsed.data.payPeriod, salaryType: parsed.data.salaryType, totalSalary: totals.totalSalary.toFixed(2), lateArrivalRate: policy.lateArrivals, halfDayRate: policy.halfDays, dayOffRate: parsed.data.amountPerDayOff, lateArrivalDeduction: totals.lateArrivalDeduction.toFixed(2), halfDayDeduction: totals.halfDayDeduction.toFixed(2), dayOffDeduction: totals.dayOffDeduction.toFixed(2), totalDeductions: totals.totalDeductions.toFixed(2), netSalary: totals.netSalary.toFixed(2) } } }),
    ]);
    refreshPayroll(id);
    return { status: "success", message: "Salary transcript created." };
  } catch {
    return { status: "error", message: "The salary transcript could not be saved." };
  }
}

export async function deletePayrollTranscriptAction(transcriptId: string, _state: PayrollFormState, _formData: FormData): Promise<PayrollFormState> {
  void _state; void _formData;
  const parsedId = transcriptIdSchema.safeParse(transcriptId);
  if (!parsedId.success) return unauthorized();
  const auth = await getAuthContext();
  if (!auth || !canManageOrganization(auth.membership.role)) return unauthorized();
  const database = getDatabase();
  try {
    const transcript = await database.payrollTranscript.findFirst({ where: { id: parsedId.data, organizationId: auth.organization.id }, select: { id: true, uid: true, employeeName: true, payPeriodStart: true, totalSalary: true, netSalary: true } });
    if (!transcript) return unauthorized();
    await database.$transaction([database.payrollTranscript.delete({ where: { id: transcript.id } }), database.auditLog.create({ data: { organizationId: auth.organization.id, actorProfileId: auth.profile.id, action: "payroll.transcript.deleted", entityType: "PayrollTranscript", entityId: transcript.id, metadata: { uid: transcript.uid, employeeName: transcript.employeeName, payPeriodStart: transcript.payPeriodStart.toISOString(), totalSalary: transcript.totalSalary?.toFixed(2), netSalary: transcript.netSalary?.toFixed(2) } } })]);
    refreshPayroll(transcript.id);
    return { status: "success", message: "Salary transcript deleted." };
  } catch {
    return { status: "error", message: "The salary transcript could not be deleted." };
  }
}

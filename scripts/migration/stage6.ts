import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { cashbookUidFromId } from "../../src/features/cashbook/identifiers";
import { payrollUidFromId } from "../../src/features/payroll/identifiers";
import { refundUidFromId } from "../../src/features/refunds/identifiers";
import { voucherUidFromId } from "../../src/features/vouchers/identifiers";
import {
  buildStage6Plan,
  mongoId,
  parseMongoExport,
  staffLookupKey,
  type FinanceTotals,
  type MongoDocument,
  type Stage6Plan,
} from "./legacy-stage6";

const FINANCE_COLLECTIONS = [
  "sales", "cashbooks", "vouchers", "refunds", "deductions", "transcripts",
] as const;
const REFERENCE_COLLECTIONS = ["users", "employees", "leads", "projects", "approvals"] as const;
type FinanceCollection = (typeof FINANCE_COLLECTIONS)[number];
type ReferenceCollection = (typeof REFERENCE_COLLECTIONS)[number];

const fileCandidates: Record<FinanceCollection | ReferenceCollection, string[]> = {
  sales: ["sales.json"],
  cashbooks: ["cashbooks.json", "cashbook.json"],
  vouchers: ["vouchers.json"],
  refunds: ["refunds.json"],
  deductions: ["deductions.json", "deduction.json"],
  transcripts: ["transcripts.json", "transcript.json"],
  users: ["users.json"],
  employees: ["employees.json"],
  leads: ["leads.json"],
  projects: ["projects.json"],
  approvals: ["approvals.json"],
};

type Arguments = { apply: boolean; input?: string; organization?: string; report?: string };
type CountKey =
  | "sales"
  | "cashbookEntries"
  | "vouchers"
  | "refunds"
  | "deductionPolicies"
  | "payrollTranscripts"
  | "approvals";
type ApplyCounts = Record<CountKey, { created: number; updated: number }>;

function parseArguments(argv: string[]): Arguments {
  const parsed: Arguments = { apply: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--apply") { parsed.apply = true; continue; }
    if (["--input", "--organization", "--report"].includes(argument)) {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) throw new Error(`${argument} requires a value.`);
      index += 1;
      if (argument === "--input") parsed.input = value;
      if (argument === "--organization") parsed.organization = value;
      if (argument === "--report") parsed.report = value;
      continue;
    }
    throw new Error(`Unknown argument: ${argument}`);
  }
  if (!parsed.input) throw new Error("--input is required.");
  if (parsed.apply && !parsed.organization) throw new Error("--organization is required with --apply.");
  return parsed;
}

async function readOptionalFile(inputDirectory: string, candidates: string[]) {
  for (const candidate of candidates) {
    const filename = path.join(inputDirectory, candidate);
    try {
      return { documents: parseMongoExport(await readFile(filename, "utf8")), found: true };
    } catch (error) {
      const code = error instanceof Error && "code" in error
        ? (error as NodeJS.ErrnoException).code
        : undefined;
      if (code !== "ENOENT") {
        throw new Error(`Could not read ${filename}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }
  return { documents: [] as MongoDocument[], found: false };
}

function normalizedRole(value: unknown) {
  return typeof value === "string"
    ? value.trim().toLowerCase().replaceAll(/[^a-z]/g, "")
    : undefined;
}

function assignableIdentity(document: MongoDocument, collection: "users" | "employees") {
  const role = normalizedRole(document.role);
  if (collection === "employees" && !role) return true;
  return !role || role === "employee" || role === "manager" || role === "superadmin";
}

function optionalText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function buildStaffLookup(identities: MongoDocument[]) {
  const lookup = new Map<string, string | null>();
  for (const identity of identities) {
    const id = mongoId(identity._id);
    if (!id) continue;
    const fullName = [optionalText(identity.firstName), optionalText(identity.lastName)].filter(Boolean).join(" ");
    const aliases = [
      optionalText(identity.username),
      optionalText(identity.employee),
      optionalText(identity.email),
      fullName || undefined,
    ].filter((value): value is string => Boolean(value));
    for (const alias of aliases) {
      const key = staffLookupKey(alias);
      const existing = lookup.get(key);
      lookup.set(key, existing && existing !== id ? null : id);
    }
  }
  return lookup;
}

async function readInput(inputDirectory: string) {
  const collections: Partial<Record<FinanceCollection, MongoDocument[]>> = {};
  const references: Partial<Record<ReferenceCollection, MongoDocument[]>> = {};
  const warnings: string[] = [];
  let financeFiles = 0;
  for (const collection of FINANCE_COLLECTIONS) {
    const result = await readOptionalFile(inputDirectory, fileCandidates[collection]);
    collections[collection] = result.documents;
    if (result.found) financeFiles += 1;
    else warnings.push(`${fileCandidates[collection][0]} was not supplied; treating it as empty.`);
  }
  if (!financeFiles) throw new Error(`No Stage 6 export files were found in ${inputDirectory}.`);

  const referenceFiles = new Set<ReferenceCollection>();
  for (const collection of REFERENCE_COLLECTIONS) {
    const result = await readOptionalFile(inputDirectory, fileCandidates[collection]);
    references[collection] = result.documents;
    if (result.found) referenceFiles.add(collection);
  }
  const identities = [
    ...(references.users ?? []).filter((item) => assignableIdentity(item, "users")),
    ...(references.employees ?? []).filter((item) => assignableIdentity(item, "employees")),
  ];
  const identitiesSupplied = referenceFiles.has("users") || referenceFiles.has("employees");
  const knownProfileLegacyIds = identitiesSupplied
    ? new Set(identities.map((item) => mongoId(item._id)).filter((id): id is string => Boolean(id)))
    : undefined;
  const knownLeadLegacyIds = referenceFiles.has("leads")
    ? new Set((references.leads ?? []).map((item) => mongoId(item._id)).filter((id): id is string => Boolean(id)))
    : undefined;
  const knownProjectLegacyIds = referenceFiles.has("projects")
    ? new Set((references.projects ?? []).map((item) => mongoId(item._id)).filter((id): id is string => Boolean(id)))
    : undefined;
  const leadAssigneesById = referenceFiles.has("leads")
    ? new Map((references.leads ?? []).flatMap((item) => {
        const id = mongoId(item._id);
        if (!id) return [];
        const assignees = Array.isArray(item.allocatedTo)
          ? [...new Set(item.allocatedTo.map(mongoId).filter((value): value is string => Boolean(value)))]
          : [];
        return [[id, assignees] as const];
      }))
    : undefined;

  return {
    collections: { ...collections, approvals: referenceFiles.has("approvals") ? references.approvals : undefined },
    options: {
      knownProfileLegacyIds,
      knownLeadLegacyIds,
      knownProjectLegacyIds,
      staffLegacyIdByName: identitiesSupplied ? buildStaffLookup(identities) : undefined,
      leadAssigneesById,
    },
    warnings,
  };
}

function emptyCounts(): ApplyCounts {
  return {
    sales: { created: 0, updated: 0 }, cashbookEntries: { created: 0, updated: 0 },
    vouchers: { created: 0, updated: 0 }, refunds: { created: 0, updated: 0 },
    deductionPolicies: { created: 0, updated: 0 }, payrollTranscripts: { created: 0, updated: 0 },
    approvals: { created: 0, updated: 0 },
  };
}

function increment(counts: ApplyCounts, key: CountKey, existed: boolean) {
  counts[key][existed ? "updated" : "created"] += 1;
}

function recordPayload(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function comparableMoney(value: unknown) {
  if (typeof value !== "string" && typeof value !== "number") return undefined;
  const candidate = String(value);
  if (!/^-?\d{1,16}(?:\.\d{1,2})?$/.test(candidate)) return undefined;
  const [whole, fraction = ""] = candidate.split(".");
  return `${whole}.${fraction.padEnd(2, "0")}`;
}

function saleUidFromId(id: string) {
  return `SALE-${id.replaceAll("-", "").slice(0, 12).toUpperCase()}`;
}

function approvalUidFromId(id: string) {
  return `APR-${id.replaceAll("-", "").slice(0, 12).toUpperCase()}`;
}

function decimalTotal(value: { toFixed(decimalPlaces: number): string } | null | undefined) {
  return value?.toFixed(2) ?? "0.00";
}

async function applyPlan(plan: Stage6Plan, organizationSlug: string) {
  const { getDatabase } = await import("../../src/lib/database");
  const database = getDatabase();
  try {
    const organization = await database.organization.findUnique({
      where: { slug: organizationSlug },
      select: { id: true, name: true, slug: true },
    });
    if (!organization) throw new Error(`Organization ${organizationSlug} does not exist.`);
    const organizationId = organization.id;
    const counts = emptyCounts();
    let reconciledTotals: FinanceTotals | undefined;

    await database.$transaction(async (transaction) => {
      const profileLegacyIds = [...new Set([
        ...plan.sales.flatMap((item) => item.staffLegacyProfileId ? [item.staffLegacyProfileId] : []),
        ...plan.cashbookEntries.flatMap((item) => item.staffLegacyProfileId ? [item.staffLegacyProfileId] : []),
        ...plan.vouchers.flatMap((item) => item.allocatedToLegacyProfileId ? [item.allocatedToLegacyProfileId] : []),
        ...plan.refunds.flatMap((item) => item.requestedByLegacyProfileId ? [item.requestedByLegacyProfileId] : []),
        ...plan.payrollTranscripts.flatMap((item) => item.profileLegacyMongoId ? [item.profileLegacyMongoId] : []),
      ])];
      const leadLegacyIds = [...new Set([
        ...plan.sales.flatMap((item) => item.leadLegacyMongoId ? [item.leadLegacyMongoId] : []),
        ...plan.cashbookEntries.flatMap((item) => item.leadLegacyMongoId ? [item.leadLegacyMongoId] : []),
        ...plan.refunds.flatMap((item) => item.leadLegacyMongoId ? [item.leadLegacyMongoId] : []),
      ])];
      const projectLegacyIds = [...new Set([
        ...plan.cashbookEntries.flatMap((item) => item.projectLegacyMongoId ? [item.projectLegacyMongoId] : []),
        ...plan.vouchers.flatMap((item) => item.projectLegacyMongoId ? [item.projectLegacyMongoId] : []),
      ])];
      const [profiles, leads, projects] = await Promise.all([
        transaction.profile.findMany({
          where: { legacyMongoId: { in: profileLegacyIds }, memberships: { some: { organizationId: organization.id } } },
          select: { id: true, legacyMongoId: true },
        }),
        transaction.lead.findMany({
          where: { organizationId: organization.id, legacyMongoId: { in: leadLegacyIds } },
          select: { id: true, legacyMongoId: true },
        }),
        transaction.project.findMany({
          where: { organizationId: organization.id, legacyMongoId: { in: projectLegacyIds } },
          select: { id: true, legacyMongoId: true },
        }),
      ]);
      const profileIds = new Map(profiles.flatMap((item) => item.legacyMongoId ? [[item.legacyMongoId, item.id] as const] : []));
      const leadIds = new Map(leads.flatMap((item) => item.legacyMongoId ? [[item.legacyMongoId, item.id] as const] : []));
      const projectIds = new Map(projects.flatMap((item) => item.legacyMongoId ? [[item.legacyMongoId, item.id] as const] : []));
      const missingProfiles = profileLegacyIds.filter((id) => !profileIds.has(id));
      const missingLeads = leadLegacyIds.filter((id) => !leadIds.has(id));
      const missingProjects = projectLegacyIds.filter((id) => !projectIds.has(id));
      if (missingProfiles.length) throw new Error(`Missing organization profiles: ${missingProfiles.join(", ")}.`);
      if (missingLeads.length) throw new Error(`Missing organization leads: ${missingLeads.join(", ")}.`);
      if (missingProjects.length) throw new Error(`Missing organization projects: ${missingProjects.join(", ")}.`);

      const legacyIds = {
        sales: plan.sales.map((item) => item.legacyMongoId),
        cashbookEntries: plan.cashbookEntries.map((item) => item.legacyMongoId),
        vouchers: plan.vouchers.map((item) => item.legacyMongoId),
        refunds: plan.refunds.map((item) => item.legacyMongoId),
        deductionPolicies: plan.deductionPolicies.map((item) => item.legacyMongoId),
        payrollTranscripts: plan.payrollTranscripts.map((item) => item.legacyMongoId),
      };
      const [existingSales, existingCashbooks, existingVouchers, existingRefunds, existingPolicies, existingTranscripts] = await Promise.all([
        transaction.sale.findMany({ where: { legacyMongoId: { in: legacyIds.sales } }, select: { id: true, legacyMongoId: true, organizationId: true } }),
        transaction.cashbookEntry.findMany({ where: { legacyMongoId: { in: legacyIds.cashbookEntries } }, select: { id: true, legacyMongoId: true, organizationId: true } }),
        transaction.voucher.findMany({ where: { legacyMongoId: { in: legacyIds.vouchers } }, select: { id: true, legacyMongoId: true, organizationId: true } }),
        transaction.refund.findMany({ where: { legacyMongoId: { in: legacyIds.refunds } }, select: { id: true, legacyMongoId: true, organizationId: true } }),
        transaction.payrollDeductionPolicy.findMany({ where: { legacyMongoId: { in: legacyIds.deductionPolicies } }, select: { id: true, legacyMongoId: true, organizationId: true } }),
        transaction.payrollTranscript.findMany({ where: { legacyMongoId: { in: legacyIds.payrollTranscripts } }, select: { id: true, legacyMongoId: true, organizationId: true } }),
      ]);
      for (const [label, records] of [
        ["sale", existingSales], ["cashbook entry", existingCashbooks], ["voucher", existingVouchers],
        ["refund", existingRefunds], ["deduction policy", existingPolicies], ["payroll transcript", existingTranscripts],
      ] as const) {
        const collision = records.find((item) => item.organizationId !== organization.id);
        if (collision) throw new Error(`${label} ${collision.legacyMongoId} already belongs to another organization.`);
      }

      const [saleUidRecords, cashUidRecords, voucherUidRecords, refundUidRecords, payrollUidRecords] = await Promise.all([
        transaction.sale.findMany({ where: { organizationId: organization.id, uid: { in: plan.sales.flatMap((item) => item.uid ? [item.uid] : []) } }, select: { uid: true, legacyMongoId: true } }),
        transaction.cashbookEntry.findMany({ where: { organizationId: organization.id, uid: { in: plan.cashbookEntries.flatMap((item) => item.uid ? [item.uid] : []) } }, select: { uid: true, legacyMongoId: true } }),
        transaction.voucher.findMany({ where: { organizationId: organization.id, uid: { in: plan.vouchers.flatMap((item) => item.uid ? [item.uid] : []) } }, select: { uid: true, legacyMongoId: true } }),
        transaction.refund.findMany({ where: { organizationId: organization.id, uid: { in: plan.refunds.flatMap((item) => item.uid ? [item.uid] : []) } }, select: { uid: true, legacyMongoId: true } }),
        transaction.payrollTranscript.findMany({ where: { organizationId: organization.id, uid: { in: plan.payrollTranscripts.flatMap((item) => item.uid ? [item.uid] : []) } }, select: { uid: true, legacyMongoId: true } }),
      ]);
      for (const [label, records, planned] of [
        ["sale", saleUidRecords, plan.sales], ["cashbook entry", cashUidRecords, plan.cashbookEntries],
        ["voucher", voucherUidRecords, plan.vouchers], ["refund", refundUidRecords, plan.refunds],
        ["payroll transcript", payrollUidRecords, plan.payrollTranscripts],
      ] as const) {
        for (const record of records) {
          const source = planned.find((item) => item.uid === record.uid);
          if (source && source.legacyMongoId !== record.legacyMongoId) {
            throw new Error(`${label} uid ${record.uid} already belongs to another record.`);
          }
        }
      }

      const existingSets = {
        sales: new Set(existingSales.map((item) => item.legacyMongoId)),
        cashbookEntries: new Set(existingCashbooks.map((item) => item.legacyMongoId)),
        vouchers: new Set(existingVouchers.map((item) => item.legacyMongoId)),
        refunds: new Set(existingRefunds.map((item) => item.legacyMongoId)),
        deductionPolicies: new Set(existingPolicies.map((item) => item.legacyMongoId)),
        payrollTranscripts: new Set(existingTranscripts.map((item) => item.legacyMongoId)),
      };
      const voucherIds = new Map<string, string>();
      const refundIds = new Map<string, string>();

      for (const item of plan.sales) {
        const existing = existingSales.find((record) => record.legacyMongoId === item.legacyMongoId);
        const id = existing?.id ?? randomUUID();
        const commonData = {
          leadId: item.leadLegacyMongoId ? leadIds.get(item.leadLegacyMongoId)! : null,
          staffProfileId: item.staffLegacyProfileId ? profileIds.get(item.staffLegacyProfileId)! : null,
          staffName: item.staffName ?? null, clientName: item.clientName ?? null,
          paymentType: item.paymentType ?? null, referenceNumber: item.referenceNumber ?? null,
          netPrice: item.netPrice ?? null, receivedAmount: item.receivedAmount ?? null, profit: item.profit ?? null,
          ...(item.updatedAt ? { updatedAt: new Date(item.updatedAt) } : {}),
        };
        await transaction.sale.upsert({
          where: { legacyMongoId: item.legacyMongoId },
          create: { id, organizationId: organization.id, legacyMongoId: item.legacyMongoId, uid: item.uid ?? saleUidFromId(id), ...commonData, createdAt: new Date(item.createdAt) },
          update: { ...commonData, ...(item.uid ? { uid: item.uid } : {}) },
        });
        increment(counts, "sales", existingSets.sales.has(item.legacyMongoId));
      }

      for (const item of plan.cashbookEntries) {
        const existing = existingCashbooks.find((record) => record.legacyMongoId === item.legacyMongoId);
        const id = existing?.id ?? randomUUID();
        const commonData = {
          leadId: item.leadLegacyMongoId ? leadIds.get(item.leadLegacyMongoId)! : null,
          projectId: item.projectLegacyMongoId ? projectIds.get(item.projectLegacyMongoId)! : null,
          staffProfileId: item.staffLegacyProfileId ? profileIds.get(item.staffLegacyProfileId)! : null,
          direction: item.direction, branch: item.branch ?? null, staffName: item.staffName ?? null,
          clientName: item.clientName ?? null, remarks: item.remarks ?? null,
          paymentType: item.paymentType ?? null, referenceNumber: item.referenceNumber ?? null,
          amount: item.amount, occurredAt: new Date(item.occurredAt),
          ...(item.updatedAt ? { updatedAt: new Date(item.updatedAt) } : {}),
        };
        await transaction.cashbookEntry.upsert({
          where: { legacyMongoId: item.legacyMongoId },
          create: { id, organizationId: organization.id, legacyMongoId: item.legacyMongoId, uid: item.uid ?? cashbookUidFromId(id), ...commonData, createdAt: new Date(item.createdAt) },
          update: { ...commonData, ...(item.uid ? { uid: item.uid } : {}) },
        });
        increment(counts, "cashbookEntries", existingSets.cashbookEntries.has(item.legacyMongoId));
      }

      for (const item of plan.vouchers) {
        const existing = existingVouchers.find((record) => record.legacyMongoId === item.legacyMongoId);
        const id = existing?.id ?? randomUUID();
        const commonData = {
          allocatedToProfileId: item.allocatedToLegacyProfileId ? profileIds.get(item.allocatedToLegacyProfileId)! : null,
          projectId: item.projectLegacyMongoId ? projectIds.get(item.projectLegacyMongoId)! : null,
          issuingDate: item.issuingDate ? new Date(`${item.issuingDate}T00:00:00.000Z`) : null,
          dueDate: item.dueDate ? new Date(`${item.dueDate}T00:00:00.000Z`) : null,
          branch: item.branch ?? null, clientName: item.clientName ?? null, cnic: item.cnic ?? null,
          phone: item.phone ?? null, email: item.email ?? null, type: item.type ?? null,
          cheque: item.cheque ?? null, propertyType: item.propertyType ?? null, area: item.area ?? null,
          total: item.total ?? null, paid: item.paid ?? null, remaining: item.remaining ?? null,
          note: item.note ?? null, status: item.status,
          ...(item.updatedAt ? { updatedAt: new Date(item.updatedAt) } : {}),
        };
        const voucher = await transaction.voucher.upsert({
          where: { legacyMongoId: item.legacyMongoId },
          create: { id, organizationId: organization.id, legacyMongoId: item.legacyMongoId, uid: item.uid ?? voucherUidFromId(id), ...commonData, createdAt: new Date(item.createdAt) },
          update: { ...commonData, ...(item.uid ? { uid: item.uid } : {}) },
          select: { id: true },
        });
        voucherIds.set(item.legacyMongoId, voucher.id);
        increment(counts, "vouchers", existingSets.vouchers.has(item.legacyMongoId));
      }

      for (const item of plan.refunds) {
        const existing = existingRefunds.find((record) => record.legacyMongoId === item.legacyMongoId);
        const id = existing?.id ?? randomUUID();
        const commonData = {
          leadId: item.leadLegacyMongoId ? leadIds.get(item.leadLegacyMongoId)! : null,
          requestedByProfileId: item.requestedByLegacyProfileId ? profileIds.get(item.requestedByLegacyProfileId)! : null,
          legacyNotificationId: item.legacyNotificationId ?? null, branch: item.branch ?? null,
          amount: item.amount, clientName: item.clientName, cnic: item.cnic ?? null,
          phone: item.phone, reason: item.reason, status: item.status,
          decidedAt: item.decidedAt ? new Date(item.decidedAt) : null,
          ...(item.updatedAt ? { updatedAt: new Date(item.updatedAt) } : {}),
        };
        const refund = await transaction.refund.upsert({
          where: { legacyMongoId: item.legacyMongoId },
          create: { id, organizationId: organization.id, legacyMongoId: item.legacyMongoId, uid: item.uid ?? refundUidFromId(id), ...commonData, createdAt: new Date(item.createdAt) },
          update: { ...commonData, ...(item.uid ? { uid: item.uid } : {}) },
          select: { id: true },
        });
        refundIds.set(item.legacyMongoId, refund.id);
        increment(counts, "refunds", existingSets.refunds.has(item.legacyMongoId));
      }

      for (const item of plan.deductionPolicies) {
        const commonData = {
          lateArrivals: item.lateArrivals, halfDays: item.halfDays, daysOff: item.daysOff,
          effectiveFrom: new Date(`${item.effectiveFrom}T00:00:00.000Z`),
          ...(item.updatedAt ? { updatedAt: new Date(item.updatedAt) } : {}),
        };
        await transaction.payrollDeductionPolicy.upsert({
          where: { legacyMongoId: item.legacyMongoId },
          create: { organizationId: organization.id, legacyMongoId: item.legacyMongoId, ...commonData, createdAt: new Date(item.createdAt) },
          update: commonData,
        });
        increment(counts, "deductionPolicies", existingSets.deductionPolicies.has(item.legacyMongoId));
      }

      const transcriptProfiles = [...new Set(plan.payrollTranscripts.flatMap((item) => item.profileLegacyMongoId ? [profileIds.get(item.profileLegacyMongoId)!] : []))];
      const transcriptPeriods = [...new Set(plan.payrollTranscripts.map((item) => new Date(`${item.payPeriodStart}T00:00:00.000Z`)))];
      const periodConflicts = await transaction.payrollTranscript.findMany({
        where: { organizationId: organization.id, profileId: { in: transcriptProfiles }, payPeriodStart: { in: transcriptPeriods } },
        select: { profileId: true, payPeriodStart: true, legacyMongoId: true },
      });
      for (const item of plan.payrollTranscripts) {
        if (!item.profileLegacyMongoId) continue;
        const profileId = profileIds.get(item.profileLegacyMongoId)!;
        const conflict = periodConflicts.find((record) =>
          record.profileId === profileId
          && record.payPeriodStart.toISOString().slice(0, 10) === item.payPeriodStart
          && record.legacyMongoId !== item.legacyMongoId);
        if (conflict) throw new Error(`Payroll transcript already exists for profile ${item.profileLegacyMongoId} and ${item.payPeriodStart.slice(0, 7)}.`);
      }
      for (const item of plan.payrollTranscripts) {
        const existing = existingTranscripts.find((record) => record.legacyMongoId === item.legacyMongoId);
        const id = existing?.id ?? randomUUID();
        const commonData = {
          profileId: item.profileLegacyMongoId ? profileIds.get(item.profileLegacyMongoId)! : null,
          employeeName: item.employeeName, designation: item.designation ?? null, phone: item.phone ?? null,
          payPeriodStart: new Date(`${item.payPeriodStart}T00:00:00.000Z`), salaryType: item.salaryType ?? null,
          totalSalary: item.totalSalary ?? null, lateArrivals: item.lateArrivals ?? null,
          halfDays: item.halfDays ?? null, daysOff: item.daysOff ?? null,
          amountPerDayOff: item.amountPerDayOff ?? null, netSalary: item.netSalary ?? null,
          ...(item.updatedAt ? { updatedAt: new Date(item.updatedAt) } : {}),
        };
        await transaction.payrollTranscript.upsert({
          where: { legacyMongoId: item.legacyMongoId },
          create: { id, organizationId: organization.id, legacyMongoId: item.legacyMongoId, uid: item.uid ?? payrollUidFromId(id), ...commonData, createdAt: new Date(item.createdAt) },
          update: { ...commonData, ...(item.uid ? { uid: item.uid } : {}) },
        });
        increment(counts, "payrollTranscripts", existingSets.payrollTranscripts.has(item.legacyMongoId));
      }

      const syntheticApprovalIds = [
        ...plan.vouchers.map((item) => item.approvalLegacyMongoId ?? `finance:voucher:${item.legacyMongoId}`),
        ...plan.refunds.map((item) => item.approvalLegacyMongoId ?? `finance:refund:${item.legacyMongoId}`),
      ];
      const approvalRecords = await transaction.approval.findMany({
        where: {
          OR: [
            { legacyMongoId: { in: syntheticApprovalIds } },
            { organizationId: organization.id, type: { in: ["VOUCHER", "REFUND"] } },
          ],
        },
        select: {
          id: true, organizationId: true, legacyMongoId: true, uid: true, type: true,
          title: true, requestedByProfileId: true, payload: true,
        },
      });
      const crossOrganizationApproval = approvalRecords.find((item) =>
        item.legacyMongoId && syntheticApprovalIds.includes(item.legacyMongoId) && item.organizationId !== organization.id);
      if (crossOrganizationApproval) {
        throw new Error(`approval ${crossOrganizationApproval.legacyMongoId} already belongs to another organization.`);
      }
      const organizationApprovals = approvalRecords.filter((item) => item.organizationId === organization.id);
      const claimedApprovalIds = new Set<string>();

      async function reconcileApproval(input: {
        kind: "voucher" | "refund";
        legacyRecordId: string;
        explicitLegacyId?: string;
        recordId: string;
        recordUid?: string;
        leadId?: string | null;
        legacyLeadId?: string;
        requestedByProfileId?: string | null;
        clientName: string;
        amount?: string;
        status: "UNDER_PROCESS" | "ACCEPTED" | "REJECTED";
        decidedAt?: string;
      }) {
        const type: "VOUCHER" | "REFUND" = input.kind === "voucher" ? "VOUCHER" : "REFUND";
        const stableLegacyId = input.explicitLegacyId ?? `finance:${input.kind}:${input.legacyRecordId}`;
        let matches = organizationApprovals.filter((approval) => approval.legacyMongoId === stableLegacyId);
        if (!matches.length && !input.explicitLegacyId) {
          matches = organizationApprovals.filter((approval) => {
            if (approval.type !== type) return false;
            const payload = recordPayload(approval.payload);
            if (input.kind === "voucher") {
              return payload.voucherId === input.recordId
                || (input.recordUid && typeof payload.uid === "string" && payload.uid.toLowerCase() === input.recordUid.toLowerCase());
            }
            return payload.refundId === input.recordId
              || (
                input.legacyLeadId
                && payload.leadId === input.legacyLeadId
                && comparableMoney(payload.amount) === input.amount
                && staffLookupKey(String(payload.clientName ?? "")) === staffLookupKey(input.clientName)
              );
          });
        }
        if (matches.length > 1) throw new Error(`Multiple ${input.kind} approvals match ${input.legacyRecordId}.`);
        const existing = matches[0];
        if (existing && claimedApprovalIds.has(existing.id)) {
          throw new Error(`Approval ${existing.legacyMongoId ?? existing.id} matches multiple finance records.`);
        }
        if (existing) claimedApprovalIds.add(existing.id);
        const id = existing?.id ?? randomUUID();
        const previousPayload = recordPayload(existing?.payload);
        const relatedPayload = input.kind === "voucher"
          ? { voucherId: input.recordId }
          : { refundId: input.recordId, leadId: input.leadId ?? null };
        const payload = {
          ...previousPayload,
          ...relatedPayload,
          uid: input.recordUid ?? null,
          clientName: input.clientName,
          amount: input.amount ?? null,
          legacySourceId: input.legacyRecordId,
        };
        const commonData = {
          leadId: input.kind === "refund" ? input.leadId ?? null : undefined,
          requestedByProfileId: existing?.requestedByProfileId ?? input.requestedByProfileId ?? null,
          type,
          status: input.status,
          payload,
          decidedAt: input.status === "UNDER_PROCESS"
            ? null
            : new Date(input.decidedAt ?? new Date().toISOString()),
        };
        if (existing) {
          await transaction.approval.update({ where: { id: existing.id }, data: commonData });
        } else {
          await transaction.approval.create({ data: {
            id, organizationId, legacyMongoId: stableLegacyId,
            uid: approvalUidFromId(id),
            title: `${input.kind === "voucher" ? "Voucher" : "Refund"} ${input.recordUid ?? input.legacyRecordId}`,
            description: `Migrated ${input.kind} approval for ${input.clientName}.`,
            ...commonData,
          } });
        }
        increment(counts, "approvals", Boolean(existing));
      }

      for (const item of plan.vouchers) {
        await reconcileApproval({
          kind: "voucher", legacyRecordId: item.legacyMongoId,
          explicitLegacyId: item.approvalLegacyMongoId, recordId: voucherIds.get(item.legacyMongoId)!,
          recordUid: item.uid, requestedByProfileId: item.allocatedToLegacyProfileId ? profileIds.get(item.allocatedToLegacyProfileId)! : null,
          clientName: item.clientName ?? "Unknown client", amount: item.total,
          status: item.status, decidedAt: item.updatedAt ?? item.createdAt,
        });
      }
      for (const item of plan.refunds) {
        await reconcileApproval({
          kind: "refund", legacyRecordId: item.legacyMongoId,
          explicitLegacyId: item.approvalLegacyMongoId, recordId: refundIds.get(item.legacyMongoId)!,
          recordUid: item.uid,
          leadId: item.leadLegacyMongoId ? leadIds.get(item.leadLegacyMongoId)! : null,
          legacyLeadId: item.leadLegacyMongoId,
          requestedByProfileId: item.requestedByLegacyProfileId ? profileIds.get(item.requestedByLegacyProfileId)! : null,
          clientName: item.clientName, amount: item.amount,
          status: item.status, decidedAt: item.decidedAt ?? item.updatedAt ?? item.createdAt,
        });
      }

      const affectedRefundLeadIds = [...new Set(plan.refunds.flatMap((item) =>
        item.leadLegacyMongoId ? [leadIds.get(item.leadLegacyMongoId)!] : []))];
      if (affectedRefundLeadIds.length) {
        await transaction.lead.updateMany({
          where: { organizationId: organization.id, id: { in: affectedRefundLeadIds } },
          data: { refundRequested: false },
        });
        const pendingRefunds = await transaction.refund.findMany({
          where: { organizationId: organization.id, leadId: { in: affectedRefundLeadIds }, status: "UNDER_PROCESS" },
          select: { leadId: true },
        });
        const pendingLeadIds = [...new Set(pendingRefunds.flatMap((item) => item.leadId ? [item.leadId] : []))];
        if (pendingLeadIds.length) {
          await transaction.lead.updateMany({
            where: { organizationId: organization.id, id: { in: pendingLeadIds } },
            data: { refundRequested: true },
          });
        }
      }

      const [saleTotals, cashTotals, voucherTotals, refundTotals, payrollTotals] = await Promise.all([
        transaction.sale.aggregate({ where: { organizationId: organization.id, legacyMongoId: { in: legacyIds.sales } }, _sum: { netPrice: true, receivedAmount: true, profit: true } }),
        transaction.cashbookEntry.groupBy({ by: ["direction"], where: { organizationId: organization.id, legacyMongoId: { in: legacyIds.cashbookEntries } }, _sum: { amount: true } }),
        transaction.voucher.aggregate({ where: { organizationId: organization.id, legacyMongoId: { in: legacyIds.vouchers } }, _sum: { total: true, paid: true, remaining: true } }),
        transaction.refund.aggregate({ where: { organizationId: organization.id, legacyMongoId: { in: legacyIds.refunds } }, _sum: { amount: true } }),
        transaction.payrollTranscript.aggregate({ where: { organizationId: organization.id, legacyMongoId: { in: legacyIds.payrollTranscripts } }, _sum: { totalSalary: true, netSalary: true } }),
      ]);
      reconciledTotals = {
        salesNetPrice: decimalTotal(saleTotals._sum.netPrice),
        salesReceivedAmount: decimalTotal(saleTotals._sum.receivedAmount),
        salesProfit: decimalTotal(saleTotals._sum.profit),
        cashIn: decimalTotal(cashTotals.find((item) => item.direction === "IN")?._sum.amount),
        cashOut: decimalTotal(cashTotals.find((item) => item.direction === "OUT")?._sum.amount),
        voucherTotal: decimalTotal(voucherTotals._sum.total),
        voucherPaid: decimalTotal(voucherTotals._sum.paid),
        voucherRemaining: decimalTotal(voucherTotals._sum.remaining),
        refundAmount: decimalTotal(refundTotals._sum.amount),
        payrollGross: decimalTotal(payrollTotals._sum.totalSalary),
        payrollNet: decimalTotal(payrollTotals._sum.netSalary),
      };
      for (const key of Object.keys(plan.totals) as Array<keyof FinanceTotals>) {
        if (reconciledTotals[key] !== plan.totals[key]) {
          throw new Error(`Finance total reconciliation failed for ${key}: expected ${plan.totals[key]}, stored ${reconciledTotals[key]}.`);
        }
      }

      await transaction.auditLog.create({ data: {
        organizationId: organization.id, action: "migration.stage6_applied",
        entityType: "Organization", entityId: organization.id,
        metadata: { sourceCounts: plan.sourceCounts, appliedCounts: counts, totals: reconciledTotals, warningCount: plan.warnings.length },
      } });
    }, { maxWait: 10_000, timeout: 300_000 });

    return { organization, counts, reconciledTotals: reconciledTotals! };
  } finally {
    await database.$disconnect();
  }
}

function defaultReportPath() {
  const timestamp = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
  return path.resolve("migration-reports", `stage6-${timestamp}.json`);
}

async function main() {
  const arguments_ = parseArguments(process.argv.slice(2));
  const inputDirectory = path.resolve(arguments_.input!);
  const reportPath = path.resolve(arguments_.report ?? defaultReportPath());
  const input = await readInput(inputDirectory);
  const plan = buildStage6Plan(input.collections, input.options);
  plan.warnings.unshift(...input.warnings);
  if (arguments_.apply && plan.rejected.length) {
    throw new Error(`Refusing to apply ${plan.rejected.length} rejected record(s). Run the dry-run and fix the export first.`);
  }
  const application = arguments_.apply ? await applyPlan(plan, arguments_.organization!) : undefined;
  const report = {
    generatedAt: new Date().toISOString(), mode: arguments_.apply ? "apply" : "dry-run",
    inputDirectory, organization: application?.organization ?? arguments_.organization ?? null,
    sourceCounts: plan.sourceCounts,
    acceptedCounts: {
      sales: plan.sales.length, cashbookEntries: plan.cashbookEntries.length,
      vouchers: plan.vouchers.length, refunds: plan.refunds.length,
      deductionPolicies: plan.deductionPolicies.length,
      payrollTranscripts: plan.payrollTranscripts.length,
      reconciledApprovals: plan.vouchers.length + plan.refunds.length,
    },
    sourceTotals: plan.totals,
    databaseTotals: application?.reconciledTotals ?? null,
    appliedCounts: application?.counts ?? null,
    rejected: plan.rejected, warnings: plan.warnings,
  };
  await mkdir(path.dirname(reportPath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  process.stdout.write(`${report.mode}: ${plan.rejected.length} rejected, ${plan.warnings.length} warning(s).\nReport: ${reportPath}\n`);
  if (!arguments_.apply && plan.rejected.length) process.exitCode = 2;
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});

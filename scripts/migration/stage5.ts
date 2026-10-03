import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { Prisma } from "../../src/generated/prisma/client";

import {
  buildStage5Plan,
  mongoId,
  parseMongoExport,
  type MongoDocument,
  type Stage5Plan,
} from "./legacy-stage5";

const WORK_COLLECTIONS = ["tasks", "events", "approvals", "notifications"] as const;
const REFERENCE_COLLECTIONS = ["users", "employees", "leads"] as const;
type WorkCollection = (typeof WORK_COLLECTIONS)[number];
type ReferenceCollection = (typeof REFERENCE_COLLECTIONS)[number];

type Arguments = { apply: boolean; input?: string; organization?: string; report?: string };
type ApplyCounts = Record<"tasks" | "calendarEvents" | "approvals" | "notifications", { created: number; updated: number }>;

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

async function readOptionalCollection(inputDirectory: string, collection: string) {
  const filename = path.join(inputDirectory, `${collection}.json`);
  try {
    return { documents: parseMongoExport(await readFile(filename, "utf8")), found: true };
  } catch (error) {
    const code = error instanceof Error && "code" in error ? (error as NodeJS.ErrnoException).code : undefined;
    if (code === "ENOENT") return { documents: [] as MongoDocument[], found: false };
    throw new Error(`Could not read ${filename}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function readInput(inputDirectory: string) {
  const collections: Partial<Record<WorkCollection, MongoDocument[]>> = {};
  const references: Partial<Record<ReferenceCollection, MongoDocument[]>> = {};
  const warnings: string[] = [];
  let workFiles = 0;
  const referenceFilesFound = new Set<string>();
  for (const collection of WORK_COLLECTIONS) {
    const result = await readOptionalCollection(inputDirectory, collection);
    collections[collection] = result.documents;
    if (result.found) workFiles += 1;
    else warnings.push(`${collection}.json was not supplied; treating it as empty.`);
  }
  for (const collection of REFERENCE_COLLECTIONS) {
    const result = await readOptionalCollection(inputDirectory, collection);
    references[collection] = result.documents;
    if (result.found) referenceFilesFound.add(collection);
  }
  if (workFiles === 0) throw new Error(`No Stage 5 export files were found in ${inputDirectory}.`);
  const identityFilesSupplied = referenceFilesFound.has("users") || referenceFilesFound.has("employees");
  const leadFileSupplied = referenceFilesFound.has("leads");
  const knownProfileLegacyIds = identityFilesSupplied
    ? new Set([...(references.users ?? []), ...(references.employees ?? [])].map((item) => mongoId(item._id)).filter((id): id is string => Boolean(id)))
    : undefined;
  const knownLeadLegacyIds = leadFileSupplied
    ? new Set((references.leads ?? []).map((item) => mongoId(item._id)).filter((id): id is string => Boolean(id)))
    : undefined;
  return { collections, warnings, knownProfileLegacyIds, knownLeadLegacyIds };
}

function emptyCounts(): ApplyCounts {
  return {
    tasks: { created: 0, updated: 0 }, calendarEvents: { created: 0, updated: 0 },
    approvals: { created: 0, updated: 0 }, notifications: { created: 0, updated: 0 },
  };
}

function increment(counts: ApplyCounts, collection: keyof ApplyCounts, existed: boolean) {
  counts[collection][existed ? "updated" : "created"] += 1;
}

async function applyPlan(plan: Stage5Plan, organizationSlug: string) {
  const { getDatabase } = await import("../../src/lib/database");
  const database = getDatabase();
  try {
    const organization = await database.organization.findUnique({ where: { slug: organizationSlug }, select: { id: true, name: true, slug: true } });
    if (!organization) throw new Error(`Organization ${organizationSlug} does not exist.`);
    const counts = emptyCounts();
    await database.$transaction(async (transaction) => {
      const profileLegacyIds = new Set<string>();
      for (const item of plan.tasks) profileLegacyIds.add(item.assignedToLegacyProfileId);
      for (const item of plan.calendarEvents) profileLegacyIds.add(item.ownerLegacyProfileId);
      for (const item of plan.approvals) if (item.requestedByLegacyProfileId) profileLegacyIds.add(item.requestedByLegacyProfileId);
      for (const item of plan.notifications) if (item.recipient.kind === "profile") profileLegacyIds.add(item.recipient.legacyProfileId);
      const profiles = await transaction.profile.findMany({
        where: { legacyMongoId: { in: [...profileLegacyIds] }, memberships: { some: { organizationId: organization.id } } },
        select: { id: true, legacyMongoId: true },
      });
      const profileIds = new Map(profiles.flatMap((item) => item.legacyMongoId ? [[item.legacyMongoId, item.id] as const] : []));
      const missingProfiles = [...profileLegacyIds].filter((id) => !profileIds.has(id));
      if (missingProfiles.length) throw new Error(`Missing organization profiles: ${missingProfiles.join(", ")}.`);

      const leadLegacyIds = plan.approvals.flatMap((item) => item.leadLegacyMongoId ? [item.leadLegacyMongoId] : []);
      const leads = await transaction.lead.findMany({ where: { organizationId: organization.id, legacyMongoId: { in: leadLegacyIds } }, select: { id: true, legacyMongoId: true } });
      const leadIds = new Map(leads.flatMap((item) => item.legacyMongoId ? [[item.legacyMongoId, item.id] as const] : []));
      const missingLeads = leadLegacyIds.filter((id) => !leadIds.has(id));
      if (missingLeads.length) throw new Error(`Missing organization leads: ${[...new Set(missingLeads)].join(", ")}.`);

      const managers = await transaction.organizationMembership.findMany({
        where: { organizationId: organization.id, isActive: true, role: { in: ["MANAGER", "SUPER_ADMIN"] }, profile: { isActive: true } },
        orderBy: { profileId: "asc" }, select: { profileId: true },
      });
      if (plan.notifications.some((item) => item.recipient.kind === "management") && !managers.length) {
        throw new Error("Management notifications cannot be imported because the organization has no active manager.");
      }

      const legacyIdsByModel = {
        tasks: plan.tasks.map((item) => item.legacyMongoId),
        calendarEvents: plan.calendarEvents.map((item) => item.legacyMongoId),
        approvals: plan.approvals.map((item) => item.legacyMongoId),
      };
      const [existingTasks, existingEvents, existingApprovals] = await Promise.all([
        transaction.task.findMany({ where: { legacyMongoId: { in: legacyIdsByModel.tasks } }, select: { legacyMongoId: true, organizationId: true } }),
        transaction.calendarEvent.findMany({ where: { legacyMongoId: { in: legacyIdsByModel.calendarEvents } }, select: { legacyMongoId: true, organizationId: true } }),
        transaction.approval.findMany({ where: { legacyMongoId: { in: legacyIdsByModel.approvals } }, select: { legacyMongoId: true, organizationId: true } }),
      ]);
      for (const [label, records] of [["task", existingTasks], ["calendar event", existingEvents], ["approval", existingApprovals]] as const) {
        const collision = records.find((item) => item.organizationId !== organization.id);
        if (collision) throw new Error(`${label} ${collision.legacyMongoId} already belongs to another organization.`);
      }
      const existingTaskIds = new Set(existingTasks.map((item) => item.legacyMongoId));
      const existingEventIds = new Set(existingEvents.map((item) => item.legacyMongoId));
      const existingApprovalIds = new Set(existingApprovals.map((item) => item.legacyMongoId));
      const taskIds = new Map<string, string>();
      const approvalIds = new Map<string, string>();

      for (const item of plan.tasks) {
        const assignedToProfileId = profileIds.get(item.assignedToLegacyProfileId)!;
        const data = {
          assignedToProfileId, uid: item.uid ?? null, title: item.title, description: item.description ?? null,
          dueAt: item.dueAt ? new Date(item.dueAt) : null, status: item.status, outcome: item.outcome ?? null,
          outcomeComment: item.outcomeComment ?? null, completedAt: item.completedAt ? new Date(item.completedAt) : null,
          legacyPayload: item.legacyPayload as Prisma.InputJsonValue, isArchived: item.isArchived,
          ...(item.updatedAt ? { updatedAt: new Date(item.updatedAt) } : {}),
        };
        const task = await transaction.task.upsert({
          where: { legacyMongoId: item.legacyMongoId },
          create: { organizationId: organization.id, legacyMongoId: item.legacyMongoId, createdByProfileId: null, ...data, ...(item.createdAt ? { createdAt: new Date(item.createdAt) } : {}) },
          update: data, select: { id: true },
        });
        taskIds.set(item.legacyMongoId, task.id);
        increment(counts, "tasks", existingTaskIds.has(item.legacyMongoId));
      }

      for (const item of plan.calendarEvents) {
        const data = {
          ownerProfileId: profileIds.get(item.ownerLegacyProfileId)!, uid: item.uid ?? null,
          title: item.title, description: item.description ?? null,
          startsAt: new Date(item.startsAt), endsAt: new Date(item.endsAt),
          ...(item.updatedAt ? { updatedAt: new Date(item.updatedAt) } : {}),
        };
        await transaction.calendarEvent.upsert({
          where: { legacyMongoId: item.legacyMongoId },
          create: { organizationId: organization.id, legacyMongoId: item.legacyMongoId, ...data, ...(item.createdAt ? { createdAt: new Date(item.createdAt) } : {}) },
          update: data,
        });
        increment(counts, "calendarEvents", existingEventIds.has(item.legacyMongoId));
      }

      for (const item of plan.approvals) {
        const data = {
          leadId: item.leadLegacyMongoId ? leadIds.get(item.leadLegacyMongoId)! : null,
          requestedByProfileId: item.requestedByLegacyProfileId ? profileIds.get(item.requestedByLegacyProfileId)! : null,
          uid: item.uid ?? null, title: item.title ?? null, description: item.description,
          dueAt: item.dueAt ? new Date(item.dueAt) : null, type: item.type, status: item.status,
          payload: item.payload as Prisma.InputJsonValue | undefined, decidedAt: item.decidedAt ? new Date(item.decidedAt) : null,
          ...(item.updatedAt ? { updatedAt: new Date(item.updatedAt) } : {}),
        };
        const approval = await transaction.approval.upsert({
          where: { legacyMongoId: item.legacyMongoId },
          create: { organizationId: organization.id, legacyMongoId: item.legacyMongoId, ...data, ...(item.createdAt ? { createdAt: new Date(item.createdAt) } : {}) },
          update: data, select: { id: true },
        });
        approvalIds.set(item.legacyMongoId, approval.id);
        increment(counts, "approvals", existingApprovalIds.has(item.legacyMongoId));
      }

      for (const item of plan.notifications) {
        const recipients = item.recipient.kind === "profile"
          ? [profileIds.get(item.recipient.legacyProfileId)!]
          : managers.map(({ profileId }) => profileId);
        for (const [index, recipientProfileId] of recipients.entries()) {
          const expanded = item.recipient.kind === "management";
          const legacyMongoId = expanded ? `${item.legacyMongoId}:${recipientProfileId}` : item.legacyMongoId;
          const uid = expanded && item.uid ? `${item.uid}:${item.legacyMongoId}:${index + 1}` : item.uid;
          const existing = await transaction.notification.findUnique({ where: { legacyMongoId }, select: { organizationId: true } });
          if (existing && existing.organizationId !== organization.id) throw new Error(`notification ${legacyMongoId} already belongs to another organization.`);
          const approvalId = item.approvalLegacyMongoId ? approvalIds.get(item.approvalLegacyMongoId)! : null;
          const taskId = item.taskLegacyMongoId ? taskIds.get(item.taskLegacyMongoId)! : undefined;
          const payload = { ...(item.payload ?? {}), legacySourceId: item.legacyMongoId, ...(approvalId ? { approvalId } : {}), ...(taskId ? { taskId } : {}) };
          const data = {
            recipientProfileId, approvalId, uid: uid ?? null, type: item.type, title: item.title ?? null,
            description: item.description, payload, readAt: item.readAt ? new Date(item.readAt) : null,
          };
          await transaction.notification.upsert({
            where: { legacyMongoId },
            create: { organizationId: organization.id, legacyMongoId, ...data, ...(item.createdAt ? { createdAt: new Date(item.createdAt) } : {}) },
            update: data,
          });
          increment(counts, "notifications", Boolean(existing));
        }
      }

      await transaction.auditLog.create({ data: {
        organizationId: organization.id, action: "migration.stage5_applied", entityType: "Organization", entityId: organization.id,
        metadata: { sourceCounts: plan.sourceCounts, appliedCounts: counts, warningCount: plan.warnings.length },
      } });
    }, { maxWait: 10_000, timeout: 120_000 });
    return { organization, counts };
  } finally {
    await database.$disconnect();
  }
}

function defaultReportPath() {
  const timestamp = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
  return path.resolve("migration-reports", `stage5-${timestamp}.json`);
}

async function main() {
  const arguments_ = parseArguments(process.argv.slice(2));
  const inputDirectory = path.resolve(arguments_.input!);
  const reportPath = path.resolve(arguments_.report ?? defaultReportPath());
  const input = await readInput(inputDirectory);
  const plan = buildStage5Plan(input.collections, {
    knownProfileLegacyIds: input.knownProfileLegacyIds,
    knownLeadLegacyIds: input.knownLeadLegacyIds,
  });
  plan.warnings.unshift(...input.warnings);
  if (arguments_.apply && plan.rejected.length) throw new Error(`Refusing to apply ${plan.rejected.length} rejected record(s). Run the dry-run and fix the export first.`);
  const application = arguments_.apply ? await applyPlan(plan, arguments_.organization!) : undefined;
  const report = {
    generatedAt: new Date().toISOString(), mode: arguments_.apply ? "apply" : "dry-run", inputDirectory,
    organization: application?.organization ?? arguments_.organization ?? null,
    sourceCounts: plan.sourceCounts,
    acceptedCounts: { tasks: plan.tasks.length, calendarEvents: plan.calendarEvents.length, approvals: plan.approvals.length, notificationSources: plan.notifications.length },
    appliedCounts: application?.counts ?? null, rejected: plan.rejected, warnings: plan.warnings,
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

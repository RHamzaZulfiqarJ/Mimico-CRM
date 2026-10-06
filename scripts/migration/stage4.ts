import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { leadUidFromId } from "../../src/features/leads/identifiers";

import {
  buildStage4Plan,
  mongoId,
  parseMongoExport,
  type MongoDocument,
  type Stage4Plan,
} from "./legacy-stage4";

const REFERENCE_COLLECTIONS = ["users", "employees", "projects"] as const;
type ReferenceCollection = (typeof REFERENCE_COLLECTIONS)[number];

type Arguments = {
  apply: boolean;
  input?: string;
  organization?: string;
  report?: string;
};

type ApplyCounts = Record<
  "leads" | "assignments" | "followUps",
  { created: number; updated: number }
>;

function parseArguments(argv: string[]): Arguments {
  const parsed: Arguments = { apply: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--apply") {
      parsed.apply = true;
      continue;
    }
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
  if (parsed.apply && !parsed.organization) {
    throw new Error("--organization is required with --apply.");
  }
  return parsed;
}

async function readOptionalFile(inputDirectory: string, filenames: string[]) {
  for (const filename of filenames) {
    const fullPath = path.join(inputDirectory, filename);
    try {
      return {
        documents: parseMongoExport(await readFile(fullPath, "utf8")),
        found: true,
        filename,
      };
    } catch (error) {
      const code = error instanceof Error && "code" in error
        ? (error as NodeJS.ErrnoException).code
        : undefined;
      if (code !== "ENOENT") {
        throw new Error(`Could not read ${fullPath}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }
  return { documents: [] as MongoDocument[], found: false, filename: filenames[0] };
}

function normalizedRole(value: unknown) {
  return typeof value === "string"
    ? value.trim().toLowerCase().replaceAll(/[^a-z]/g, "")
    : undefined;
}

function isAssignableIdentity(document: MongoDocument, collection: "users" | "employees") {
  const role = normalizedRole(document.role);
  if (collection === "employees" && !role) return true;
  return !role || role === "employee" || role === "manager" || role === "superadmin";
}

function phoneKey(value: string) {
  return value.replaceAll(/\D/g, "") || value.toLowerCase();
}

async function readInput(inputDirectory: string) {
  const warnings: string[] = [];
  const leadsResult = await readOptionalFile(inputDirectory, ["leads.json"]);
  const followUpsResult = await readOptionalFile(inputDirectory, ["followups.json", "followUps.json"]);
  if (!leadsResult.found && !followUpsResult.found) {
    throw new Error(`No Stage 4 export files were found in ${inputDirectory}.`);
  }
  if (!leadsResult.found) warnings.push("leads.json was not supplied; treating it as empty.");
  if (!followUpsResult.found) warnings.push("followups.json was not supplied; treating it as empty.");

  const references: Partial<Record<ReferenceCollection, MongoDocument[]>> = {};
  const referenceFilesFound = new Set<ReferenceCollection>();
  for (const collection of REFERENCE_COLLECTIONS) {
    const result = await readOptionalFile(inputDirectory, [`${collection}.json`]);
    references[collection] = result.documents;
    if (result.found) referenceFilesFound.add(collection);
  }

  const identityFilesSupplied = referenceFilesFound.has("users") || referenceFilesFound.has("employees");
  const identities = [
    ...(references.users ?? []).filter((item) => isAssignableIdentity(item, "users")),
    ...(references.employees ?? []).filter((item) => isAssignableIdentity(item, "employees")),
  ];
  const knownProfileLegacyIds = identityFilesSupplied
    ? new Set(identities.map((item) => mongoId(item._id)).filter((id): id is string => Boolean(id)))
    : undefined;
  const knownClientLegacyIds = referenceFilesFound.has("users")
    ? new Set(
        (references.users ?? [])
          .filter((item) => normalizedRole(item.role) === "client")
          .map((item) => mongoId(item._id))
          .filter((id): id is string => Boolean(id)),
      )
    : undefined;
  const knownProjectLegacyIds = referenceFilesFound.has("projects")
    ? new Set(
        (references.projects ?? [])
          .map((item) => mongoId(item._id))
          .filter((id): id is string => Boolean(id)),
      )
    : undefined;

  return {
    collections: { leads: leadsResult.documents, followUps: followUpsResult.documents },
    options: { knownProfileLegacyIds, knownClientLegacyIds, knownProjectLegacyIds },
    warnings,
  };
}

function emptyCounts(): ApplyCounts {
  return {
    leads: { created: 0, updated: 0 },
    assignments: { created: 0, updated: 0 },
    followUps: { created: 0, updated: 0 },
  };
}

function increment(counts: ApplyCounts, collection: keyof ApplyCounts, existed: boolean) {
  counts[collection][existed ? "updated" : "created"] += 1;
}

async function applyPlan(plan: Stage4Plan, organizationSlug: string) {
  const { getDatabase } = await import("../../src/lib/database");
  const database = getDatabase();

  try {
    const organization = await database.organization.findUnique({
      where: { slug: organizationSlug },
      select: { id: true, name: true, slug: true },
    });
    if (!organization) throw new Error(`Organization ${organizationSlug} does not exist.`);

    const counts = emptyCounts();
    await database.$transaction(async (transaction) => {
      const profileLegacyIds = [...new Set(plan.leads.flatMap((item) => item.assignedLegacyProfileIds))];
      const clientLegacyIds = [...new Set(plan.leads.flatMap((item) => item.clientLegacyMongoId ? [item.clientLegacyMongoId] : []))];
      const projectLegacyIds = [...new Set(plan.leads.flatMap((item) => item.projectLegacyMongoId ? [item.projectLegacyMongoId] : []))];

      const [profiles, clients, projects] = await Promise.all([
        transaction.profile.findMany({
          where: {
            legacyMongoId: { in: profileLegacyIds },
            memberships: {
              some: {
                organizationId: organization.id,
                isActive: true,
                role: { in: ["EMPLOYEE", "MANAGER", "SUPER_ADMIN"] },
              },
            },
          },
          select: { id: true, legacyMongoId: true },
        }),
        transaction.client.findMany({
          where: { organizationId: organization.id, legacyMongoId: { in: clientLegacyIds } },
          select: { id: true, legacyMongoId: true },
        }),
        transaction.project.findMany({
          where: { organizationId: organization.id, legacyMongoId: { in: projectLegacyIds } },
          select: { id: true, legacyMongoId: true },
        }),
      ]);
      const profileIds = new Map(profiles.flatMap((item) => item.legacyMongoId ? [[item.legacyMongoId, item.id] as const] : []));
      const clientIds = new Map(clients.flatMap((item) => item.legacyMongoId ? [[item.legacyMongoId, item.id] as const] : []));
      const projectIds = new Map(projects.flatMap((item) => item.legacyMongoId ? [[item.legacyMongoId, item.id] as const] : []));
      const missingProfiles = profileLegacyIds.filter((id) => !profileIds.has(id));
      const missingClients = clientLegacyIds.filter((id) => !clientIds.has(id));
      const missingProjects = projectLegacyIds.filter((id) => !projectIds.has(id));
      if (missingProfiles.length) throw new Error(`Missing active organization profiles: ${missingProfiles.join(", ")}.`);
      if (missingClients.length) throw new Error(`Missing organization clients: ${missingClients.join(", ")}.`);
      if (missingProjects.length) throw new Error(`Missing organization projects: ${missingProjects.join(", ")}.`);

      const leadLegacyIds = plan.leads.map((item) => item.legacyMongoId);
      const followUpLegacyIds = plan.followUps.map((item) => item.legacyMongoId);
      const leadUids = plan.leads.flatMap((item) => item.uid ? [item.uid] : []);
      const followUpUids = plan.followUps.flatMap((item) => item.uid ? [item.uid] : []);
      const [
        existingLeads,
        existingFollowUps,
        conflictingLeadUids,
        conflictingFollowUpUids,
        existingActivePhones,
      ] = await Promise.all([
        transaction.lead.findMany({
          where: { legacyMongoId: { in: leadLegacyIds } },
          select: { id: true, legacyMongoId: true, organizationId: true },
        }),
        transaction.followUp.findMany({
          where: { legacyMongoId: { in: followUpLegacyIds } },
          select: { legacyMongoId: true, organizationId: true },
        }),
        transaction.lead.findMany({
          where: { organizationId: organization.id, uid: { in: leadUids } },
          select: { uid: true, legacyMongoId: true },
        }),
        transaction.followUp.findMany({
          where: { organizationId: organization.id, uid: { in: followUpUids } },
          select: { uid: true, legacyMongoId: true },
        }),
        transaction.lead.findMany({
          where: {
            organizationId: organization.id,
            isArchived: false,
            clientPhone: { not: null },
          },
          select: { legacyMongoId: true, clientPhone: true },
        }),
      ]);
      const crossOrganizationLead = existingLeads.find((item) => item.organizationId !== organization.id);
      const crossOrganizationFollowUp = existingFollowUps.find((item) => item.organizationId !== organization.id);
      if (crossOrganizationLead) {
        throw new Error(`lead ${crossOrganizationLead.legacyMongoId} already belongs to another organization.`);
      }
      if (crossOrganizationFollowUp) {
        throw new Error(`follow-up ${crossOrganizationFollowUp.legacyMongoId} already belongs to another organization.`);
      }
      for (const record of conflictingLeadUids) {
        const source = plan.leads.find((item) => item.uid === record.uid);
        if (source && record.legacyMongoId !== source.legacyMongoId) {
          throw new Error(`Lead uid ${record.uid} already belongs to another lead in this organization.`);
        }
      }
      for (const record of conflictingFollowUpUids) {
        const source = plan.followUps.find((item) => item.uid === record.uid);
        if (source && record.legacyMongoId !== source.legacyMongoId) {
          throw new Error(`Follow-up uid ${record.uid} already belongs to another follow-up in this organization.`);
        }
      }
      const existingPhoneOwners = new Map<string, Set<string | null>>();
      for (const record of existingActivePhones) {
        if (!record.clientPhone) continue;
        const key = phoneKey(record.clientPhone);
        const owners = existingPhoneOwners.get(key) ?? new Set<string | null>();
        owners.add(record.legacyMongoId);
        existingPhoneOwners.set(key, owners);
      }
      for (const item of plan.leads) {
        if (item.isArchived || !item.clientPhone) continue;
        const owners = existingPhoneOwners.get(phoneKey(item.clientPhone));
        if (owners && [...owners].some((owner) => owner !== item.legacyMongoId)) {
          throw new Error(`Active lead phone ${item.clientPhone} already belongs to another lead in this organization.`);
        }
      }

      const existingLeadIds = new Set(existingLeads.map((item) => item.legacyMongoId));
      const existingFollowUpIds = new Set(existingFollowUps.map((item) => item.legacyMongoId));
      const leadIds = new Map<string, string>();

      for (const item of plan.leads) {
        const existing = existingLeads.find((record) => record.legacyMongoId === item.legacyMongoId);
        const id = existing?.id ?? randomUUID();
        const stableUid = item.uid ?? leadUidFromId(id);
        const commonData = {
          clientId: item.clientLegacyMongoId ? clientIds.get(item.clientLegacyMongoId)! : null,
          projectId: item.projectLegacyMongoId ? projectIds.get(item.projectLegacyMongoId)! : null,
          clientName: item.clientName ?? null,
          clientPhone: item.clientPhone ?? null,
          area: item.area ?? null,
          city: item.city ?? null,
          priority: item.priority,
          stage: item.stage,
          source: item.source ?? null,
          description: item.description ?? null,
          isArchived: item.isArchived,
          refundRequested: item.refundRequested,
          ...(item.updatedAt ? { updatedAt: new Date(item.updatedAt) } : {}),
        };
        const lead = await transaction.lead.upsert({
          where: { legacyMongoId: item.legacyMongoId },
          create: {
            id,
            organizationId: organization.id,
            legacyMongoId: item.legacyMongoId,
            createdByProfileId: null,
            uid: stableUid,
            ...commonData,
            ...(item.createdAt ? { createdAt: new Date(item.createdAt) } : {}),
          },
          update: {
            ...commonData,
            ...(item.uid ? { uid: item.uid } : {}),
          },
          select: { id: true },
        });
        leadIds.set(item.legacyMongoId, lead.id);
        increment(counts, "leads", existingLeadIds.has(item.legacyMongoId));
      }

      const assignmentData = plan.leads.flatMap((lead) =>
        lead.assignedLegacyProfileIds.map((profileLegacyId) => ({
          organizationId: organization.id,
          leadId: leadIds.get(lead.legacyMongoId)!,
          profileId: profileIds.get(profileLegacyId)!,
          assignedByProfileId: null,
          ...(lead.createdAt ? { assignedAt: new Date(lead.createdAt) } : {}),
        })),
      );
      const leadIdsForAssignments = [...new Set(assignmentData.map((item) => item.leadId))];
      const existingAssignments = await transaction.leadAssignment.findMany({
        where: { organizationId: organization.id, leadId: { in: leadIdsForAssignments } },
        select: { leadId: true, profileId: true },
      });
      const existingAssignmentKeys = new Set(
        existingAssignments.map((item) => `${item.leadId}:${item.profileId}`),
      );
      for (const item of assignmentData) {
        increment(counts, "assignments", existingAssignmentKeys.has(`${item.leadId}:${item.profileId}`));
      }
      if (assignmentData.length) {
        await transaction.leadAssignment.createMany({ data: assignmentData, skipDuplicates: true });
      }

      for (const item of plan.followUps) {
        const commonData = {
          leadId: leadIds.get(item.leadLegacyMongoId)!,
          stage: item.stage,
          followUpAt: item.followUpAt ? new Date(item.followUpAt) : null,
          remarks: item.remarks ?? null,
          ...(item.updatedAt ? { updatedAt: new Date(item.updatedAt) } : {}),
        };
        await transaction.followUp.upsert({
          where: { legacyMongoId: item.legacyMongoId },
          create: {
            organizationId: organization.id,
            legacyMongoId: item.legacyMongoId,
            createdByProfileId: null,
            uid: item.uid ?? null,
            ...commonData,
            ...(item.createdAt ? { createdAt: new Date(item.createdAt) } : {}),
          },
          update: {
            ...commonData,
            ...(item.uid ? { uid: item.uid } : {}),
          },
        });
        increment(counts, "followUps", existingFollowUpIds.has(item.legacyMongoId));
      }

      await transaction.auditLog.create({
        data: {
          organizationId: organization.id,
          action: "migration.stage4_applied",
          entityType: "Organization",
          entityId: organization.id,
          metadata: {
            sourceCounts: plan.sourceCounts,
            appliedCounts: counts,
            warningCount: plan.warnings.length,
            storageObjectCount: plan.storageManifest.length,
          },
        },
      });
    }, { maxWait: 10_000, timeout: 300_000 });

    return { organization, counts };
  } finally {
    await database.$disconnect();
  }
}

function defaultReportPath() {
  const timestamp = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
  return path.resolve("migration-reports", `stage4-${timestamp}.json`);
}

async function main() {
  const arguments_ = parseArguments(process.argv.slice(2));
  const inputDirectory = path.resolve(arguments_.input!);
  const reportPath = path.resolve(arguments_.report ?? defaultReportPath());
  const input = await readInput(inputDirectory);
  const plan = buildStage4Plan(input.collections, input.options);
  plan.warnings.unshift(...input.warnings);

  if (arguments_.apply && plan.rejected.length) {
    throw new Error(
      `Refusing to apply ${plan.rejected.length} rejected record(s). Run the dry-run and fix the export first.`,
    );
  }

  const application = arguments_.apply
    ? await applyPlan(plan, arguments_.organization!)
    : undefined;
  const report = {
    generatedAt: new Date().toISOString(),
    mode: arguments_.apply ? "apply" : "dry-run",
    inputDirectory,
    organization: application?.organization ?? arguments_.organization ?? null,
    sourceCounts: plan.sourceCounts,
    acceptedCounts: {
      leads: plan.leads.length,
      assignments: plan.leads.reduce((total, item) => total + item.assignedLegacyProfileIds.length, 0),
      followUps: plan.followUps.length,
      storageObjects: plan.storageManifest.length,
    },
    appliedCounts: application?.counts ?? null,
    rejected: plan.rejected,
    warnings: plan.warnings,
    storageManifest: plan.storageManifest,
  };

  await mkdir(path.dirname(reportPath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  process.stdout.write(
    `${report.mode}: ${plan.rejected.length} rejected, ${plan.warnings.length} warning(s).\nReport: ${reportPath}\n`,
  );
  if (!arguments_.apply && plan.rejected.length) process.exitCode = 2;
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});

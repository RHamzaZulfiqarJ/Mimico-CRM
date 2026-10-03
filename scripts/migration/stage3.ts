import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  buildStage3Plan,
  parseMongoExport,
  type MongoDocument,
  type Stage3Plan,
} from "./legacy-stage3";

const COLLECTIONS = [
  "users",
  "employees",
  "societies",
  "projects",
  "inventories",
] as const;

type CollectionName = (typeof COLLECTIONS)[number];

type Arguments = {
  apply: boolean;
  input?: string;
  organization?: string;
  report?: string;
};

type ApplyCounts = Record<
  "profiles" | "memberships" | "clients" | "societies" | "projects" | "inventories",
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
      if (!value || value.startsWith("--")) {
        throw new Error(`${argument} requires a value.`);
      }
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

async function readCollections(inputDirectory: string) {
  const collections: Partial<Record<CollectionName, MongoDocument[]>> = {};
  const warnings: string[] = [];
  let filesFound = 0;

  for (const collection of COLLECTIONS) {
    const filename = path.join(inputDirectory, `${collection}.json`);
    try {
      collections[collection] = parseMongoExport(await readFile(filename, "utf8"));
      filesFound += 1;
    } catch (error) {
      const code = error instanceof Error && "code" in error
        ? (error as NodeJS.ErrnoException).code
        : undefined;
      if (code === "ENOENT") {
        collections[collection] = [];
        warnings.push(`${collection}.json was not supplied; treating it as empty.`);
        continue;
      }
      throw new Error(`Could not read ${filename}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (filesFound === 0) {
    throw new Error(`No supported export files were found in ${inputDirectory}.`);
  }

  return { collections, warnings };
}

function emptyApplyCounts(): ApplyCounts {
  return {
    profiles: { created: 0, updated: 0 },
    memberships: { created: 0, updated: 0 },
    clients: { created: 0, updated: 0 },
    societies: { created: 0, updated: 0 },
    projects: { created: 0, updated: 0 },
    inventories: { created: 0, updated: 0 },
  };
}

function increment(
  counts: ApplyCounts,
  collection: keyof ApplyCounts,
  existed: boolean,
) {
  counts[collection][existed ? "updated" : "created"] += 1;
}

async function applyPlan(plan: Stage3Plan, organizationSlug: string) {
  const { getDatabase } = await import("../../src/lib/database");
  const database = getDatabase();

  try {
    const organization = await database.organization.findUnique({
      where: { slug: organizationSlug },
      select: { id: true, name: true, slug: true },
    });
    if (!organization) {
      throw new Error(`Organization ${organizationSlug} does not exist.`);
    }

    const counts = emptyApplyCounts();
    await database.$transaction(async (transaction) => {
      const profileLegacyIds = plan.profiles.map((item) => item.legacyMongoId);
      const societyLegacyIds = plan.societies.map((item) => item.legacyMongoId);
      const projectLegacyIds = plan.projects.map((item) => item.legacyMongoId);
      const inventoryLegacyIds = plan.inventories.map((item) => item.legacyMongoId);
      const clientLegacyIds = plan.profiles
        .filter((item) => item.client)
        .map((item) => item.legacyMongoId);

      const [existingProfiles, existingMemberships, existingClients, existingSocieties, existingProjects, existingInventories] = await Promise.all([
        transaction.profile.findMany({
          where: { legacyMongoId: { in: profileLegacyIds } },
          select: { id: true, legacyMongoId: true },
        }),
        transaction.organizationMembership.findMany({
          where: {
            organizationId: organization.id,
            profile: { legacyMongoId: { in: profileLegacyIds } },
          },
          select: { profile: { select: { legacyMongoId: true } } },
        }),
        transaction.client.findMany({
          where: { legacyMongoId: { in: clientLegacyIds } },
          select: { legacyMongoId: true, organizationId: true },
        }),
        transaction.society.findMany({
          where: { legacyMongoId: { in: societyLegacyIds } },
          select: { legacyMongoId: true, organizationId: true },
        }),
        transaction.project.findMany({
          where: { legacyMongoId: { in: projectLegacyIds } },
          select: { legacyMongoId: true, organizationId: true },
        }),
        transaction.inventory.findMany({
          where: { legacyMongoId: { in: inventoryLegacyIds } },
          select: { legacyMongoId: true, organizationId: true },
        }),
      ]);

      for (const [label, records] of [
        ["client", existingClients],
        ["society", existingSocieties],
        ["project", existingProjects],
        ["inventory", existingInventories],
      ] as const) {
        const collision = records.find((record) => record.organizationId !== organization.id);
        if (collision) {
          throw new Error(
            `${label} ${collision.legacyMongoId} already belongs to another organization.`,
          );
        }
      }

      const existingProfileIds = new Set(existingProfiles.map((item) => item.legacyMongoId));
      const existingMembershipIds = new Set(
        existingMemberships.map((item) => item.profile.legacyMongoId),
      );
      const existingClientIds = new Set(existingClients.map((item) => item.legacyMongoId));
      const existingSocietyIds = new Set(existingSocieties.map((item) => item.legacyMongoId));
      const existingProjectIds = new Set(existingProjects.map((item) => item.legacyMongoId));
      const existingInventoryIds = new Set(existingInventories.map((item) => item.legacyMongoId));
      const profileIds = new Map<string, string>();
      const societyIds = new Map<string, string>();
      const projectIds = new Map<string, string>();

      for (const item of plan.profiles) {
        const profile = await transaction.profile.upsert({
          where: { legacyMongoId: item.legacyMongoId },
          create: {
            legacyMongoId: item.legacyMongoId,
            username: item.username ?? null,
            firstName: item.firstName ?? null,
            lastName: item.lastName ?? null,
            email: item.email ?? null,
            phone: item.phone ?? null,
            city: item.city ?? null,
            cnic: item.cnic ?? null,
            isActive: item.isActive,
          },
          update: {
            username: item.username ?? null,
            firstName: item.firstName ?? null,
            lastName: item.lastName ?? null,
            email: item.email ?? null,
            phone: item.phone ?? null,
            city: item.city ?? null,
            cnic: item.cnic ?? null,
            isActive: item.isActive,
          },
          select: { id: true },
        });
        profileIds.set(item.legacyMongoId, profile.id);
        increment(counts, "profiles", existingProfileIds.has(item.legacyMongoId));

        await transaction.organizationMembership.upsert({
          where: {
            organizationId_profileId: {
              organizationId: organization.id,
              profileId: profile.id,
            },
          },
          create: {
            organizationId: organization.id,
            profileId: profile.id,
            role: item.role,
            isActive: item.isActive,
          },
          update: { role: item.role, isActive: item.isActive },
        });
        increment(counts, "memberships", existingMembershipIds.has(item.legacyMongoId));

        if (item.client) {
          await transaction.client.upsert({
            where: { legacyMongoId: item.legacyMongoId },
            create: {
              organizationId: organization.id,
              portalProfileId: profile.id,
              legacyMongoId: item.legacyMongoId,
              uid: item.client.uid ?? null,
              firstName: item.firstName ?? null,
              lastName: item.lastName ?? null,
              displayName: item.client.displayName,
              email: item.client.email ?? null,
              phone: item.client.phone,
              city: item.client.city ?? null,
              cnic: item.client.cnic ?? null,
              isActive: item.isActive,
            },
            update: {
              portalProfileId: profile.id,
              uid: item.client.uid ?? null,
              firstName: item.firstName ?? null,
              lastName: item.lastName ?? null,
              displayName: item.client.displayName,
              email: item.client.email ?? null,
              phone: item.client.phone,
              city: item.client.city ?? null,
              cnic: item.client.cnic ?? null,
              isActive: item.isActive,
            },
          });
          increment(counts, "clients", existingClientIds.has(item.legacyMongoId));
        }
      }

      for (const item of plan.societies) {
        const society = await transaction.society.upsert({
          where: { legacyMongoId: item.legacyMongoId },
          create: { organizationId: organization.id, ...item },
          update: {
            uid: item.uid ?? null,
            title: item.title,
            description: item.description,
            status: item.status,
            isArchived: item.isArchived,
          },
          select: { id: true },
        });
        societyIds.set(item.legacyMongoId, society.id);
        increment(counts, "societies", existingSocietyIds.has(item.legacyMongoId));
      }

      for (const item of plan.projects) {
        const societyId = societyIds.get(item.societyLegacyMongoId);
        if (!societyId) throw new Error(`Society ${item.societyLegacyMongoId} was not applied.`);
        const project = await transaction.project.upsert({
          where: { legacyMongoId: item.legacyMongoId },
          create: {
            organizationId: organization.id,
            societyId,
            legacyMongoId: item.legacyMongoId,
            uid: item.uid ?? null,
            title: item.title,
            description: item.description,
            city: item.city,
            status: item.status,
            isArchived: item.isArchived,
          },
          update: {
            societyId,
            uid: item.uid ?? null,
            title: item.title,
            description: item.description,
            city: item.city,
            status: item.status,
            isArchived: item.isArchived,
          },
          select: { id: true },
        });
        projectIds.set(item.legacyMongoId, project.id);
        increment(counts, "projects", existingProjectIds.has(item.legacyMongoId));
      }

      for (const item of plan.inventories) {
        const projectId = item.projectLegacyMongoId
          ? projectIds.get(item.projectLegacyMongoId)
          : undefined;
        const ownerProfileId = item.ownerLegacyMongoId
          ? profileIds.get(item.ownerLegacyMongoId)
          : undefined;
        const data = {
          projectId: projectId ?? null,
          ownerProfileId: ownerProfileId ?? null,
          uid: item.uid ?? null,
          sellerName: item.sellerName ?? null,
          sellerPhone: item.sellerPhone ?? null,
          sellerEmail: item.sellerEmail ?? null,
          sellerCompanyName: item.sellerCompanyName ?? null,
          sellerCity: item.sellerCity ?? null,
          propertyStreetNumber: item.propertyStreetNumber ?? null,
          propertyNumber: item.propertyNumber ?? null,
          price: item.price ?? null,
          remarks: item.remarks ?? null,
          status: item.status,
          isArchived: item.isArchived,
        };
        await transaction.inventory.upsert({
          where: { legacyMongoId: item.legacyMongoId },
          create: {
            organizationId: organization.id,
            legacyMongoId: item.legacyMongoId,
            ...data,
          },
          update: data,
        });
        increment(counts, "inventories", existingInventoryIds.has(item.legacyMongoId));
      }

      await transaction.auditLog.create({
        data: {
          organizationId: organization.id,
          action: "migration.stage3_applied",
          entityType: "Organization",
          entityId: organization.id,
          metadata: {
            sourceCounts: plan.sourceCounts,
            appliedCounts: counts,
            warningCount: plan.warnings.length,
          },
        },
      });
    }, { maxWait: 10_000, timeout: 120_000 });

    return { organization, counts };
  } finally {
    await database.$disconnect();
  }
}

function defaultReportPath() {
  const timestamp = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
  return path.resolve("migration-reports", `stage3-${timestamp}.json`);
}

async function main() {
  const arguments_ = parseArguments(process.argv.slice(2));
  const inputDirectory = path.resolve(arguments_.input!);
  const reportPath = path.resolve(arguments_.report ?? defaultReportPath());
  const { collections, warnings } = await readCollections(inputDirectory);
  const plan = buildStage3Plan(collections);
  plan.warnings.unshift(...warnings);

  if (arguments_.apply && plan.rejected.length > 0) {
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
      profiles: plan.profiles.length,
      memberships: plan.profiles.length,
      clients: plan.profiles.filter((item) => item.client).length,
      societies: plan.societies.length,
      projects: plan.projects.length,
      inventories: plan.inventories.length,
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
  if (!arguments_.apply && plan.rejected.length > 0) process.exitCode = 2;
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});

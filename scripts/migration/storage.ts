import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  attachmentBucket,
  attachmentMaxBytes,
  attachmentMimeTypes,
} from "../../src/features/attachments/policy";
import {
  buildStoragePlan,
  parseStorageManifestReport,
  type PlannedStorageObject,
  type StoragePlan,
} from "./legacy-storage";

type Arguments = {
  apply: boolean;
  manifests: string[];
  sourceRoot?: string;
  organization?: string;
  output?: string;
};

type ApplyCounts = {
  storageObjects: { uploaded: number; reused: number };
  attachments: { created: number; updated: number };
};

function parseArguments(argv: string[]): Arguments {
  const parsed: Arguments = { apply: false, manifests: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--apply") {
      parsed.apply = true;
      continue;
    }
    if (["--manifest", "--source-root", "--organization", "--output"].includes(argument)) {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) throw new Error(`${argument} requires a value.`);
      index += 1;
      if (argument === "--manifest") parsed.manifests.push(value);
      if (argument === "--source-root") parsed.sourceRoot = value;
      if (argument === "--organization") parsed.organization = value;
      if (argument === "--output") parsed.output = value;
      continue;
    }
    throw new Error(`Unknown argument: ${argument}`);
  }
  if (!parsed.manifests.length) throw new Error("At least one --manifest is required.");
  if (!parsed.sourceRoot) throw new Error("--source-root is required.");
  if (parsed.apply && !parsed.organization) {
    throw new Error("--organization is required with --apply.");
  }
  return parsed;
}

async function readManifests(manifestPaths: string[]) {
  return Promise.all(manifestPaths.map(async (manifestPath) => {
    const resolvedPath = path.resolve(manifestPath);
    try {
      return parseStorageManifestReport(await readFile(resolvedPath, "utf8"), resolvedPath);
    } catch (error) {
      throw new Error(
        `Could not read manifest ${resolvedPath}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }));
}

async function verifyLocalFiles(plan: StoragePlan) {
  for (const item of plan.objects) {
    const bytes = await readFile(item.sourcePath);
    const hash = createHash("sha256").update(bytes).digest("hex");
    if (bytes.byteLength !== item.sizeBytes || hash !== item.sha256) {
      throw new Error(`Source file changed after validation: ${item.sourcePath}`);
    }
  }
}

async function ensureAttachmentBucket() {
  const { createAdminClient } = await import("../../src/lib/supabase/admin");
  const admin = createAdminClient();
  const existing = await admin.storage.getBucket(attachmentBucket);
  if (existing.data) {
    const allowed = [...(existing.data.allowed_mime_types ?? [])].sort();
    const expected = [...attachmentMimeTypes].sort();
    if (
      existing.data.public
      || existing.data.file_size_limit !== attachmentMaxBytes
      || allowed.join("|") !== expected.join("|")
    ) {
      const updated = await admin.storage.updateBucket(attachmentBucket, {
        public: false,
        fileSizeLimit: attachmentMaxBytes,
        allowedMimeTypes: [...attachmentMimeTypes],
      });
      if (updated.error) throw updated.error;
    }
    return admin;
  }
  const created = await admin.storage.createBucket(attachmentBucket, {
    public: false,
    fileSizeLimit: attachmentMaxBytes,
    allowedMimeTypes: [...attachmentMimeTypes],
  });
  if (created.error) {
    const raced = await admin.storage.getBucket(attachmentBucket);
    if (!raced.data) throw created.error;
  }
  return admin;
}

async function remoteMatches(
  admin: Awaited<ReturnType<typeof ensureAttachmentBucket>>,
  item: PlannedStorageObject,
) {
  const downloaded = await admin.storage.from(item.targetBucket).download(item.targetObjectPath);
  if (downloaded.error || !downloaded.data) return false;
  const bytes = Buffer.from(await downloaded.data.arrayBuffer());
  const hash = createHash("sha256").update(bytes).digest("hex");
  if (bytes.byteLength !== item.sizeBytes || hash !== item.sha256) {
    throw new Error(`Storage object differs from the source file: ${item.targetObjectPath}`);
  }
  return true;
}

async function ensureRemoteObject(
  admin: Awaited<ReturnType<typeof ensureAttachmentBucket>>,
  item: PlannedStorageObject,
) {
  if (await remoteMatches(admin, item)) return "reused" as const;
  const bytes = await readFile(item.sourcePath);
  const uploaded = await admin.storage.from(item.targetBucket).upload(
    item.targetObjectPath,
    bytes,
    { contentType: item.contentType, upsert: false },
  );
  if (uploaded.error && !(await remoteMatches(admin, item))) throw uploaded.error;
  if (!(await remoteMatches(admin, item))) {
    throw new Error(`Uploaded object could not be verified: ${item.targetObjectPath}`);
  }
  return uploaded.error ? "reused" as const : "uploaded" as const;
}

async function applyPlan(plan: StoragePlan, organizationSlug: string) {
  await verifyLocalFiles(plan);
  const { getDatabase } = await import("../../src/lib/database");
  const database = getDatabase();
  try {
    const organization = await database.organization.findUnique({
      where: { slug: organizationSlug },
      select: { id: true, name: true, slug: true },
    });
    if (!organization) throw new Error(`Organization ${organizationSlug} does not exist.`);

    const leadLegacyIds = [...new Set(plan.objects.flatMap((item) =>
      item.entityType === "Lead" ? [item.entityLegacyMongoId] : []))];
    const societyLegacyIds = [...new Set(plan.objects.flatMap((item) =>
      item.entityType === "Society" ? [item.entityLegacyMongoId] : []))];
    const [leads, societies, existingAttachments] = await Promise.all([
      database.lead.findMany({
        where: { organizationId: organization.id, legacyMongoId: { in: leadLegacyIds } },
        select: { id: true, legacyMongoId: true },
      }),
      database.society.findMany({
        where: { organizationId: organization.id, legacyMongoId: { in: societyLegacyIds } },
        select: { id: true, legacyMongoId: true },
      }),
      database.attachment.findMany({
        where: {
          bucket: attachmentBucket,
          objectPath: { in: plan.objects.map((item) => item.targetObjectPath) },
        },
        select: {
          id: true,
          organizationId: true,
          leadId: true,
          societyId: true,
          objectPath: true,
        },
      }),
    ]);
    const leadIds = new Map(leads.flatMap((item) => item.legacyMongoId
      ? [[item.legacyMongoId, item.id] as const]
      : []));
    const societyIds = new Map(societies.flatMap((item) => item.legacyMongoId
      ? [[item.legacyMongoId, item.id] as const]
      : []));
    const missingLeads = leadLegacyIds.filter((id) => !leadIds.has(id));
    const missingSocieties = societyLegacyIds.filter((id) => !societyIds.has(id));
    if (missingLeads.length) throw new Error(`Missing organization leads: ${missingLeads.join(", ")}.`);
    if (missingSocieties.length) throw new Error(`Missing organization societies: ${missingSocieties.join(", ")}.`);

    const existingByPath = new Map(existingAttachments.map((item) => [item.objectPath, item]));
    for (const item of plan.objects) {
      const existing = existingByPath.get(item.targetObjectPath);
      if (!existing) continue;
      const expectedLeadId = item.entityType === "Lead" ? leadIds.get(item.entityLegacyMongoId)! : null;
      const expectedSocietyId = item.entityType === "Society" ? societyIds.get(item.entityLegacyMongoId)! : null;
      if (
        existing.organizationId !== organization.id
        || existing.leadId !== expectedLeadId
        || existing.societyId !== expectedSocietyId
      ) {
        throw new Error(`Attachment metadata collision: ${item.targetObjectPath}`);
      }
    }

    const counts: ApplyCounts = {
      storageObjects: { uploaded: 0, reused: 0 },
      attachments: { created: 0, updated: 0 },
    };
    const admin = await ensureAttachmentBucket();
    for (const item of plan.objects) {
      const result = await ensureRemoteObject(admin, item);
      counts.storageObjects[result] += 1;
    }

    await database.$transaction(async (transaction) => {
      for (const item of plan.objects) {
        const existing = existingByPath.get(item.targetObjectPath);
        const relation = item.entityType === "Lead"
          ? { leadId: leadIds.get(item.entityLegacyMongoId)!, societyId: null }
          : { leadId: null, societyId: societyIds.get(item.entityLegacyMongoId)! };
        if (existing) {
          await transaction.attachment.update({
            where: { id: existing.id },
            data: {
              legacyPath: item.legacyPath,
              originalName: item.originalName,
              contentType: item.contentType,
              sizeBytes: BigInt(item.sizeBytes),
            },
          });
          counts.attachments.updated += 1;
          continue;
        }
        const attachment = await transaction.attachment.create({
          data: {
            organizationId: organization.id,
            ...relation,
            createdByProfileId: null,
            legacyPath: item.legacyPath,
            bucket: item.targetBucket,
            objectPath: item.targetObjectPath,
            originalName: item.originalName,
            contentType: item.contentType,
            sizeBytes: BigInt(item.sizeBytes),
          },
          select: { id: true },
        });
        await transaction.auditLog.create({
          data: {
            organizationId: organization.id,
            action: "migration.attachment_imported",
            entityType: "Attachment",
            entityId: attachment.id,
            metadata: {
              entityType: item.entityType,
              entityLegacyMongoId: item.entityLegacyMongoId,
              legacyPath: item.legacyPath,
              sha256: item.sha256,
            },
          },
        });
        counts.attachments.created += 1;
      }
      await transaction.auditLog.create({
        data: {
          organizationId: organization.id,
          action: "migration.storage_applied",
          entityType: "Organization",
          entityId: organization.id,
          metadata: { sourceCounts: plan.sourceCounts, appliedCounts: counts },
        },
      });
    }, { maxWait: 10_000, timeout: 120_000 });

    return { organization, counts };
  } finally {
    await database.$disconnect();
  }
}

function defaultOutputPath() {
  const timestamp = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
  return path.resolve("migration-reports", `storage-${timestamp}.json`);
}

async function main() {
  const arguments_ = parseArguments(process.argv.slice(2));
  const manifestSources = await readManifests(arguments_.manifests);
  const sourceRoot = path.resolve(arguments_.sourceRoot!);
  const outputPath = path.resolve(arguments_.output ?? defaultOutputPath());
  const plan = await buildStoragePlan(manifestSources, sourceRoot);
  if (arguments_.apply && plan.rejected.length) {
    throw new Error(
      `Refusing to apply ${plan.rejected.length} rejected storage object(s). Run the dry-run and fix the manifests first.`,
    );
  }
  if (arguments_.apply && !plan.objects.length) {
    throw new Error("Refusing to apply an empty Storage plan.");
  }
  const application = arguments_.apply
    ? await applyPlan(plan, arguments_.organization!)
    : undefined;
  const report = {
    generatedAt: new Date().toISOString(),
    mode: arguments_.apply ? "apply" : "dry-run",
    sourceRoot,
    manifestPaths: manifestSources.map((source) => source.manifestPath),
    organization: application?.organization ?? arguments_.organization ?? null,
    sourceCounts: plan.sourceCounts,
    acceptedCount: plan.objects.length,
    appliedCounts: application?.counts ?? null,
    rejected: plan.rejected,
    warnings: plan.warnings,
    objects: plan.objects,
  };
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  process.stdout.write(
    `${report.mode}: ${plan.objects.length} accepted, ${plan.rejected.length} rejected, ${plan.warnings.length} warning(s).\nReport: ${outputPath}\n`,
  );
  if (!arguments_.apply && plan.rejected.length) process.exitCode = 2;
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});

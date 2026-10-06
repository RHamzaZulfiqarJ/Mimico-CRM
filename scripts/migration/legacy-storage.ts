import { createHash } from "node:crypto";
import { readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";

export type StorageEntityType = "Lead" | "Society";

export type StorageManifestEntry = {
  entityType: StorageEntityType;
  entityLegacyMongoId: string;
  legacyPath: string;
  targetBucket: "crm-attachments";
  targetObjectPath: string;
};

export type PlannedStorageObject = StorageManifestEntry & {
  manifestPath: string;
  sourcePath: string;
  originalName: string;
  contentType: string;
  sizeBytes: number;
  sha256: string;
};

export type StorageRejection = {
  manifestPath: string;
  index: number;
  legacyPath?: string;
  reason: string;
};

export type StoragePlan = {
  objects: PlannedStorageObject[];
  rejected: StorageRejection[];
  warnings: string[];
  sourceCounts: { manifests: number; entries: number };
};

export type ManifestSource = {
  manifestPath: string;
  entries: unknown[];
};

const maxBytes = 10 * 1024 * 1024;
const contentTypesByExtension: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function parseStorageManifestReport(text: string, manifestPath: string): ManifestSource {
  let report: unknown;
  try {
    report = JSON.parse(text);
  } catch {
    throw new Error(`${manifestPath} is not valid JSON.`);
  }
  if (!isRecord(report) || !Array.isArray(report.storageManifest)) {
    throw new Error(`${manifestPath} does not contain a storageManifest array.`);
  }
  return { manifestPath, entries: report.storageManifest };
}

function expectedPrefix(entityType: StorageEntityType, legacyId: string) {
  const collection = entityType === "Lead" ? "leads" : "societies";
  return `legacy/${collection}/${legacyId}/`;
}

function validateEntry(value: unknown): StorageManifestEntry | string {
  if (!isRecord(value)) return "Manifest entry must be an object.";
  const entityType = value.entityType;
  const entityLegacyMongoId = requiredText(value.entityLegacyMongoId);
  const legacyPath = requiredText(value.legacyPath);
  const targetBucket = value.targetBucket;
  const targetObjectPath = requiredText(value.targetObjectPath);
  if (entityType !== "Lead" && entityType !== "Society") {
    return "Unsupported entityType; expected Lead or Society.";
  }
  if (!entityLegacyMongoId || /[\\/]/.test(entityLegacyMongoId)) {
    return "Invalid entityLegacyMongoId.";
  }
  if (!legacyPath) return "Missing legacyPath.";
  if (targetBucket !== "crm-attachments") {
    return "targetBucket must be crm-attachments.";
  }
  if (!targetObjectPath) return "Missing targetObjectPath.";
  if (
    targetObjectPath.startsWith("/")
    || targetObjectPath.includes("\\")
    || targetObjectPath.split("/").some((segment) => !segment || segment === "." || segment === "..")
    || !targetObjectPath.startsWith(expectedPrefix(entityType, entityLegacyMongoId))
  ) {
    return "Unsafe or unexpected targetObjectPath.";
  }
  return {
    entityType,
    entityLegacyMongoId,
    legacyPath,
    targetBucket,
    targetObjectPath,
  };
}

function isInside(root: string, candidate: string) {
  const relative = path.relative(root, candidate);
  return relative !== "" && !relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative);
}

function signatureMatches(extension: string, bytes: Buffer) {
  if (extension === "jpg" || extension === "jpeg") {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (extension === "png") {
    return bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }
  if (extension === "webp") {
    return bytes.subarray(0, 4).toString("ascii") === "RIFF"
      && bytes.subarray(8, 12).toString("ascii") === "WEBP";
  }
  if (extension === "pdf") return bytes.subarray(0, 5).toString("ascii") === "%PDF-";
  if (extension === "doc" || extension === "xls") {
    return bytes.subarray(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]));
  }
  if (extension === "docx" || extension === "xlsx") {
    return bytes.length >= 4
      && bytes[0] === 0x50
      && bytes[1] === 0x4b
      && (
        (bytes[2] === 0x03 && bytes[3] === 0x04)
        || (bytes[2] === 0x05 && bytes[3] === 0x06)
        || (bytes[2] === 0x07 && bytes[3] === 0x08)
      );
  }
  return false;
}

function rejection(
  rejected: StorageRejection[],
  source: ManifestSource,
  index: number,
  value: unknown,
  reason: string,
) {
  rejected.push({
    manifestPath: source.manifestPath,
    index,
    legacyPath: isRecord(value) ? requiredText(value.legacyPath) : undefined,
    reason,
  });
}

export async function buildStoragePlan(
  sources: ManifestSource[],
  sourceRoot: string,
): Promise<StoragePlan> {
  const objects: PlannedStorageObject[] = [];
  const rejected: StorageRejection[] = [];
  const warnings: string[] = [];
  const seenTargets = new Map<string, StorageManifestEntry>();
  let resolvedRoot: string;
  try {
    resolvedRoot = await realpath(sourceRoot);
  } catch {
    throw new Error(`Source root does not exist: ${sourceRoot}`);
  }

  for (const source of sources) {
    for (const [entryIndex, rawEntry] of source.entries.entries()) {
      const index = entryIndex + 1;
      const validated = validateEntry(rawEntry);
      if (typeof validated === "string") {
        rejection(rejected, source, index, rawEntry, validated);
        continue;
      }

      const existingTarget = seenTargets.get(validated.targetObjectPath);
      if (existingTarget) {
        if (
          existingTarget.entityType === validated.entityType
          && existingTarget.entityLegacyMongoId === validated.entityLegacyMongoId
          && existingTarget.legacyPath === validated.legacyPath
        ) {
          warnings.push(`${source.manifestPath}:${index} duplicates an earlier manifest entry and was ignored.`);
        } else {
          rejection(rejected, source, index, rawEntry, `Target object path collides with another entry: ${validated.targetObjectPath}.`);
        }
        continue;
      }
      seenTargets.set(validated.targetObjectPath, validated);

      if (
        /^[a-z][a-z0-9+.-]*:\/\//i.test(validated.legacyPath)
        || /^[a-z]:[\\/]/i.test(validated.legacyPath)
        || /^[\\/]{2}/.test(validated.legacyPath)
      ) {
        rejection(rejected, source, index, rawEntry, "legacyPath must be relative to the source root.");
        continue;
      }
      const relativeLegacyPath = validated.legacyPath.replace(/^[\\/]+/, "");
      const candidatePath = path.resolve(resolvedRoot, relativeLegacyPath);
      if (!isInside(resolvedRoot, candidatePath)) {
        rejection(rejected, source, index, rawEntry, "legacyPath escapes the source root.");
        continue;
      }

      let sourcePath: string;
      try {
        sourcePath = await realpath(candidatePath);
      } catch {
        rejection(rejected, source, index, rawEntry, "Source file does not exist.");
        continue;
      }
      if (!isInside(resolvedRoot, sourcePath)) {
        rejection(rejected, source, index, rawEntry, "Source file resolves outside the source root.");
        continue;
      }
      const fileStat = await stat(sourcePath);
      if (!fileStat.isFile()) {
        rejection(rejected, source, index, rawEntry, "Source path is not a regular file.");
        continue;
      }
      if (fileStat.size <= 0 || fileStat.size > maxBytes) {
        rejection(rejected, source, index, rawEntry, "Source file must be between 1 byte and 10 MB.");
        continue;
      }

      const originalName = validated.legacyPath.split(/[\\/]/).at(-1) ?? "attachment";
      if (originalName.length > 255) {
        rejection(rejected, source, index, rawEntry, "Source filename exceeds 255 characters.");
        continue;
      }
      const extension = originalName.toLowerCase().match(/\.([a-z0-9]{1,10})$/)?.[1] ?? "";
      const contentType = contentTypesByExtension[extension];
      if (!contentType) {
        rejection(rejected, source, index, rawEntry, `Unsupported file extension: .${extension || "unknown"}.`);
        continue;
      }
      const bytes = await readFile(sourcePath);
      if (!signatureMatches(extension, bytes)) {
        rejection(rejected, source, index, rawEntry, `File signature does not match .${extension}.`);
        continue;
      }
      objects.push({
        ...validated,
        manifestPath: source.manifestPath,
        sourcePath,
        originalName,
        contentType,
        sizeBytes: fileStat.size,
        sha256: createHash("sha256").update(bytes).digest("hex"),
      });
    }
  }

  return {
    objects,
    rejected,
    warnings,
    sourceCounts: {
      manifests: sources.length,
      entries: sources.reduce((total, source) => total + source.entries.length, 0),
    },
  };
}

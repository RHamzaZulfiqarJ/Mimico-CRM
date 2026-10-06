import { createHash } from "node:crypto";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { buildStoragePlan, parseStorageManifestReport } from "./legacy-storage";

const temporaryDirectories: string[] = [];

async function temporarySourceRoot() {
  const directory = await mkdtemp(path.join(tmpdir(), "mimico-storage-"));
  temporaryDirectories.push(directory);
  await mkdir(path.join(directory, "uploads"));
  return directory;
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) =>
    rm(directory, { recursive: true, force: true })));
});

describe("legacy Storage planning", () => {
  it("parses a migration report and hashes a verified source file", async () => {
    const root = await temporarySourceRoot();
    const bytes = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.from("legacy-image"),
    ]);
    await writeFile(path.join(root, "uploads", "lead.png"), bytes);
    const source = parseStorageManifestReport(JSON.stringify({ storageManifest: [{
      entityType: "Lead",
      entityLegacyMongoId: "lead-1",
      legacyPath: "/uploads/lead.png",
      targetBucket: "crm-attachments",
      targetObjectPath: "legacy/leads/lead-1/001-lead.png",
    }] }), "stage4.json");

    const plan = await buildStoragePlan([source], root);

    expect(plan.rejected).toEqual([]);
    expect(plan.objects[0]).toMatchObject({
      entityType: "Lead",
      originalName: "lead.png",
      contentType: "image/png",
      sizeBytes: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    });
  });

  it("rejects traversal, missing files, and mismatched file signatures", async () => {
    const root = await temporarySourceRoot();
    await writeFile(path.join(root, "uploads", "fake.pdf"), "not a pdf");
    const entries = [
      {
        entityType: "Society", entityLegacyMongoId: "society-1",
        legacyPath: "../outside.png", targetBucket: "crm-attachments",
        targetObjectPath: "legacy/societies/society-1/001-outside.png",
      },
      {
        entityType: "Society", entityLegacyMongoId: "society-2",
        legacyPath: "uploads/missing.jpg", targetBucket: "crm-attachments",
        targetObjectPath: "legacy/societies/society-2/001-missing.jpg",
      },
      {
        entityType: "Society", entityLegacyMongoId: "society-3",
        legacyPath: "uploads/fake.pdf", targetBucket: "crm-attachments",
        targetObjectPath: "legacy/societies/society-3/001-fake.pdf",
      },
    ];

    const plan = await buildStoragePlan([{ manifestPath: "stage3.json", entries }], root);

    expect(plan.objects).toEqual([]);
    expect(plan.rejected.map((item) => item.reason)).toEqual([
      "legacyPath escapes the source root.",
      "Source file does not exist.",
      "File signature does not match .pdf.",
    ]);
  });

  it("deduplicates identical entries and rejects conflicting target paths", async () => {
    const root = await temporarySourceRoot();
    const bytes = Buffer.concat([Buffer.from("%PDF-1.7\n"), Buffer.from("document")]);
    await writeFile(path.join(root, "uploads", "document.pdf"), bytes);
    const original = {
      entityType: "Lead", entityLegacyMongoId: "lead-1",
      legacyPath: "uploads/document.pdf", targetBucket: "crm-attachments",
      targetObjectPath: "legacy/leads/lead-1/001-document.pdf",
    };
    const conflicting = { ...original, legacyPath: "uploads/another.pdf" };

    const plan = await buildStoragePlan([
      { manifestPath: "first.json", entries: [original] },
      { manifestPath: "second.json", entries: [original, conflicting] },
    ], root);

    expect(plan.objects).toHaveLength(1);
    expect(plan.warnings).toHaveLength(1);
    expect(plan.rejected).toEqual([
      expect.objectContaining({ reason: expect.stringContaining("Target object path collides") }),
    ]);
  });
});

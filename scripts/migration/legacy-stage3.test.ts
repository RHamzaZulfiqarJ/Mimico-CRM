import { describe, expect, it } from "vitest";

import { buildStage3Plan, parseMongoExport } from "./legacy-stage3";

describe("parseMongoExport", () => {
  it("parses JSON arrays and mongoexport document envelopes", () => {
    expect(parseMongoExport('[{"_id":"one"}]')).toEqual([{ _id: "one" }]);
    expect(parseMongoExport('{"documents":[{"_id":"two"}]}')).toEqual([
      { _id: "two" },
    ]);
  });

  it("parses newline-delimited mongoexport output", () => {
    expect(parseMongoExport('{"_id":"one"}\n{"_id":"two"}')).toEqual([
      { _id: "one" },
      { _id: "two" },
    ]);
  });

  it("identifies an invalid newline", () => {
    expect(() => parseMongoExport('{"_id":"one"}\nnot-json')).toThrow(
      "Invalid newline-delimited JSON at line 2.",
    );
  });
});

describe("buildStage3Plan", () => {
  it("maps legacy identities, reference data, typoed company name, and images", () => {
    const plan = buildStage3Plan({
      users: [
        {
          _id: { $oid: "profile-1" },
          username: "client.one",
          firstName: "Client",
          lastName: "One",
          phone: "03001234567",
          email: "CLIENT@EXAMPLE.COM",
          password: "legacy-hash",
          role: "client",
          uid: "U-1",
        },
      ],
      societies: [
        {
          _id: { $oid: "society-1" },
          title: "Green View",
          description: "Primary society",
          images: ["uploads/societies/green-view.jpg"],
        },
      ],
      projects: [
        {
          _id: { $oid: "project-1" },
          society: { $oid: "society-1" },
          title: "Block A",
          description: "Residential block",
          city: "Lahore",
        },
      ],
      inventories: [
        {
          _id: { $oid: "inventory-1" },
          project: { $oid: "project-1" },
          employeeId: { $oid: "profile-1" },
          sellerCompamyName: "Legacy Estates",
          price: "1250000.50",
          status: "underProcess",
        },
      ],
    });

    expect(plan.rejected).toEqual([]);
    expect(plan.profiles[0]).toMatchObject({
      legacyMongoId: "profile-1",
      email: "client@example.com",
      role: "CLIENT",
    });
    expect(plan.inventories[0]).toMatchObject({
      sellerCompanyName: "Legacy Estates",
      price: "1250000.50",
      status: "UNDER_PROCESS",
    });
    expect(plan.storageManifest).toEqual([
      {
        entityType: "Society",
        entityLegacyMongoId: "society-1",
        legacyPath: "uploads/societies/green-view.jpg",
        targetBucket: "crm-attachments",
        targetObjectPath: "legacy/societies/society-1/001-green-view.jpg",
      },
    ]);
    expect(plan.warnings).toContain(
      "users:profile-1 password ignored; Supabase invitation required.",
    );
  });

  it("rejects invalid money and broken parent relationships", () => {
    const plan = buildStage3Plan({
      projects: [
        {
          _id: "project-1",
          society: "missing-society",
          title: "Orphan",
          description: "No valid society",
          city: "Lahore",
        },
      ],
      inventories: [
        { _id: "inventory-1", price: "Rs. 10 lakh" },
        { _id: "inventory-2", project: "missing-project" },
      ],
    });

    expect(plan.projects).toEqual([]);
    expect(plan.inventories).toEqual([]);
    expect(plan.rejected).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ collection: "projects" }),
        expect.objectContaining({ reason: "Invalid price: Rs. 10 lakh." }),
        expect.objectContaining({
          reason: "Project missing-project is missing or rejected.",
        }),
      ]),
    );
  });

  it("rejects duplicate identities before database application", () => {
    const plan = buildStage3Plan({
      users: [
        { _id: "user-1", username: "same", email: "same@example.com" },
        { _id: "user-2", username: "other", email: "SAME@example.com" },
        { _id: "user-1", username: "duplicate-id" },
      ],
    });

    expect(plan.profiles).toHaveLength(1);
    expect(plan.rejected).toEqual(
      expect.arrayContaining([
        {
          collection: "users",
          legacyMongoId: "user-2",
          reason: "Duplicate email: same@example.com.",
        },
        {
          collection: "users",
          legacyMongoId: "user-1",
          reason: "Duplicate legacy ID: user-1.",
        },
      ]),
    );
  });
});

import { describe, expect, it } from "vitest";

import { buildStage4Plan } from "./legacy-stage4";

const profiles = new Set(["employee-1", "manager-1"]);
const clients = new Set(["client-1"]);
const projects = new Set(["project-1"]);

describe("buildStage4Plan", () => {
  it("maps leads, relationships, follow-ups, and attachment paths", () => {
    const plan = buildStage4Plan({
      leads: [{
        _id: { $oid: "lead-1" },
        client: { $oid: "client-1" },
        property: { $oid: "project-1" },
        allocatedTo: [{ $oid: "employee-1" }, "manager-1"],
        followUps: [{ $oid: "follow-up-1" }],
        uid: "L-100",
        clientName: "Ayesha Khan",
        clientPhone: "+92 300 1234567",
        priority: "veryHot",
        status: "visitSchedule",
        isAppliedForRefund: true,
        images: ["uploads\\leads\\booking form.pdf"],
        createdAt: { $date: "2026-10-01T08:00:00.000Z" },
      }],
      followUps: [{
        _id: { $oid: "follow-up-1" },
        status: "contactedClient",
        followUpDate: "2026-10-02T10:30",
        remarks: "Call after the site visit.",
      }],
    }, {
      knownProfileLegacyIds: profiles,
      knownClientLegacyIds: clients,
      knownProjectLegacyIds: projects,
    });

    expect(plan.rejected).toEqual([]);
    expect(plan.leads[0]).toMatchObject({
      legacyMongoId: "lead-1",
      clientLegacyMongoId: "client-1",
      projectLegacyMongoId: "project-1",
      assignedLegacyProfileIds: ["employee-1", "manager-1"],
      priority: "VERY_HOT",
      stage: "VISIT_SCHEDULED",
      refundRequested: true,
    });
    expect(plan.followUps[0]).toMatchObject({
      legacyMongoId: "follow-up-1",
      leadLegacyMongoId: "lead-1",
      stage: "CONTACTED_CLIENT",
      followUpAt: "2026-10-02T05:30:00.000Z",
    });
    expect(plan.storageManifest).toEqual([expect.objectContaining({
      entityType: "Lead",
      targetBucket: "crm-attachments",
      targetObjectPath: "legacy/leads/lead-1/001-booking-form.pdf",
    })]);
  });

  it("rejects missing project and assignee relationships", () => {
    const plan = buildStage4Plan({ leads: [
      { _id: "lead-1", property: "missing-project" },
      { _id: "lead-2", allocatedTo: ["missing-profile"] },
    ] }, {
      knownProfileLegacyIds: profiles,
      knownClientLegacyIds: clients,
      knownProjectLegacyIds: projects,
    });

    expect(plan.leads).toEqual([]);
    expect(plan.rejected).toEqual(expect.arrayContaining([
      expect.objectContaining({ reason: "Project missing-project is missing from the project export." }),
      expect.objectContaining({ reason: "Assigned profile(s) missing from the identity export: missing-profile." }),
    ]));
  });

  it("rejects duplicate active phones but permits an archived duplicate", () => {
    const plan = buildStage4Plan({ leads: [
      { _id: "lead-1", clientPhone: "0300 1234567" },
      { _id: "lead-2", clientPhone: "03001234567" },
      { _id: "lead-3", clientPhone: "03001234567", isArchived: true },
    ] });

    expect(plan.leads.map((item) => item.legacyMongoId)).toEqual(["lead-1", "lead-3"]);
    expect(plan.rejected).toEqual([
      expect.objectContaining({ legacyMongoId: "lead-2", reason: "Duplicate active lead phone: 03001234567." }),
    ]);
  });

  it("rejects orphaned follow-ups and invalid dates", () => {
    const plan = buildStage4Plan({
      leads: [{ _id: "lead-1" }],
      followUps: [
        { _id: "follow-up-1", leadId: "missing-lead", status: "followUp" },
        { _id: "follow-up-2", leadId: "lead-1", followUpDate: "not-a-date" },
      ],
    });

    expect(plan.followUps).toEqual([]);
    expect(plan.rejected).toEqual(expect.arrayContaining([
      expect.objectContaining({ reason: "Lead missing-lead is missing or rejected." }),
      expect.objectContaining({ reason: "Invalid followUpDate." }),
    ]));
  });

  it("uses an accepted lead's stage when a follow-up status is absent", () => {
    const plan = buildStage4Plan({
      leads: [{ _id: "lead-1", status: "closedWon", followUps: ["follow-up-1"] }],
      followUps: [{ _id: "follow-up-1", remarks: "Deal completed." }],
    });

    expect(plan.rejected).toEqual([]);
    expect(plan.followUps[0].stage).toBe("CLOSED_WON");
  });

  it("treats legacy date-only and day-first reminders as Pakistan calendar dates", () => {
    const plan = buildStage4Plan({
      leads: [{ _id: "lead-1" }, { _id: "lead-2" }],
      followUps: [
        { _id: "follow-up-1", leadId: "lead-1", followUpDate: "2026-10-06" },
        { _id: "follow-up-2", leadId: "lead-2", followUpDate: "7-10-26" },
      ],
    });

    expect(plan.rejected).toEqual([]);
    expect(plan.followUps.map((item) => item.followUpAt)).toEqual([
      "2026-10-05T19:00:00.000Z",
      "2026-10-06T19:00:00.000Z",
    ]);
  });
});

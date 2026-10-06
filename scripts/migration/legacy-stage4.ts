import {
  parseMongoExport,
  type MongoDocument,
  type RejectedRecord,
} from "./legacy-stage3";

export { parseMongoExport };
export type { MongoDocument };

type LeadPriority = "VERY_COLD" | "COLD" | "MODERATE" | "HOT" | "VERY_HOT";
type LeadStage =
  | "NEW_CLIENT"
  | "FOLLOW_UP"
  | "CONTACTED_CLIENT"
  | "CALL_NOT_ATTEND"
  | "VISIT_SCHEDULED"
  | "VISIT_DONE"
  | "CLOSED_WON"
  | "CLOSED_LOST";

export type PlannedLead = {
  legacyMongoId: string;
  clientLegacyMongoId?: string;
  projectLegacyMongoId?: string;
  assignedLegacyProfileIds: string[];
  followUpLegacyMongoIds: string[];
  uid?: string;
  clientName?: string;
  clientPhone?: string;
  area?: string;
  city?: string;
  priority: LeadPriority;
  stage: LeadStage;
  source?: string;
  description?: string;
  isArchived: boolean;
  refundRequested: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type PlannedFollowUp = {
  legacyMongoId: string;
  leadLegacyMongoId: string;
  uid?: string;
  stage: LeadStage;
  followUpAt?: string;
  remarks?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type LeadStorageManifestEntry = {
  entityType: "Lead";
  entityLegacyMongoId: string;
  legacyPath: string;
  targetBucket: "crm-attachments";
  targetObjectPath: string;
};

export type Stage4Plan = {
  leads: PlannedLead[];
  followUps: PlannedFollowUp[];
  storageManifest: LeadStorageManifestEntry[];
  rejected: RejectedRecord[];
  warnings: string[];
  sourceCounts: Record<"leads" | "followUps", number>;
};

type BuildOptions = {
  knownProfileLegacyIds?: ReadonlySet<string>;
  knownClientLegacyIds?: ReadonlySet<string>;
  knownProjectLegacyIds?: ReadonlySet<string>;
};

function isDocument(value: unknown): value is MongoDocument {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function mongoId(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (isDocument(value) && typeof value.$oid === "string") return value.$oid;
  return undefined;
}

function text(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  return value.trim() || undefined;
}

function supplied(value: unknown) {
  return value !== undefined && value !== null && value !== "";
}

function date(value: unknown, assumePakistanTime = false): string | undefined {
  let candidate = value;
  if (isDocument(candidate) && "$date" in candidate) candidate = candidate.$date;
  if (isDocument(candidate) && "$numberLong" in candidate) candidate = candidate.$numberLong;
  if (typeof candidate !== "string" && typeof candidate !== "number") return undefined;
  let normalizedCandidate: string | number = candidate;

  if (assumePakistanTime && typeof normalizedCandidate === "string") {
    const dayFirst = /^(\d{1,2})-(\d{1,2})-(\d{2}|\d{4})$/.exec(normalizedCandidate);
    if (dayFirst) {
      const day = Number(dayFirst[1]);
      const month = Number(dayFirst[2]);
      const rawYear = Number(dayFirst[3]);
      const year = rawYear < 100 ? 2000 + rawYear : rawYear;
      const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
      if (month < 1 || month > 12 || day < 1 || day > daysInMonth) return undefined;
      normalizedCandidate = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T00:00:00+05:00`;
    } else {
      const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(normalizedCandidate);
      if (dateOnly) {
        const year = Number(dateOnly[1]);
        const month = Number(dateOnly[2]);
        const day = Number(dateOnly[3]);
        const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
        if (month < 1 || month > 12 || day < 1 || day > daysInMonth) return undefined;
        normalizedCandidate = `${normalizedCandidate}T00:00:00+05:00`;
      }
    }
  }

  if (
    assumePakistanTime
    && typeof normalizedCandidate === "string"
    && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?$/.test(normalizedCandidate)
  ) {
    normalizedCandidate = `${normalizedCandidate}+05:00`;
  }

  const dateInput = typeof normalizedCandidate === "string" && /^-?\d{11,}$/.test(normalizedCandidate)
    ? Number(normalizedCandidate)
    : normalizedCandidate;
  const parsed = new Date(dateInput);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

function normalize(value: unknown) {
  return text(value)?.toLowerCase().replaceAll(/[^a-z]/g, "");
}

function phoneKey(value: string | undefined) {
  if (!value) return undefined;
  return value.replaceAll(/\D/g, "") || value.toLowerCase();
}

function priority(value: unknown): LeadPriority | undefined {
  return ({
    verycold: "VERY_COLD",
    cold: "COLD",
    moderate: "MODERATE",
    hot: "HOT",
    veryhot: "VERY_HOT",
  } as Record<string, LeadPriority>)[normalize(value) ?? ""];
}

function stage(value: unknown): LeadStage | undefined {
  return ({
    new: "NEW_CLIENT",
    newclient: "NEW_CLIENT",
    followup: "FOLLOW_UP",
    contacted: "CONTACTED_CLIENT",
    contactedclient: "CONTACTED_CLIENT",
    callnotattend: "CALL_NOT_ATTEND",
    callnotattended: "CALL_NOT_ATTEND",
    visitschedule: "VISIT_SCHEDULED",
    visitscheduled: "VISIT_SCHEDULED",
    visitdone: "VISIT_DONE",
    closedwon: "CLOSED_WON",
    won: "CLOSED_WON",
    closedlost: "CLOSED_LOST",
    lost: "CLOSED_LOST",
  } as Record<string, LeadStage>)[normalize(value) ?? ""];
}

function reject(
  rejected: RejectedRecord[],
  collection: string,
  document: MongoDocument,
  reason: string,
) {
  rejected.push({ collection, legacyMongoId: mongoId(document._id), reason });
}

function uniqueId(
  seen: Set<string>,
  collection: string,
  document: MongoDocument,
  rejected: RejectedRecord[],
) {
  const id = mongoId(document._id);
  if (!id) {
    reject(rejected, collection, document, "Missing MongoDB _id.");
    return undefined;
  }
  if (seen.has(id)) {
    reject(rejected, collection, document, `Duplicate legacy ID: ${id}.`);
    return undefined;
  }
  seen.add(id);
  return id;
}

function references(value: unknown) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(mongoId).filter((id): id is string => Boolean(id)))];
}

function storageObjectPath(legacyMongoId: string, legacyPath: string, index: number) {
  const originalName = legacyPath.split(/[\\/]/).at(-1) ?? "attachment";
  const safeName = originalName.replace(/[^a-zA-Z0-9._-]+/g, "-") || "attachment";
  return `legacy/leads/${legacyMongoId}/${String(index + 1).padStart(3, "0")}-${safeName}`;
}

function timestamps(
  collection: string,
  document: MongoDocument,
  rejected: RejectedRecord[],
) {
  const createdAt = date(document.createdAt);
  const updatedAt = date(document.updatedAt);
  if (supplied(document.createdAt) && !createdAt) {
    reject(rejected, collection, document, "Invalid createdAt timestamp.");
    return undefined;
  }
  if (supplied(document.updatedAt) && !updatedAt) {
    reject(rejected, collection, document, "Invalid updatedAt timestamp.");
    return undefined;
  }
  return { createdAt, updatedAt };
}

export function buildStage4Plan(
  collections: { leads?: MongoDocument[]; followUps?: MongoDocument[] },
  options: BuildOptions = {},
): Stage4Plan {
  const rejected: RejectedRecord[] = [];
  const warnings: string[] = [];
  const leads: PlannedLead[] = [];
  const followUps: PlannedFollowUp[] = [];
  const storageManifest: LeadStorageManifestEntry[] = [];
  const seenLeadIds = new Set<string>();
  const seenFollowUpIds = new Set<string>();
  const seenLeadUids = new Set<string>();
  const seenFollowUpUids = new Set<string>();
  const seenActivePhones = new Set<string>();

  function claimUid(
    collection: "leads" | "followUps",
    document: MongoDocument,
    seen: Set<string>,
  ) {
    const uid = text(document.uid);
    if (!uid) return undefined;
    const key = uid.toLowerCase();
    if (seen.has(key)) {
      reject(rejected, collection, document, `Duplicate uid: ${uid}.`);
      return null;
    }
    seen.add(key);
    return uid;
  }

  for (const document of collections.leads ?? []) {
    const id = uniqueId(seenLeadIds, "leads", document, rejected);
    if (!id) continue;
    const uid = claimUid("leads", document, seenLeadUids);
    if (uid === null) continue;

    const mappedTimestamps = timestamps("leads", document, rejected);
    if (!mappedTimestamps) continue;

    const rawPriority = text(document.priority);
    const mappedPriority = priority(rawPriority);
    if (rawPriority && !mappedPriority) {
      warnings.push(`leads:${id} has unknown priority ${rawPriority}; using MODERATE.`);
    }
    const rawStage = text(document.status);
    const mappedStage = stage(rawStage);
    if (rawStage && !mappedStage) {
      warnings.push(`leads:${id} has unknown status ${rawStage}; using NEW_CLIENT.`);
    }

    const projectLegacyMongoId = mongoId(document.property);
    if (
      projectLegacyMongoId
      && options.knownProjectLegacyIds
      && !options.knownProjectLegacyIds.has(projectLegacyMongoId)
    ) {
      reject(rejected, "leads", document, `Project ${projectLegacyMongoId} is missing from the project export.`);
      continue;
    }

    const assignedLegacyProfileIds = references(document.allocatedTo);
    const missingAssignees = options.knownProfileLegacyIds
      ? assignedLegacyProfileIds.filter((profileId) => !options.knownProfileLegacyIds!.has(profileId))
      : [];
    if (missingAssignees.length) {
      reject(rejected, "leads", document, `Assigned profile(s) missing from the identity export: ${missingAssignees.join(", ")}.`);
      continue;
    }

    const sourceClientLegacyMongoId = mongoId(document.client);
    const clientLegacyMongoId = sourceClientLegacyMongoId
      && (!options.knownClientLegacyIds || options.knownClientLegacyIds.has(sourceClientLegacyMongoId))
      ? sourceClientLegacyMongoId
      : undefined;
    if (sourceClientLegacyMongoId && !clientLegacyMongoId) {
      warnings.push(`leads:${id} client ${sourceClientLegacyMongoId} is not a client in the identity export; the lead will remain unlinked.`);
    }

    const clientPhone = text(document.clientPhone);
    const isArchived = document.isArchived === true;
    const normalizedPhone = phoneKey(clientPhone);
    if (!isArchived && normalizedPhone && seenActivePhones.has(normalizedPhone)) {
      reject(rejected, "leads", document, `Duplicate active lead phone: ${clientPhone}.`);
      continue;
    }
    if (!isArchived && normalizedPhone) seenActivePhones.add(normalizedPhone);

    if (!assignedLegacyProfileIds.length) {
      warnings.push(`leads:${id} has no assignee; only management or its linked client can see it.`);
    }

    const followUpLegacyMongoIds = references(document.followUps);
    leads.push({
      legacyMongoId: id,
      clientLegacyMongoId,
      projectLegacyMongoId,
      assignedLegacyProfileIds,
      followUpLegacyMongoIds,
      uid,
      clientName: text(document.clientName),
      clientPhone,
      area: text(document.area),
      city: text(document.city),
      priority: mappedPriority ?? "MODERATE",
      stage: mappedStage ?? "NEW_CLIENT",
      source: text(document.source),
      description: text(document.description),
      isArchived,
      refundRequested: document.isAppliedForRefund === true,
      ...mappedTimestamps,
    });

    if (Array.isArray(document.images)) {
      for (const [index, image] of document.images.entries()) {
        const legacyPath = text(image);
        if (!legacyPath) continue;
        storageManifest.push({
          entityType: "Lead",
          entityLegacyMongoId: id,
          legacyPath,
          targetBucket: "crm-attachments",
          targetObjectPath: storageObjectPath(id, legacyPath, index),
        });
      }
    }
  }

  const acceptedLeadIds = new Set(leads.map((item) => item.legacyMongoId));
  const leadsById = new Map(leads.map((item) => [item.legacyMongoId, item]));
  const followUpOwners = new Map<string, Set<string>>();
  for (const lead of leads) {
    for (const followUpId of lead.followUpLegacyMongoIds) {
      const owners = followUpOwners.get(followUpId) ?? new Set<string>();
      owners.add(lead.legacyMongoId);
      followUpOwners.set(followUpId, owners);
    }
  }

  for (const document of collections.followUps ?? []) {
    const id = uniqueId(seenFollowUpIds, "followUps", document, rejected);
    if (!id) continue;
    const uid = claimUid("followUps", document, seenFollowUpUids);
    if (uid === null) continue;

    const explicitLeadId = mongoId(document.leadId);
    const owners = [...(followUpOwners.get(id) ?? [])];
    if (!explicitLeadId && owners.length > 1) {
      reject(rejected, "followUps", document, `Follow-up is referenced by multiple leads: ${owners.join(", ")}.`);
      continue;
    }
    const leadLegacyMongoId = explicitLeadId ?? owners[0];
    if (!leadLegacyMongoId || !acceptedLeadIds.has(leadLegacyMongoId)) {
      reject(rejected, "followUps", document, `Lead ${leadLegacyMongoId ?? "reference"} is missing or rejected.`);
      continue;
    }
    if (explicitLeadId && owners.length === 1 && owners[0] !== explicitLeadId) {
      warnings.push(`followUps:${id} leadId overrides the conflicting lead.followUps reference ${owners[0]}.`);
    }

    const rawFollowUpAt = document.followUpDate;
    const followUpAt = date(rawFollowUpAt, true);
    if (supplied(rawFollowUpAt) && !followUpAt) {
      reject(rejected, "followUps", document, "Invalid followUpDate.");
      continue;
    }
    const mappedTimestamps = timestamps("followUps", document, rejected);
    if (!mappedTimestamps) continue;

    const rawStage = text(document.status);
    const mappedStage = stage(rawStage);
    if (rawStage && !mappedStage) {
      warnings.push(`followUps:${id} has unknown status ${rawStage}; using the lead's stage.`);
    }
    followUps.push({
      legacyMongoId: id,
      leadLegacyMongoId,
      uid,
      stage: mappedStage ?? leadsById.get(leadLegacyMongoId)!.stage,
      followUpAt,
      remarks: text(document.remarks),
      ...mappedTimestamps,
    });
  }

  const acceptedFollowUpIds = new Set(followUps.map((item) => item.legacyMongoId));
  for (const lead of leads) {
    for (const followUpId of lead.followUpLegacyMongoIds) {
      if (!acceptedFollowUpIds.has(followUpId)) {
        warnings.push(`leads:${lead.legacyMongoId} references follow-up ${followUpId}, but it is missing or rejected.`);
      }
    }
  }

  if (!options.knownProfileLegacyIds && leads.some((item) => item.assignedLegacyProfileIds.length)) {
    warnings.push("Identity exports were not supplied; assignee references will be verified only during apply.");
  }
  if (!options.knownProjectLegacyIds && leads.some((item) => item.projectLegacyMongoId)) {
    warnings.push("A project export was not supplied; project references will be verified only during apply.");
  }
  if (!options.knownClientLegacyIds && leads.some((item) => item.clientLegacyMongoId)) {
    warnings.push("A client identity export was not supplied; client references will be verified only during apply.");
  }

  return {
    leads,
    followUps,
    storageManifest,
    rejected,
    warnings,
    sourceCounts: {
      leads: collections.leads?.length ?? 0,
      followUps: collections.followUps?.length ?? 0,
    },
  };
}

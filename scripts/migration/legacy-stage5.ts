import { parseMongoExport, type MongoDocument, type RejectedRecord } from "./legacy-stage3";

export { parseMongoExport };
export type { MongoDocument };

type TaskStatus = "TODO" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
type TaskOutcome = "SUCCESSFUL" | "UNSUCCESSFUL";
type ApprovalType = "REQUEST" | "VOUCHER" | "RECEIPT" | "REFUND";
type ApprovalStatus = "UNDER_PROCESS" | "ACCEPTED" | "REJECTED";

export type PlannedTask = {
  legacyMongoId: string;
  assignedToLegacyProfileId: string;
  uid?: string;
  title: string;
  description?: string;
  dueAt?: string;
  status: TaskStatus;
  outcome?: TaskOutcome;
  outcomeComment?: string;
  completedAt?: string;
  isArchived: boolean;
  createdAt?: string;
  updatedAt?: string;
  legacyPayload: MongoDocument;
};

export type PlannedCalendarEvent = {
  legacyMongoId: string;
  ownerLegacyProfileId: string;
  uid?: string;
  title: string;
  description?: string;
  startsAt: string;
  endsAt: string;
  createdAt?: string;
  updatedAt?: string;
};

export type PlannedApproval = {
  legacyMongoId: string;
  requestedByLegacyProfileId?: string;
  leadLegacyMongoId?: string;
  uid?: string;
  title?: string;
  description: string;
  dueAt?: string;
  type: ApprovalType;
  status: ApprovalStatus;
  payload?: MongoDocument;
  decidedAt?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type PlannedNotification = {
  legacyMongoId: string;
  uid?: string;
  type: string;
  title?: string;
  description: string;
  readAt?: string;
  createdAt?: string;
  approvalLegacyMongoId?: string;
  taskLegacyMongoId?: string;
  payload?: MongoDocument;
  recipient:
    | { kind: "profile"; legacyProfileId: string }
    | { kind: "management" };
};

export type Stage5Plan = {
  tasks: PlannedTask[];
  calendarEvents: PlannedCalendarEvent[];
  approvals: PlannedApproval[];
  notifications: PlannedNotification[];
  rejected: RejectedRecord[];
  warnings: string[];
  sourceCounts: Record<"tasks" | "events" | "approvals" | "notifications", number>;
};

type BuildOptions = {
  knownProfileLegacyIds?: ReadonlySet<string>;
  knownLeadLegacyIds?: ReadonlySet<string>;
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

function date(value: unknown): string | undefined {
  let candidate = value;
  if (isDocument(candidate) && "$date" in candidate) candidate = candidate.$date;
  if (isDocument(candidate) && "$numberLong" in candidate) candidate = candidate.$numberLong;
  if (typeof candidate !== "string" && typeof candidate !== "number") return undefined;
  const dateInput = typeof candidate === "string" && /^-?\d{11,}$/.test(candidate)
    ? Number(candidate)
    : candidate;
  const parsed = new Date(dateInput);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

function supplied(value: unknown) {
  return value !== undefined && value !== null && value !== "";
}

function reject(rejected: RejectedRecord[], collection: string, document: MongoDocument, reason: string) {
  rejected.push({ collection, legacyMongoId: mongoId(document._id), reason });
}

function profileReference(
  value: unknown,
  collection: string,
  document: MongoDocument,
  rejected: RejectedRecord[],
  options: BuildOptions,
) {
  const id = mongoId(value);
  if (!id) {
    reject(rejected, collection, document, "Missing legacy profile reference.");
    return undefined;
  }
  if (options.knownProfileLegacyIds && !options.knownProfileLegacyIds.has(id)) {
    reject(rejected, collection, document, `Profile ${id} is missing from the identity export.`);
    return undefined;
  }
  return id;
}

function taskOutcome(value: unknown): TaskOutcome | undefined {
  const normalized = text(value)?.toLowerCase().replaceAll(/[^a-z]/g, "");
  if (normalized === "successful" || normalized === "success") return "SUCCESSFUL";
  if (normalized === "unsuccessful" || normalized === "failed" || normalized === "failure") return "UNSUCCESSFUL";
  return undefined;
}

function approvalType(value: unknown): ApprovalType | undefined {
  return ({ request: "REQUEST", voucher: "VOUCHER", receipt: "RECEIPT", refund: "REFUND" } as Record<string, ApprovalType>)[text(value)?.toLowerCase() ?? ""];
}

function approvalStatus(value: unknown): ApprovalStatus | undefined {
  return ({ underprocess: "UNDER_PROCESS", accepted: "ACCEPTED", rejected: "REJECTED" } as Record<string, ApprovalStatus>)[text(value)?.toLowerCase().replaceAll(/[^a-z]/g, "") ?? ""];
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

export function buildStage5Plan(
  collections: {
    tasks?: MongoDocument[];
    events?: MongoDocument[];
    approvals?: MongoDocument[];
    notifications?: MongoDocument[];
  },
  options: BuildOptions = {},
): Stage5Plan {
  const rejected: RejectedRecord[] = [];
  const warnings: string[] = [];
  const tasks: PlannedTask[] = [];
  const calendarEvents: PlannedCalendarEvent[] = [];
  const approvals: PlannedApproval[] = [];
  const notifications: PlannedNotification[] = [];
  const seen = {
    tasks: new Set<string>(), events: new Set<string>(), approvals: new Set<string>(), notifications: new Set<string>(),
  };
  const seenUids = {
    tasks: new Set<string>(), events: new Set<string>(), approvals: new Set<string>(), notifications: new Set<string>(),
  };

  function claimUid(collection: keyof typeof seenUids, document: MongoDocument) {
    const uid = text(document.uid);
    if (!uid) return undefined;
    if (seenUids[collection].has(uid)) {
      reject(rejected, collection, document, `Duplicate uid: ${uid}.`);
      return null;
    }
    seenUids[collection].add(uid);
    return uid;
  }

  for (const document of collections.tasks ?? []) {
    const id = uniqueId(seen.tasks, "tasks", document, rejected);
    if (!id) continue;
    const uid = claimUid("tasks", document);
    if (uid === null) continue;
    const assignedToLegacyProfileId = profileReference(document.userId, "tasks", document, rejected, options);
    if (!assignedToLegacyProfileId) continue;
    const completedTitle = text(document.completedTask);
    const title = completedTitle ?? text(document.newTask);
    if (!title) {
      reject(rejected, "tasks", document, "Missing newTask or completedTask title.");
      continue;
    }
    const rawDueAt = document.newTaskDeadline;
    const dueAt = date(rawDueAt);
    if (supplied(rawDueAt) && !dueAt) {
      reject(rejected, "tasks", document, "Invalid newTaskDeadline.");
      continue;
    }
    const rawCompletedAt = document.completedTaskDate;
    const completedAt = date(rawCompletedAt);
    if (supplied(rawCompletedAt) && !completedAt) {
      reject(rejected, "tasks", document, "Invalid completedTaskDate.");
      continue;
    }
    const outcome = taskOutcome(document.completedTaskStatus);
    if (document.completedTaskStatus && !outcome) warnings.push(`tasks:${id} has an unknown completion outcome; it will be unset.`);
    const createdAt = date(document.createdAt);
    const updatedAt = date(document.updatedAt);
    tasks.push({
      legacyMongoId: id,
      assignedToLegacyProfileId,
      uid,
      title,
      description: text(document.newTaskComment),
      dueAt,
      status: completedTitle || completedAt || outcome ? "COMPLETED" : "TODO",
      outcome,
      outcomeComment: text(document.completedTaskComment),
      completedAt,
      isArchived: document.isArchived === true,
      createdAt,
      updatedAt,
      legacyPayload: {
        newTask: text(document.newTask) ?? null,
        completedTask: completedTitle ?? null,
        completedTaskStatus: text(document.completedTaskStatus) ?? null,
      },
    });
  }

  for (const document of collections.events ?? []) {
    const id = uniqueId(seen.events, "events", document, rejected);
    if (!id) continue;
    const uid = claimUid("events", document);
    if (uid === null) continue;
    const ownerLegacyProfileId = profileReference(document.userId, "events", document, rejected, options);
    const title = text(document.title);
    const startsAt = date(document.start);
    const endsAt = date(document.end);
    if (!ownerLegacyProfileId) continue;
    if (!title || !startsAt || !endsAt) {
      reject(rejected, "events", document, "Missing title or valid start/end date.");
      continue;
    }
    if (new Date(endsAt) <= new Date(startsAt)) {
      reject(rejected, "events", document, "Event end must be after its start.");
      continue;
    }
    calendarEvents.push({
      legacyMongoId: id, ownerLegacyProfileId, uid, title,
      description: text(document.description), startsAt, endsAt,
      createdAt: date(document.createdAt), updatedAt: date(document.updatedAt),
    });
  }

  for (const document of collections.approvals ?? []) {
    const id = uniqueId(seen.approvals, "approvals", document, rejected);
    if (!id) continue;
    const uid = claimUid("approvals", document);
    if (uid === null) continue;
    const description = text(document.description);
    const type = approvalType(document.type);
    const status = approvalStatus(document.status ?? "underProcess");
    if (!description || !type || !status) {
      reject(rejected, "approvals", document, "Missing description or unsupported type/status.");
      continue;
    }
    const leadLegacyMongoId = mongoId(document.leadId);
    if (leadLegacyMongoId && options.knownLeadLegacyIds && !options.knownLeadLegacyIds.has(leadLegacyMongoId)) {
      reject(rejected, "approvals", document, `Lead ${leadLegacyMongoId} is missing from the lead export.`);
      continue;
    }
    const data = isDocument(document.data) ? document.data : undefined;
    const requestedByLegacyProfileId = mongoId(document.requestedByProfileId)
      ?? mongoId(document.userId)
      ?? (data ? mongoId(data.userId) : undefined);
    if (requestedByLegacyProfileId && options.knownProfileLegacyIds && !options.knownProfileLegacyIds.has(requestedByLegacyProfileId)) {
      reject(rejected, "approvals", document, `Requester ${requestedByLegacyProfileId} is missing from the identity export.`);
      continue;
    }
    const dueAt = date(document.dueDate);
    if (supplied(document.dueDate) && !dueAt) {
      reject(rejected, "approvals", document, "Invalid dueDate.");
      continue;
    }
    approvals.push({
      legacyMongoId: id, requestedByLegacyProfileId, leadLegacyMongoId,
      uid, title: text(document.title), description,
      dueAt, type, status, payload: data,
      decidedAt: status === "UNDER_PROCESS" ? undefined : date(document.updatedAt),
      createdAt: date(document.createdAt), updatedAt: date(document.updatedAt),
    });
  }

  const acceptedTaskIds = new Set(tasks.map((item) => item.legacyMongoId));
  const acceptedApprovalIds = new Set(approvals.map((item) => item.legacyMongoId));
  for (const document of collections.notifications ?? []) {
    const id = uniqueId(seen.notifications, "notifications", document, rejected);
    if (!id) continue;
    const uid = claimUid("notifications", document);
    if (uid === null) continue;
    const type = text(document.type);
    const description = text(document.description);
    if (!type || !description) {
      reject(rejected, "notifications", document, "Missing notification type or description.");
      continue;
    }
    const data = isDocument(document.data) ? document.data : undefined;
    const approvalLegacyMongoId = mongoId(document.approvalID) ?? mongoId(document.approvalId);
    if (approvalLegacyMongoId && !acceptedApprovalIds.has(approvalLegacyMongoId)) {
      reject(rejected, "notifications", document, `Approval ${approvalLegacyMongoId} is missing or rejected.`);
      continue;
    }
    const taskLegacyMongoId = data ? mongoId(data._id) : undefined;
    if (type === "urgent-task" && (!taskLegacyMongoId || !acceptedTaskIds.has(taskLegacyMongoId))) {
      reject(rejected, "notifications", document, "Urgent-task notification has no accepted task reference.");
      continue;
    }
    const recipientLegacyProfileId = mongoId(document.recipientProfileId)
      ?? mongoId(document.userId)
      ?? (data ? mongoId(data.userId) : undefined);
    if (recipientLegacyProfileId && options.knownProfileLegacyIds && !options.knownProfileLegacyIds.has(recipientLegacyProfileId)) {
      reject(rejected, "notifications", document, `Recipient ${recipientLegacyProfileId} is missing from the identity export.`);
      continue;
    }
    const recipient = recipientLegacyProfileId
      ? { kind: "profile" as const, legacyProfileId: recipientLegacyProfileId }
      : type.includes("approval")
        ? { kind: "management" as const }
        : undefined;
    if (!recipient) {
      reject(rejected, "notifications", document, "Notification recipient cannot be derived.");
      continue;
    }
    notifications.push({
      legacyMongoId: id, uid, type: `legacy_${type.replaceAll("-", "_")}`,
      title: text(document.title), description, readAt: document.isRead === true ? date(document.updatedAt) ?? date(document.createdAt) ?? new Date(0).toISOString() : undefined,
      createdAt: date(document.createdAt), approvalLegacyMongoId, taskLegacyMongoId,
      payload: data, recipient,
    });
  }

  if (!options.knownProfileLegacyIds) warnings.push("Identity exports were not supplied; profile references will be verified only during apply.");
  if (!options.knownLeadLegacyIds && approvals.some((item) => item.leadLegacyMongoId)) warnings.push("A lead export was not supplied; approval lead references will be verified only during apply.");

  return {
    tasks, calendarEvents, approvals, notifications, rejected, warnings,
    sourceCounts: {
      tasks: collections.tasks?.length ?? 0,
      events: collections.events?.length ?? 0,
      approvals: collections.approvals?.length ?? 0,
      notifications: collections.notifications?.length ?? 0,
    },
  };
}

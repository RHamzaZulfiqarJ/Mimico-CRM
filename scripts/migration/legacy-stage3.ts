export type MongoDocument = Record<string, unknown>;

export type RejectedRecord = {
  collection: string;
  legacyMongoId?: string;
  reason: string;
};

export type PlannedProfile = {
  legacyMongoId: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  city?: string;
  cnic?: string;
  role: "CLIENT" | "EMPLOYEE" | "MANAGER" | "SUPER_ADMIN";
  isActive: boolean;
  client?: {
    uid?: string;
    displayName: string;
    email?: string;
    phone: string;
    city?: string;
    cnic?: string;
  };
};

export type PlannedSociety = {
  legacyMongoId: string;
  uid?: string;
  title: string;
  description: string;
  status: "ACTIVE" | "INACTIVE";
  isArchived: boolean;
};

export type PlannedProject = {
  legacyMongoId: string;
  societyLegacyMongoId: string;
  uid?: string;
  title: string;
  description: string;
  city: string;
  status: "ACTIVE" | "INACTIVE";
  isArchived: boolean;
};

export type PlannedInventory = {
  legacyMongoId: string;
  projectLegacyMongoId?: string;
  ownerLegacyMongoId?: string;
  uid?: string;
  sellerName?: string;
  sellerPhone?: string;
  sellerEmail?: string;
  sellerCompanyName?: string;
  sellerCity?: string;
  propertyStreetNumber?: string;
  propertyNumber?: string;
  price?: string;
  remarks?: string;
  status: "SOLD" | "UNSOLD" | "UNDER_PROCESS";
  isArchived: boolean;
};

export type StorageManifestEntry = {
  entityType: "Society";
  entityLegacyMongoId: string;
  legacyPath: string;
  targetBucket: "crm-attachments";
  targetObjectPath: string;
};

export type Stage3Plan = {
  profiles: PlannedProfile[];
  societies: PlannedSociety[];
  projects: PlannedProject[];
  inventories: PlannedInventory[];
  storageManifest: StorageManifestEntry[];
  rejected: RejectedRecord[];
  warnings: string[];
  sourceCounts: Record<string, number>;
};

export function parseMongoExport(text: string): MongoDocument[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (Array.isArray(parsed)) return parsed.filter(isDocument);
    if (isDocument(parsed) && Array.isArray(parsed.documents)) {
      return parsed.documents.filter(isDocument);
    }
    return isDocument(parsed) ? [parsed] : [];
  } catch {
    return trimmed
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line, index) => {
        try {
          const parsed = JSON.parse(line) as unknown;
          if (!isDocument(parsed)) throw new Error("not an object");
          return parsed;
        } catch {
          throw new Error(`Invalid newline-delimited JSON at line ${index + 1}.`);
        }
      });
  }
}

function isDocument(value: unknown): value is MongoDocument {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function mongoId(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (isDocument(value) && typeof value.$oid === "string") return value.$oid;
  return undefined;
}

function text(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  return normalized || undefined;
}

function bool(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function role(value: unknown): PlannedProfile["role"] {
  const roles: Record<string, PlannedProfile["role"]> = {
    client: "CLIENT",
    employee: "EMPLOYEE",
    manager: "MANAGER",
    super_admin: "SUPER_ADMIN",
  };
  return roles[text(value) ?? ""] ?? "EMPLOYEE";
}

function recordStatus(value: unknown): PlannedSociety["status"] {
  return text(value) === "inactive" ? "INACTIVE" : "ACTIVE";
}

function inventoryStatus(value: unknown): PlannedInventory["status"] {
  const mapped = ({
    sold: "SOLD",
    unsold: "UNSOLD",
    underProcess: "UNDER_PROCESS",
  } as Record<string, PlannedInventory["status"]>)[text(value) ?? ""];

  return mapped ?? "UNSOLD";
}

function decimal(value: unknown): string | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  const normalized = String(value).trim();
  return /^\d{1,16}(?:\.\d{1,2})?$/.test(normalized)
    ? normalized
    : undefined;
}

function storageObjectPath(legacyMongoId: string, legacyPath: string, index: number) {
  const originalName = legacyPath.split(/[\\/]/).at(-1) ?? "image";
  const safeName = originalName.replace(/[^a-zA-Z0-9._-]+/g, "-") || "image";
  return `legacy/societies/${legacyMongoId}/${String(index + 1).padStart(3, "0")}-${safeName}`;
}

function reject(
  rejected: RejectedRecord[],
  collection: string,
  document: MongoDocument,
  reason: string,
) {
  rejected.push({
    collection,
    legacyMongoId: mongoId(document._id),
    reason,
  });
}

export function buildStage3Plan(collections: {
  users?: MongoDocument[];
  employees?: MongoDocument[];
  societies?: MongoDocument[];
  projects?: MongoDocument[];
  inventories?: MongoDocument[];
}): Stage3Plan {
  const rejected: RejectedRecord[] = [];
  const warnings: string[] = [];
  const profiles: PlannedProfile[] = [];
  const societies: PlannedSociety[] = [];
  const projects: PlannedProject[] = [];
  const inventories: PlannedInventory[] = [];
  const storageManifest: StorageManifestEntry[] = [];
  const seenProfileIds = new Set<string>();
  const seenSocietyIds = new Set<string>();
  const seenProjectIds = new Set<string>();
  const seenInventoryIds = new Set<string>();
  const seenEmails = new Set<string>();
  const seenUsernames = new Set<string>();

  const profileSources = [
    ...((collections.users ?? []).map((document) => ({ collection: "users", document }))),
    ...((collections.employees ?? []).map((document) => ({ collection: "employees", document }))),
  ];

  for (const { collection, document } of profileSources) {
    const id = mongoId(document._id);
    if (!id) {
      reject(rejected, collection, document, "Missing MongoDB _id.");
      continue;
    }
    if (seenProfileIds.has(id)) {
      reject(rejected, collection, document, `Duplicate legacy ID: ${id}.`);
      continue;
    }
    seenProfileIds.add(id);

    const username = text(document.username);
    const email = text(document.email)?.toLowerCase();
    if (username && seenUsernames.has(username.toLowerCase())) {
      reject(rejected, collection, document, `Duplicate username: ${username}.`);
      continue;
    }
    if (email && seenEmails.has(email)) {
      reject(rejected, collection, document, `Duplicate email: ${email}.`);
      continue;
    }

    const mappedRole = collection === "employees" && !document.role
      ? "EMPLOYEE"
      : role(document.role);
    const firstName = text(document.firstName);
    const lastName = text(document.lastName);
    const phone = text(document.phone);
    const displayName = [firstName, lastName].filter(Boolean).join(" ") || username || phone;

    if (mappedRole === "CLIENT" && (!phone || !displayName)) {
      reject(rejected, collection, document, "Client requires a phone and display name.");
      continue;
    }

    if (username) seenUsernames.add(username.toLowerCase());
    if (email) seenEmails.add(email);

    profiles.push({
      legacyMongoId: id,
      username,
      firstName,
      lastName,
      email,
      phone,
      city: text(document.city),
      cnic: text(document.CNIC),
      role: mappedRole,
      isActive: bool(document.status, true),
      client: mappedRole === "CLIENT" && phone && displayName
        ? {
            uid: text(document.uid),
            displayName,
            email,
            phone,
            city: text(document.city),
            cnic: text(document.CNIC),
          }
        : undefined,
    });

    if (document.password) {
      warnings.push(`${collection}:${id} password ignored; Supabase invitation required.`);
    }
    if (!email) {
      warnings.push(`${collection}:${id} has no email and cannot receive an Auth invitation.`);
    }
  }

  for (const document of collections.societies ?? []) {
    const id = mongoId(document._id);
    const title = text(document.title);
    const description = text(document.description);
    if (!id || !title || !description) {
      reject(rejected, "societies", document, "Missing _id, title, or description.");
      continue;
    }
    if (seenSocietyIds.has(id)) {
      reject(rejected, "societies", document, `Duplicate legacy ID: ${id}.`);
      continue;
    }
    seenSocietyIds.add(id);
    societies.push({
      legacyMongoId: id,
      uid: text(document.uid),
      title,
      description,
      status: recordStatus(document.status),
      isArchived: bool(document.isArchived, false),
    });
    if (Array.isArray(document.images)) {
      for (const [index, image] of document.images.entries()) {
        const legacyPath = text(image);
        if (legacyPath) {
          storageManifest.push({
            entityType: "Society",
            entityLegacyMongoId: id,
            legacyPath,
            targetBucket: "crm-attachments",
            targetObjectPath: storageObjectPath(id, legacyPath, index),
          });
        }
      }
    }
  }

  const societyIds = new Set(societies.map((item) => item.legacyMongoId));
  for (const document of collections.projects ?? []) {
    const id = mongoId(document._id);
    const societyId = mongoId(document.society);
    const title = text(document.title);
    const description = text(document.description);
    const city = text(document.city);
    if (!id || !societyId || !title || !description || !city) {
      reject(rejected, "projects", document, "Missing required project fields.");
      continue;
    }
    if (seenProjectIds.has(id)) {
      reject(rejected, "projects", document, `Duplicate legacy ID: ${id}.`);
      continue;
    }
    seenProjectIds.add(id);
    if (!societyIds.has(societyId)) {
      reject(rejected, "projects", document, `Society ${societyId} is missing or rejected.`);
      continue;
    }
    projects.push({
      legacyMongoId: id,
      societyLegacyMongoId: societyId,
      uid: text(document.uid),
      title,
      description,
      city,
      status: recordStatus(document.status),
      isArchived: bool(document.isArchived, false),
    });
  }

  const projectIds = new Set(projects.map((item) => item.legacyMongoId));
  const profileIds = new Set(profiles.map((item) => item.legacyMongoId));
  for (const document of collections.inventories ?? []) {
    const id = mongoId(document._id);
    const projectId = mongoId(document.project);
    const ownerId = mongoId(document.employeeId);
    if (!id) {
      reject(rejected, "inventories", document, "Missing MongoDB _id.");
      continue;
    }
    if (seenInventoryIds.has(id)) {
      reject(rejected, "inventories", document, `Duplicate legacy ID: ${id}.`);
      continue;
    }
    seenInventoryIds.add(id);
    if (projectId && !projectIds.has(projectId)) {
      reject(rejected, "inventories", document, `Project ${projectId} is missing or rejected.`);
      continue;
    }
    if (ownerId && !profileIds.has(ownerId)) {
      warnings.push(`inventories:${id} owner ${ownerId} is missing; owner will be unset.`);
    }
    const rawPrice = document.price;
    const normalizedPrice = decimal(rawPrice);
    if (rawPrice !== undefined && rawPrice !== null && rawPrice !== "" && !normalizedPrice) {
      reject(rejected, "inventories", document, `Invalid price: ${String(rawPrice)}.`);
      continue;
    }
    inventories.push({
      legacyMongoId: id,
      projectLegacyMongoId: projectId,
      ownerLegacyMongoId: ownerId && profileIds.has(ownerId) ? ownerId : undefined,
      uid: text(document.uid),
      sellerName: text(document.sellerName),
      sellerPhone: text(document.sellerPhone),
      sellerEmail: text(document.sellerEmail)?.toLowerCase(),
      sellerCompanyName: text(document.sellerCompamyName) ?? text(document.sellerCompanyName),
      sellerCity: text(document.sellerCity),
      propertyStreetNumber: text(document.propertyStreetNumber),
      propertyNumber: text(document.propertyNumber),
      price: normalizedPrice,
      remarks: text(document.remarks),
      status: inventoryStatus(document.status),
      isArchived: bool(document.isArchived, false),
    });
  }

  return {
    profiles,
    societies,
    projects,
    inventories,
    storageManifest,
    rejected,
    warnings,
    sourceCounts: {
      users: collections.users?.length ?? 0,
      employees: collections.employees?.length ?? 0,
      societies: collections.societies?.length ?? 0,
      projects: collections.projects?.length ?? 0,
      inventories: collections.inventories?.length ?? 0,
    },
  };
}

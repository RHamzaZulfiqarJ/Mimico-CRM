"use server";

import { revalidatePath } from "next/cache";

import {
  leadCsvMaxBytes,
  normalizedLookup,
  normalizedPhone,
  parseImportDate,
  parseImportPriority,
  parseImportStage,
  parseLeadCsv,
  type LeadImportError,
  type LeadImportState,
  validateLeadImportRow,
} from "@/features/leads/csv-import";
import { leadUidFromId } from "@/features/leads/identifiers";
import { canManageOrganization, isStaff } from "@/lib/auth/authorization";
import { getAuthContext } from "@/lib/auth/session";
import { getDatabase } from "@/lib/database";

const visibleErrorLimit = 100;

function errorState(message: string, errors: LeadImportError[] = []): LeadImportState {
  return {
    status: "error",
    message,
    errorCount: errors.length,
    errors: errors.slice(0, visibleErrorLimit),
  };
}

export async function importLeadsAction(
  _state: LeadImportState,
  formData: FormData,
): Promise<LeadImportState> {
  const auth = await getAuthContext();
  if (!auth || !isStaff(auth.membership.role)) {
    return errorState("You are not authorized to import leads.");
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return errorState("Choose a non-empty CSV file.");
  }
  if (!file.name.toLocaleLowerCase().endsWith(".csv")) {
    return errorState("The import file must use the .csv extension.");
  }
  if (file.size > leadCsvMaxBytes) {
    return errorState("The CSV file must be smaller than 750 KB.");
  }

  let parsedCsv: ReturnType<typeof parseLeadCsv>;
  try {
    parsedCsv = parseLeadCsv(await file.text());
  } catch (error) {
    return errorState(error instanceof Error ? error.message : "The CSV file is invalid.");
  }

  const rowErrors: LeadImportError[] = [];
  const validRows: Array<{
    rowNumber: number;
    clientName: string;
    clientPhone: string;
    city?: string;
    area?: string;
    project: string;
    priority: NonNullable<ReturnType<typeof parseImportPriority>>;
    stage: NonNullable<ReturnType<typeof parseImportStage>>;
    source?: string;
    description?: string;
    followUpAt: Date | null;
    assignedEmail: string;
  }> = [];
  const seenPhones = new Map<string, number>();

  for (const row of parsedCsv.rows) {
    const validated = validateLeadImportRow(row);
    if (!validated.success) {
      for (const issue of validated.error.issues) {
        rowErrors.push({
          row: row.rowNumber,
          field: String(issue.path[0] ?? "row"),
          message: issue.message,
        });
      }
      continue;
    }

    const priority = parseImportPriority(validated.data.priority);
    const stage = parseImportStage(validated.data.stage);
    const followUpAt = parseImportDate(validated.data.follow_up_at);
    const phoneKey = normalizedPhone(validated.data.client_phone);
    if (!priority) {
      rowErrors.push({ row: row.rowNumber, field: "priority", message: "Use a supported priority." });
    }
    if (!stage) {
      rowErrors.push({ row: row.rowNumber, field: "stage", message: "Use a supported stage." });
    }
    if (followUpAt === undefined) {
      rowErrors.push({ row: row.rowNumber, field: "follow_up_at", message: "Use a valid ISO date and time." });
    }
    if (phoneKey.length < 7) {
      rowErrors.push({ row: row.rowNumber, field: "client_phone", message: "Client phone must contain at least 7 digits." });
    }
    const duplicateRow = seenPhones.get(phoneKey);
    if (duplicateRow) {
      rowErrors.push({
        row: row.rowNumber,
        field: "client_phone",
        message: `Duplicates row ${duplicateRow} in this file.`,
      });
    } else {
      seenPhones.set(phoneKey, row.rowNumber);
    }
    if (!canManageOrganization(auth.membership.role) && validated.data.assigned_email) {
      rowErrors.push({
        row: row.rowNumber,
        field: "assigned_email",
        message: "Employees cannot assign imported leads to another team member.",
      });
    }
    if (rowErrors.some((error) => error.row === row.rowNumber)) continue;

    validRows.push({
      rowNumber: row.rowNumber,
      clientName: validated.data.client_name,
      clientPhone: validated.data.client_phone,
      city: validated.data.city || undefined,
      area: validated.data.area || undefined,
      project: validated.data.project,
      priority: priority!,
      stage: stage!,
      source: validated.data.source || undefined,
      description: validated.data.description || undefined,
      followUpAt: followUpAt!,
      assignedEmail: validated.data.assigned_email,
    });
  }

  if (rowErrors.length) {
    return errorState(`Nothing was imported. Fix ${rowErrors.length} row issue${rowErrors.length === 1 ? "" : "s"} and try again.`, rowErrors);
  }

  const database = getDatabase();
  const phones = validRows.map(({ clientPhone }) => clientPhone);
  const management = canManageOrganization(auth.membership.role);
  const [projects, staff, existingLeads, clients] = await Promise.all([
    database.project.findMany({
      where: {
        organizationId: auth.organization.id,
        isArchived: false,
        status: "ACTIVE",
      },
      select: { id: true, uid: true, title: true },
    }),
    management
      ? database.organizationMembership.findMany({
          where: {
            organizationId: auth.organization.id,
            isActive: true,
            role: { in: ["EMPLOYEE", "MANAGER", "SUPER_ADMIN"] },
            profile: { isActive: true },
          },
          select: { profileId: true, profile: { select: { email: true } } },
        })
      : Promise.resolve([]),
    database.lead.findMany({
      where: {
        organizationId: auth.organization.id,
        isArchived: false,
        clientPhone: { in: phones },
      },
      select: { clientPhone: true },
    }),
    database.client.findMany({
      where: {
        organizationId: auth.organization.id,
        isActive: true,
        phone: { in: phones },
      },
      select: { id: true, phone: true },
    }),
  ]);

  const projectByLookup = new Map<string, string | null>();
  for (const project of projects) {
    for (const value of [project.id, project.uid, project.title]) {
      if (!value) continue;
      const key = normalizedLookup(value);
      if (!projectByLookup.has(key)) {
        projectByLookup.set(key, project.id);
      } else if (projectByLookup.get(key) !== project.id) {
        projectByLookup.set(key, null);
      }
    }
  }
  const staffByEmail = new Map(
    staff.flatMap(({ profileId, profile }) =>
      profile.email ? [[normalizedLookup(profile.email), profileId] as const] : [],
    ),
  );
  const existingPhones = new Set(existingLeads.map(({ clientPhone }) => clientPhone));
  const clientByPhone = new Map(clients.map(({ id, phone }) => [phone, id] as const));
  const preparedRows: Array<(typeof validRows)[number] & {
    id: string;
    uid: string;
    projectId?: string;
    assignedProfileId: string;
    clientId?: string;
  }> = [];

  for (const row of validRows) {
    if (existingPhones.has(row.clientPhone)) {
      rowErrors.push({ row: row.rowNumber, field: "client_phone", message: "An active lead already uses this phone number." });
    }
    let projectId: string | undefined;
    if (row.project) {
      const match = projectByLookup.get(normalizedLookup(row.project));
      if (match === null) {
        rowErrors.push({ row: row.rowNumber, field: "project", message: "Project name is ambiguous; use its ID or UID." });
      } else if (!match) {
        rowErrors.push({ row: row.rowNumber, field: "project", message: "Project was not found." });
      } else {
        projectId = match;
      }
    }
    let assignedProfileId = auth.profile.id;
    if (management && row.assignedEmail) {
      const match = staffByEmail.get(normalizedLookup(row.assignedEmail));
      if (!match) {
        rowErrors.push({ row: row.rowNumber, field: "assigned_email", message: "Active staff member was not found." });
      } else {
        assignedProfileId = match;
      }
    }
    if (rowErrors.some((error) => error.row === row.rowNumber)) continue;
    const id = crypto.randomUUID();
    preparedRows.push({
      ...row,
      id,
      uid: leadUidFromId(id),
      projectId,
      assignedProfileId,
      clientId: clientByPhone.get(row.clientPhone),
    });
  }

  if (rowErrors.length) {
    return errorState(`Nothing was imported. Fix ${rowErrors.length} row issue${rowErrors.length === 1 ? "" : "s"} and try again.`, rowErrors);
  }

  try {
    await database.$transaction([
      database.lead.createMany({
        data: preparedRows.map((row) => ({
          id: row.id,
          organizationId: auth.organization.id,
          uid: row.uid,
          clientId: row.clientId,
          projectId: row.projectId,
          createdByProfileId: auth.profile.id,
          clientName: row.clientName,
          clientPhone: row.clientPhone,
          area: row.area,
          city: row.city,
          priority: row.priority,
          stage: row.stage,
          source: row.source ?? "CSV Import",
          description: row.description,
        })),
      }),
      database.leadAssignment.createMany({
        data: preparedRows.map((row) => ({
          organizationId: auth.organization.id,
          leadId: row.id,
          profileId: row.assignedProfileId,
          assignedByProfileId: auth.profile.id,
        })),
      }),
      database.followUp.createMany({
        data: preparedRows.map((row) => ({
          organizationId: auth.organization.id,
          leadId: row.id,
          createdByProfileId: auth.profile.id,
          stage: row.stage,
          followUpAt: row.followUpAt,
          remarks: row.description ?? "Lead imported from CSV.",
        })),
      }),
      database.auditLog.create({
        data: {
          organizationId: auth.organization.id,
          actorProfileId: auth.profile.id,
          action: "leads.csv_imported",
          entityType: "Organization",
          entityId: auth.organization.id,
          metadata: {
            imported: preparedRows.length,
            fileName: file.name.slice(0, 255),
          },
        },
      }),
    ]);
  } catch {
    return errorState("The validated leads could not be imported. No rows were saved.");
  }

  revalidatePath("/leads");
  return {
    status: "success",
    imported: preparedRows.length,
    message: `${preparedRows.length} lead${preparedRows.length === 1 ? "" : "s"} imported successfully.`,
  };
}

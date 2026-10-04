import { z } from "zod";

import { leadPriorities, leadStages } from "@/features/leads/schemas";

export const leadCsvMaxBytes = 750_000;
export const leadCsvMaxRows = 1_000;

export type LeadImportError = {
  row: number;
  field: string;
  message: string;
};

export type ParsedLeadCsvRow = {
  rowNumber: number;
  values: Record<string, string>;
};

export type LeadImportState = {
  status: "idle" | "error" | "success";
  message?: string;
  imported?: number;
  errorCount?: number;
  errors?: LeadImportError[];
};

export const initialLeadImportState: LeadImportState = { status: "idle" };

const requiredHeaders = ["client_name", "client_phone"];
const supportedHeaders = new Set([
  ...requiredHeaders,
  "city",
  "area",
  "project",
  "priority",
  "stage",
  "source",
  "description",
  "follow_up_at",
  "assigned_email",
]);

function normalizeHeader(value: string) {
  return value
    .replace(/^\uFEFF/, "")
    .trim()
    .toLocaleLowerCase()
    .replace(/[\s-]+/g, "_");
}

function parseRecords(input: string) {
  const records: string[][] = [];
  let record: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (quoted) {
      if (character === '"' && input[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
    } else if (character === '"' && field.length === 0) {
      quoted = true;
    } else if (character === ",") {
      record.push(field);
      field = "";
    } else if (character === "\n" || character === "\r") {
      if (character === "\r" && input[index + 1] === "\n") index += 1;
      record.push(field);
      if (record.some((value) => value.trim() !== "")) records.push(record);
      record = [];
      field = "";
    } else {
      field += character;
    }
  }

  if (quoted) throw new Error("The CSV contains an unclosed quoted value.");
  record.push(field);
  if (record.some((value) => value.trim() !== "")) records.push(record);
  return records;
}

export function parseLeadCsv(input: string) {
  const records = parseRecords(input);
  if (!records.length) throw new Error("The CSV file is empty.");
  const headers = records[0].map(normalizeHeader);
  const duplicateHeaders = headers.filter((header, index) => headers.indexOf(header) !== index);
  if (duplicateHeaders.length) {
    throw new Error(`Duplicate CSV header: ${duplicateHeaders[0]}.`);
  }
  const missing = requiredHeaders.filter((header) => !headers.includes(header));
  if (missing.length) throw new Error(`Missing required CSV header: ${missing[0]}.`);
  const unsupported = headers.filter((header) => header && !supportedHeaders.has(header));
  if (unsupported.length) throw new Error(`Unsupported CSV header: ${unsupported[0]}.`);
  const dataRecords = records.slice(1);
  if (!dataRecords.length) throw new Error("The CSV contains headers but no lead rows.");
  if (dataRecords.length > leadCsvMaxRows) {
    throw new Error(`Import at most ${leadCsvMaxRows} leads at a time.`);
  }

  const rows: ParsedLeadCsvRow[] = dataRecords.map((fields, index) => {
    if (fields.length > headers.length) {
      throw new Error(`Row ${index + 2} has more values than the header row.`);
    }
    return {
      rowNumber: index + 2,
      values: Object.fromEntries(
        headers.map((header, headerIndex) => [header, fields[headerIndex]?.trim() ?? ""]),
      ),
    };
  });
  return { headers, rows };
}

const importRowSchema = z.object({
  client_name: z.string().trim().min(2, "Client name must contain at least 2 characters.").max(160),
  client_phone: z.string().trim().min(7, "Client phone must contain at least 7 characters.").max(50),
  city: z.string().trim().max(100).optional().default(""),
  area: z.string().trim().max(120).optional().default(""),
  project: z.string().trim().max(160).optional().default(""),
  priority: z.string().trim().max(40).optional().default(""),
  stage: z.string().trim().max(40).optional().default(""),
  source: z.string().trim().max(100).optional().default(""),
  description: z.string().trim().max(2_000).optional().default(""),
  follow_up_at: z.string().trim().max(50).optional().default(""),
  assigned_email: z.string().trim().max(320).optional().default(""),
});

function enumKey(value: string) {
  return value.trim().toLocaleLowerCase().replace(/[^a-z0-9]/g, "");
}

const priorityByKey = new Map(
  leadPriorities.map((priority) => [enumKey(priority), priority] as const),
);
const stageByKey = new Map(leadStages.map((stage) => [enumKey(stage), stage] as const));

export function parseImportPriority(value: string) {
  if (!value.trim()) return "MODERATE" as const;
  return priorityByKey.get(enumKey(value)) ?? null;
}

export function parseImportStage(value: string) {
  if (!value.trim()) return "NEW_CLIENT" as const;
  return stageByKey.get(enumKey(value)) ?? null;
}

export function parseImportDate(value: string) {
  if (!value.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export function validateLeadImportRow(row: ParsedLeadCsvRow) {
  return importRowSchema.safeParse(row.values);
}

export function normalizedPhone(value: string) {
  return value.replace(/\D/g, "");
}

export function normalizedLookup(value: string) {
  return value.trim().toLocaleLowerCase();
}

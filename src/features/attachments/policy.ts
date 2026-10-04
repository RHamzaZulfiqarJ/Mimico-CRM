import { z } from "zod";

export const attachmentBucket = "crm-attachments";
export const attachmentMaxBytes = 10 * 1024 * 1024;
export const attachmentMimeTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
] as const;

const attachmentExtensionsByMimeType: Record<(typeof attachmentMimeTypes)[number], readonly string[]> = {
  "image/jpeg": ["jpg", "jpeg"],
  "image/png": ["png"],
  "image/webp": ["webp"],
  "application/pdf": ["pdf"],
  "application/msword": ["doc"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ["docx"],
  "application/vnd.ms-excel": ["xls"],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ["xlsx"],
};

export const attachmentMetadataSchema = z
  .object({
    name: z.string().trim().min(1, "File name is required.").max(255),
    type: z.enum(attachmentMimeTypes, { error: "This file type is not supported." }),
    size: z.number().int().positive().max(attachmentMaxBytes, "File must be 10 MB or smaller."),
  })
  .superRefine((file, context) => {
    if (!attachmentExtensionsByMimeType[file.type].includes(attachmentExtension(file.name))) {
      context.addIssue({
        code: "custom",
        path: ["name"],
        message: "The file extension does not match its file type.",
      });
    }
  });

export function attachmentExtension(fileName: string) {
  return fileName.toLocaleLowerCase().match(/\.([a-z0-9]{1,10})$/)?.[1] ?? "bin";
}

export function attachmentObjectPath(
  organizationId: string,
  leadId: string,
  fileName: string,
  objectId = crypto.randomUUID(),
) {
  return `${organizationId}/leads/${leadId}/${objectId}.${attachmentExtension(fileName)}`;
}

export function isLeadAttachmentPath(
  objectPath: string,
  organizationId: string,
  leadId: string,
) {
  return objectPath.startsWith(`${organizationId}/leads/${leadId}/`) && !objectPath.includes("..");
}

export function formatAttachmentSize(bytes: bigint | number | null) {
  if (bytes == null) return "Unknown size";
  const value = Number(bytes);
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

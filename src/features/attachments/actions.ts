"use server";

import { revalidatePath } from "next/cache";

import {
  attachmentBucket,
  attachmentMaxBytes,
  attachmentMetadataSchema,
  attachmentMimeTypes,
  attachmentObjectPath,
  isLeadAttachmentPath,
} from "@/features/attachments/policy";
import { canManageOrganization, isStaff } from "@/lib/auth/authorization";
import { getAuthContext, type AuthContext } from "@/lib/auth/session";
import { getDatabase } from "@/lib/database";
import { createAdminClient } from "@/lib/supabase/admin";

export type AttachmentActionResult =
  | { status: "error"; message: string }
  | { status: "success"; message: string };

export type AttachmentUploadPreparation =
  | { status: "error"; message: string }
  | {
      status: "success";
      bucket: string;
      objectPath: string;
      token: string;
    };

function leadAccessWhere(auth: AuthContext) {
  return canManageOrganization(auth.membership.role)
    ? {}
    : { assignments: { some: { profileId: auth.profile.id } } };
}

async function authorizedLeadForUpload(leadId: string, auth: AuthContext) {
  if (!isStaff(auth.membership.role)) return null;
  return getDatabase().lead.findFirst({
    where: {
      id: leadId,
      organizationId: auth.organization.id,
      isArchived: false,
      ...leadAccessWhere(auth),
    },
    select: { id: true },
  });
}

async function ensureAttachmentBucket() {
  const admin = createAdminClient();
  const existing = await admin.storage.getBucket(attachmentBucket);
  if (existing.data) {
    const allowed = [...(existing.data.allowed_mime_types ?? [])].sort();
    const expected = [...attachmentMimeTypes].sort();
    if (
      existing.data.public ||
      existing.data.file_size_limit !== attachmentMaxBytes ||
      allowed.join("|") !== expected.join("|")
    ) {
      const updated = await admin.storage.updateBucket(attachmentBucket, {
        public: false,
        fileSizeLimit: attachmentMaxBytes,
        allowedMimeTypes: [...attachmentMimeTypes],
      });
      if (updated.error) throw updated.error;
    }
    return admin;
  }

  const created = await admin.storage.createBucket(attachmentBucket, {
    public: false,
    fileSizeLimit: attachmentMaxBytes,
    allowedMimeTypes: [...attachmentMimeTypes],
  });
  if (!created.error) return admin;

  const raced = await admin.storage.getBucket(attachmentBucket);
  if (!raced.data) throw new Error("ATTACHMENT_BUCKET_UNAVAILABLE");
  return admin;
}

export async function prepareLeadAttachmentUploadAction(
  leadId: string,
  input: unknown,
): Promise<AttachmentUploadPreparation> {
  const auth = await getAuthContext();
  if (!auth || !(await authorizedLeadForUpload(leadId, auth))) {
    return { status: "error", message: "You are not authorized to upload to this lead." };
  }
  const metadata = attachmentMetadataSchema.safeParse(input);
  if (!metadata.success) {
    return { status: "error", message: metadata.error.issues[0]?.message ?? "The file is invalid." };
  }

  try {
    const admin = await ensureAttachmentBucket();
    const objectPath = attachmentObjectPath(
      auth.organization.id,
      leadId,
      metadata.data.name,
    );
    const signed = await admin.storage
      .from(attachmentBucket)
      .createSignedUploadUrl(objectPath, { upsert: false });
    if (signed.error) throw signed.error;
    return {
      status: "success",
      bucket: attachmentBucket,
      objectPath,
      token: signed.data.token,
    };
  } catch {
    return { status: "error", message: "A secure upload could not be prepared." };
  }
}

export async function completeLeadAttachmentUploadAction(
  leadId: string,
  objectPath: string,
  input: unknown,
): Promise<AttachmentActionResult> {
  const auth = await getAuthContext();
  if (!auth || !(await authorizedLeadForUpload(leadId, auth))) {
    return { status: "error", message: "You are not authorized to attach files to this lead." };
  }
  const metadata = attachmentMetadataSchema.safeParse(input);
  if (
    !metadata.success ||
    !isLeadAttachmentPath(objectPath, auth.organization.id, leadId)
  ) {
    return { status: "error", message: "The uploaded file metadata is invalid." };
  }

  const admin = createAdminClient();
  const separator = objectPath.lastIndexOf("/");
  const folder = objectPath.slice(0, separator);
  const objectName = objectPath.slice(separator + 1);
  const listed = await admin.storage
    .from(attachmentBucket)
    .list(folder, { search: objectName, limit: 10 });
  const stored = listed.data?.find((item) => item.name === objectName && item.id);
  const actualSize = Number(stored?.metadata?.size ?? metadata.data.size);
  const actualType = String(stored?.metadata?.mimetype ?? metadata.data.type);
  if (
    listed.error ||
    !stored ||
    actualSize <= 0 ||
    actualSize > attachmentMaxBytes ||
    !attachmentMimeTypes.includes(actualType as (typeof attachmentMimeTypes)[number])
  ) {
    await admin.storage.from(attachmentBucket).remove([objectPath]);
    return { status: "error", message: "The uploaded file failed verification and was removed." };
  }

  const database = getDatabase();
  const existing = await database.attachment.findUnique({
    where: { bucket_objectPath: { bucket: attachmentBucket, objectPath } },
    select: { id: true },
  });
  if (existing) return { status: "success", message: "Attachment uploaded." };

  try {
    await database.$transaction(async (transaction) => {
      const attachment = await transaction.attachment.create({
        data: {
          organizationId: auth.organization.id,
          leadId,
          createdByProfileId: auth.profile.id,
          bucket: attachmentBucket,
          objectPath,
          originalName: metadata.data.name,
          contentType: actualType,
          sizeBytes: BigInt(actualSize),
        },
      });
      await transaction.auditLog.create({
        data: {
          organizationId: auth.organization.id,
          actorProfileId: auth.profile.id,
          action: "lead_attachment.created",
          entityType: "Attachment",
          entityId: attachment.id,
          metadata: { leadId, contentType: actualType, sizeBytes: actualSize },
        },
      });
    });
  } catch {
    const completedElsewhere = await database.attachment.findUnique({
      where: { bucket_objectPath: { bucket: attachmentBucket, objectPath } },
      select: { id: true },
    });
    if (!completedElsewhere) {
      await admin.storage.from(attachmentBucket).remove([objectPath]);
      return { status: "error", message: "Attachment metadata could not be saved." };
    }
  }

  revalidatePath(`/leads/${leadId}`);
  return { status: "success", message: "Attachment uploaded." };
}

export async function deleteLeadAttachmentAction(attachmentId: string) {
  const auth = await getAuthContext();
  if (!auth || !canManageOrganization(auth.membership.role)) return;

  const database = getDatabase();
  const attachment = await database.attachment.findFirst({
    where: { id: attachmentId, organizationId: auth.organization.id, leadId: { not: null } },
    select: { id: true, leadId: true, bucket: true, objectPath: true },
  });
  if (!attachment?.leadId) return;

  await database.$transaction(async (transaction) => {
    const deleted = await transaction.attachment.deleteMany({
      where: { id: attachment.id, organizationId: auth.organization.id },
    });
    if (deleted.count !== 1) return;
    await transaction.auditLog.create({
      data: {
        organizationId: auth.organization.id,
        actorProfileId: auth.profile.id,
        action: "lead_attachment.deleted",
        entityType: "Attachment",
        entityId: attachment.id,
        metadata: { leadId: attachment.leadId },
      },
    });
  });
  await createAdminClient().storage
    .from(attachment.bucket)
    .remove([attachment.objectPath]);
  revalidatePath(`/leads/${attachment.leadId}`);
}

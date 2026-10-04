"use server";

import { revalidatePath } from "next/cache";

import { Prisma } from "@/generated/prisma/client";
import { clientUidFromId } from "@/features/clients/identifiers";
import {
  clientFormSchema,
  clientStatusSchema,
  type ClientFormState,
} from "@/features/clients/schemas";
import { canManageOrganization, isStaff } from "@/lib/auth/authorization";
import { getAuthContext } from "@/lib/auth/session";
import { getDatabase } from "@/lib/database";

function clientInput(formData: FormData) {
  return {
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    city: formData.get("city"),
    cnic: formData.get("cnic"),
    portalProfileId: formData.get("portalProfileId"),
  };
}

function errorState(message: string): ClientFormState {
  return { status: "error", message };
}

async function validatePortalProfile(
  transaction: Prisma.TransactionClient,
  organizationId: string,
  portalProfileId: string | undefined,
  currentClientId?: string,
) {
  if (!portalProfileId) return null;
  const [membership, existingLink] = await Promise.all([
    transaction.organizationMembership.findFirst({
      where: {
        organizationId,
        profileId: portalProfileId,
        role: "CLIENT",
        isActive: true,
        profile: { isActive: true },
      },
      select: { profileId: true },
    }),
    transaction.client.findFirst({
      where: {
        organizationId,
        portalProfileId,
        ...(currentClientId ? { id: { not: currentClientId } } : {}),
      },
      select: { id: true },
    }),
  ]);
  if (!membership) throw new Error("PORTAL_PROFILE_UNAVAILABLE");
  if (existingLink) throw new Error("PORTAL_PROFILE_LINKED");
  return membership.profileId;
}

function clientError(error: unknown): ClientFormState {
  if (error instanceof Error) {
    if (error.message === "DUPLICATE_PHONE") return errorState("A client with this phone number already exists.");
    if (error.message === "CLIENT_NOT_FOUND") return errorState("This client is no longer available.");
    if (error.message === "PORTAL_PROFILE_UNAVAILABLE") return errorState("The selected portal account is unavailable.");
    if (error.message === "PORTAL_PROFILE_LINKED") return errorState("That portal account is already linked to another client.");
  }
  return errorState("The client could not be saved. Please try again.");
}

export async function createClientAction(
  _state: ClientFormState,
  formData: FormData,
): Promise<ClientFormState> {
  const parsed = clientFormSchema.safeParse(clientInput(formData));
  if (!parsed.success) return { status: "error", errors: parsed.error.flatten().fieldErrors };

  const auth = await getAuthContext();
  if (!auth || !isStaff(auth.membership.role)) return errorState("You cannot create clients.");
  const canLinkPortal = canManageOrganization(auth.membership.role);

  try {
    const database = getDatabase();
    const clientId = crypto.randomUUID();
    await database.$transaction(async (transaction) => {
      const duplicate = await transaction.client.findFirst({
        where: { organizationId: auth.organization.id, phone: parsed.data.phone },
        select: { id: true },
      });
      if (duplicate) throw new Error("DUPLICATE_PHONE");
      const portalProfileId = canLinkPortal
        ? await validatePortalProfile(transaction, auth.organization.id, parsed.data.portalProfileId)
        : null;
      const client = await transaction.client.create({
        data: {
          id: clientId,
          uid: clientUidFromId(clientId),
          organizationId: auth.organization.id,
          portalProfileId,
          firstName: parsed.data.firstName,
          lastName: parsed.data.lastName,
          displayName: `${parsed.data.firstName} ${parsed.data.lastName}`,
          email: parsed.data.email,
          phone: parsed.data.phone,
          city: parsed.data.city,
          cnic: parsed.data.cnic,
        },
      });
      await transaction.auditLog.create({
        data: {
          organizationId: auth.organization.id,
          actorProfileId: auth.profile.id,
          action: "client.created",
          entityType: "Client",
          entityId: client.id,
          metadata: { portalLinked: Boolean(portalProfileId) },
        },
      });
    }, { isolationLevel: "Serializable" });
  } catch (error) {
    return clientError(error);
  }

  revalidatePath("/clients");
  return { status: "success", message: "Client created." };
}

export async function updateClientAction(
  clientId: string,
  _state: ClientFormState,
  formData: FormData,
): Promise<ClientFormState> {
  const parsed = clientFormSchema.safeParse(clientInput(formData));
  if (!parsed.success) return { status: "error", errors: parsed.error.flatten().fieldErrors };

  const auth = await getAuthContext();
  if (!auth || !isStaff(auth.membership.role)) return errorState("You cannot update clients.");
  const canLinkPortal = canManageOrganization(auth.membership.role);

  try {
    const database = getDatabase();
    await database.$transaction(async (transaction) => {
      const current = await transaction.client.findFirst({
        where: { id: clientId, organizationId: auth.organization.id },
        select: { id: true, phone: true, portalProfileId: true },
      });
      if (!current) throw new Error("CLIENT_NOT_FOUND");
      if (current.phone !== parsed.data.phone) {
        const duplicate = await transaction.client.findFirst({
          where: { organizationId: auth.organization.id, phone: parsed.data.phone, id: { not: current.id } },
          select: { id: true },
        });
        if (duplicate) throw new Error("DUPLICATE_PHONE");
      }
      const portalProfileId = canLinkPortal
        ? await validatePortalProfile(transaction, auth.organization.id, parsed.data.portalProfileId, current.id)
        : current.portalProfileId;
      await transaction.client.update({
        where: { id: current.id },
        data: {
          portalProfileId,
          firstName: parsed.data.firstName,
          lastName: parsed.data.lastName,
          displayName: `${parsed.data.firstName} ${parsed.data.lastName}`,
          email: parsed.data.email,
          phone: parsed.data.phone,
          city: parsed.data.city,
          cnic: parsed.data.cnic,
        },
      });
      await transaction.auditLog.create({
        data: {
          organizationId: auth.organization.id,
          actorProfileId: auth.profile.id,
          action: "client.updated",
          entityType: "Client",
          entityId: current.id,
          metadata: { portalLinked: Boolean(portalProfileId) },
        },
      });
    }, { isolationLevel: "Serializable" });
  } catch (error) {
    return clientError(error);
  }

  revalidatePath("/clients");
  return { status: "success", message: "Client updated." };
}

export async function setClientStatusAction(clientId: string, active: string) {
  const parsed = clientStatusSchema.safeParse({ clientId, active });
  if (!parsed.success) return;
  const auth = await getAuthContext();
  if (!auth || !canManageOrganization(auth.membership.role)) return;

  const database = getDatabase();
  await database.$transaction(async (transaction) => {
    const updated = await transaction.client.updateMany({
      where: {
        id: parsed.data.clientId,
        organizationId: auth.organization.id,
        isActive: { not: parsed.data.active },
      },
      data: { isActive: parsed.data.active },
    });
    if (updated.count !== 1) return;
    await transaction.auditLog.create({
      data: {
        organizationId: auth.organization.id,
        actorProfileId: auth.profile.id,
        action: parsed.data.active ? "client.reactivated" : "client.deactivated",
        entityType: "Client",
        entityId: parsed.data.clientId,
      },
    });
  });
  revalidatePath("/clients");
}

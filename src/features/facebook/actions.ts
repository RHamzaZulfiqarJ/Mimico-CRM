"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  facebookIntegrationSchema,
  facebookLeadConversionSchema,
  type FacebookConnectionFormState,
  type FacebookIntegrationFormState,
  type FacebookLeadFormState,
} from "@/features/facebook/schemas";
import { fetchFacebookPageIdentity } from "@/features/facebook/graph";
import { getNamedServerSecret } from "@/features/facebook/security";
import { leadUidFromId } from "@/features/leads/identifiers";
import { canManageOrganization, isStaff } from "@/lib/auth/authorization";
import { getAuthContext } from "@/lib/auth/session";
import { getDatabase } from "@/lib/database";

export async function saveFacebookIntegrationAction(
  _state: FacebookIntegrationFormState,
  formData: FormData,
): Promise<FacebookIntegrationFormState> {
  const parsed = facebookIntegrationSchema.safeParse({
    pageId: formData.get("pageId"),
    appId: formData.get("appId"),
    verifyTokenSecretName: formData.get("verifyTokenSecretName"),
    appSecretName: formData.get("appSecretName"),
    pageAccessTokenSecretName: formData.get("pageAccessTokenSecretName"),
  });
  if (!parsed.success) {
    return { status: "error", errors: parsed.error.flatten().fieldErrors };
  }

  const auth = await getAuthContext();
  if (!auth || !canManageOrganization(auth.membership.role)) {
    return { status: "error", message: "You are not authorized to manage integrations." };
  }

  try {
    const database = getDatabase();
    await database.$transaction(async (transaction) => {
      const integration = await transaction.facebookIntegration.upsert({
        where: {
          organizationId_pageId: {
            organizationId: auth.organization.id,
            pageId: parsed.data.pageId,
          },
        },
        create: {
          organizationId: auth.organization.id,
          ...parsed.data,
        },
        update: {
          appId: parsed.data.appId,
          verifyTokenSecretName: parsed.data.verifyTokenSecretName,
          appSecretName: parsed.data.appSecretName,
          pageAccessTokenSecretName: parsed.data.pageAccessTokenSecretName,
          isActive: true,
        },
      });
      await transaction.auditLog.create({
        data: {
          organizationId: auth.organization.id,
          actorProfileId: auth.profile.id,
          action: "facebook_integration.saved",
          entityType: "FacebookIntegration",
          entityId: integration.id,
          metadata: {
            pageId: integration.pageId,
            appId: integration.appId,
            secretNames: {
              verifyToken: integration.verifyTokenSecretName,
              appSecret: integration.appSecretName,
              pageAccessToken: integration.pageAccessTokenSecretName,
            },
          },
        },
      });
    });
  } catch {
    return {
      status: "error",
      message: "The Facebook integration could not be saved. Please try again.",
    };
  }

  revalidatePath("/integrations/facebook");
  return {
    status: "success",
    message: "Facebook page configuration saved. Add the referenced secrets to Vercel before verifying the webhook.",
  };
}

export async function checkFacebookIntegrationAction(
  integrationId: string,
  _state: FacebookConnectionFormState,
): Promise<FacebookConnectionFormState> {
  void _state;
  const auth = await getAuthContext();
  if (!auth || !canManageOrganization(auth.membership.role)) {
    return { status: "error", message: "You are not authorized to test integrations." };
  }

  try {
    const integration = await getDatabase().facebookIntegration.findFirst({
      where: {
        id: integrationId,
        organizationId: auth.organization.id,
        isActive: true,
      },
      select: { pageId: true, pageAccessTokenSecretName: true },
    });
    if (!integration) {
      return { status: "error", message: "The Facebook integration is unavailable." };
    }
    const pageAccessToken = getNamedServerSecret(integration.pageAccessTokenSecretName);
    if (!pageAccessToken) {
      return {
        status: "error",
        message: `${integration.pageAccessTokenSecretName} is missing from the server environment.`,
      };
    }
    const identity = await fetchFacebookPageIdentity(pageAccessToken);
    if (identity.id !== integration.pageId) {
      return {
        status: "error",
        message: `Token belongs to Page ${identity.id}, not configured Page ${integration.pageId}.`,
      };
    }
    return {
      status: "success",
      message: `Connected to ${identity.name} (${identity.id}).`,
    };
  } catch {
    return {
      status: "error",
      message: "Facebook rejected the Page token, or the Graph API could not be reached.",
    };
  }
}

function unauthorizedLeadState(): FacebookLeadFormState {
  return { status: "error", message: "You are not authorized to change this Facebook lead." };
}

export async function declineFacebookLeadAction(
  inboundLeadId: string,
  _state: FacebookLeadFormState,
): Promise<FacebookLeadFormState> {
  void _state;
  const auth = await getAuthContext();
  if (!auth || !isStaff(auth.membership.role)) return unauthorizedLeadState();

  try {
    const database = getDatabase();
    await database.$transaction(async (transaction) => {
      const claim = await transaction.facebookLeadClaim.findFirst({
        where: {
          inboundLeadId,
          organizationId: auth.organization.id,
          profileId: auth.profile.id,
        },
        select: {
          id: true,
          status: true,
          inboundLead: { select: { status: true, expiresAt: true } },
        },
      });
      if (
        !claim ||
        claim.status !== "PENDING" ||
        claim.inboundLead.status !== "PENDING" ||
        (claim.inboundLead.expiresAt && claim.inboundLead.expiresAt <= new Date())
      ) {
        throw new Error("LEAD_UNAVAILABLE");
      }

      const updated = await transaction.facebookLeadClaim.updateMany({
        where: { id: claim.id, status: "PENDING" },
        data: { status: "REJECTED", respondedAt: new Date() },
      });
      if (updated.count !== 1) throw new Error("LEAD_UNAVAILABLE");
      await transaction.auditLog.create({
        data: {
          organizationId: auth.organization.id,
          actorProfileId: auth.profile.id,
          action: "facebook_lead.declined",
          entityType: "FacebookInboundLead",
          entityId: inboundLeadId,
        },
      });
    });
  } catch (error) {
    if (error instanceof Error && error.message === "LEAD_UNAVAILABLE") {
      return { status: "error", message: "This lead is no longer available." };
    }
    return { status: "error", message: "The Facebook lead could not be declined." };
  }

  revalidatePath("/leads/facebook");
  return { status: "success", message: "Lead declined for your inbox." };
}

export async function convertFacebookLeadAction(
  inboundLeadId: string,
  _state: FacebookLeadFormState,
  formData: FormData,
): Promise<FacebookLeadFormState> {
  const parsed = facebookLeadConversionSchema.safeParse({
    clientName: formData.get("clientName"),
    clientPhone: formData.get("clientPhone"),
    projectId: formData.get("projectId"),
    area: formData.get("area"),
    city: formData.get("city"),
    priority: formData.get("priority"),
    stage: formData.get("stage"),
    description: formData.get("description"),
    followUpAt: formData.get("followUpAt"),
  });
  if (!parsed.success) {
    return { status: "error", errors: parsed.error.flatten().fieldErrors };
  }

  const auth = await getAuthContext();
  if (!auth || !isStaff(auth.membership.role)) return unauthorizedLeadState();
  const management = canManageOrganization(auth.membership.role);
  let createdLeadId: string | null = null;

  try {
    const database = getDatabase();
    createdLeadId = await database.$transaction(async (transaction) => {
      const inbound = await transaction.facebookInboundLead.findFirst({
        where: { id: inboundLeadId, organizationId: auth.organization.id },
        select: {
          id: true,
          status: true,
          expiresAt: true,
          providerLeadId: true,
          claims: {
            where: { profileId: auth.profile.id },
            select: { id: true, status: true },
          },
        },
      });
      const ownClaim = inbound?.claims[0];
      if (
        !inbound ||
        inbound.status !== "PENDING" ||
        (inbound.expiresAt && inbound.expiresAt <= new Date()) ||
        (!management && ownClaim?.status !== "PENDING")
      ) {
        throw new Error("LEAD_UNAVAILABLE");
      }

      const [duplicate, project, client] = await Promise.all([
        transaction.lead.findFirst({
          where: {
            organizationId: auth.organization.id,
            clientPhone: parsed.data.clientPhone,
            isArchived: false,
          },
          select: { id: true },
        }),
        parsed.data.projectId
          ? transaction.project.findFirst({
              where: {
                id: parsed.data.projectId,
                organizationId: auth.organization.id,
                isArchived: false,
                status: "ACTIVE",
              },
              select: { id: true },
            })
          : Promise.resolve(null),
        transaction.client.findFirst({
          where: {
            organizationId: auth.organization.id,
            phone: parsed.data.clientPhone,
            isActive: true,
          },
          select: { id: true },
        }),
      ]);
      if (duplicate) throw new Error("DUPLICATE_PHONE");
      if (parsed.data.projectId && !project) throw new Error("PROJECT_NOT_FOUND");

      const claimed = await transaction.facebookInboundLead.updateMany({
        where: {
          id: inbound.id,
          organizationId: auth.organization.id,
          status: "PENDING",
          acceptedByProfileId: null,
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
        data: {
          status: "ACCEPTED",
          acceptedByProfileId: auth.profile.id,
          acceptedAt: new Date(),
        },
      });
      if (claimed.count !== 1) throw new Error("LEAD_UNAVAILABLE");

      const leadId = crypto.randomUUID();
      const uid = leadUidFromId(leadId);
      await transaction.lead.create({
        data: {
          id: leadId,
          organizationId: auth.organization.id,
          uid,
          clientId: client?.id,
          projectId: project?.id,
          createdByProfileId: auth.profile.id,
          clientName: parsed.data.clientName,
          clientPhone: parsed.data.clientPhone,
          area: parsed.data.area,
          city: parsed.data.city,
          priority: parsed.data.priority,
          stage: parsed.data.stage,
          source: "Facebook",
          description: parsed.data.description,
          assignments: {
            create: {
              organizationId: auth.organization.id,
              profileId: auth.profile.id,
              assignedByProfileId: auth.profile.id,
            },
          },
          followUps: {
            create: {
              organizationId: auth.organization.id,
              createdByProfileId: auth.profile.id,
              stage: parsed.data.stage,
              followUpAt: parsed.data.followUpAt
                ? new Date(parsed.data.followUpAt)
                : null,
              remarks: parsed.data.description ?? "Facebook lead converted.",
            },
          },
        },
      });
      await transaction.facebookInboundLead.update({
        where: { id: inbound.id },
        data: { status: "CONVERTED", convertedLeadId: leadId },
      });
      await transaction.facebookLeadClaim.updateMany({
        where: { inboundLeadId: inbound.id, profileId: { not: auth.profile.id } },
        data: { status: "DISMISSED", respondedAt: new Date() },
      });
      await transaction.facebookLeadClaim.upsert({
        where: {
          inboundLeadId_profileId: {
            inboundLeadId: inbound.id,
            profileId: auth.profile.id,
          },
        },
        create: {
          organizationId: auth.organization.id,
          inboundLeadId: inbound.id,
          profileId: auth.profile.id,
          status: "ACCEPTED",
          respondedAt: new Date(),
        },
        update: { status: "ACCEPTED", respondedAt: new Date() },
      });
      await transaction.auditLog.create({
        data: {
          organizationId: auth.organization.id,
          actorProfileId: auth.profile.id,
          action: "facebook_lead.converted",
          entityType: "FacebookInboundLead",
          entityId: inbound.id,
          metadata: { leadId, uid, providerLeadId: inbound.providerLeadId },
        },
      });
      await transaction.auditLog.create({
        data: {
          organizationId: auth.organization.id,
          actorProfileId: auth.profile.id,
          action: "lead.created",
          entityType: "Lead",
          entityId: leadId,
          metadata: {
            uid,
            assignedProfileId: auth.profile.id,
            projectId: project?.id ?? null,
            source: "facebook_lead",
            facebookInboundLeadId: inbound.id,
          },
        },
      });
      return leadId;
    });
  } catch (error) {
    if (error instanceof Error && error.message === "LEAD_UNAVAILABLE") {
      return { status: "error", message: "Another team member claimed this lead, or it expired." };
    }
    if (error instanceof Error && error.message === "DUPLICATE_PHONE") {
      return { status: "error", message: "An active CRM lead already uses this phone number." };
    }
    if (error instanceof Error && error.message === "PROJECT_NOT_FOUND") {
      return { status: "error", message: "The selected project is unavailable." };
    }
    return { status: "error", message: "The Facebook lead could not be converted." };
  }

  revalidatePath("/leads/facebook");
  revalidatePath("/leads");
  if (createdLeadId) redirect(`/leads/${createdLeadId}`);
  return { status: "error", message: "The Facebook lead could not be converted." };
}

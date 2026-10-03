"use server";

import { revalidatePath } from "next/cache";

import {
  facebookIntegrationSchema,
  type FacebookIntegrationFormState,
} from "@/features/facebook/schemas";
import { canManageOrganization } from "@/lib/auth/authorization";
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

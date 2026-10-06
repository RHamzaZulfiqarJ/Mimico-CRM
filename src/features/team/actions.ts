"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import {
  canAssignRole,
  canManageMember,
  canManageOrganization,
} from "@/lib/auth/authorization";
import { getAuthContext } from "@/lib/auth/session";
import { getDatabase } from "@/lib/database";
import { getPublicEnvironment, hasAdminEnvironment } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveAuthRedirectOrigin } from "@/lib/auth/redirect-origin";
import {
  inviteMemberSchema,
  membershipChangeSchema,
  membershipStatusSchema,
  type TeamFormState,
} from "@/features/team/schemas";

function unauthorizedState(): TeamFormState {
  return { status: "error", message: "You cannot manage organization members." };
}

function saveErrorState(): TeamFormState {
  return { status: "error", message: "The membership change could not be saved." };
}

function invitationErrorState(error: { message: string }): TeamFormState {
  const message = error.message.toLowerCase();
  if (message.includes("rate limit")) {
    return {
      status: "error",
      message: "Supabase's email rate limit was reached. Wait a few minutes, then retry.",
    };
  }
  if (message.includes("authorized") || message.includes("smtp")) {
    return {
      status: "error",
      message: "Supabase could not deliver this email. Configure production SMTP or authorize the recipient in the Supabase project.",
    };
  }
  return {
    status: "error",
    message: `Supabase invitation failed: ${error.message}`,
  };
}

async function findAuthUserByEmail(
  admin: ReturnType<typeof createAdminClient>,
  email: string,
) {
  const normalizedEmail = email.toLowerCase();
  const perPage = 200;

  for (let page = 1; page <= 50; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const user = data.users.find(
      ({ email: candidate }) => candidate?.toLowerCase() === normalizedEmail,
    );
    if (user) return user;
    if (data.users.length < perPage) return null;
  }

  return null;
}

export async function inviteMemberAction(
  _state: TeamFormState,
  formData: FormData,
): Promise<TeamFormState> {
  const parsed = inviteMemberSchema.safeParse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    email: formData.get("email"),
    role: formData.get("role"),
  });

  if (!parsed.success) {
    return { status: "error", errors: parsed.error.flatten().fieldErrors };
  }

  const auth = await getAuthContext();
  if (
    !auth ||
    !canManageOrganization(auth.membership.role) ||
    !canAssignRole(auth.membership.role, parsed.data.role)
  ) {
    return unauthorizedState();
  }

  const database = getDatabase();
  const existingProfile = await database.profile.findUnique({
    where: { email: parsed.data.email },
    select: {
      id: true,
      authUserId: true,
      memberships: {
        where: { organizationId: auth.organization.id },
        take: 1,
        select: { id: true },
      },
    },
  });
  const existingMembership = existingProfile?.memberships[0] ?? null;

  const saveIdentity = async (
    authUserId: string,
    action: "membership.created" | "membership.invited" | "membership.identity_reconciled",
  ) => {
    await database.$transaction(async (transaction) => {
      const profile = existingProfile
        ? await transaction.profile.update({
            where: { id: existingProfile.id },
            data: {
              authUserId,
              firstName: parsed.data.firstName,
              lastName: parsed.data.lastName,
              isActive: true,
            },
          })
        : await transaction.profile.create({
            data: {
              authUserId,
              email: parsed.data.email,
              firstName: parsed.data.firstName,
              lastName: parsed.data.lastName,
            },
          });

      const membership = existingMembership
        ? await transaction.organizationMembership.update({
            where: { id: existingMembership.id },
            data: { role: parsed.data.role, isActive: true },
          })
        : await transaction.organizationMembership.create({
            data: {
              organizationId: auth.organization.id,
              profileId: profile.id,
              role: parsed.data.role,
            },
          });

      await transaction.auditLog.create({
        data: {
          organizationId: auth.organization.id,
          actorProfileId: auth.profile.id,
          action,
          entityType: "OrganizationMembership",
          entityId: membership.id,
          metadata: {
            role: parsed.data.role,
            existingIdentity: action !== "membership.invited",
          },
        },
      });
    });
  };

  if (existingProfile?.authUserId && existingMembership) {
    return { status: "error", message: "That person already belongs to this organization." };
  }

  if (existingProfile?.authUserId) {
    try {
      await saveIdentity(existingProfile.authUserId, "membership.created");
    } catch {
      return saveErrorState();
    }
    revalidatePath("/team");
    return { status: "success", message: "Existing account added to the organization." };
  }

  if (!hasAdminEnvironment()) {
    return {
      status: "error",
      message: "Invitations require the server-only Supabase secret key.",
    };
  }

  const admin = createAdminClient();
  const environment = getPublicEnvironment();
  const requestHeaders = await headers();
  const redirectOrigin = resolveAuthRedirectOrigin({
    configuredUrl: environment.NEXT_PUBLIC_APP_URL,
    origin: requestHeaders.get("origin"),
    forwardedHost: requestHeaders.get("x-forwarded-host"),
    forwardedProto: requestHeaders.get("x-forwarded-proto"),
    host: requestHeaders.get("host"),
  });
  const { data: invitation, error: invitationError } =
    await admin.auth.admin.inviteUserByEmail(parsed.data.email, {
      data: {
        first_name: parsed.data.firstName,
        last_name: parsed.data.lastName,
      },
      redirectTo: new URL(
        "/auth/complete/invite",
        redirectOrigin,
      ).toString(),
    });

  if (invitationError || !invitation.user) {
    if (invitationError) {
      try {
        const existingAuthUser = await findAuthUserByEmail(admin, parsed.data.email);
        if (existingAuthUser?.email_confirmed_at) {
          await saveIdentity(
            existingAuthUser.id,
            "membership.identity_reconciled",
          );
          revalidatePath("/team");
          return {
            status: "success",
            message:
              "The existing Supabase account was linked to this organization. The employee can now use Forgot Password to create a password.",
          };
        }
        if (existingAuthUser) {
          return {
            status: "error",
            message:
              "An unconfirmed Supabase Auth user already exists for this email. Remove that pending Auth user in Supabase, then resend the invitation.",
          };
        }
      } catch {
        // Preserve the original invitation error when the reconciliation lookup fails.
      }
      return invitationErrorState(invitationError);
    }
    return {
      status: "error",
      message: "Supabase accepted the invitation request but returned no user.",
    };
  }

  try {
    await saveIdentity(invitation.user.id, "membership.invited");
  } catch {
    const { error: rollbackError } = await admin.auth.admin.deleteUser(
      invitation.user.id,
    );
    return rollbackError
      ? {
          status: "error",
          message:
            "Provisioning failed and the newly invited Auth user requires manual cleanup.",
        }
      : saveErrorState();
  }

  revalidatePath("/team");
  return { status: "success", message: "Invitation sent and membership created." };
}

export async function changeMemberRoleAction(
  membershipId: string,
  formData: FormData,
) {
  const parsed = membershipChangeSchema.safeParse({
    membershipId,
    role: formData.get("role"),
  });
  if (!parsed.success) return;

  const auth = await getAuthContext();
  if (!auth || !canManageOrganization(auth.membership.role)) return;

  const database = getDatabase();
  await database.$transaction(async (transaction) => {
    const target = await transaction.organizationMembership.findFirst({
      where: { id: parsed.data.membershipId, organizationId: auth.organization.id },
      select: { id: true, profileId: true, role: true, isActive: true },
    });

    if (
      !target ||
      target.profileId === auth.profile.id ||
      !canManageMember(auth.membership.role, target.role) ||
      !canAssignRole(auth.membership.role, parsed.data.role)
    ) return;

    if (
      target.isActive &&
      ["MANAGER", "SUPER_ADMIN"].includes(target.role) &&
      !["MANAGER", "SUPER_ADMIN"].includes(parsed.data.role)
    ) {
      const managementCount = await transaction.organizationMembership.count({
        where: {
          organizationId: auth.organization.id,
          isActive: true,
          role: { in: ["MANAGER", "SUPER_ADMIN"] },
        },
      });
      if (managementCount <= 1) return;
    }

    await transaction.organizationMembership.update({
      where: { id: target.id },
      data: { role: parsed.data.role },
    });
    await transaction.auditLog.create({
      data: {
        organizationId: auth.organization.id,
        actorProfileId: auth.profile.id,
        action: "membership.role_changed",
        entityType: "OrganizationMembership",
        entityId: target.id,
        metadata: { from: target.role, to: parsed.data.role },
      },
    });
  }, { isolationLevel: "Serializable" });

  revalidatePath("/team");
}

export async function setMembershipStatusAction(
  membershipId: string,
  active: string,
) {
  const parsed = membershipStatusSchema.safeParse({ membershipId, active });
  if (!parsed.success) return;

  const auth = await getAuthContext();
  if (!auth || !canManageOrganization(auth.membership.role)) return;

  const database = getDatabase();
  await database.$transaction(async (transaction) => {
    const target = await transaction.organizationMembership.findFirst({
      where: { id: parsed.data.membershipId, organizationId: auth.organization.id },
      select: { id: true, profileId: true, role: true, isActive: true },
    });

    if (
      !target ||
      target.profileId === auth.profile.id ||
      !canManageMember(auth.membership.role, target.role) ||
      target.isActive === parsed.data.active
    ) return;

    if (
      !parsed.data.active &&
      ["MANAGER", "SUPER_ADMIN"].includes(target.role)
    ) {
      const managementCount = await transaction.organizationMembership.count({
        where: {
          organizationId: auth.organization.id,
          isActive: true,
          role: { in: ["MANAGER", "SUPER_ADMIN"] },
        },
      });
      if (managementCount <= 1) return;
    }

    await transaction.organizationMembership.update({
      where: { id: target.id },
      data: { isActive: parsed.data.active },
    });
    await transaction.auditLog.create({
      data: {
        organizationId: auth.organization.id,
        actorProfileId: auth.profile.id,
        action: parsed.data.active
          ? "membership.reactivated"
          : "membership.deactivated",
        entityType: "OrganizationMembership",
        entityId: target.id,
      },
    });
  }, { isolationLevel: "Serializable" });

  revalidatePath("/team");
}

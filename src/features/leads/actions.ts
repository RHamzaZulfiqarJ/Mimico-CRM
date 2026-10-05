"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  assignmentSchema,
  createLeadSchema,
  followUpSchema,
  type LeadFormState,
  updateLeadSchema,
} from "@/features/leads/schemas";
import { leadUidFromId } from "@/features/leads/identifiers";
import {
  canDeleteOperationalRecord,
  canManageOrganization,
  isStaff,
  type MembershipRole,
} from "@/lib/auth/authorization";
import { getAuthContext } from "@/lib/auth/session";
import { getDatabase } from "@/lib/database";

function unauthorizedState(): LeadFormState {
  return { status: "error", message: "You are not authorized to change this lead." };
}

function databaseErrorState(): LeadFormState {
  return { status: "error", message: "The lead could not be saved. Please try again." };
}

function employeeLeadAccess(role: MembershipRole, profileId: string) {
  return canManageOrganization(role)
    ? {}
    : { assignments: { some: { profileId } } };
}

export async function createLeadAction(
  _state: LeadFormState,
  formData: FormData,
): Promise<LeadFormState> {
  const parsed = createLeadSchema.safeParse({
    clientName: formData.get("clientName"),
    clientPhone: formData.get("clientPhone"),
    projectId: formData.get("projectId"),
    assignedProfileId: formData.get("assignedProfileId"),
    area: formData.get("area"),
    city: formData.get("city"),
    priority: formData.get("priority"),
    stage: formData.get("stage"),
    source: formData.get("source"),
    description: formData.get("description"),
    followUpAt: formData.get("followUpAt"),
  });
  if (!parsed.success) {
    return { status: "error", errors: parsed.error.flatten().fieldErrors };
  }

  const auth = await getAuthContext();
  if (!auth || !isStaff(auth.membership.role)) return unauthorizedState();

  const assignedProfileId = canManageOrganization(auth.membership.role)
    ? (parsed.data.assignedProfileId ?? auth.profile.id)
    : auth.profile.id;

  try {
    const database = getDatabase();
    const [duplicate, project, assignee, client] = await Promise.all([
      database.lead.findFirst({
        where: {
          organizationId: auth.organization.id,
          clientPhone: parsed.data.clientPhone,
          isArchived: false,
        },
        select: { id: true },
      }),
      parsed.data.projectId
        ? database.project.findFirst({
            where: {
              id: parsed.data.projectId,
              organizationId: auth.organization.id,
              isArchived: false,
              status: "ACTIVE",
            },
            select: { id: true },
          })
        : Promise.resolve(null),
      database.organizationMembership.findFirst({
        where: {
          organizationId: auth.organization.id,
          profileId: assignedProfileId,
          isActive: true,
          role: { in: ["EMPLOYEE", "MANAGER", "SUPER_ADMIN"] },
          profile: { isActive: true },
        },
        select: { profileId: true },
      }),
      database.client.findFirst({
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
    if (!assignee) throw new Error("ASSIGNEE_NOT_FOUND");

    const leadId = crypto.randomUUID();
    const leadUid = leadUidFromId(leadId);
    await database.$transaction([
      database.lead.create({
        data: {
          id: leadId,
          organizationId: auth.organization.id,
          uid: leadUid,
          clientId: client?.id,
          projectId: project?.id,
          createdByProfileId: auth.profile.id,
          clientName: parsed.data.clientName,
          clientPhone: parsed.data.clientPhone,
          area: parsed.data.area,
          city: parsed.data.city,
          priority: parsed.data.priority,
          stage: parsed.data.stage,
          source: parsed.data.source,
          description: parsed.data.description,
          assignments: {
            create: {
              organizationId: auth.organization.id,
              profileId: assignedProfileId,
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
              remarks: parsed.data.description ?? "Lead created.",
            },
          },
        },
      }),
      database.auditLog.create({
        data: {
          organizationId: auth.organization.id,
          actorProfileId: auth.profile.id,
          action: "lead.created",
          entityType: "Lead",
          entityId: leadId,
          metadata: {
            uid: leadUid,
            assignedProfileId,
            projectId: project?.id ?? null,
          },
        },
      }),
    ]);
  } catch (error) {
    if (error instanceof Error && error.message === "DUPLICATE_PHONE") {
      return { status: "error", message: "An active lead already uses this phone number." };
    }
    if (error instanceof Error && error.message === "PROJECT_NOT_FOUND") {
      return { status: "error", message: "The selected project is unavailable." };
    }
    if (error instanceof Error && error.message === "ASSIGNEE_NOT_FOUND") {
      return { status: "error", message: "The selected assignee is unavailable." };
    }
    return databaseErrorState();
  }

  revalidatePath("/leads");
  return { status: "success", message: "Lead created." };
}

export async function updateLeadAction(
  leadId: string,
  _state: LeadFormState,
  formData: FormData,
): Promise<LeadFormState> {
  const parsed = updateLeadSchema.safeParse({
    projectId: formData.get("projectId"),
    priority: formData.get("priority"),
    stage: formData.get("stage"),
  });
  if (!parsed.success) {
    return { status: "error", errors: parsed.error.flatten().fieldErrors };
  }

  const auth = await getAuthContext();
  if (!auth || !isStaff(auth.membership.role)) return unauthorizedState();

  try {
    const database = getDatabase();
    await database.$transaction(async (transaction) => {
      const [lead, project] = await Promise.all([
        transaction.lead.findFirst({
          where: {
            id: leadId,
            organizationId: auth.organization.id,
            isArchived: false,
            ...employeeLeadAccess(auth.membership.role, auth.profile.id),
          },
          select: { id: true, stage: true, priority: true, projectId: true },
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
      ]);
      if (!lead) throw new Error("LEAD_NOT_FOUND");
      if (parsed.data.projectId && !project) throw new Error("PROJECT_NOT_FOUND");

      await transaction.lead.update({
        where: { id: lead.id },
        data: {
          projectId: project?.id ?? null,
          priority: parsed.data.priority,
          stage: parsed.data.stage,
        },
      });
      await transaction.auditLog.create({
        data: {
          organizationId: auth.organization.id,
          actorProfileId: auth.profile.id,
          action: "lead.updated",
          entityType: "Lead",
          entityId: lead.id,
          metadata: {
            from: { stage: lead.stage, priority: lead.priority, projectId: lead.projectId },
            to: {
              stage: parsed.data.stage,
              priority: parsed.data.priority,
              projectId: project?.id ?? null,
            },
          },
        },
      });
    });
  } catch (error) {
    if (error instanceof Error && error.message === "LEAD_NOT_FOUND") return unauthorizedState();
    if (error instanceof Error && error.message === "PROJECT_NOT_FOUND") {
      return { status: "error", message: "The selected project is unavailable." };
    }
    return databaseErrorState();
  }

  revalidatePath("/leads");
  revalidatePath(`/leads/${leadId}`);
  return { status: "success", message: "Lead updated." };
}

export async function createFollowUpAction(
  leadId: string,
  _state: LeadFormState,
  formData: FormData,
): Promise<LeadFormState> {
  const parsed = followUpSchema.safeParse({
    stage: formData.get("stage"),
    followUpAt: formData.get("followUpAt"),
    remarks: formData.get("remarks"),
  });
  if (!parsed.success) {
    return { status: "error", errors: parsed.error.flatten().fieldErrors };
  }

  const auth = await getAuthContext();
  if (!auth || !isStaff(auth.membership.role)) return unauthorizedState();

  try {
    const database = getDatabase();
    await database.$transaction(async (transaction) => {
      const lead = await transaction.lead.findFirst({
        where: {
          id: leadId,
          organizationId: auth.organization.id,
          isArchived: false,
          ...employeeLeadAccess(auth.membership.role, auth.profile.id),
        },
        select: { id: true, stage: true },
      });
      if (!lead) throw new Error("LEAD_NOT_FOUND");

      const followUp = await transaction.followUp.create({
        data: {
          organizationId: auth.organization.id,
          leadId: lead.id,
          createdByProfileId: auth.profile.id,
          stage: parsed.data.stage,
          followUpAt: parsed.data.followUpAt ? new Date(parsed.data.followUpAt) : null,
          remarks: parsed.data.remarks,
        },
      });
      await transaction.lead.update({
        where: { id: lead.id },
        data: { stage: parsed.data.stage },
      });
      await transaction.auditLog.create({
        data: {
          organizationId: auth.organization.id,
          actorProfileId: auth.profile.id,
          action: "follow_up.created",
          entityType: "Lead",
          entityId: lead.id,
          metadata: {
            followUpId: followUp.id,
            previousStage: lead.stage,
            stage: parsed.data.stage,
          },
        },
      });
    });
  } catch (error) {
    if (error instanceof Error && error.message === "LEAD_NOT_FOUND") return unauthorizedState();
    return databaseErrorState();
  }

  revalidatePath("/leads");
  revalidatePath(`/leads/${leadId}`);
  return { status: "success", message: "Follow-up added." };
}

export async function assignLeadAction(
  leadId: string,
  _state: LeadFormState,
  formData: FormData,
): Promise<LeadFormState> {
  const parsed = assignmentSchema.safeParse({ profileId: formData.get("profileId") });
  if (!parsed.success) {
    return { status: "error", errors: parsed.error.flatten().fieldErrors };
  }

  const auth = await getAuthContext();
  if (!auth || !canManageOrganization(auth.membership.role)) return unauthorizedState();

  try {
    const database = getDatabase();
    await database.$transaction(async (transaction) => {
      const [lead, assignee] = await Promise.all([
        transaction.lead.findFirst({
          where: { id: leadId, organizationId: auth.organization.id, isArchived: false },
          select: { id: true },
        }),
        transaction.organizationMembership.findFirst({
          where: {
            organizationId: auth.organization.id,
            profileId: parsed.data.profileId,
            isActive: true,
            role: { in: ["EMPLOYEE", "MANAGER", "SUPER_ADMIN"] },
            profile: { isActive: true },
          },
          select: { profileId: true },
        }),
      ]);
      if (!lead || !assignee) throw new Error("ASSIGNMENT_NOT_FOUND");

      await transaction.leadAssignment.deleteMany({ where: { leadId: lead.id } });
      await transaction.leadAssignment.create({
        data: {
          organizationId: auth.organization.id,
          leadId: lead.id,
          profileId: assignee.profileId,
          assignedByProfileId: auth.profile.id,
        },
      });
      await transaction.auditLog.create({
        data: {
          organizationId: auth.organization.id,
          actorProfileId: auth.profile.id,
          action: "lead.assigned",
          entityType: "Lead",
          entityId: lead.id,
          metadata: { assignedProfileId: assignee.profileId },
        },
      });
    });
  } catch (error) {
    if (error instanceof Error && error.message === "ASSIGNMENT_NOT_FOUND") {
      return { status: "error", message: "The lead or assignee is unavailable." };
    }
    return databaseErrorState();
  }

  revalidatePath("/leads");
  revalidatePath(`/leads/${leadId}`);
  return { status: "success", message: "Lead reassigned." };
}

export async function archiveLeadAction(leadId: string) {
  const auth = await getAuthContext();
  if (!auth || !canDeleteOperationalRecord(auth.membership.role)) return;

  const database = getDatabase();
  await database.$transaction(async (transaction) => {
    const result = await transaction.lead.updateMany({
      where: { id: leadId, organizationId: auth.organization.id, isArchived: false },
      data: { isArchived: true },
    });
    if (result.count !== 1) return;
    await transaction.auditLog.create({
      data: {
        organizationId: auth.organization.id,
        actorProfileId: auth.profile.id,
        action: "lead.archived",
        entityType: "Lead",
        entityId: leadId,
      },
    });
  });

  revalidatePath("/leads");
  redirect("/leads");
}

export async function restoreLeadAction(leadId: string) {
  const auth = await getAuthContext();
  if (!auth || !canDeleteOperationalRecord(auth.membership.role)) return;

  const database = getDatabase();
  const result = await database.$transaction(async (transaction) => {
    const lead = await transaction.lead.findFirst({
      where: { id: leadId, organizationId: auth.organization.id, isArchived: true },
      select: { id: true, clientPhone: true },
    });
    if (!lead) return "not_found" as const;

    if (lead.clientPhone) {
      const duplicate = await transaction.lead.findFirst({
        where: {
          organizationId: auth.organization.id,
          clientPhone: lead.clientPhone,
          isArchived: false,
        },
        select: { id: true },
      });
      if (duplicate) return "duplicate_phone" as const;
    }

    const restored = await transaction.lead.updateMany({
      where: { id: lead.id, organizationId: auth.organization.id, isArchived: true },
      data: { isArchived: false },
    });
    if (restored.count !== 1) return "not_found" as const;

    await transaction.auditLog.create({
      data: {
        organizationId: auth.organization.id,
        actorProfileId: auth.profile.id,
        action: "lead.restored",
        entityType: "Lead",
        entityId: lead.id,
      },
    });
    return "restored" as const;
  }, { isolationLevel: "Serializable" });

  revalidatePath("/leads");
  if (result === "duplicate_phone") {
    redirect("/leads?archived=true&error=duplicate-phone");
  }
}

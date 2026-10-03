"use server";

import { revalidatePath } from "next/cache";

import {
  createTaskSchema,
  localDateTimeToUtc,
  type TaskFormState,
  updateTaskStatusSchema,
} from "@/features/tasks/schemas";
import { canManageOrganization, isStaff } from "@/lib/auth/authorization";
import { getAuthContext } from "@/lib/auth/session";
import { getDatabase } from "@/lib/database";

function unauthorizedState(): TaskFormState {
  return { status: "error", message: "You are not authorized to change this task." };
}

function databaseErrorState(): TaskFormState {
  return { status: "error", message: "The task could not be saved. Please try again." };
}

function revalidateTaskViews(taskId?: string) {
  revalidatePath("/tasks");
  if (taskId) revalidatePath(`/tasks/${taskId}`);
  revalidatePath("/notifications");
  revalidatePath("/dashboard");
}

export async function createTaskAction(
  _state: TaskFormState,
  formData: FormData,
): Promise<TaskFormState> {
  const parsed = createTaskSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
    dueAt: formData.get("dueAt"),
    timezoneOffset: formData.get("timezoneOffset"),
    assignedProfileId: formData.get("assignedProfileId"),
  });
  if (!parsed.success) {
    return { status: "error", errors: parsed.error.flatten().fieldErrors };
  }

  const auth = await getAuthContext();
  if (!auth || !isStaff(auth.membership.role)) return unauthorizedState();

  const assignedProfileId = canManageOrganization(auth.membership.role)
    ? (parsed.data.assignedProfileId ?? auth.profile.id)
    : auth.profile.id;
  const dueAt = localDateTimeToUtc(parsed.data.dueAt, parsed.data.timezoneOffset);

  try {
    const database = getDatabase();
    await database.$transaction(async (transaction) => {
      const assignee = await transaction.organizationMembership.findFirst({
        where: {
          organizationId: auth.organization.id,
          profileId: assignedProfileId,
          isActive: true,
          role: { in: ["EMPLOYEE", "MANAGER", "SUPER_ADMIN"] },
          profile: { isActive: true },
        },
        select: { profileId: true },
      });
      if (!assignee) throw new Error("ASSIGNEE_NOT_FOUND");

      const task = await transaction.task.create({
        data: {
          organizationId: auth.organization.id,
          assignedToProfileId: assignee.profileId,
          createdByProfileId: auth.profile.id,
          uid: `TSK-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
          title: parsed.data.title,
          description: parsed.data.description,
          dueAt,
        },
      });

      if (assignee.profileId !== auth.profile.id) {
        await transaction.notification.create({
          data: {
            organizationId: auth.organization.id,
            recipientProfileId: assignee.profileId,
            type: "task_assigned",
            title: "New task assigned",
            description: parsed.data.title,
            payload: { taskId: task.id, dueAt: dueAt.toISOString() },
          },
        });
      }

      await transaction.auditLog.create({
        data: {
          organizationId: auth.organization.id,
          actorProfileId: auth.profile.id,
          action: "task.created",
          entityType: "Task",
          entityId: task.id,
          metadata: { assignedProfileId: assignee.profileId, dueAt: dueAt.toISOString() },
        },
      });
    });
  } catch (error) {
    if (error instanceof Error && error.message === "ASSIGNEE_NOT_FOUND") {
      return { status: "error", message: "The selected assignee is unavailable." };
    }
    return databaseErrorState();
  }

  revalidateTaskViews();
  return { status: "success", message: "Task created." };
}

export async function updateTaskStatusAction(
  taskId: string,
  _state: TaskFormState,
  formData: FormData,
): Promise<TaskFormState> {
  const parsed = updateTaskStatusSchema.safeParse({
    status: formData.get("status"),
    outcome: formData.get("outcome"),
    outcomeComment: formData.get("outcomeComment"),
  });
  if (!parsed.success) {
    return { status: "error", errors: parsed.error.flatten().fieldErrors };
  }

  const auth = await getAuthContext();
  if (!auth || !isStaff(auth.membership.role)) return unauthorizedState();

  try {
    const database = getDatabase();
    await database.$transaction(async (transaction) => {
      const task = await transaction.task.findFirst({
        where: {
          id: taskId,
          organizationId: auth.organization.id,
          isArchived: false,
          ...(canManageOrganization(auth.membership.role)
            ? {}
            : { assignedToProfileId: auth.profile.id }),
        },
        select: {
          id: true,
          title: true,
          status: true,
          createdByProfileId: true,
          assignedToProfileId: true,
        },
      });
      if (!task) throw new Error("TASK_NOT_FOUND");

      await transaction.task.update({
        where: { id: task.id },
        data: {
          status: parsed.data.status,
          outcome: parsed.data.status === "COMPLETED" ? parsed.data.outcome : null,
          outcomeComment: parsed.data.outcomeComment,
          completedAt: parsed.data.status === "COMPLETED" ? new Date() : null,
        },
      });

      const recipientProfileId =
        task.createdByProfileId && task.createdByProfileId !== auth.profile.id
          ? task.createdByProfileId
          : task.assignedToProfileId !== auth.profile.id
            ? task.assignedToProfileId
            : null;
      if (recipientProfileId) {
        await transaction.notification.create({
          data: {
            organizationId: auth.organization.id,
            recipientProfileId,
            type: "task_status_changed",
            title: "Task status updated",
            description: `${task.title} is now ${parsed.data.status.toLowerCase().replace("_", " ")}.`,
            payload: { taskId: task.id, status: parsed.data.status },
          },
        });
      }

      await transaction.auditLog.create({
        data: {
          organizationId: auth.organization.id,
          actorProfileId: auth.profile.id,
          action: "task.status_changed",
          entityType: "Task",
          entityId: task.id,
          metadata: {
            from: task.status,
            to: parsed.data.status,
            outcome: parsed.data.outcome ?? null,
          },
        },
      });
    });
  } catch (error) {
    if (error instanceof Error && error.message === "TASK_NOT_FOUND") return unauthorizedState();
    return databaseErrorState();
  }

  revalidateTaskViews(taskId);
  return { status: "success", message: "Task status updated." };
}

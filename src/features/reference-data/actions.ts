"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  canDeleteOperationalRecord,
  isStaff,
} from "@/lib/auth/authorization";
import { getAuthContext } from "@/lib/auth/session";
import { getDatabase } from "@/lib/database";
import {
  inventorySchema,
  projectSchema,
  type ReferenceFormState,
  societySchema,
} from "@/features/reference-data/schemas";

function unauthorizedState(): ReferenceFormState {
  return {
    status: "error",
    message: "Your account is not authorized to change reference data.",
  };
}

function databaseErrorState(): ReferenceFormState {
  return {
    status: "error",
    message: "The record could not be saved. Please try again.",
  };
}

export async function createSocietyAction(
  _state: ReferenceFormState,
  formData: FormData,
): Promise<ReferenceFormState> {
  const parsed = societySchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  const auth = await getAuthContext();
  if (!auth || !isStaff(auth.membership.role)) {
    return unauthorizedState();
  }

  try {
    const database = getDatabase();
    await database.$transaction(async (transaction) => {
      const society = await transaction.society.create({
        data: {
          organizationId: auth.organization.id,
          title: parsed.data.title,
          description: parsed.data.description,
        },
      });

      await transaction.auditLog.create({
        data: {
          organizationId: auth.organization.id,
          actorProfileId: auth.profile.id,
          action: "society.created",
          entityType: "Society",
          entityId: society.id,
        },
      });
    });
  } catch {
    return databaseErrorState();
  }

  revalidatePath("/reference-data");
  return { status: "success", message: "Society created." };
}

export async function createProjectAction(
  _state: ReferenceFormState,
  formData: FormData,
): Promise<ReferenceFormState> {
  const parsed = projectSchema.safeParse({
    societyId: formData.get("societyId"),
    title: formData.get("title"),
    description: formData.get("description"),
    city: formData.get("city"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  const auth = await getAuthContext();
  if (!auth || !isStaff(auth.membership.role)) {
    return unauthorizedState();
  }

  try {
    const database = getDatabase();
    await database.$transaction(async (transaction) => {
      const society = await transaction.society.findFirst({
        where: {
          id: parsed.data.societyId,
          organizationId: auth.organization.id,
          isArchived: false,
        },
        select: { id: true },
      });

      if (!society) {
        throw new Error("SOCIETY_NOT_FOUND");
      }

      const project = await transaction.project.create({
        data: {
          organizationId: auth.organization.id,
          societyId: society.id,
          title: parsed.data.title,
          description: parsed.data.description,
          city: parsed.data.city,
        },
      });

      await transaction.auditLog.create({
        data: {
          organizationId: auth.organization.id,
          actorProfileId: auth.profile.id,
          action: "project.created",
          entityType: "Project",
          entityId: project.id,
          metadata: { societyId: society.id },
        },
      });
    });
  } catch (error) {
    if (error instanceof Error && error.message === "SOCIETY_NOT_FOUND") {
      return {
        status: "error",
        message: "The selected society is unavailable.",
      };
    }
    return databaseErrorState();
  }

  revalidatePath("/reference-data");
  return { status: "success", message: "Project created." };
}

export async function createInventoryAction(
  _state: ReferenceFormState,
  formData: FormData,
): Promise<ReferenceFormState> {
  const parsed = inventorySchema.safeParse({
    projectId: formData.get("projectId"),
    sellerName: formData.get("sellerName"),
    sellerPhone: formData.get("sellerPhone"),
    sellerEmail: formData.get("sellerEmail"),
    sellerCompanyName: formData.get("sellerCompanyName"),
    sellerCity: formData.get("sellerCity"),
    propertyStreetNumber: formData.get("propertyStreetNumber"),
    propertyNumber: formData.get("propertyNumber"),
    price: formData.get("price"),
    remarks: formData.get("remarks"),
    status: formData.get("status"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  const auth = await getAuthContext();
  if (!auth || !isStaff(auth.membership.role)) {
    return unauthorizedState();
  }

  try {
    const database = getDatabase();
    await database.$transaction(async (transaction) => {
      if (parsed.data.projectId) {
        const project = await transaction.project.findFirst({
          where: {
            id: parsed.data.projectId,
            organizationId: auth.organization.id,
            isArchived: false,
          },
          select: { id: true },
        });

        if (!project) {
          throw new Error("PROJECT_NOT_FOUND");
        }
      }

      const inventory = await transaction.inventory.create({
        data: {
          organizationId: auth.organization.id,
          projectId: parsed.data.projectId,
          ownerProfileId: auth.profile.id,
          sellerName: parsed.data.sellerName,
          sellerPhone: parsed.data.sellerPhone,
          sellerEmail: parsed.data.sellerEmail,
          sellerCompanyName: parsed.data.sellerCompanyName,
          sellerCity: parsed.data.sellerCity,
          propertyStreetNumber: parsed.data.propertyStreetNumber,
          propertyNumber: parsed.data.propertyNumber,
          price: parsed.data.price,
          remarks: parsed.data.remarks,
          status: parsed.data.status,
        },
      });

      await transaction.auditLog.create({
        data: {
          organizationId: auth.organization.id,
          actorProfileId: auth.profile.id,
          action: "inventory.created",
          entityType: "Inventory",
          entityId: inventory.id,
          metadata: { projectId: parsed.data.projectId ?? null },
        },
      });
    });
  } catch (error) {
    if (error instanceof Error && error.message === "PROJECT_NOT_FOUND") {
      return {
        status: "error",
        message: "The selected project is unavailable.",
      };
    }
    return databaseErrorState();
  }

  revalidatePath("/reference-data");
  return { status: "success", message: "Inventory record created." };
}

export async function archiveReferenceRecordAction(
  entityType: "society" | "project" | "inventory",
  entityId: string,
) {
  const auth = await getAuthContext();
  if (!auth || !canDeleteOperationalRecord(auth.membership.role)) {
    return;
  }

  const database = getDatabase();
  const auditEntityTypes = {
    society: "Society",
    project: "Project",
    inventory: "Inventory",
  } as const;
  const where = {
    id: entityId,
    organizationId: auth.organization.id,
    isArchived: false,
  };

  const result = await database.$transaction(async (transaction) => {
    if (entityType === "society") {
      const activeProjects = await transaction.project.count({
        where: { societyId: entityId, organizationId: auth.organization.id, isArchived: false },
      });
      if (activeProjects > 0) return "society_has_projects" as const;
    }

    if (entityType === "project") {
      const activeInventory = await transaction.inventory.count({
        where: { projectId: entityId, organizationId: auth.organization.id, isArchived: false },
      });
      if (activeInventory > 0) return "project_has_inventory" as const;
    }

    const result =
      entityType === "society"
        ? await transaction.society.updateMany({ where, data: { isArchived: true } })
        : entityType === "project"
          ? await transaction.project.updateMany({ where, data: { isArchived: true } })
          : await transaction.inventory.updateMany({ where, data: { isArchived: true } });

    if (result.count === 1) {
      await transaction.auditLog.create({
        data: {
          organizationId: auth.organization.id,
          actorProfileId: auth.profile.id,
          action: `${entityType}.archived`,
          entityType: auditEntityTypes[entityType],
          entityId,
        },
      });
      return "archived" as const;
    }

    return "not_found" as const;
  });

  revalidatePath("/reference-data");

  if (result === "society_has_projects") {
    redirect("/reference-data?error=society-has-projects");
  }

  if (result === "project_has_inventory") {
    redirect("/reference-data?error=project-has-inventory");
  }
}

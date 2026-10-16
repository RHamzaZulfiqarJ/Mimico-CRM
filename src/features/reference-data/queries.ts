import { inventoryFiltersSchema } from "@/features/reference-data/schemas";
import { isStaff } from "@/lib/auth/authorization";
import { getAuthContext } from "@/lib/auth/session";
import { getDatabase } from "@/lib/database";

export async function getReferenceData() {
  const auth = await getAuthContext();

  if (!auth || auth.membership.role === "CLIENT") {
    return null;
  }

  const database = getDatabase();
  const organizationId = auth.organization.id;

  const [societies, projects, inventories, counts] = await Promise.all([
    database.society.findMany({
      where: { organizationId, isArchived: false },
      orderBy: [{ title: "asc" }],
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        _count: {
          select: { projects: { where: { isArchived: false } } },
        },
      },
    }),
    database.project.findMany({
      where: { organizationId, isArchived: false },
      orderBy: [{ title: "asc" }],
      select: {
        id: true,
        title: true,
        description: true,
        city: true,
        status: true,
        society: { select: { title: true } },
        _count: {
          select: { inventories: { where: { isArchived: false } } },
        },
      },
    }),
    database.inventory.findMany({
      where: { organizationId, isArchived: false },
      orderBy: [{ createdAt: "desc" }],
      take: 50,
      select: {
        id: true,
        sellerName: true,
        sellerPhone: true,
        propertyNumber: true,
        price: true,
        status: true,
        project: { select: { title: true } },
      },
    }),
    Promise.all([
      database.society.count({ where: { organizationId, isArchived: false } }),
      database.project.count({ where: { organizationId, isArchived: false } }),
      database.inventory.count({ where: { organizationId, isArchived: false } }),
    ]),
  ]);

  return {
    auth,
    societies,
    projects,
    inventories,
    counts: {
      societies: counts[0],
      projects: counts[1],
      inventories: counts[2],
    },
  };
}

export async function getInventoryWorkspace(rawFilters: {
  query?: string;
  view?: string;
  status?: string;
  projectId?: string;
}) {
  const auth = await getAuthContext();
  if (!auth || !isStaff(auth.membership.role)) return null;

  const filters = inventoryFiltersSchema.parse(rawFilters);
  const database = getDatabase();
  const organizationId = auth.organization.id;
  const searchWhere = filters.query
    ? {
        OR: [
          { uid: { contains: filters.query, mode: "insensitive" as const } },
          { sellerName: { contains: filters.query, mode: "insensitive" as const } },
          { sellerPhone: { contains: filters.query, mode: "insensitive" as const } },
          { sellerEmail: { contains: filters.query, mode: "insensitive" as const } },
          { sellerCompanyName: { contains: filters.query, mode: "insensitive" as const } },
          { sellerCity: { contains: filters.query, mode: "insensitive" as const } },
          { propertyNumber: { contains: filters.query, mode: "insensitive" as const } },
          { project: { title: { contains: filters.query, mode: "insensitive" as const } } },
        ],
      }
    : {};
  const baseWhere = {
    organizationId,
    isArchived: false,
    projectId: filters.projectId,
    ...searchWhere,
  };
  const where = { ...baseWhere, status: filters.status };

  const [inventories, projects, total, unsold, underProcess, sold] = await Promise.all([
    database.inventory.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      take: 100,
      select: {
        id: true,
        uid: true,
        sellerName: true,
        sellerPhone: true,
        sellerEmail: true,
        sellerCompanyName: true,
        sellerCity: true,
        propertyStreetNumber: true,
        propertyNumber: true,
        price: true,
        remarks: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        project: { select: { id: true, title: true, city: true } },
        ownerProfile: {
          select: { id: true, firstName: true, lastName: true, username: true, email: true },
        },
      },
    }),
    database.project.findMany({
      where: { organizationId, isArchived: false },
      orderBy: { title: "asc" },
      select: { id: true, title: true },
    }),
    database.inventory.count({ where }),
    database.inventory.count({ where: { ...baseWhere, status: "UNSOLD" } }),
    database.inventory.count({ where: { ...baseWhere, status: "UNDER_PROCESS" } }),
    database.inventory.count({ where: { ...baseWhere, status: "SOLD" } }),
  ]);

  return {
    auth,
    filters,
    inventories,
    projects,
    total,
    counts: { unsold, underProcess, sold },
  };
}

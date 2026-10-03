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

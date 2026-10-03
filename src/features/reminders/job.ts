import { getDatabase } from "@/lib/database";
import {
  getTaskReminderWindow,
  taskReminderDescription,
  taskReminderUid,
} from "@/features/reminders/policy";

const batchSize = 250;

type ReminderTask = {
  id: string;
  organizationId: string;
  assignedToProfileId: string;
  title: string;
  dueAt: Date;
};

function groupByOrganization(tasks: ReminderTask[]) {
  const grouped = new Map<string, ReminderTask[]>();
  for (const task of tasks) {
    const organizationTasks = grouped.get(task.organizationId) ?? [];
    organizationTasks.push(task);
    grouped.set(task.organizationId, organizationTasks);
  }
  return grouped;
}

export async function runTaskReminderJob(now = new Date()) {
  const database = getDatabase();
  const window = getTaskReminderWindow(now);
  let cursor: string | undefined;
  let matched = 0;
  let created = 0;

  do {
    const tasks = await database.task.findMany({
      where: {
        isArchived: false,
        status: { in: ["TODO", "IN_PROGRESS"] },
        dueAt: { gte: window.startsAt, lte: window.endsAt },
        organization: { status: "ACTIVE" },
        assignedTo: { isActive: true },
      },
      orderBy: { id: "asc" },
      take: batchSize,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        organizationId: true,
        assignedToProfileId: true,
        title: true,
        dueAt: true,
      },
    });

    if (!tasks.length) break;
    cursor = tasks.at(-1)?.id;
    const dueTasks = tasks.filter((task): task is ReminderTask => Boolean(task.dueAt));
    matched += dueTasks.length;

    for (const [organizationId, organizationTasks] of groupByOrganization(dueTasks)) {
      const result = await database.$transaction(async (transaction) => {
        const notifications = await transaction.notification.createMany({
          data: organizationTasks.map((task) => ({
            organizationId,
            recipientProfileId: task.assignedToProfileId,
            uid: taskReminderUid(task.id, task.dueAt),
            type: "task_due_soon",
            title: "Task due soon",
            description: taskReminderDescription(task.title, task.dueAt),
            payload: { taskId: task.id, dueAt: task.dueAt.toISOString() },
          })),
          skipDuplicates: true,
        });

        if (notifications.count > 0) {
          await transaction.auditLog.create({
            data: {
              organizationId,
              action: "task.reminders_dispatched",
              entityType: "Organization",
              entityId: organizationId,
              metadata: {
                windowStartsAt: window.startsAt.toISOString(),
                windowEndsAt: window.endsAt.toISOString(),
                matched: organizationTasks.length,
                created: notifications.count,
              },
            },
          });
        }
        return notifications.count;
      });
      created += result;
    }

    if (tasks.length < batchSize) break;
  } while (cursor);

  return {
    window: {
      startsAt: window.startsAt.toISOString(),
      endsAt: window.endsAt.toISOString(),
    },
    matched,
    created,
    skipped: matched - created,
  };
}

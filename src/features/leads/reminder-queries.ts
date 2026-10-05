import { Prisma } from "@/generated/prisma/client";
import { leadReminderFiltersSchema } from "@/features/leads/schemas";
import { canManageOrganization, isStaff } from "@/lib/auth/authorization";
import { getAuthContext } from "@/lib/auth/session";
import { getDatabase } from "@/lib/database";

export const LEAD_REMINDER_PAGE_SIZE = 30;

type ReminderAssignment = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  email: string | null;
};

type ReminderRow = {
  id: string;
  uid: string | null;
  followUpAt: Date;
  stage: "NEW_CLIENT" | "FOLLOW_UP" | "CONTACTED_CLIENT" | "CALL_NOT_ATTEND" | "VISIT_SCHEDULED" | "VISIT_DONE" | "CLOSED_WON" | "CLOSED_LOST";
  remarks: string | null;
  createdAt: Date;
  leadId: string;
  leadUid: string | null;
  clientName: string | null;
  clientPhone: string | null;
  city: string | null;
  projectTitle: string | null;
  assignments: ReminderAssignment[];
};

type ReminderSummaryRow = {
  overdue: number;
  today: number;
  upcoming: number;
};

function reminderScopeSql({
  organizationId,
  profileId,
  canManage,
  query,
}: {
  organizationId: string;
  profileId: string;
  canManage: boolean;
  query?: string;
}) {
  const roleClause = canManage
    ? Prisma.sql``
    : Prisma.sql`
        AND EXISTS (
          SELECT 1
          FROM lead_assignments access_assignment
          WHERE access_assignment.lead_id = lead.id
            AND access_assignment.profile_id = ${profileId}::uuid
        )
      `;
  const searchTerm = query ? `%${query}%` : undefined;
  const searchClause = searchTerm
    ? Prisma.sql`
        AND (
          lead.uid ILIKE ${searchTerm}
          OR lead.client_name ILIKE ${searchTerm}
          OR lead.client_phone ILIKE ${searchTerm}
          OR lead.city ILIKE ${searchTerm}
          OR project.title ILIKE ${searchTerm}
          OR EXISTS (
            SELECT 1
            FROM lead_assignments search_assignment
            JOIN profiles search_profile ON search_profile.id = search_assignment.profile_id
            WHERE search_assignment.lead_id = lead.id
              AND concat_ws(' ', search_profile.first_name, search_profile.last_name, search_profile.username, search_profile.email) ILIKE ${searchTerm}
          )
        )
      `
    : Prisma.sql``;

  return Prisma.sql`
    WITH bounds AS (
      SELECT
        date_trunc('day', now() AT TIME ZONE 'Asia/Karachi') AT TIME ZONE 'Asia/Karachi' AS day_start,
        (date_trunc('day', now() AT TIME ZONE 'Asia/Karachi') + interval '1 day') AT TIME ZONE 'Asia/Karachi' AS day_end,
        date_trunc('month', now() AT TIME ZONE 'Asia/Karachi') AT TIME ZONE 'Asia/Karachi' AS month_start,
        (date_trunc('month', now() AT TIME ZONE 'Asia/Karachi') + interval '1 month') AT TIME ZONE 'Asia/Karachi' AS month_end
    ),
    latest AS (
      SELECT DISTINCT ON (follow_up.lead_id)
        follow_up.id,
        follow_up.lead_id,
        follow_up.follow_up_at
      FROM follow_ups follow_up
      JOIN leads lead ON lead.id = follow_up.lead_id
      LEFT JOIN projects project ON project.id = lead.project_id
      WHERE follow_up.organization_id = ${organizationId}::uuid
        AND lead.organization_id = ${organizationId}::uuid
        AND lead.is_archived = false
        ${roleClause}
        ${searchClause}
      ORDER BY follow_up.lead_id, follow_up.created_at DESC, follow_up.id DESC
    ),
    scoped AS (
      SELECT latest.*
      FROM latest
      WHERE latest.follow_up_at IS NOT NULL
    )
  `;
}

function viewClause(view: "due" | "today" | "upcoming" | "month" | "all") {
  if (view === "today") {
    return Prisma.sql`scoped.follow_up_at >= bounds.day_start AND scoped.follow_up_at < bounds.day_end`;
  }
  if (view === "upcoming") {
    return Prisma.sql`scoped.follow_up_at >= bounds.day_end`;
  }
  if (view === "month") {
    return Prisma.sql`scoped.follow_up_at >= bounds.month_start AND scoped.follow_up_at < bounds.month_end`;
  }
  if (view === "all") return Prisma.sql`true`;
  return Prisma.sql`scoped.follow_up_at < bounds.day_end`;
}

export async function getLeadReminderWorkspace(rawFilters: {
  query?: string;
  view?: string;
  page?: string;
}) {
  const auth = await getAuthContext();
  if (!auth || !isStaff(auth.membership.role)) return null;

  const filters = leadReminderFiltersSchema.parse(rawFilters);
  const database = getDatabase();
  const scope = reminderScopeSql({
    organizationId: auth.organization.id,
    profileId: auth.profile.id,
    canManage: canManageOrganization(auth.membership.role),
    query: filters.query,
  });
  const offset = (filters.page - 1) * LEAD_REMINDER_PAGE_SIZE;
  const selectedView = viewClause(filters.view);

  const remindersPromise = database.$queryRaw<ReminderRow[]>(Prisma.sql`
    ${scope}
    SELECT
      follow_up.id,
      follow_up.uid,
      follow_up.follow_up_at AS "followUpAt",
      follow_up.stage,
      follow_up.remarks,
      follow_up.created_at AS "createdAt",
      lead.id AS "leadId",
      lead.uid AS "leadUid",
      lead.client_name AS "clientName",
      lead.client_phone AS "clientPhone",
      lead.city,
      project.title AS "projectTitle",
      COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', assigned_profile.id,
            'firstName', assigned_profile.first_name,
            'lastName', assigned_profile.last_name,
            'username', assigned_profile.username,
            'email', assigned_profile.email
          )
          ORDER BY assignment.assigned_at ASC
        )
        FROM lead_assignments assignment
        JOIN profiles assigned_profile ON assigned_profile.id = assignment.profile_id
        WHERE assignment.lead_id = lead.id
      ), '[]'::jsonb) AS assignments
    FROM scoped
    CROSS JOIN bounds
    JOIN follow_ups follow_up ON follow_up.id = scoped.id
    JOIN leads lead ON lead.id = scoped.lead_id
    LEFT JOIN projects project ON project.id = lead.project_id
    WHERE ${selectedView}
    ORDER BY scoped.follow_up_at ASC, scoped.id ASC
    LIMIT ${LEAD_REMINDER_PAGE_SIZE + 1}
    OFFSET ${offset}
  `);

  const summaryPromise = database.$queryRaw<ReminderSummaryRow[]>(Prisma.sql`
    ${scope}
    SELECT
      COUNT(*) FILTER (WHERE scoped.follow_up_at < bounds.day_start)::int AS overdue,
      COUNT(*) FILTER (
        WHERE scoped.follow_up_at >= bounds.day_start
          AND scoped.follow_up_at < bounds.day_end
      )::int AS today,
      COUNT(*) FILTER (WHERE scoped.follow_up_at >= bounds.day_end)::int AS upcoming
    FROM scoped
    CROSS JOIN bounds
  `);

  const [reminderRows, summaryRows] = await Promise.all([
    remindersPromise,
    summaryPromise,
  ]);
  const hasNext = reminderRows.length > LEAD_REMINDER_PAGE_SIZE;

  return {
    auth,
    filters,
    reminders: hasNext
      ? reminderRows.slice(0, LEAD_REMINDER_PAGE_SIZE)
      : reminderRows,
    summary: summaryRows[0] ?? { overdue: 0, today: 0, upcoming: 0 },
    pagination: {
      page: filters.page,
      hasPrevious: filters.page > 1,
      hasNext,
    },
  };
}

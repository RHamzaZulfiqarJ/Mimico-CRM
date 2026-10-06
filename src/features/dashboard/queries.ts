import { Prisma } from "@/generated/prisma/client";
import { canManageOrganization, isStaff } from "@/lib/auth/authorization";
import type { AuthContext } from "@/lib/auth/session";
import { getAuthContext } from "@/lib/auth/session";
import { getDatabase } from "@/lib/database";

export type DashboardBucket = {
  key: string;
  label: string;
  count: number;
};

export type DashboardCashflowBucket = {
  key: string;
  label: string;
  income: string;
  expense: string;
};

type LeadMetricsRow = {
  activeLeads: number;
  newThisMonth: number;
  wonLeads: number;
  lostLeads: number;
  dueCalls: number;
  stages: DashboardBucket[];
  priorities: DashboardBucket[];
  monthlyLeads: DashboardBucket[];
};

type StaffMetricsRow = {
  openTasks: number;
  overdueTasks: number;
  tasksDueToday: number;
  pendingApprovals: number;
  unreadNotifications: number;
  receivedToday: string;
  receivedMonth: string;
  receivedYear: string;
  cashflow: DashboardCashflowBucket[];
};

function leadAccessSql(auth: AuthContext) {
  if (canManageOrganization(auth.membership.role)) return Prisma.sql``;
  if (auth.membership.role === "EMPLOYEE") {
    return Prisma.sql`
      AND EXISTS (
        SELECT 1
        FROM lead_assignments access_assignment
        WHERE access_assignment.lead_id = lead.id
          AND access_assignment.profile_id = ${auth.profile.id}::uuid
      )
    `;
  }
  return Prisma.sql`
    AND EXISTS (
      SELECT 1
      FROM clients access_client
      WHERE access_client.id = lead.client_id
        AND access_client.organization_id = ${auth.organization.id}::uuid
        AND access_client.portal_profile_id = ${auth.profile.id}::uuid
        AND access_client.is_active = true
    )
  `;
}

function leadAccessWhere(auth: AuthContext): Prisma.LeadWhereInput {
  if (canManageOrganization(auth.membership.role)) return {};
  if (auth.membership.role === "EMPLOYEE") {
    return { assignments: { some: { profileId: auth.profile.id } } };
  }
  return { client: { portalProfileId: auth.profile.id, isActive: true } };
}

function leadMetricsQuery(auth: AuthContext) {
  const access = leadAccessSql(auth);
  return Prisma.sql`
    WITH bounds AS (
      SELECT date_trunc('month', now() AT TIME ZONE 'Asia/Karachi') AS month_start
    ),
    months AS (
      SELECT generate_series(
        (SELECT month_start FROM bounds) - interval '5 months',
        (SELECT month_start FROM bounds),
        interval '1 month'
      ) AS bucket_start
    ),
    scoped_leads AS MATERIALIZED (
      SELECT lead.id, lead.stage::text AS stage, lead.priority::text AS priority,
        lead.created_at, lead.updated_at
      FROM leads lead
      WHERE lead.organization_id = ${auth.organization.id}::uuid
        AND lead.is_archived = false
        ${access}
    ),
    latest_follow_ups AS (
      SELECT DISTINCT ON (follow_up.lead_id)
        follow_up.lead_id, follow_up.follow_up_at
      FROM follow_ups follow_up
      JOIN scoped_leads lead ON lead.id = follow_up.lead_id
      WHERE follow_up.organization_id = ${auth.organization.id}::uuid
      ORDER BY follow_up.lead_id, follow_up.created_at DESC, follow_up.id DESC
    ),
    stage_counts AS (
      SELECT stage AS key, COUNT(*)::int AS count
      FROM scoped_leads
      GROUP BY stage
    ),
    priority_counts AS (
      SELECT priority AS key, COUNT(*)::int AS count
      FROM scoped_leads
      GROUP BY priority
    ),
    monthly_counts AS (
      SELECT
        to_char(months.bucket_start, 'YYYY-MM') AS key,
        to_char(months.bucket_start, 'Mon') AS label,
        COUNT(scoped_leads.id)::int AS count
      FROM months
      LEFT JOIN scoped_leads
        ON scoped_leads.created_at >= (months.bucket_start AT TIME ZONE 'Asia/Karachi')
        AND scoped_leads.created_at < ((months.bucket_start + interval '1 month') AT TIME ZONE 'Asia/Karachi')
      GROUP BY months.bucket_start
      ORDER BY months.bucket_start
    )
    SELECT
      (SELECT COUNT(*)::int FROM scoped_leads) AS "activeLeads",
      (SELECT COUNT(*)::int FROM scoped_leads, bounds
        WHERE scoped_leads.created_at >= (bounds.month_start AT TIME ZONE 'Asia/Karachi')) AS "newThisMonth",
      (SELECT COUNT(*)::int FROM scoped_leads WHERE stage = 'closedWon') AS "wonLeads",
      (SELECT COUNT(*)::int FROM scoped_leads WHERE stage = 'closedLost') AS "lostLeads",
      (SELECT COUNT(*)::int FROM latest_follow_ups
        WHERE follow_up_at IS NOT NULL
          AND follow_up_at < ((date_trunc('day', now() AT TIME ZONE 'Asia/Karachi') + interval '1 day') AT TIME ZONE 'Asia/Karachi')) AS "dueCalls",
      COALESCE((SELECT jsonb_agg(jsonb_build_object('key', key, 'label', key, 'count', count) ORDER BY count DESC, key) FROM stage_counts), '[]'::jsonb) AS stages,
      COALESCE((SELECT jsonb_agg(jsonb_build_object('key', key, 'label', key, 'count', count) ORDER BY count DESC, key) FROM priority_counts), '[]'::jsonb) AS priorities,
      COALESCE((SELECT jsonb_agg(jsonb_build_object('key', key, 'label', label, 'count', count) ORDER BY key) FROM monthly_counts), '[]'::jsonb) AS "monthlyLeads"
  `;
}

function staffMetricsQuery(auth: AuthContext) {
  const management = canManageOrganization(auth.membership.role);
  const taskAccess = management
    ? Prisma.sql``
    : Prisma.sql`AND (task.assigned_to_profile_id = ${auth.profile.id}::uuid OR task.created_by_profile_id = ${auth.profile.id}::uuid)`;
  const approvalAccess = management
    ? Prisma.sql``
    : Prisma.sql`AND approval.requested_by_profile_id = ${auth.profile.id}::uuid`;

  return Prisma.sql`
    WITH bounds AS (
      SELECT
        date_trunc('day', now() AT TIME ZONE 'Asia/Karachi') AT TIME ZONE 'Asia/Karachi' AS day_start,
        (date_trunc('day', now() AT TIME ZONE 'Asia/Karachi') + interval '1 day') AT TIME ZONE 'Asia/Karachi' AS day_end,
        date_trunc('month', now() AT TIME ZONE 'Asia/Karachi') AT TIME ZONE 'Asia/Karachi' AS month_start,
        date_trunc('year', now() AT TIME ZONE 'Asia/Karachi') AT TIME ZONE 'Asia/Karachi' AS year_start
    ),
    months AS (
      SELECT generate_series(
        date_trunc('month', now() AT TIME ZONE 'Asia/Karachi') - interval '5 months',
        date_trunc('month', now() AT TIME ZONE 'Asia/Karachi'),
        interval '1 month'
      ) AS bucket_start
    ),
    monthly_cashflow AS (
      SELECT
        to_char(months.bucket_start, 'YYYY-MM') AS key,
        to_char(months.bucket_start, 'Mon') AS label,
        COALESCE(SUM(entry.amount) FILTER (WHERE entry.direction = 'in'::cash_direction), 0)::text AS income,
        COALESCE(SUM(entry.amount) FILTER (WHERE entry.direction = 'out'::cash_direction), 0)::text AS expense
      FROM months
      LEFT JOIN cashbook_entries entry
        ON entry.organization_id = ${auth.organization.id}::uuid
        AND entry.occurred_at >= (months.bucket_start AT TIME ZONE 'Asia/Karachi')
        AND entry.occurred_at < ((months.bucket_start + interval '1 month') AT TIME ZONE 'Asia/Karachi')
      GROUP BY months.bucket_start
      ORDER BY months.bucket_start
    )
    SELECT
      (SELECT COUNT(*)::int FROM tasks task
        WHERE task.organization_id = ${auth.organization.id}::uuid
          AND task.is_archived = false
          AND task.status IN ('todo'::task_status, 'in_progress'::task_status)
          ${taskAccess}) AS "openTasks",
      (SELECT COUNT(*)::int FROM tasks task
        WHERE task.organization_id = ${auth.organization.id}::uuid
          AND task.is_archived = false
          AND task.status IN ('todo'::task_status, 'in_progress'::task_status)
          AND task.due_at < now()
          ${taskAccess}) AS "overdueTasks",
      (SELECT COUNT(*)::int FROM tasks task, bounds
        WHERE task.organization_id = ${auth.organization.id}::uuid
          AND task.is_archived = false
          AND task.status IN ('todo'::task_status, 'in_progress'::task_status)
          AND task.due_at >= bounds.day_start
          AND task.due_at < bounds.day_end
          ${taskAccess}) AS "tasksDueToday",
      (SELECT COUNT(*)::int FROM approvals approval
        WHERE approval.organization_id = ${auth.organization.id}::uuid
          AND approval.status = 'underProcess'::approval_status
          ${approvalAccess}) AS "pendingApprovals",
      (SELECT COUNT(*)::int FROM notifications notification
        WHERE notification.organization_id = ${auth.organization.id}::uuid
          AND notification.recipient_profile_id = ${auth.profile.id}::uuid
          AND notification.read_at IS NULL) AS "unreadNotifications",
      (SELECT COALESCE(SUM(entry.amount), 0)::text FROM cashbook_entries entry, bounds
        WHERE entry.organization_id = ${auth.organization.id}::uuid
          AND entry.direction = 'in'::cash_direction
          AND entry.occurred_at >= bounds.day_start) AS "receivedToday",
      (SELECT COALESCE(SUM(entry.amount), 0)::text FROM cashbook_entries entry, bounds
        WHERE entry.organization_id = ${auth.organization.id}::uuid
          AND entry.direction = 'in'::cash_direction
          AND entry.occurred_at >= bounds.month_start) AS "receivedMonth",
      (SELECT COALESCE(SUM(entry.amount), 0)::text FROM cashbook_entries entry, bounds
        WHERE entry.organization_id = ${auth.organization.id}::uuid
          AND entry.direction = 'in'::cash_direction
          AND entry.occurred_at >= bounds.year_start) AS "receivedYear",
      COALESCE((SELECT jsonb_agg(jsonb_build_object('key', key, 'label', label, 'income', income, 'expense', expense) ORDER BY key) FROM monthly_cashflow), '[]'::jsonb) AS cashflow
  `;
}

export async function getDashboardWorkspace() {
  const auth = await getAuthContext();
  if (!auth) return null;

  const database = getDatabase();
  const staff = isStaff(auth.membership.role);
  const management = canManageOrganization(auth.membership.role);
  const leadWhere: Prisma.LeadWhereInput = {
    organizationId: auth.organization.id,
    isArchived: false,
    ...leadAccessWhere(auth),
  };

  const leadMetricsPromise = database.$queryRaw<LeadMetricsRow[]>(
    leadMetricsQuery(auth),
  );
  const staffMetricsPromise = staff
    ? database.$queryRaw<StaffMetricsRow[]>(staffMetricsQuery(auth))
    : Promise.resolve([]);
  const recentLeadsPromise = database.lead.findMany({
    where: leadWhere,
    orderBy: { updatedAt: "desc" },
    take: 5,
    select: {
      id: true,
      uid: true,
      clientName: true,
      stage: true,
      updatedAt: true,
      project: { select: { title: true } },
    },
  });
  const upcomingEventsPromise = staff
    ? database.calendarEvent.findMany({
        where: {
          organizationId: auth.organization.id,
          ownerProfileId: management ? undefined : auth.profile.id,
          endsAt: { gte: new Date() },
        },
        orderBy: { startsAt: "asc" },
        take: 4,
        select: { id: true, title: true, startsAt: true, endsAt: true },
      })
    : Promise.resolve([]);

  const [leadRows, staffRows, recentLeads, upcomingEvents] = await Promise.all([
    leadMetricsPromise,
    staffMetricsPromise,
    recentLeadsPromise,
    upcomingEventsPromise,
  ]);

  return {
    auth,
    isStaff: staff,
    leadMetrics: leadRows[0] ?? {
      activeLeads: 0,
      newThisMonth: 0,
      wonLeads: 0,
      lostLeads: 0,
      dueCalls: 0,
      stages: [],
      priorities: [],
      monthlyLeads: [],
    },
    staffMetrics: staffRows[0] ?? null,
    recentLeads,
    upcomingEvents,
  };
}

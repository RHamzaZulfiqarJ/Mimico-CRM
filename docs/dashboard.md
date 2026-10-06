# Operational dashboard

The `/dashboard` route is a server-rendered, organization-scoped reporting
workspace. It replaces the migration placeholder with live lead, follow-up,
task, approval, notification, calendar, and cashbook metrics.

## Role scope

- Managers and super admins see organization-wide lead, task, approval,
  calendar, and finance summaries.
- Employees see assigned leads, tasks they own or created, their approval
  requests, their notifications, and their calendar events. Cashbook reporting
  follows the existing staff-wide cashbook permission.
- Clients see only active leads linked through their active portal client
  profile. Staff operations and finance are never loaded or rendered for them.

Prisma uses a trusted server connection, so these predicates are applied in
the dashboard query itself rather than relying on browser-side filtering.

## Performance

Lead totals, six-month activity, stage/priority distribution, and current call
reminders are calculated in one PostgreSQL statement. Staff task, approval,
notification, payment, and six-month cashflow metrics are calculated in a
second statement. Those aggregates run concurrently with the small recent-lead
and upcoming-event queries.

Only aggregate rows and at most five recent leads/four upcoming events are
returned. Pakistan calendar boundaries use `Asia/Karachi`, and the queries use
the existing organization/date/status/assignment indexes instead of loading
full datasets into the application runtime.

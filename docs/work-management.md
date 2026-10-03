# Work management and notifications

Stage 5 provides tenant-scoped tasks, calendar events, approval decisions, and an in-application notification center.

## Access rules

- Employees can create tasks for themselves, read tasks they created or that are assigned to them, and update tasks assigned to them.
- Managers and super administrators can read all active tasks in their organization, assign work to active staff, and update any organization task.
- Clients cannot access the staff task workspace.
- Notifications are always restricted to the signed-in recipient and current organization.
- Every task creation and status change is recorded in `AuditLog`.
- Employees see their own calendar events; managers can review organization events. Owners and managers can delete events.
- Staff can submit approval requests. Employees see only their own requests, while managers and super administrators can review and decide all organization requests.
- Calendar creation, deletion, approval submission, and approval decisions are recorded in `AuditLog`.

## Task lifecycle

Tasks move through `TODO`, `IN_PROGRESS`, `COMPLETED`, or `CANCELLED`. Completing a task requires a successful or unsuccessful outcome. Assignment and status-change notifications store only routing metadata in their JSON payload and link back to the organization-scoped task detail route.

Calendar event times are entered in the browser's timezone and converted to UTC before persistence. The calendar defaults to an upcoming agenda, with past and all-event views available without loading a large client-side calendar dependency.

General approval requests use the `REQUEST` type. Voucher, receipt, and refund approval types remain reserved for the finance migration. New requests notify active managers; decisions notify the requester and can include a decision note.

## Delivery strategy

The initial delivery mechanism uses Server Actions plus targeted route revalidation. This avoids legacy polling and keeps reads server-rendered. Supabase Realtime can be added after the live database and RLS policies are connected and verified.

### Scheduled task reminders

An external scheduler should call `POST /api/jobs/task-reminders` once per hour with `Authorization: Bearer <TASK_REMINDER_SECRET>`. Configure `TASK_REMINDER_SECRET` as a server-only runtime secret containing at least 32 characters; never prefix it with `NEXT_PUBLIC_` or commit it to an environment file.

```powershell
Invoke-RestMethod -Method Post `
  -Uri "$env:NEXT_PUBLIC_APP_URL/api/jobs/task-reminders" `
  -Headers @{ Authorization = "Bearer $env:TASK_REMINDER_SECRET" }
```

Each run scans active tasks in bounded batches for deadlines between one hour ago and 24 hours ahead. Notifications use a deterministic task/deadline identifier and PostgreSQL's unique constraint, so overlapping or concurrent runs do not duplicate delivery. Changing a deadline creates a new reminder identity. Each organization with newly created reminders receives a job-level audit entry.

The endpoint is deliberately `POST`-only, uncached, and unavailable when the secret is missing or too short. It returns aggregate counts without exposing task details. Scheduling remains outside the Next.js process so deployments, restarts, and horizontal scaling do not interrupt or duplicate the job.

## Remaining Stage 5 work

- Run the reviewed Stage 5 importer against the connected development database and reconcile its report.
- Connect Realtime delivery after live RLS verification.
- Configure an external hourly scheduler and verify reminder delivery against the connected development database.

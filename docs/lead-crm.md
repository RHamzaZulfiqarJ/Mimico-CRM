# Lead CRM vertical slice

The Stage 4 lead workspace is available at `/leads`. It uses the relational `Lead`, `LeadAssignment`, and `FollowUp` models rather than carrying forward MongoDB arrays.

## Access model

| Role | Visibility | Mutations |
| --- | --- | --- |
| `SUPER_ADMIN`, `MANAGER` | Every active lead in the organization | Create, update progress, add follow-ups, reassign, archive, upload and delete attachments |
| `EMPLOYEE` | Only leads assigned to their profile | Create a lead assigned to self, update progress, add follow-ups, upload attachments |
| `CLIENT` | Only leads linked to their portal client record | Read-only, including attachment downloads |

All reads apply the organization and role predicates in Prisma. The interface never loads all tenant leads and filters them in memory. Mutations validate the same authorization, organization, and relationship boundaries before an atomic write.

## Implemented workflow

- Create a lead with client contact details, project, source, priority, stage, and optional next-contact time.
- Link an existing organization client when the phone number matches.
- Reject a duplicate active lead phone number.
- Create a relational owner assignment and initial follow-up record atomically.
- Generate a stable readable lead ID and backfill identifiers for existing records.
- Search by name, phone, city, area, source, or UID; filter by stage, priority, and project.
- Load leads in indexed 30-record pages without fetching unused follow-up history or counts.
- Update project, priority, and stage.
- Add timestamped follow-ups that retain the actor and update the lead stage.
- Reassign leads through an active staff membership.
- Archive leads without deleting their history.
- Review archived leads in the same indexed workspace and restore them with an
  audit entry. Restoration refuses to recreate an active duplicate phone.
- Import up to 1,000 leads from a validated CSV file. Imports support quoted
  values, readable stage/priority labels, project title/UID matching, optional
  manager-controlled assignee emails, duplicate reporting, and atomic batched
  creation of leads, assignments, and initial follow-ups.
- Upload images, PDF, Word, and Excel documents up to 10 MB directly to the
  private `crm-attachments` Supabase Storage bucket. Downloads use short-lived
  signed URLs, and only organization managers can delete attachment records.
- Record lead creation, updates, follow-ups, assignments, archival, and attachment changes in the audit log.

## Performance notes

The lead list fetches one 30-record page at a time and no longer loads unused
follow-up history or aggregate counts. Creation validates independent
relationships concurrently, then batches the lead, assignment, initial
follow-up, and audit entry into one atomic write transaction. CSV imports
validate the entire file before writing and use three bulk inserts inside one
transaction instead of one database round trip per row.

Attachment bytes upload directly from the browser to Supabase Storage through
a single-object signed upload URL, avoiding a Vercel server-function proxy. The
server still checks lead access before issuing the upload token and verifies the
stored object's type and size before exposing it in the lead record. The bucket
is created on first use and kept private using `SUPABASE_SECRET_KEY`.

Keep the production Next.js runtime in the same or a nearby region as the
Supabase database. Local development still pays the physical network latency
between the developer machine and the configured database region.

The call-reminders workspace at `/leads/reminders` loads only the newest
follow-up record for each active lead. A newer update without a scheduled time
clears that lead from the reminder queue, so an older reminder cannot reappear.
Managers see the organization queue, while employees see only leads assigned
to them. The paginated reminder rows and overdue/today/upcoming totals are
queried concurrently and all calendar boundaries use `Asia/Karachi`.
The supporting organization/lead/creation-time index is installed by the
`20261005230000_lead_reminder_performance` Prisma migration.

## Remaining Stage 4 work

- Run the dry-run-first Stage 4 importer and reconcile legacy leads,
  assignments, and follow-ups against a production export.
- Run the verified, no-overwrite Storage transfer against the reviewed Stage 4
  manifest and reconcile its attachment metadata in production.
- Run cross-role integration and acceptance tests against the connected Supabase/PostgreSQL environment.

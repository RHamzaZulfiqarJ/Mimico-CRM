# Lead CRM vertical slice

The Stage 4 lead workspace is available at `/leads`. It uses the relational `Lead`, `LeadAssignment`, and `FollowUp` models rather than carrying forward MongoDB arrays.

## Access model

| Role | Visibility | Mutations |
| --- | --- | --- |
| `SUPER_ADMIN`, `MANAGER` | Every active lead in the organization | Create, update progress, add follow-ups, reassign, archive |
| `EMPLOYEE` | Only leads assigned to their profile | Create a lead assigned to self, update progress, add follow-ups |
| `CLIENT` | Only leads linked to their portal client record | Read-only |

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
- Record creation, updates, follow-ups, assignments, and archival in the audit log.

## Performance notes

The lead list fetches one 30-record page at a time and no longer loads unused
follow-up history or aggregate counts. Creation validates independent
relationships concurrently, then batches the lead, assignment, initial
follow-up, and audit entry into one atomic write transaction.

Keep the production Next.js runtime in the same or a nearby region as the
Supabase database. Local development still pays the physical network latency
between the developer machine and the configured database region.

## Remaining Stage 4 work

- Import and reconcile legacy leads, assignments, follow-ups, and attachments.
- Add validated CSV import with a row-level report.
- Transfer lead images to Supabase Storage and create attachment metadata.
- Run cross-role integration and acceptance tests against the connected Supabase/PostgreSQL environment.

# Production readiness and cutover

The legacy `client/`, `server/`, MongoDB database, and upload directory remain
unchanged until the final acceptance decision. Rehearsals and imports target a
separate Supabase project or an explicitly selected organization in PostgreSQL.

## Automated release preflight

Set the operator environment from `.env.example`, deploy the candidate commit,
and run this read-only check from `web/`:

```powershell
npm run release:preflight -- --organization <organization-slug> --base-url https://crm.mimico.live --report C:\migration-output\production-preflight.json
```

The preflight never writes to PostgreSQL, Supabase Storage, or the deployment.
It verifies:

- required environment variables without printing their values;
- a public HTTPS application URL and a sufficiently long scheduler secret;
- database connectivity and exact agreement between local and applied Prisma
  migration names;
- existence of every managed table, RLS enablement, and at least one policy per
  table;
- the target organization, an active member, and active manager/super-admin
  access;
- existence and privacy of the `crm-attachments` bucket; and
- the deployed `/api/health` response.

Failed checks and invocation/runtime errors return a nonzero exit status.
Warnings require review but do not fail the command. `--skip-http` is permitted
only before the first deployment, and `--allow-local` is only for a local
rehearsal. Keep every JSON report with the release evidence.

## Read-only performance gate

After deploying the candidate, run the bounded performance suite:

```powershell
npm run release:performance -- --organization <organization-slug> --base-url https://crm.mimico.live --concurrency 4 --iterations 20 --threshold-ms 750 --report C:\migration-output\production-performance.json
```

It exercises database round trips plus the lead list, reminders, dashboard,
tasks, cashbook, finance-list, and deployed-health workloads. The command stores
only aggregate table counts and latency statistics; it does not store CRM rows
or perform writes. Each database workload must remain below the configured p95
threshold with zero errors. The health endpoint uses a minimum 1,000 ms p95
threshold to include public network latency.

The tool warns when either leads or cashbook entries contain fewer than 1,000
rows. Such a run proves connectivity and catches large regressions, but it is
not evidence of production-scale performance. Repeat the same command after the
full restore/migration rehearsal and retain both JSON reports.

Server functions are pinned to Vercel `hnd1` because the current Supabase
database endpoint is in AWS `ap-northeast-1`; both are Tokyo. Static content
continues to use Vercel's global CDN. Re-run the performance gate after every
region, database, pooling, or material query/index change.

## Independent backups

Create and verify backups before every rehearsal and immediately before the
production write freeze. Use Supabase's documented CLI flow with the direct or
session-pooler URL stored in `DIRECT_URL`:

```powershell
supabase db dump --db-url $env:DIRECT_URL -f roles.sql --role-only
supabase db dump --db-url $env:DIRECT_URL -f schema.sql
supabase db dump --db-url $env:DIRECT_URL -f data.sql --use-copy --data-only -x "storage.buckets_vectors" -x "storage.vector_indexes"
```

Follow the current [Supabase backup/restore guide](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore)
for restore order and provider-specific schemas. A database backup contains
Storage metadata but not the actual uploaded bytes. Export the private
`crm-attachments` objects separately through Supabase Storage's S3-compatible
endpoint or its documented bulk-download method, then retain a file count and
SHA-256 manifest. See [Download Objects](https://supabase.com/docs/guides/storage/management/download-objects).

Also retain immutable copies of:

- the MongoDB exports used by Stages 3–6;
- the original legacy `server/uploads` directory;
- every dry-run, apply, Storage, and production-preflight report;
- the Git commit SHA and deployed environment-variable names (never values);
  and
- DNS values and scheduler configuration from before cutover.

## Restore rehearsal

Never test restore commands against production. Create a disposable Supabase
project, restore the database using the current official sequence, copy Storage
objects, and deploy the exact candidate commit against it. Record start/end
times and verify:

1. Prisma migration history contains no unfinished or missing migration.
2. The release preflight returns zero failures.
3. Attachment object count and checksum manifest match the backup.
4. A manager and employee can sign in, while a deactivated account cannot.
5. Cross-organization reads return no data through the Data API.
6. Lead, task, approval, finance, payroll, and attachment smoke tests pass.
7. Representative voucher and payroll documents print correctly.

Destroy or lock the rehearsal project after evidence is retained; it contains
production-like personal and financial data.

## Final migration order

1. Announce the maintenance window and confirm named cutover/rollback owners.
2. Capture database, Storage, MongoDB, uploads, deployment, and DNS backups.
3. Put the legacy application into maintenance/read-only mode. Do not delete it.
4. Export MongoDB again and rerun clean Stage 3, Stage 4, Stage 5, and Stage 6
   dry-runs in that order.
5. Apply those reviewed plans in the same order, then run the Storage transfer.
6. Compare source, accepted, rejected, expanded, and financial totals in every
   report. Any unexplained difference stops cutover.
7. Run `npm run release:preflight` and require zero failures.
8. Complete the role-based acceptance checklist against the production URL.
9. Switch traffic only after the technical and business owners sign off.
10. Monitor authentication failures, server errors, database saturation,
    scheduler results, and user-reported discrepancies throughout the window.

## Acceptance checklist

- Anonymous users cannot access a workspace route or CRM rows.
- Client, employee, manager, and super-admin accounts see only their permitted
  organization data.
- A representative lead can be created, assigned, followed up, archived, and
  restored.
- Tasks, calendar events, notifications, and approval decisions complete.
- Sale, cashbook, voucher, refund, and payroll totals match the final reports.
- An attachment uploads privately and downloads only through an authorized
  signed request.
- Invitation, password creation, sign-in, and password recovery work through
  production SMTP.
- The task-reminder scheduler authenticates successfully and is idempotent.
- `/api/health` and the Vercel deployment remain healthy under normal traffic.

## Rollback boundary

Before the new CRM accepts writes, rollback means restoring the previous DNS or
deployment target and returning the legacy application from maintenance mode.
After the new CRM accepts writes, switching blindly back would lose or fork new
records. At that point, stop writes, export the PostgreSQL delta, reconcile it
with MongoDB, and obtain an explicit business decision before routing traffic.

Keep MongoDB and legacy uploads read-only for the agreed retention period. Do
not remove them until the restore rehearsal, reconciliation evidence, monitoring
period, and business sign-off are complete.

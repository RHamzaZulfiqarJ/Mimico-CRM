# Legacy data import

## Stage 3 — identities and reference data

This importer validates and migrates the legacy identity and reference-data collections:

- `users`
- `employees`
- `societies`
- `projects`
- `inventories`

It is a dry-run by default. A dry-run reads exported JSON and writes a local reconciliation report; it does not connect to PostgreSQL or Supabase.

## 1. Export MongoDB data

Create an export directory outside the legacy `client/` and `server/` trees. The expected filenames are `users.json`, `employees.json`, `societies.json`, `projects.json`, and `inventories.json`. Files may contain a JSON array, newline-delimited JSON from `mongoexport`, or an object with a `documents` array.

Example commands (replace the URI and output directory):

```powershell
mongoexport --uri $env:LEGACY_MONGODB_URI --collection users --jsonArray --out C:\migration-input\users.json
mongoexport --uri $env:LEGACY_MONGODB_URI --collection employees --jsonArray --out C:\migration-input\employees.json
mongoexport --uri $env:LEGACY_MONGODB_URI --collection societies --jsonArray --out C:\migration-input\societies.json
mongoexport --uri $env:LEGACY_MONGODB_URI --collection projects --jsonArray --out C:\migration-input\projects.json
mongoexport --uri $env:LEGACY_MONGODB_URI --collection inventories --jsonArray --out C:\migration-input\inventories.json
```

The export directory can omit a collection that does not exist; the report records it as a warning. At least one supported export file must be present.

## 2. Validate and reconcile

From `web/`, run:

```powershell
npm run migrate:stage3 -- --input C:\migration-input
```

To choose the report location:

```powershell
npm run migrate:stage3 -- --input C:\migration-input --report C:\migration-output\stage3-dry-run.json
```

The report includes source and accepted counts, rejected records, warnings, and a society-image Storage manifest. A clean dry-run exits with status `0`; a dry-run with rejected records writes the report and exits with status `2`. Invalid arguments or unreadable input exit with status `1`.

Resolve every rejection before applying. The importer rejects broken society/project relationships, invalid monetary values, duplicate source identities, and missing required fields. A missing inventory owner is preserved as a warning and imported without an owner.

## 3. Apply to PostgreSQL

Apply the Prisma migration and create the target organization first. Set `DATABASE_URL`, then use the exact target organization slug:

```powershell
npm run migrate:stage3 -- --input C:\migration-input --organization marcable --apply --report C:\migration-output\stage3-apply.json
```

`--apply` is deliberately explicit. It refuses to run when the plan contains rejected records, and it refuses any `Client`, `Society`, `Project`, or `Inventory` whose `legacyMongoId` already belongs to a different organization. Writes run in one transaction and can be safely repeated: profiles, memberships, clients, societies, projects, and inventories are upserted by their stable legacy identities.

## Identity and file handling

- Legacy password hashes are never imported. They are listed as warnings; users must be invited or linked through Supabase Auth separately.
- A profile may be imported without an email, but it cannot receive a Supabase Auth invitation until an email is supplied.
- The legacy `sellerCompamyName` misspelling is mapped to `sellerCompanyName`.
- Monetary strings are validated and passed to Prisma as decimal values; JavaScript floating-point conversion is not used.
- Society image paths and deterministic target object paths are written to `storageManifest` in the report. This command does not read, upload, move, or delete legacy files. A later Storage step can use the reviewed manifest to copy objects into the `crm-attachments` bucket and create attachment metadata.

## Post-apply reconciliation

Keep MongoDB as the source of truth until all of these checks pass:

1. Compare every `sourceCounts` value with the corresponding MongoDB export count.
2. Confirm `acceptedCounts + rejected counts` explains every source document.
3. Confirm the apply report's created/updated totals match the accepted records.
4. Review all warnings, especially identities without email and inventories without owners.
5. Copy and verify Storage objects from the manifest before enabling migrated image links.
6. Test organization isolation and administrator workflows against the migrated data.

## Stage 4 — leads and follow-ups

The Stage 4 importer handles `leads.json` and `followups.json` (the camel-case
`followUps.json` filename is also accepted). Keep `users.json`, `employees.json`,
and `projects.json` in the same input directory when possible so the dry-run can
validate clients, assignees, and projects without connecting to PostgreSQL.

Run the offline reconciliation first:

```powershell
npm run migrate:stage4 -- --input C:\migration-input --report C:\migration-output\stage4-dry-run.json
```

The report maps lead stages and priorities, resolves relational assignments,
reconnects follow-ups, and lists each legacy image in a deterministic private
Storage manifest. Offset-less legacy `followUpDate` values are interpreted in
`Asia/Karachi` (`UTC+05:00`) before being stored as UTC. The dry-run rejects
broken project or assignee references, orphaned follow-ups, invalid dates,
duplicate stable IDs, and duplicate active lead phone numbers.

After resolving every rejection, apply the reviewed plan with the exact
organization slug:

```powershell
npm run migrate:stage4 -- --input C:\migration-input --organization marcable --apply --report C:\migration-output\stage4-apply.json
```

Apply mode is transactional and idempotent. Leads and follow-ups are upserted by
their legacy MongoDB IDs, assignments are inserted only when missing, and
cross-organization ID collisions abort all writes. A missing legacy lead UID is
replaced with the same stable UUID-based readable ID used by newly created
leads. Re-running the importer does not remove assignments added later in the
new CRM.

The importer does not copy image bytes and does not create attachment metadata.
Review `storageManifest`, copy each object into the private `crm-attachments`
bucket, verify it, and only then create its matching `Attachment` record. The
legacy files and MongoDB data are never changed by this command.

## Storage transfer — society and lead attachments

After clean Stage 3 and Stage 4 dry-runs, validate their Storage manifests
against the legacy server's upload directory. Supply each migration report with
a separate `--manifest` argument:

```powershell
npm run migrate:storage -- --manifest C:\migration-output\stage3-dry-run.json --manifest C:\migration-output\stage4-dry-run.json --source-root "C:\Websites\Marcable Solutions\server" --output C:\migration-output\storage-dry-run.json
```

This is also a dry-run by default. It resolves every legacy path beneath the
specified source root, rejects traversal and symlink escapes, enforces the CRM's
10 MB/type policy, verifies file signatures, and records a SHA-256 hash. It
does not connect to Supabase or PostgreSQL.

Review every rejection and compare the accepted count with both source
manifests. Then apply using the exact organization slug:

```powershell
npm run migrate:storage -- --manifest C:\migration-output\stage3-dry-run.json --manifest C:\migration-output\stage4-dry-run.json --source-root "C:\Websites\Marcable Solutions\server" --organization marcable --apply --output C:\migration-output\storage-apply.json
```

Apply mode requires `DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, and
`SUPABASE_SECRET_KEY`. It verifies that every referenced lead or society belongs
to the target organization, keeps the bucket private, uploads with overwrite
disabled, downloads each object to compare its hash, and only then creates or
updates `Attachment` metadata. Existing objects are reused only when their
bytes match exactly. A conflicting object or metadata record aborts instead of
being replaced.

The operation is idempotent. If a network or database failure leaves a verified
object without metadata, rerunning the same command reuses that object and
finishes reconciliation. It never modifies or deletes files in the legacy
server directory.

## Stage 5 — work management

The Stage 5 importer handles `tasks.json`, `events.json`, `approvals.json`, and `notifications.json`. Put these files in the same export directory used for the Stage 3 reference exports. Supplying `users.json`, `employees.json`, and `leads.json` lets the dry-run reject missing profile and lead relationships before a database connection is involved.

Run the offline reconciliation first:

```powershell
npm run migrate:stage5 -- --input C:\migration-input --report C:\migration-output\stage5-dry-run.json
```

After resolving every rejected record, apply the reviewed plan with the exact organization slug:

```powershell
npm run migrate:stage5 -- --input C:\migration-input --organization marcable --apply --report C:\migration-output\stage5-apply.json
```

The importer maps the legacy split task fields into the normalized task lifecycle, converts MongoDB extended dates to UTC timestamps, validates event ranges, preserves variable approval data as JSON, and reconnects notifications to the new task or approval UUID. Legacy approval notifications were global; they are expanded into one deterministic notification per active manager or super administrator. Urgent-task notifications remain assigned to the task owner.

Apply mode is transactional and idempotent. Records are upserted using stable legacy identities, cross-organization identity collisions abort the transaction, and missing organization profiles, leads, or active management recipients prevent all writes. Repeating an apply updates the same records instead of creating duplicates.

After applying, reconcile source counts against accepted and rejected records, review the expanded notification totals, confirm migrated timestamps in the application timezone, and test employee/manager visibility before treating PostgreSQL as the source of truth.

## Stage 6 — finance and payroll

Run Stage 3, Stage 4, and Stage 5 first so profiles, leads, projects, and legacy
approvals are available for relationship reconciliation. The Stage 6 importer
accepts `sales.json`, `cashbooks.json`, `vouchers.json`, `refunds.json`,
`deductions.json`, and `transcripts.json`; singular filenames are also accepted.
Keep `users.json`, `employees.json`, `leads.json`, `projects.json`, and
`approvals.json` alongside them when available so the offline plan can validate
every reference before opening a database connection.

Export the finance collections from MongoDB, then create the dry-run report:

```powershell
mongoexport --uri $env:LEGACY_MONGODB_URI --collection sales --jsonArray --out C:\migration-input\sales.json
mongoexport --uri $env:LEGACY_MONGODB_URI --collection cashbooks --jsonArray --out C:\migration-input\cashbooks.json
mongoexport --uri $env:LEGACY_MONGODB_URI --collection vouchers --jsonArray --out C:\migration-input\vouchers.json
mongoexport --uri $env:LEGACY_MONGODB_URI --collection refunds --jsonArray --out C:\migration-input\refunds.json
mongoexport --uri $env:LEGACY_MONGODB_URI --collection deductions --jsonArray --out C:\migration-input\deductions.json
mongoexport --uri $env:LEGACY_MONGODB_URI --collection transcripts --jsonArray --out C:\migration-input\transcripts.json
npm run migrate:stage6 -- --input C:\migration-input --report C:\migration-output\stage6-dry-run.json
```

The report contains per-collection source and accepted counts plus exact decimal
totals. Currency is parsed as text and accumulated as integer cents; JavaScript
floating-point arithmetic is never used. The planner rejects invalid money,
inconsistent sale profit or voucher balances, broken references, duplicate
stable identities, and payroll conflicts. When a legacy payroll record stores a
month name without a year, the importer infers the closest historical period
from `createdAt` and records that decision as a warning for review.

Resolve every rejection and review all totals and warnings before applying:

```powershell
npm run migrate:stage6 -- --input C:\migration-input --organization marcable --apply --report C:\migration-output\stage6-apply.json
```

Apply mode is transactional and idempotent. Finance records are upserted by
their legacy MongoDB identities, cross-organization collisions abort all
writes, and the importer recomputes database totals inside the same transaction
before committing. Legacy voucher and refund approvals are reconnected to the
new record UUIDs. If the old application did not create an approval row, a
deterministic migration approval is created so pending decisions still use the
normal audited workflow. Refund lead flags are recalculated from pending
refunds; the importer does not create cashbook entries for already accepted
legacy refunds because those entries are migrated from `cashbooks.json`.

After apply, compare `sourceTotals`, `databaseTotals`, accepted counts, and
rejected records in the report. Then verify representative sale calculations,
cashbook balances, voucher/refund decisions, payroll periods, and printed
voucher and salary documents before switching the finance source of truth.

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

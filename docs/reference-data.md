# Reference-data module

The `/reference-data` workspace is the first operational PostgreSQL vertical slice. Employees, managers, and super admins can read and create societies, projects, and inventory. Only managers and super admins can archive them.

## Write guarantees

- The acting organization and profile are derived from the verified server session, never submitted form fields.
- A project can reference only a non-archived society in the same organization.
- Inventory can reference only a non-archived project in the same organization.
- Prices remain validated decimal strings until Prisma writes them to `numeric(18,2)`; they are never converted through JavaScript floating-point arithmetic.
- Every successful create/archive operation writes an `AuditLog` row in the same database transaction.
- Archive operations use tenant-scoped `updateMany` conditions and never hard-delete migrated records.
- A society with active projects, or a project with active inventory, cannot be archived until its active children are archived.

## Deferred migration work

Connecting Supabase/PostgreSQL is required before running integration tests or importing legacy data. The eventual importer must upsert by `legacyMongoId`, upload society images to Supabase Storage, preserve a reject report, and reconcile record/relationship counts against MongoDB before the module can be accepted for cutover.

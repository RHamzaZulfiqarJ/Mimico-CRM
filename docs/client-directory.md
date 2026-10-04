# Client directory

The `/clients` workspace replaces the legacy in-memory client table with an
organization-scoped PostgreSQL directory.

## Access and lifecycle

- Employees, managers, and super administrators can list, search, create, and
  update clients in their current organization.
- Only managers and super administrators can link an active `CLIENT`
  membership to a CRM client record or change a client's active status.
- Deactivation preserves leads, financial history, and audit records. It also
  removes client-portal access to linked leads until the client is reactivated.
- Client records are never hard-deleted by this interface.

## Performance

The directory fetches 30 records at a time, requests one extra record to detect
the next page, and selects only fields rendered by the page. Search, status,
portal-account lookup, and lead counts are evaluated by PostgreSQL rather than
loading the organization directory into the browser.

## RLS deployment

The current `supabase/rls.sql` requires an active client record for self-service
client and lead access. Client mutations are intentionally server-only so Data
API calls cannot bypass manager-controlled identity and lifecycle fields.
Reapply the file after deploying this slice so database grants and policies
match the server-side authorization rule.

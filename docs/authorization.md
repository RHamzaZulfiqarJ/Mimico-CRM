# Authorization model

## Role matrix

| Capability | Client | Employee | Manager | Super admin |
| --- | ---: | ---: | ---: | ---: |
| Read own profile and organization | Yes | Yes | Yes | Yes |
| Read own CRM client/leads | Yes | No | No | No |
| Read/update assigned leads | No | Yes | Yes | Yes |
| Read assigned/created tasks | No | Yes | Yes | Yes |
| Assign tasks to other staff | No | No | Yes | Yes |
| Read own notifications | Yes | Yes | Yes | Yes |
| Create operational records | No | Yes | Yes | Yes |
| Assign leads and decide approvals | No | No | Yes | Yes |
| Delete operational records | No | No | Yes | Yes |
| Manage organization members | No | No | Yes | Yes |
| Read audit history | No | No | Yes | Yes |

`super_admin` currently has the same organization-scoped data powers as `manager`. It remains a distinct role so later platform-wide administration can be introduced deliberately instead of accidentally granting cross-organization access now.

## Two enforcement layers

Supabase Data API/browser calls are protected by PostgreSQL row-level security in `supabase/rls.sql`. Policies resolve the signed-in user through `auth.uid()`, then `Profile.authUserId`, then an active `OrganizationMembership`. There is no anonymous CRM access.

Prisma runs on the trusted server. Its database connection may use a role that bypasses RLS, so every Server Action and Route Handler must:

1. Authenticate with Supabase on the server.
2. Resolve the active profile and organization membership from the database.
3. Check the operation with `src/lib/auth/authorization.ts` and, for record-scoped access, query assignment/ownership in the same organization.
4. Derive organization, actor, and recipient IDs from that trusted context.
5. Validate input with Zod and execute the write in a transaction when multiple records change.
6. Append an audit record for sensitive status, assignment, approval, finance, membership, and deletion operations.

Never expose `DATABASE_URL`, `DIRECT_URL`, a service-role key, or Facebook secrets to client code. A publishable/anon key is expected in the browser because RLS is its security boundary.

All application responses set anti-sniffing, anti-framing, strict referrer, and
browser feature-permission headers. Production responses additionally enable
HSTS. The release preflight verifies RLS is enabled and policies exist on every
managed table; the role-by-role live cases below remain required before cutover.

## Identity rules

- Supabase Auth is the only credential and password-recovery system.
- A profile can exist before its Auth identity is invited, so `authUserId` is nullable.
- An Auth user maps to at most one profile; a profile can have one membership per organization.
- A CRM `Client` can exist without portal access. Portal access is granted only by linking `portalProfileId` and adding a `client` membership.
- Disabling a profile or membership immediately removes data access even if the Auth account still exists.
- Role claims in JWTs may be introduced later for performance, but database membership remains authoritative and claim changes require token refresh.

## RLS verification cases

Before traffic is enabled, automated database tests must create two organizations and assert at least these cases with real authenticated JWTs:

- every role in organization A receives zero rows belonging only to organization B;
- an employee sees assigned leads but not unassigned leads;
- an employee sees tasks they created or that are assigned to them, but can update only assigned tasks;
- a user cannot read or mark another recipient's notifications;
- a client sees only leads attached to their linked CRM client;
- a manager can assign leads and decide approvals only in their organization;
- employee/client attempts to delete operational data fail;
- users cannot change protected profile identity columns through the Data API;
- anonymous requests receive no CRM rows;
- deactivating a membership removes access.

These integration tests require a running Supabase/PostgreSQL environment. The unit tests cover the matching application role matrix until that environment is connected.

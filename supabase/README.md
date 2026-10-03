# Supabase database policies

Apply `rls.sql` only after Prisma has created the tables in `prisma/schema.prisma`.

1. Set `DIRECT_URL` to the Supabase direct/session-pooler connection.
2. Review the generated initial Prisma migration.
3. Apply the Prisma migration.
4. Run `rls.sql` in the Supabase SQL editor or through the database migration pipeline.
5. Test each role with an authenticated JWT before enabling migrated traffic.

The `private` schema must not be added to the Supabase Data API exposed-schema list. Its security-definer functions deliberately expose only boolean authorization decisions.

RLS secures browser and Data API traffic. A Prisma connection may use a privileged database role that bypasses RLS, so every server mutation must also use the application authorization helpers and derive `organizationId` and `profileId` from the authenticated membership rather than request input.

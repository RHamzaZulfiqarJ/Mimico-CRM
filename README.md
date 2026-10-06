# crm.mimico.live

This directory is the isolated Next.js application for the staged CRM migration.
The legacy `../client` and `../server` applications remain the source system until
the final cutover.

## Foundation

- Next.js 16 App Router and React 19
- TypeScript with strict checking
- Tailwind CSS 4
- Supabase browser/server clients with cookie-based session refresh
- Prisma PostgreSQL runtime dependencies (schema design begins in Stage 1)
- TanStack Query for client-side server-state use cases
- React Hook Form and Zod for forms and validation
- Vitest and Testing Library
- Health endpoint at `/api/health`

## Local setup

1. Copy `.env.example` to `.env.local`.
2. Add development Supabase credentials and database connection strings.
3. Install dependencies with `npm install`.
4. Run `npm run dev`.

The landing page works without credentials and reports which integrations are
awaiting configuration. Never commit `.env.local` or Supabase/database secrets.

## Checks

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

After configuring `DIRECT_URL`, use `npm run db:validate` to validate the Prisma
schema and `npm run db:generate` to generate the client.

Before a production release, follow [the cutover runbook](docs/production-cutover.md)
and run the read-only readiness gate:

```bash
npm run release:preflight -- --organization <organization-slug> --base-url https://crm.mimico.live
```

## Migration boundary

New work belongs in this directory. Do not import legacy client components or
Express controllers directly; migrate each feature through a reviewed data model,
authorization policy, server boundary, and UI.

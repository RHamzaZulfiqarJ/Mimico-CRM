<div align="center">

# Mimico CRM

### A multi-tenant operations platform for leads, clients, sales, finance, and team workflows

[![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=nextdotjs)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Prisma-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Supabase](https://img.shields.io/badge/Auth%20%26%20Storage-Supabase-3FCF8E?logo=supabase&logoColor=white)](https://supabase.com/)
[![Tests](https://img.shields.io/badge/Tests-Vitest-6E9F18?logo=vitest&logoColor=white)](https://vitest.dev/)

[Live application](https://mimico-crm-hamza-zulfiqars-projects.vercel.app) · [Architecture and data model](docs/data-model.md) · [Production cutover](docs/production-cutover.md)

</div>

## Overview

Mimico CRM is a modern, organization-scoped business operations system built for teams that need one place to manage their customer lifecycle and internal workflows. It replaces a legacy React/Express application through a staged migration to a typed Next.js architecture with explicit authorization boundaries, auditable data changes, and production-readiness checks.

## Product capabilities

- Lead capture, assignment, follow-ups, reminders, CSV import, and Kanban workflows
- Client records, attachments, projects, inventory, sales, and refund management
- Tasks, calendars, approvals, notifications, and team administration
- Cashbook, vouchers, payroll transcripts, and printable business documents
- Facebook lead ingestion, webhook validation, health monitoring, and maintenance jobs
- Multi-organization access control with scoped queries and Supabase Row Level Security
- Audit logging and reference-data management for operational traceability

## Engineering highlights

- Next.js 16 App Router and React 19 with strict TypeScript
- Server-first feature boundaries with Zod-validated actions and queries
- PostgreSQL through Prisma 7, backed by versioned migrations
- Supabase authentication, storage, server-side sessions, and RLS policies
- TanStack Query, React Hook Form, Tailwind CSS 4, and reusable UI components
- Vitest and Testing Library coverage for policies, schemas, money logic, routes, and interactive workflows
- Automated preflight and load-test scripts for production releases
- Security headers, environment validation, protected routes, and cron-job authorization

## Architecture

```text
Next.js App Router
├── Workspace UI and server-rendered pages
├── Feature actions, queries, schemas, and policies
├── Auth, webhooks, health checks, and scheduled jobs
└── Prisma data access
    └── PostgreSQL / Supabase
        ├── Row Level Security
        ├── Authentication
        └── Object storage
```

Feature modules live under `src/features`, route surfaces under `src/app`, and reusable components under `src/components`. The application keeps authorization and organization scoping close to each server boundary instead of relying on client-side checks.

## Local development

### Prerequisites

- Node.js and npm
- PostgreSQL or a Supabase project

### Setup

```bash
git clone https://github.com/RHamzaZulfiqarJ/Mimico-CRM.git
cd Mimico-CRM
cp .env.example .env.local
npm install
npm run db:generate
npm run dev
```

Add the Supabase and database values documented in `.env.example`. Never commit `.env.local` or service credentials.

## Quality checks

Run the complete local verification pipeline:

```bash
npm run check
```

Or run checks individually:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

## Production readiness

After configuring `DIRECT_URL`, validate the Prisma schema and generate the client:

```bash
npm run db:validate
npm run db:generate
```

Before release, follow the [production cutover runbook](docs/production-cutover.md) and run the read-only readiness gates:

```bash
npm run release:preflight -- --organization <organization-slug> --base-url https://crm.mimico.live
npm run release:performance -- --organization <organization-slug> --base-url https://crm.mimico.live
```

## Migration strategy

This repository is the isolated Next.js target for a staged CRM migration. Each legacy feature is moved through a reviewed data model, authorization policy, server boundary, and user interface. Legacy React components and Express controllers are not imported directly into the new application.

## Documentation

The `docs` directory covers authentication, authorization, the data model, dashboard metrics, lead management, client records, work management, finance, team administration, Facebook integration, legacy imports, and production cutover.

## Status

Active development. The public deployment may require an authorized organization account for workspace features.

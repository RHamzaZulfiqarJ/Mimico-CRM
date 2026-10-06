import "dotenv/config";

import { mkdir, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";
import { Pool } from "pg";

import {
  evaluateDatabaseSnapshot,
  evaluateHealthEndpoint,
  evaluateStorageBucket,
  managedTables,
  summarizeChecks,
  validateEnvironment,
  type DatabaseSnapshot,
  type ReadinessCheck,
} from "./readiness";

type Arguments = {
  allowLocal: boolean;
  baseUrl?: string;
  organization?: string;
  report?: string;
  skipHttp: boolean;
};

function parseArguments(argv: string[]): Arguments {
  const parsed: Arguments = { allowLocal: false, skipHttp: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--allow-local") { parsed.allowLocal = true; continue; }
    if (argument === "--skip-http") { parsed.skipHttp = true; continue; }
    if (["--base-url", "--organization", "--report"].includes(argument)) {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) throw new Error(`${argument} requires a value.`);
      index += 1;
      if (argument === "--base-url") parsed.baseUrl = value;
      if (argument === "--organization") parsed.organization = value;
      if (argument === "--report") parsed.report = value;
      continue;
    }
    throw new Error(`Unknown argument: ${argument}`);
  }
  if (!parsed.organization) throw new Error("--organization is required.");
  return parsed;
}

function failedCheck(id: string, message: string): ReadinessCheck {
  return { id, status: "fail", message };
}

async function databaseChecks(organizationSlug: string): Promise<ReadinessCheck[]> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) return [failedCheck("database.connection", "DATABASE_URL is unavailable, so database checks could not run.")];
  const pool = new Pool({ connectionString, connectionTimeoutMillis: 8_000, max: 1 });
  try {
    const [migrationResult, failedMigrationResult, tableResult, organizationResult, localEntries] = await Promise.all([
      pool.query<{ migration_name: string }>(
        'select migration_name from public."_prisma_migrations" where finished_at is not null and rolled_back_at is null order by migration_name',
      ),
      pool.query<{ migration_name: string }>(
        'select migration_name from public."_prisma_migrations" where finished_at is null and rolled_back_at is null order by migration_name',
      ),
      pool.query<{ table_name: string; rls_enabled: boolean; policy_count: string }>(
        `select c.relname as table_name,
                c.relrowsecurity as rls_enabled,
                count(p.policyname)::text as policy_count
         from pg_class c
         join pg_namespace n on n.oid = c.relnamespace
         left join pg_policies p on p.schemaname = n.nspname and p.tablename = c.relname
         where n.nspname = 'public' and c.relname = any($1::text[])
         group by c.relname, c.relrowsecurity
         order by c.relname`,
        [[...managedTables]],
      ),
      pool.query<{ slug: string; active_members: string; active_management: string }>(
        `select o.slug,
                count(m.id) filter (where m.is_active)::text as active_members,
                count(m.id) filter (where m.is_active and m.role::text in ('manager', 'super_admin'))::text as active_management
         from public.organizations o
         left join public.organization_memberships m on m.organization_id = o.id
         where o.slug = $1
         group by o.id, o.slug`,
        [organizationSlug],
      ),
      readdir(path.resolve("prisma", "migrations"), { withFileTypes: true }),
    ]);
    const organization = organizationResult.rows[0];
    const snapshot: DatabaseSnapshot = {
      appliedMigrations: migrationResult.rows.map((row) => row.migration_name),
      failedMigrations: failedMigrationResult.rows.map((row) => row.migration_name),
      localMigrations: localEntries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort(),
      organization: organization ? {
        slug: organization.slug,
        activeMembers: Number(organization.active_members),
        activeManagement: Number(organization.active_management),
      } : undefined,
      tables: tableResult.rows.map((row) => ({
        tableName: row.table_name,
        rlsEnabled: row.rls_enabled,
        policyCount: Number(row.policy_count),
      })),
    };
    return [
      { id: "database.connection", status: "pass", message: "The production database is reachable." },
      ...evaluateDatabaseSnapshot(snapshot),
    ];
  } catch {
    return [failedCheck("database.connection", "The database readiness checks could not be completed.")];
  } finally {
    await pool.end();
  }
}

async function storageCheck(): Promise<ReadinessCheck> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) return failedCheck("storage.attachments", "Supabase server credentials are unavailable, so Storage could not be checked.");
  try {
    const client = createClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data, error } = await client.storage.getBucket("crm-attachments");
    if (error) {
      const statusCode = "statusCode" in error ? Number(error.statusCode) : undefined;
      return statusCode === 404
        ? evaluateStorageBucket({ exists: false })
        : failedCheck("storage.attachments", "The attachment Storage bucket could not be verified with the configured server credentials.");
    }
    return evaluateStorageBucket({ exists: true, isPublic: data.public });
  } catch {
    return failedCheck("storage.attachments", "The attachment Storage readiness check could not be completed.");
  }
}

async function healthCheck(baseUrl: string | undefined, skip: boolean): Promise<ReadinessCheck> {
  if (skip) return { id: "deployment.health", status: "warn", message: "The deployment health check was skipped explicitly." };
  if (!baseUrl) return failedCheck("deployment.health", "No application URL is available for the deployment health check.");
  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/api/health`, {
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(8_000),
    });
    const payload = await response.json() as { status?: string };
    return evaluateHealthEndpoint({ reachable: true, httpStatus: response.status, serviceStatus: payload.status });
  } catch {
    return evaluateHealthEndpoint({ reachable: false });
  }
}

function defaultReportPath() {
  const timestamp = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
  return path.resolve("migration-reports", `production-preflight-${timestamp}.json`);
}

async function main() {
  const arguments_ = parseArguments(process.argv.slice(2));
  const baseUrl = arguments_.baseUrl ?? process.env.NEXT_PUBLIC_APP_URL;
  const environmentChecks = validateEnvironment(process.env, baseUrl, arguments_.allowLocal);
  const [database, storage, health] = await Promise.all([
    databaseChecks(arguments_.organization!),
    storageCheck(),
    healthCheck(baseUrl, arguments_.skipHttp),
  ]);
  const checks = [...environmentChecks, ...database, storage, health];
  const summary = summarizeChecks(checks);
  const reportPath = path.resolve(arguments_.report ?? defaultReportPath());
  const report = {
    generatedAt: new Date().toISOString(),
    target: { organization: arguments_.organization, baseUrl: baseUrl ?? null },
    summary,
    ready: summary.fail === 0,
    checks,
  };
  await mkdir(path.dirname(reportPath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  process.stdout.write(`Production preflight: ${summary.pass} passed, ${summary.warn} warning(s), ${summary.fail} failed.\nReport: ${reportPath}\n`);
  if (summary.fail) process.exitCode = 2;
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});

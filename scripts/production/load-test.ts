import "dotenv/config";

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { Pool, type QueryConfig } from "pg";

import { runBenchmark, summarizeBenchmarks, type BenchmarkResult } from "./performance";

type Arguments = {
  baseUrl?: string;
  concurrency: number;
  iterations: number;
  organization?: string;
  report?: string;
  thresholdMs: number;
};

function integerArgument(argument: string, value: string | undefined, minimum: number, maximum: number) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`${argument} must be an integer between ${minimum} and ${maximum}.`);
  }
  return parsed;
}

function parseArguments(argv: string[]): Arguments {
  const parsed: Arguments = { concurrency: 4, iterations: 20, thresholdMs: 750 };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (["--base-url", "--concurrency", "--iterations", "--organization", "--report", "--threshold-ms"].includes(argument)) {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) throw new Error(`${argument} requires a value.`);
      index += 1;
      if (argument === "--base-url") parsed.baseUrl = value;
      if (argument === "--organization") parsed.organization = value;
      if (argument === "--report") parsed.report = value;
      if (argument === "--concurrency") parsed.concurrency = integerArgument(argument, value, 1, 20);
      if (argument === "--iterations") parsed.iterations = integerArgument(argument, value, 3, 200);
      if (argument === "--threshold-ms") parsed.thresholdMs = integerArgument(argument, value, 50, 10_000);
      continue;
    }
    throw new Error(`Unknown argument: ${argument}`);
  }
  if (!parsed.organization) throw new Error("--organization is required.");
  return parsed;
}

const probes: Array<{ name: string; query: QueryConfig }> = [
  {
    name: "database_round_trip",
    query: { text: "select $1::uuid is not null" },
  },
  {
    name: "leads_workspace",
    query: {
      text: `select lead.id
             from public.leads lead
             left join public.projects project on project.id = lead.project_id
             where lead.organization_id = $1::uuid and lead.is_archived = false
             order by lead.updated_at desc
             limit 31`,
    },
  },
  {
    name: "lead_reminders",
    query: {
      text: `with latest as (
               select distinct on (follow_up.lead_id)
                 follow_up.id, follow_up.lead_id, follow_up.follow_up_at
               from public.follow_ups follow_up
               join public.leads lead on lead.id = follow_up.lead_id
               where follow_up.organization_id = $1::uuid
                 and lead.organization_id = $1::uuid
                 and lead.is_archived = false
               order by follow_up.lead_id, follow_up.created_at desc, follow_up.id desc
             )
             select id
             from latest
             where follow_up_at is not null
             order by follow_up_at asc, id asc
             limit 31`,
    },
  },
  {
    name: "dashboard_metrics",
    query: {
      text: `with scoped_leads as materialized (
               select id, stage, priority, created_at
               from public.leads
               where organization_id = $1::uuid and is_archived = false
             ), latest_follow_ups as (
               select distinct on (follow_up.lead_id) follow_up.lead_id, follow_up.follow_up_at
               from public.follow_ups follow_up
               join scoped_leads lead on lead.id = follow_up.lead_id
               where follow_up.organization_id = $1::uuid
               order by follow_up.lead_id, follow_up.created_at desc, follow_up.id desc
             )
             select
               (select count(*) from scoped_leads) as active_leads,
               (select count(*) from scoped_leads group by stage limit 1) as largest_stage,
               (select count(*) from latest_follow_ups where follow_up_at < now()) as due_calls,
               (select coalesce(sum(amount), 0) from public.cashbook_entries where organization_id = $1::uuid) as cash_total`,
    },
  },
  {
    name: "tasks_workspace",
    query: {
      text: `with task_page as materialized (
               select id
               from public.tasks
               where organization_id = $1::uuid and is_archived = false
               order by due_at asc nulls last, created_at desc
               limit 100
             )
             select
               (select count(*) from task_page) as page_rows,
               (select count(*) from public.tasks where organization_id = $1::uuid and is_archived = false) as total,
               (select count(*) from public.tasks where organization_id = $1::uuid and is_archived = false and status in ('todo', 'in_progress')) as active`,
    },
  },
  {
    name: "cashbook_workspace",
    query: {
      text: `with entry_page as materialized (
               select id
               from public.cashbook_entries
               where organization_id = $1::uuid
               order by occurred_at desc, id desc
               limit 31
             )
             select
               (select count(*) from entry_page) as page_rows,
               coalesce(sum(case when direction = 'in' then amount else -amount end), 0) as net,
               coalesce(sum(amount) filter (where occurred_at >= date_trunc('month', now())), 0) as month_total
             from public.cashbook_entries
             where organization_id = $1::uuid`,
    },
  },
  {
    name: "finance_workspaces",
    query: {
      text: `with
               sale_page as materialized (select id from public.sales where organization_id = $1::uuid order by created_at desc limit 31),
               voucher_page as materialized (select id from public.vouchers where organization_id = $1::uuid order by created_at desc limit 31),
               refund_page as materialized (select id from public.refunds where organization_id = $1::uuid order by created_at desc limit 31),
               payroll_page as materialized (select id from public.payroll_transcripts where organization_id = $1::uuid order by pay_period_start desc limit 31)
             select
               (select count(*) from sale_page) as sales,
               (select count(*) from voucher_page) as vouchers,
               (select count(*) from refund_page) as refunds,
               (select count(*) from payroll_page) as payroll`,
    },
  },
];

async function healthOperation(baseUrl: string) {
  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/api/health`, {
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error("Health endpoint failed.");
  const body = await response.json() as { status?: string };
  if (body.status !== "ok") throw new Error("Health endpoint returned an unexpected payload.");
}

async function deploymentRegion(baseUrl: string) {
  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/api/health`, {
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(8_000),
    });
    const body = await response.json() as { region?: string };
    return body.region ?? null;
  } catch {
    return null;
  }
}

function defaultReportPath() {
  const timestamp = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
  return path.resolve("migration-reports", `production-performance-${timestamp}.json`);
}

async function main() {
  const arguments_ = parseArguments(process.argv.slice(2));
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required.");
  const baseUrl = arguments_.baseUrl ?? process.env.NEXT_PUBLIC_APP_URL;
  if (!baseUrl) throw new Error("--base-url or NEXT_PUBLIC_APP_URL is required.");
  const pool = new Pool({
    connectionString,
    connectionTimeoutMillis: 8_000,
    idleTimeoutMillis: 10_000,
    max: arguments_.concurrency,
    statement_timeout: 8_000,
  });
  try {
    const organizationResult = await pool.query<{ id: string }>(
      "select id from public.organizations where slug = $1 limit 1",
      [arguments_.organization],
    );
    const organizationId = organizationResult.rows[0]?.id;
    if (!organizationId) throw new Error(`Organization ${arguments_.organization} does not exist.`);

    const countResult = await pool.query<Record<string, string>>(
      `select
         (select count(*)::text from public.leads where organization_id = $1::uuid) as leads,
         (select count(*)::text from public.follow_ups where organization_id = $1::uuid) as follow_ups,
         (select count(*)::text from public.tasks where organization_id = $1::uuid) as tasks,
         (select count(*)::text from public.sales where organization_id = $1::uuid) as sales,
         (select count(*)::text from public.cashbook_entries where organization_id = $1::uuid) as cashbook_entries,
         (select count(*)::text from public.vouchers where organization_id = $1::uuid) as vouchers,
         (select count(*)::text from public.refunds where organization_id = $1::uuid) as refunds,
         (select count(*)::text from public.payroll_transcripts where organization_id = $1::uuid) as payroll_transcripts`,
      [organizationId],
    );
    const datasetCounts = Object.fromEntries(
      Object.entries(countResult.rows[0] ?? {}).map(([key, value]) => [key, Number(value)]),
    );
    const warnings: string[] = [];
    if ((datasetCounts.leads ?? 0) < 1_000 || (datasetCounts.cashbook_entries ?? 0) < 1_000) {
      warnings.push("The target contains fewer than 1,000 leads or cashbook entries; treat this as a connectivity baseline and repeat against a production-sized rehearsal import.");
    }
    await Promise.all(Array.from(
      { length: arguments_.concurrency },
      () => pool.query("select 1"),
    ));
    const results: BenchmarkResult[] = [];
    for (const probe of probes) {
      results.push(await runBenchmark({
        name: probe.name,
        iterations: arguments_.iterations,
        concurrency: arguments_.concurrency,
        thresholdMs: arguments_.thresholdMs,
        operation: () => pool.query({ ...probe.query, values: [organizationId] }),
      }));
    }
    results.push(await runBenchmark({
      name: "deployment_health",
      iterations: arguments_.iterations,
      concurrency: arguments_.concurrency,
      thresholdMs: Math.max(arguments_.thresholdMs, 1_000),
      operation: () => healthOperation(baseUrl),
    }));

    const [summary, region] = [summarizeBenchmarks(results), await deploymentRegion(baseUrl)];
    const reportPath = path.resolve(arguments_.report ?? defaultReportPath());
    const report = {
      generatedAt: new Date().toISOString(),
      target: { organization: arguments_.organization, baseUrl, deploymentRegion: region },
      configuration: {
        concurrency: arguments_.concurrency,
        iterationsPerProbe: arguments_.iterations,
        databaseP95ThresholdMs: arguments_.thresholdMs,
        healthP95ThresholdMs: Math.max(arguments_.thresholdMs, 1_000),
      },
      datasetCounts,
      warnings,
      summary,
      results,
    };
    await mkdir(path.dirname(reportPath), { recursive: true });
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    process.stdout.write(`Performance gate: ${summary.passed} passed, ${summary.failed} failed; slowest p95 ${summary.slowestP95Ms} ms.\nReport: ${reportPath}\n`);
    if (summary.failed) process.exitCode = 2;
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});

export type CheckStatus = "pass" | "warn" | "fail";

export type ReadinessCheck = {
  id: string;
  status: CheckStatus;
  message: string;
  details?: string[];
};

export const managedTables = [
  "organizations",
  "profiles",
  "organization_memberships",
  "clients",
  "societies",
  "projects",
  "inventories",
  "leads",
  "lead_assignments",
  "follow_ups",
  "attachments",
  "tasks",
  "calendar_events",
  "approvals",
  "notifications",
  "sales",
  "cashbook_entries",
  "vouchers",
  "refunds",
  "payroll_deduction_policies",
  "payroll_transcripts",
  "facebook_integrations",
  "facebook_inbound_leads",
  "facebook_lead_claims",
  "audit_logs",
] as const;

type Environment = Record<string, string | undefined>;

export type DatabaseSnapshot = {
  appliedMigrations: string[];
  failedMigrations: string[];
  localMigrations: string[];
  organization?: { slug: string; activeMembers: number; activeManagement: number };
  tables: Array<{ tableName: string; rlsEnabled: boolean; policyCount: number }>;
};

function check(id: string, status: CheckStatus, message: string, details?: string[]): ReadinessCheck {
  return { id, status, message, ...(details?.length ? { details } : {}) };
}

function parsedUrl(value: string | undefined) {
  if (!value) return undefined;
  try {
    return new URL(value);
  } catch {
    return undefined;
  }
}

function normalizedUrl(value: string) {
  return value.replace(/\/$/, "");
}

export function validateEnvironment(
  environment: Environment,
  baseUrl: string | undefined,
  allowLocal: boolean,
): ReadinessCheck[] {
  const checks: ReadinessCheck[] = [];
  const required = [
    "NEXT_PUBLIC_APP_URL",
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "DATABASE_URL",
    "SUPABASE_SECRET_KEY",
    "TASK_REMINDER_SECRET",
  ] as const;
  const missing = required.filter((name) => !environment[name]?.trim());
  checks.push(check(
    "environment.required",
    missing.length ? "fail" : "pass",
    missing.length ? "Required production environment variables are missing." : "Required production environment variables are present.",
    missing,
  ));

  checks.push(check(
    "environment.direct_url",
    environment.DIRECT_URL?.trim() ? "pass" : "warn",
    environment.DIRECT_URL?.trim()
      ? "A direct/session database URL is available for migrations and backups."
      : "DIRECT_URL is not configured in this operator environment; migration and backup commands need a direct or session-mode URL.",
  ));

  const appUrl = parsedUrl(environment.NEXT_PUBLIC_APP_URL);
  const selectedUrl = parsedUrl(baseUrl ?? environment.NEXT_PUBLIC_APP_URL);
  const supabaseUrl = parsedUrl(environment.NEXT_PUBLIC_SUPABASE_URL);
  const localHostnames = new Set(["localhost", "127.0.0.1", "::1"]);
  const unsafeAppUrl = !selectedUrl
    || (!allowLocal && (selectedUrl.protocol !== "https:" || localHostnames.has(selectedUrl.hostname)));
  checks.push(check(
    "environment.app_url",
    unsafeAppUrl ? "fail" : "pass",
    unsafeAppUrl
      ? "The production application URL must be a valid public HTTPS URL."
      : `Application URL is production-safe (${selectedUrl.origin}).`,
  ));
  if (appUrl && selectedUrl && normalizedUrl(appUrl.href) !== normalizedUrl(selectedUrl.href)) {
    checks.push(check(
      "environment.app_url_match",
      "fail",
      "The requested deployment URL does not match NEXT_PUBLIC_APP_URL.",
    ));
  } else {
    checks.push(check("environment.app_url_match", "pass", "Deployment and configured application URLs match."));
  }

  checks.push(check(
    "environment.supabase_url",
    !supabaseUrl || (!allowLocal && supabaseUrl.protocol !== "https:") ? "fail" : "pass",
    !supabaseUrl || (!allowLocal && supabaseUrl.protocol !== "https:")
      ? "NEXT_PUBLIC_SUPABASE_URL must be a valid HTTPS URL."
      : "Supabase URL is valid.",
  ));

  const reminderLength = environment.TASK_REMINDER_SECRET?.length ?? 0;
  checks.push(check(
    "environment.task_secret",
    reminderLength >= 32 ? "pass" : "fail",
    reminderLength >= 32
      ? "Task reminder authentication secret meets the minimum length."
      : "TASK_REMINDER_SECRET must contain at least 32 characters.",
  ));
  return checks;
}

export function evaluateDatabaseSnapshot(snapshot: DatabaseSnapshot): ReadinessCheck[] {
  const checks: ReadinessCheck[] = [];
  const applied = new Set(snapshot.appliedMigrations);
  const missingMigrations = snapshot.localMigrations.filter((migration) => !applied.has(migration));
  const unknownMigrations = snapshot.appliedMigrations.filter((migration) => !snapshot.localMigrations.includes(migration));
  checks.push(check(
    "database.migrations",
    snapshot.failedMigrations.length || missingMigrations.length ? "fail" : "pass",
    snapshot.failedMigrations.length || missingMigrations.length
      ? "Database migration history is not ready for release."
      : `All ${snapshot.localMigrations.length} local migrations are applied successfully.`,
    [
      ...snapshot.failedMigrations.map((migration) => `unfinished: ${migration}`),
      ...missingMigrations.map((migration) => `missing: ${migration}`),
    ],
  ));
  if (unknownMigrations.length) {
    checks.push(check(
      "database.unknown_migrations",
      "warn",
      "The database contains migrations not present in this checkout.",
      unknownMigrations,
    ));
  }

  const tableByName = new Map(snapshot.tables.map((table) => [table.tableName, table]));
  const missingTables = managedTables.filter((table) => !tableByName.has(table));
  checks.push(check(
    "database.tables",
    missingTables.length ? "fail" : "pass",
    missingTables.length ? "Required CRM tables are missing." : `All ${managedTables.length} managed CRM tables exist.`,
    [...missingTables],
  ));
  const unrestricted = snapshot.tables.filter((table) => !table.rlsEnabled).map((table) => table.tableName);
  checks.push(check(
    "database.rls",
    unrestricted.length ? "fail" : "pass",
    unrestricted.length ? "Some CRM tables do not have Row Level Security enabled." : "RLS is enabled on every managed CRM table.",
    unrestricted,
  ));
  const withoutPolicies = snapshot.tables.filter((table) => table.policyCount < 1).map((table) => table.tableName);
  checks.push(check(
    "database.policies",
    withoutPolicies.length ? "fail" : "pass",
    withoutPolicies.length ? "Some CRM tables have no RLS policy." : "Every managed CRM table has at least one RLS policy.",
    withoutPolicies,
  ));

  if (!snapshot.organization) {
    checks.push(check("database.organization", "fail", "The target organization does not exist."));
  } else {
    checks.push(check(
      "database.organization",
      snapshot.organization.activeMembers > 0 ? "pass" : "fail",
      snapshot.organization.activeMembers > 0
        ? `Organization ${snapshot.organization.slug} has ${snapshot.organization.activeMembers} active member(s).`
        : `Organization ${snapshot.organization.slug} has no active members.`,
    ));
    checks.push(check(
      "database.management",
      snapshot.organization.activeManagement > 0 ? "pass" : "fail",
      snapshot.organization.activeManagement > 0
        ? `Organization ${snapshot.organization.slug} has active management access.`
        : `Organization ${snapshot.organization.slug} has no active manager or super administrator.`,
    ));
  }
  return checks;
}

export function evaluateStorageBucket(bucket: { exists: boolean; isPublic?: boolean }): ReadinessCheck {
  if (!bucket.exists) return check("storage.attachments", "fail", "The crm-attachments Storage bucket does not exist.");
  if (bucket.isPublic) return check("storage.attachments", "fail", "The crm-attachments Storage bucket is public.");
  return check("storage.attachments", "pass", "The crm-attachments Storage bucket exists and is private.");
}

export function evaluateHealthEndpoint(result: { reachable: boolean; httpStatus?: number; serviceStatus?: string }): ReadinessCheck {
  const healthy = result.reachable && result.httpStatus === 200 && result.serviceStatus === "ok";
  return check(
    "deployment.health",
    healthy ? "pass" : "fail",
    healthy ? "The deployed health endpoint is responding normally." : "The deployed health endpoint did not return the expected healthy response.",
  );
}

export function summarizeChecks(checks: ReadinessCheck[]) {
  return {
    pass: checks.filter((item) => item.status === "pass").length,
    warn: checks.filter((item) => item.status === "warn").length,
    fail: checks.filter((item) => item.status === "fail").length,
  };
}

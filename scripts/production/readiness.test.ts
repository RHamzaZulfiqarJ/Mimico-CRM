import { describe, expect, it } from "vitest";

import {
  evaluateDatabaseSnapshot,
  evaluateHealthEndpoint,
  evaluateStorageBucket,
  managedTables,
  summarizeChecks,
  validateEnvironment,
} from "./readiness";

const validEnvironment = {
  NEXT_PUBLIC_APP_URL: "https://crm.mimico.live",
  NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable",
  DATABASE_URL: "postgresql://runtime",
  DIRECT_URL: "postgresql://direct",
  SUPABASE_SECRET_KEY: "secret",
  TASK_REMINDER_SECRET: "a-secure-reminder-secret-with-32-characters",
};

describe("production readiness checks", () => {
  it("accepts a complete production environment without exposing values", () => {
    const checks = validateEnvironment(validEnvironment, undefined, false);
    expect(checks.every((item) => item.status === "pass")).toBe(true);
    expect(JSON.stringify(checks)).not.toContain("postgresql://");
    expect(JSON.stringify(checks)).not.toContain(validEnvironment.TASK_REMINDER_SECRET);
  });

  it("rejects local deployment URLs and short scheduler secrets", () => {
    const checks = validateEnvironment({
      ...validEnvironment,
      NEXT_PUBLIC_APP_URL: "http://localhost:3000",
      TASK_REMINDER_SECRET: "short",
    }, undefined, false);
    expect(checks).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "environment.app_url", status: "fail" }),
      expect.objectContaining({ id: "environment.task_secret", status: "fail" }),
    ]));
  });

  it("detects missing migrations, unrestricted tables, and missing management", () => {
    const tables = managedTables.map((tableName) => ({ tableName, rlsEnabled: true, policyCount: 1 }));
    tables[0] = { ...tables[0], rlsEnabled: false, policyCount: 0 };
    const checks = evaluateDatabaseSnapshot({
      appliedMigrations: ["001"],
      failedMigrations: [],
      localMigrations: ["001", "002"],
      organization: { slug: "mimico", activeMembers: 1, activeManagement: 0 },
      tables,
    });
    expect(checks).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "database.migrations", status: "fail" }),
      expect.objectContaining({ id: "database.rls", status: "fail" }),
      expect.objectContaining({ id: "database.policies", status: "fail" }),
      expect.objectContaining({ id: "database.management", status: "fail" }),
    ]));
  });

  it("evaluates private storage, health, and summary totals", () => {
    const checks = [
      evaluateStorageBucket({ exists: true, isPublic: false }),
      evaluateHealthEndpoint({ reachable: true, httpStatus: 200, serviceStatus: "ok" }),
    ];
    expect(summarizeChecks(checks)).toEqual({ pass: 2, warn: 0, fail: 0 });
  });
});

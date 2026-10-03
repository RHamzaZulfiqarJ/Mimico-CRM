import { z } from "zod";

const publicEnvironmentSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
});

const databaseEnvironmentSchema = z.object({
  DATABASE_URL: z.string().min(1),
});

const adminEnvironmentSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  SUPABASE_SECRET_KEY: z.string().min(1),
});

const taskReminderEnvironmentSchema = z.object({
  TASK_REMINDER_SECRET: z.string().min(32),
});

const facebookMaintenanceEnvironmentSchema = z.object({
  FACEBOOK_MAINTENANCE_SECRET: z.string().min(32),
});

function formatEnvironmentError(error: z.ZodError) {
  return error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join(", ");
}

export function hasSupabaseEnvironment() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}

export function hasDatabaseEnvironment() {
  return Boolean(process.env.DATABASE_URL);
}

export function hasAdminEnvironment() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SECRET_KEY,
  );
}

export function getPublicEnvironment() {
  const result = publicEnvironmentSchema.safeParse({
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  });

  if (!result.success) {
    throw new Error(
      `Invalid public environment configuration: ${formatEnvironmentError(result.error)}`,
    );
  }

  return result.data;
}

export function getDatabaseEnvironment() {
  const result = databaseEnvironmentSchema.safeParse({
    DATABASE_URL: process.env.DATABASE_URL,
  });

  if (!result.success) {
    throw new Error(
      `Invalid database environment configuration: ${formatEnvironmentError(result.error)}`,
    );
  }

  return result.data;
}

export function getAdminEnvironment() {
  const result = adminEnvironmentSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
  });

  if (!result.success) {
    throw new Error(
      `Invalid admin environment configuration: ${formatEnvironmentError(result.error)}`,
    );
  }

  return result.data;
}

export function getTaskReminderEnvironment() {
  const result = taskReminderEnvironmentSchema.safeParse({
    TASK_REMINDER_SECRET: process.env.TASK_REMINDER_SECRET,
  });

  if (!result.success) {
    throw new Error(
      `Invalid task reminder configuration: ${formatEnvironmentError(result.error)}`,
    );
  }

  return result.data;
}

export function getFacebookMaintenanceEnvironment() {
  const result = facebookMaintenanceEnvironmentSchema.safeParse({
    FACEBOOK_MAINTENANCE_SECRET: process.env.FACEBOOK_MAINTENANCE_SECRET,
  });

  if (!result.success) {
    throw new Error(
      `Invalid Facebook maintenance configuration: ${formatEnvironmentError(result.error)}`,
    );
  }

  return result.data;
}

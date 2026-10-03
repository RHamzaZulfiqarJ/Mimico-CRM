import { z } from "zod";

export const assignableRoleSchema = z.enum([
  "CLIENT",
  "EMPLOYEE",
  "MANAGER",
  "SUPER_ADMIN",
]);

export const inviteMemberSchema = z.object({
  firstName: z.string().trim().min(2).max(100),
  lastName: z.string().trim().min(2).max(100),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email("Enter a valid email address.")),
  role: assignableRoleSchema,
});

export const membershipChangeSchema = z.object({
  membershipId: z.uuid(),
  role: assignableRoleSchema,
});

export const membershipStatusSchema = z.object({
  membershipId: z.uuid(),
  active: z.enum(["true", "false"]).transform((value) => value === "true"),
});

export type TeamFormState = {
  status: "idle" | "error" | "success";
  message?: string;
  errors?: Record<string, string[]>;
};

export const initialTeamFormState: TeamFormState = { status: "idle" };

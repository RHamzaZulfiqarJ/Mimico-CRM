import { z } from "zod";

const requiredText = (label: string, max: number) =>
  z.string().trim().min(2, `${label} must contain at least 2 characters.`).max(max);

const optionalText = (max: number) =>
  z.preprocess(
    (value) => value == null || (typeof value === "string" && value.trim() === "") ? undefined : value,
    z.string().trim().max(max).optional(),
  );

const optionalUuid = z.preprocess(
  (value) => value == null || value === "" ? undefined : value,
  z.uuid("Select a valid portal account.").optional(),
);

export const clientFormSchema = z.object({
  firstName: requiredText("First name", 100),
  lastName: requiredText("Last name", 100),
  email: z.preprocess(
    (value) => value == null || value === "" ? undefined : value,
    z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address.")).optional(),
  ),
  phone: z.string().trim().min(7, "Enter a valid phone number.").max(50),
  city: optionalText(100),
  cnic: optionalText(30),
  portalProfileId: optionalUuid,
});

export const clientFiltersSchema = z.object({
  query: z.string().trim().max(120).optional().catch(undefined),
  status: z.enum(["active", "inactive", "all"]).catch("active"),
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
});

export const clientStatusSchema = z.object({
  clientId: z.uuid(),
  active: z.enum(["true", "false"]).transform((value) => value === "true"),
});

export type ClientFormState = {
  status: "idle" | "error" | "success";
  message?: string;
  errors?: Record<string, string[]>;
};

export const initialClientFormState: ClientFormState = { status: "idle" };

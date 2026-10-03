import { z } from "zod";

const requiredText = (label: string, max: number) =>
  z
    .string()
    .trim()
    .min(2, `${label} must contain at least 2 characters.`)
    .max(max, `${label} must contain at most ${max} characters.`);

const optionalText = (max: number) =>
  z.preprocess(
    (value) =>
      typeof value === "string" && value.trim() === ""
        ? undefined
        : value,
    z.string().trim().max(max).optional(),
  );

const optionalUuid = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.uuid("Select a valid project.").optional(),
);

const optionalPrice = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z
    .string()
    .trim()
    .regex(/^\d{1,16}(?:\.\d{1,2})?$/, "Enter a valid amount with up to 2 decimal places.")
    .optional(),
);

export const societySchema = z.object({
  title: requiredText("Title", 120),
  description: requiredText("Description", 2_000),
});

export const projectSchema = z.object({
  societyId: z.uuid("Select a valid society."),
  title: requiredText("Title", 120),
  description: requiredText("Description", 2_000),
  city: requiredText("City", 100),
});

export const inventorySchema = z.object({
  projectId: optionalUuid,
  sellerName: requiredText("Seller name", 160),
  sellerPhone: optionalText(50),
  sellerEmail: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z
      .string()
      .trim()
      .toLowerCase()
      .pipe(z.email("Enter a valid seller email."))
      .optional(),
  ),
  sellerCompanyName: optionalText(160),
  sellerCity: optionalText(100),
  propertyStreetNumber: optionalText(100),
  propertyNumber: optionalText(100),
  price: optionalPrice,
  remarks: optionalText(2_000),
  status: z.enum(["SOLD", "UNSOLD", "UNDER_PROCESS"]),
});

export type ReferenceFormState = {
  status: "idle" | "error" | "success";
  message?: string;
  errors?: Record<string, string[]>;
};

export const initialReferenceFormState: ReferenceFormState = {
  status: "idle",
};

type FacebookField = { name: string; values: string[] };

export function facebookFields(value: unknown): FacebookField[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const name = "name" in entry && typeof entry.name === "string" ? entry.name : null;
    const values =
      "values" in entry && Array.isArray(entry.values)
        ? entry.values.filter((item: unknown): item is string => typeof item === "string")
        : [];
    return name ? [{ name, values }] : [];
  });
}

export function facebookAnswer(fields: FacebookField[], ...names: string[]) {
  for (const name of names) {
    const answer = fields.find((field) => field.name === name)?.values[0]?.trim();
    if (answer) return answer;
  }
  return null;
}

export function facebookLeadDefaults(value: unknown) {
  const fields = facebookFields(value);
  const firstName = facebookAnswer(fields, "first_name");
  const lastName = facebookAnswer(fields, "last_name");
  const combinedName = [firstName, lastName].filter(Boolean).join(" ");
  const reserved = new Set([
    "full_name",
    "first_name",
    "last_name",
    "phone_number",
    "phone",
    "mobile_number",
    "city",
    "area",
  ]);
  const details = fields
    .filter((field) => !reserved.has(field.name) && field.values.length)
    .map((field) => `${field.name.replaceAll("_", " ")}: ${field.values.join(", ")}`)
    .join("\n")
    .slice(0, 2_000);

  return {
    fields,
    clientName: facebookAnswer(fields, "full_name") ?? combinedName,
    clientPhone: facebookAnswer(fields, "phone_number", "phone", "mobile_number"),
    city: facebookAnswer(fields, "city"),
    area: facebookAnswer(fields, "area"),
    requestedProject: facebookAnswer(fields, "project", "property", "interested_project"),
    description: details || "Captured through Facebook Lead Ads.",
  };
}

export function facebookLeadDisplayStatus({
  inboundStatus,
  claimStatus,
  expiresAt,
  now = new Date(),
}: {
  inboundStatus: "PENDING" | "ACCEPTED" | "EXPIRED" | "CONVERTED";
  claimStatus?: "PENDING" | "ACCEPTED" | "REJECTED" | "DISMISSED";
  expiresAt: Date | null;
  now?: Date;
}) {
  if (inboundStatus === "CONVERTED") return "converted" as const;
  if (claimStatus === "REJECTED") return "declined" as const;
  if (inboundStatus === "ACCEPTED" || claimStatus === "ACCEPTED") return "claimed" as const;
  if (inboundStatus === "EXPIRED" || (expiresAt && expiresAt <= now)) return "expired" as const;
  if (claimStatus === "DISMISSED") return "claimed" as const;
  return "available" as const;
}

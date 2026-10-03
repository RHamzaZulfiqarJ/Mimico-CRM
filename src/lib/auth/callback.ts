import { safeNextPath } from "@/lib/auth/forms";

export const passwordSetupFlows = ["invite", "recovery"] as const;
export type PasswordSetupFlow = (typeof passwordSetupFlows)[number];

export function isPasswordSetupFlow(value: string | null): value is PasswordSetupFlow {
  return passwordSetupFlows.includes(value as PasswordSetupFlow);
}

export function authCallbackDestination(
  flow: string | null,
  requestedNext: string | null,
) {
  const passwordFlow = isPasswordSetupFlow(flow);
  const fallback = passwordFlow ? "/update-password" : "/dashboard";
  const destination = safeNextPath(requestedNext, fallback);

  if (!passwordFlow || !destination.startsWith("/update-password")) {
    return destination;
  }

  const url = new URL(destination, "https://local.invalid");
  url.searchParams.set("flow", flow);
  return `${url.pathname}${url.search}`;
}

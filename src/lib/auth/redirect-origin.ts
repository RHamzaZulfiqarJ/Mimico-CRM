type RedirectOriginInput = {
  configuredUrl: string;
  forwardedHost?: string | null;
  forwardedProto?: string | null;
  host?: string | null;
  origin?: string | null;
};

function firstHeaderValue(value: string | null | undefined) {
  return value?.split(",", 1)[0]?.trim() || undefined;
}

function safeOrigin(value: string | undefined) {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    const local = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
    if (url.protocol !== "https:" && !(local && url.protocol === "http:")) return undefined;
    return url.origin;
  } catch {
    return undefined;
  }
}

export function resolveAuthRedirectOrigin(input: RedirectOriginInput) {
  const requestOrigin = safeOrigin(firstHeaderValue(input.origin));
  if (requestOrigin) return requestOrigin;

  const host = firstHeaderValue(input.forwardedHost) ?? firstHeaderValue(input.host);
  const protocol = firstHeaderValue(input.forwardedProto) ?? (host?.startsWith("localhost") ? "http" : "https");
  const forwardedOrigin = safeOrigin(host ? `${protocol}://${host}` : undefined);
  if (forwardedOrigin) return forwardedOrigin;

  return new URL(input.configuredUrl).origin;
}

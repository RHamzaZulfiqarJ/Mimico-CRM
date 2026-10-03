import { facebookPageIdentitySchema } from "@/features/facebook/schemas";

export function facebookGraphApiVersion() {
  const configured = process.env.FACEBOOK_GRAPH_API_VERSION?.trim();
  return configured && /^v\d+\.\d+$/.test(configured) ? configured : "v23.0";
}

export async function fetchFacebookPageIdentity(pageAccessToken: string) {
  const url = new URL(`https://graph.facebook.com/${facebookGraphApiVersion()}/me`);
  url.searchParams.set("fields", "id,name");
  const response = await fetch(url, {
    cache: "no-store",
    headers: { Authorization: `Bearer ${pageAccessToken}` },
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error(`FACEBOOK_GRAPH_${response.status}`);
  return facebookPageIdentitySchema.parse(await response.json());
}

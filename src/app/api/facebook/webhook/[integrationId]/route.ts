import { getNamedServerSecret, secureStringEqual, verifyFacebookSignature } from "@/features/facebook/security";
import { ingestFacebookWebhook } from "@/features/facebook/webhook";
import { getDatabase } from "@/lib/database";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function getIntegration(integrationId: string) {
  return getDatabase().facebookIntegration.findFirst({
    where: { id: integrationId, isActive: true },
    select: {
      id: true,
      organizationId: true,
      pageId: true,
      verifyTokenSecretName: true,
      appSecretName: true,
      pageAccessTokenSecretName: true,
    },
  });
}

export async function GET(request: Request, context: RouteContext<"/api/facebook/webhook/[integrationId]">) {
  const { integrationId } = await context.params;
  const integration = await getIntegration(integrationId);
  if (!integration) return new Response("Not found", { status: 404 });

  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  const expectedToken = getNamedServerSecret(integration.verifyTokenSecretName);

  if (
    mode !== "subscribe" ||
    !token ||
    !challenge ||
    !expectedToken ||
    !secureStringEqual(token, expectedToken)
  ) {
    return new Response("Forbidden", { status: 403 });
  }
  return new Response(challenge, { status: 200 });
}

export async function POST(request: Request, context: RouteContext<"/api/facebook/webhook/[integrationId]">) {
  const { integrationId } = await context.params;
  const integration = await getIntegration(integrationId);
  if (!integration) return new Response("Not found", { status: 404 });

  const appSecret = getNamedServerSecret(integration.appSecretName);
  const pageAccessToken = getNamedServerSecret(integration.pageAccessTokenSecretName);
  if (!appSecret || !pageAccessToken) {
    console.error("Facebook integration secrets are unavailable", { integrationId });
    return new Response("Integration unavailable", { status: 503 });
  }

  const rawBody = await request.text();
  if (!verifyFacebookSignature(rawBody, request.headers.get("x-hub-signature-256"), appSecret)) {
    return new Response("Invalid signature", { status: 401 });
  }

  try {
    const payload: unknown = JSON.parse(rawBody);
    const result = await ingestFacebookWebhook(integration, payload, pageAccessToken);
    return Response.json({ status: "accepted", ...result });
  } catch (error) {
    console.error("Facebook webhook ingestion failed", {
      integrationId,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return new Response("Webhook processing failed", { status: 500 });
  }
}

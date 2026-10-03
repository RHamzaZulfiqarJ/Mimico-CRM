import { NextResponse } from "next/server";

import { runFacebookHealthCheck } from "@/features/facebook/health";
import { isFacebookMaintenanceRequestAuthorized } from "@/features/facebook/maintenance";
import { getFacebookMaintenanceEnvironment } from "@/lib/env";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const responseHeaders = { "Cache-Control": "no-store" };

async function handle(request: Request) {
  let secret: string;
  try {
    secret = getFacebookMaintenanceEnvironment().FACEBOOK_MAINTENANCE_SECRET;
  } catch {
    return NextResponse.json(
      { error: "Facebook health monitoring is not configured." },
      { status: 503, headers: responseHeaders },
    );
  }

  if (!isFacebookMaintenanceRequestAuthorized(request.headers.get("authorization"), secret)) {
    return NextResponse.json(
      { error: "Unauthorized." },
      { status: 401, headers: responseHeaders },
    );
  }

  try {
    const result = await runFacebookHealthCheck();
    return NextResponse.json({ status: "ok", ...result }, { headers: responseHeaders });
  } catch {
    return NextResponse.json(
      { error: "Facebook health monitoring failed." },
      { status: 500, headers: responseHeaders },
    );
  }
}

export const GET = handle;
export const POST = handle;

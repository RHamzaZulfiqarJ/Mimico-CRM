import type { EmailOtpType } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { authCallbackDestination } from "@/lib/auth/callback";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type") as EmailOtpType | null;
  const code = request.nextUrl.searchParams.get("code");
  const nextPath = authCallbackDestination(
    type,
    request.nextUrl.searchParams.get("next"),
  );

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(nextPath, request.url));
    }
  }

  if (tokenHash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    });

    if (!error) {
      return NextResponse.redirect(new URL(nextPath, request.url));
    }
  }

  // Older/default templates can return an implicit session in the URL
  // fragment. Fragments never reach the server, so hand the browser URL to a
  // client completion page. Browsers preserve the original fragment across
  // this redirect when the Location header has no fragment of its own.
  if (!tokenHash && !code) {
    return NextResponse.redirect(new URL("/auth/complete/link", request.url));
  }

  return NextResponse.redirect(new URL("/login?error=invalid-link", request.url));
}

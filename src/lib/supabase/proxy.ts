import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

import { verifiedAuthUserIdHeader } from "@/lib/auth/identity";
import { getPublicEnvironment, hasSupabaseEnvironment } from "@/lib/env";

export async function updateSession(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.delete(verifiedAuthUserIdHeader);

  if (!hasSupabaseEnvironment()) {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  const pendingCookies: Array<{
    name: string;
    value: string;
    options: CookieOptions;
  }> = [];
  const environment = getPublicEnvironment();

  const supabase = createServerClient(
    environment.NEXT_PUBLIC_SUPABASE_URL,
    environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          pendingCookies.push(...cookiesToSet);
        },
      },
    },
  );

  const { data, error } = await supabase.auth.getClaims();
  if (!error && typeof data?.claims?.sub === "string") {
    requestHeaders.set(verifiedAuthUserIdHeader, data.claims.sub);
  }

  const refreshedCookieHeader = request.headers.get("cookie");
  if (refreshedCookieHeader) {
    requestHeaders.set("cookie", refreshedCookieHeader);
  }

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  pendingCookies.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, options);
  });

  return response;
}

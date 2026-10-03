"use client";

import type { EmailOtpType } from "@supabase/supabase-js";
import { CircleAlert, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import {
  authCallbackDestination,
  isPasswordSetupFlow,
  type PasswordSetupFlow,
} from "@/lib/auth/callback";
import { createClient } from "@/lib/supabase/client";

export function AuthCompletion({
  expectedFlow,
}: {
  expectedFlow: PasswordSetupFlow | "link";
}) {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function completeAuthentication() {
      const url = new URL(window.location.href);
      const query = url.searchParams;
      const fragment = new URLSearchParams(url.hash.replace(/^#/, ""));
      const detectedType = query.get("type") ?? fragment.get("type");
      const flow = isPasswordSetupFlow(detectedType)
        ? detectedType
        : expectedFlow === "link"
          ? null
          : expectedFlow;
      if (!flow) {
        throw new Error("The authentication flow could not be determined.");
      }
      const verificationType = detectedType ?? flow;
      const destination = authCallbackDestination(flow, query.get("next"));
      const providerError = query.get("error_description") ?? fragment.get("error_description");

      if (providerError) {
        throw new Error(providerError);
      }

      const supabase = createClient();
      const code = query.get("code");
      const tokenHash = query.get("token_hash");
      const accessToken = fragment.get("access_token");
      const refreshToken = fragment.get("refresh_token");

      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) throw exchangeError;
      } else if (tokenHash) {
        const { error: verificationError } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: verificationType as EmailOtpType,
        });
        if (verificationError) throw verificationError;
      } else if (accessToken && refreshToken) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (sessionError) throw sessionError;
      } else {
        throw new Error("The authentication link did not contain a usable session.");
      }

      // Remove one-time credentials before navigating away, then force a full
      // request so the proxy can validate the newly written session cookies.
      window.history.replaceState(null, "", url.pathname);
      window.location.replace(destination);
    }

    completeAuthentication().catch(() => {
      if (active) {
        window.history.replaceState(null, "", window.location.pathname);
        setError("This invitation or password-recovery link is invalid or has expired.");
      }
    });

    return () => {
      active = false;
    };
  }, [expectedFlow]);

  if (error) {
    return (
      <div className="text-center">
        <CircleAlert className="mx-auto size-9 text-rose-400" />
        <p role="alert" className="mt-4 text-sm leading-6 text-rose-600">
          {error}
        </p>
        <Link
          href={expectedFlow === "recovery" ? "/forgot-password" : "/login"}
          className="mt-5 inline-flex h-10 items-center rounded-lg bg-[#20aee3] px-4 text-sm font-medium text-white"
        >
          {expectedFlow === "recovery" ? "Request another link" : "Return to sign in"}
        </Link>
      </div>
    );
  }

  return (
    <div role="status" className="text-center">
      <LoaderCircle className="mx-auto size-9 animate-spin text-[#20aee3]" />
      <p className="mt-4 text-sm text-gray-500">
        {expectedFlow === "invite"
          ? "Accepting your invitation…"
          : expectedFlow === "recovery"
            ? "Verifying your recovery link…"
            : "Completing authentication…"}
      </p>
    </div>
  );
}

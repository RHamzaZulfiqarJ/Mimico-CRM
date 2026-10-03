import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { LoginForm } from "@/components/auth/login-form";
import { safeNextPath } from "@/lib/auth/forms";
import { getVerifiedAuthUserId } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string; password?: string }>;
}) {
  const userId = await getVerifiedAuthUserId();

  if (userId) {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const nextPath = safeNextPath(params.next ?? null);

  return (
    <section className="surface-card rounded-lg p-6 shadow-xl shadow-slate-300/35 sm:p-10">
      <div className="mb-5 text-center">
        <h1 className="text-xl font-normal tracking-wide text-slate-600">Sign in to your account</h1>
      </div>

      {params.error === "invalid-link" ? (
        <p
          role="alert"
          className="mb-5 rounded border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600"
        >
          This sign-in or recovery link is invalid or has expired.
        </p>
      ) : null}

      {params.password === "updated" ? (
        <p
          role="status"
          className="mb-5 rounded border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
        >
          Your password has been saved. Sign in with the new password.
        </p>
      ) : null}

      <LoginForm nextPath={nextPath} />

      <p className="mt-5 text-center text-sm font-light text-slate-500">
        Need an account? Contact your administrator.
      </p>
    </section>
  );
}

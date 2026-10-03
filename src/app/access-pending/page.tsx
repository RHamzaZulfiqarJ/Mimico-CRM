import { Clock3, LogOut } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { signOutAction } from "@/app/auth/actions";
import { getAuthContext, getVerifiedAuthUserId } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Access pending" };

export default async function AccessPendingPage() {
  const authUserId = await getVerifiedAuthUserId();

  if (!authUserId) {
    redirect("/login");
  }

  const auth = await getAuthContext();

  if (auth) {
    redirect("/dashboard");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f6f9fa] px-5 py-12 text-[#67757c]">
      <section className="page-enter w-full max-w-lg border border-gray-100 bg-white p-8 text-center shadow-lg">
        <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-amber-50 text-amber-500">
          <Clock3 className="size-7" />
        </span>
        <h1 className="mt-6 text-2xl font-semibold">Workspace access pending</h1>
        <p className="mt-3 text-sm leading-6 text-gray-500">
          Your identity is verified, but no active CRM profile and organization
          membership is linked yet. Ask an administrator to finish provisioning
          your account.
        </p>
        <form action={signOutAction} className="mt-7">
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded border border-gray-200 px-4 py-2.5 text-sm font-medium text-[#67757c] transition hover:bg-gray-50"
          >
            <LogOut className="size-4" />
            Sign out
          </button>
        </form>
      </section>
    </main>
  );
}

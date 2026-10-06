import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { UpdatePasswordForm } from "@/components/auth/update-password-form";
import { getVerifiedAuthUserId } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Choose a new password" };

export default async function UpdatePasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ flow?: string }>;
}) {
  const userId = await getVerifiedAuthUserId();

  if (!userId) {
    redirect("/login?error=invalid-link");
  }

  const { flow } = await searchParams;
  const invitation = flow === "invite";

  return (
    <section className="surface-card rounded-lg p-6 shadow-xl shadow-slate-300/35 sm:p-10">
      <div className="mb-7">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#20aee3]">
          Account security
        </p>
        <h1 className="mt-3 text-2xl font-normal tracking-tight text-slate-600">
          {invitation ? "Create your password" : "Choose a new password"}
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          {invitation
            ? "Finish activating your CRM account with a password only you know."
            : "Use a unique password with uppercase, lowercase, and numeric characters."}
        </p>
      </div>
      <UpdatePasswordForm />
    </section>
  );
}

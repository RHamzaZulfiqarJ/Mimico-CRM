import type { Metadata } from "next";
import Link from "next/link";

import { RecoveryForm } from "@/components/auth/recovery-form";

export const metadata: Metadata = { title: "Recover account" };

export default function ForgotPasswordPage() {
  return (
    <section className="surface-card rounded-lg p-6 shadow-xl shadow-slate-300/35 sm:p-10">
      <div className="mb-7">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#20aee3]">
          Account recovery
        </p>
        <h1 className="mt-3 text-2xl font-normal tracking-tight text-slate-600">
          Reset your password
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          Enter your account email and we’ll send a secure recovery link.
        </p>
      </div>
      <RecoveryForm />
      <Link
        href="/login"
        className="mt-6 block text-center text-sm font-medium text-[#20aee3] transition hover:text-sky-600"
      >
        Return to sign in
      </Link>
    </section>
  );
}

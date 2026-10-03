import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AuthCompletion } from "@/components/auth/auth-completion";
import { isPasswordSetupFlow } from "@/lib/auth/callback";

export const metadata: Metadata = { title: "Completing authentication" };

export default async function CompleteAuthenticationPage({
  params,
}: {
  params: Promise<{ flow: string }>;
}) {
  const { flow } = await params;
  if (!isPasswordSetupFlow(flow) && flow !== "link") notFound();

  return (
    <section className="surface-card rounded-lg p-8 shadow-xl shadow-slate-300/35 sm:p-10">
      <AuthCompletion expectedFlow={flow} />
    </section>
  );
}

import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { getAuthContext, getVerifiedAuthUserId } from "@/lib/auth/session";

export default async function WorkspaceLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const authUserId = await getVerifiedAuthUserId();

  if (!authUserId) {
    redirect("/login?next=/dashboard");
  }

  const auth = await getAuthContext();

  if (!auth) {
    redirect("/access-pending");
  }

  return <AppShell auth={auth}>{children}</AppShell>;
}

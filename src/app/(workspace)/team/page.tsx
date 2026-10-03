import { ShieldCheck, UserCheck, UserPlus, UsersRound } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { InviteMemberForm } from "@/components/team/invite-member-form";
import {
  changeMemberRoleAction,
  setMembershipStatusAction,
} from "@/features/team/actions";
import { getTeamData } from "@/features/team/queries";
import {
  canAssignRole,
  canManageMember,
  type MembershipRole,
} from "@/lib/auth/authorization";

export const metadata: Metadata = { title: "Team" };

const roleLabels: Record<MembershipRole, string> = {
  CLIENT: "Client",
  EMPLOYEE: "Employee",
  MANAGER: "Manager",
  SUPER_ADMIN: "Super admin",
};

export default async function TeamPage() {
  const data = await getTeamData();
  if (!data) redirect("/dashboard");

  const activeCount = data.memberships.filter((membership) => membership.isActive).length;
  const pendingIdentityCount = data.memberships.filter(
    (membership) => !membership.profile.authUserId,
  ).length;
  const assignableRoles = (["CLIENT", "EMPLOYEE", "MANAGER", "SUPER_ADMIN"] as const).filter(
    (role) => canAssignRole(data.auth.membership.role, role),
  );

  return (
    <div className="mx-auto max-w-6xl">
      <p className="text-xs font-medium text-gray-500 sm:text-sm">Dashboard › User › Employees</p>
      <h1 className="mt-2 text-[28px] font-light tracking-tight text-[#20aee3] sm:text-[32px]">Employees</h1>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-500">
        Invite people, assign organization roles, and deactivate access without
        deleting historical CRM records.
      </p>

      <section className="mt-7 grid gap-4 sm:grid-cols-3" aria-label="Team totals">
        {[
          { label: "Total memberships", value: data.memberships.length, icon: UsersRound },
          { label: "Active access", value: activeCount, icon: UserCheck },
          { label: "Awaiting identity", value: pendingIdentityCount, icon: UserPlus },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <article key={item.label} className="surface-card surface-card-interactive flex items-center gap-4 rounded-lg p-5">
              <span className="flex size-11 items-center justify-center rounded-lg bg-[#ebf2f5] text-[#20aee3]"><Icon className="size-5" /></span>
              <div><p className="text-2xl font-medium text-gray-700">{item.value}</p><p className="text-xs text-gray-500">{item.label}</p></div>
            </article>
          );
        })}
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-[360px_1fr]">
        <article className="surface-card h-fit rounded-lg p-5">
          <h2 className="font-medium text-[#ff5c6c]">Invite a member</h2>
          <p className="mb-5 mt-1 text-xs leading-5 text-slate-500">
            Invitations create the Auth identity, profile, and organization membership together.
          </p>
          {!data.invitationsConfigured ? (
            <p role="status" className="mb-5 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-700">
              Add the server-only Supabase secret key to enable invitations.
            </p>
          ) : null}
          <InviteMemberForm actorRole={data.auth.membership.role} />
        </article>

        <article className="surface-card rounded-lg p-5">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div><h2 className="font-medium text-[#20aee3]">Organization members</h2><p className="mt-1 text-xs text-gray-500">Role and access changes are audit logged.</p></div>
            <ShieldCheck className="size-5 text-[#20aee3]" />
          </div>
          <div className="space-y-3">
            {data.memberships.map((membership) => {
              const isSelf = membership.profile.id === data.auth.profile.id;
              const manageable = !isSelf && canManageMember(data.auth.membership.role, membership.role);
              const displayName = [membership.profile.firstName, membership.profile.lastName].filter(Boolean).join(" ") || membership.profile.username || membership.profile.email || "Unnamed profile";
              const roleAction = changeMemberRoleAction.bind(null, membership.id);
              const statusAction = setMembershipStatusAction.bind(null, membership.id, String(!membership.isActive));

              return (
                <div key={membership.id} className="rounded-md border border-gray-100 bg-[#f8fbfc] p-4 transition hover:border-sky-100 hover:bg-sky-50/40">
                  <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2"><p className="truncate text-sm font-medium text-gray-700">{displayName}</p>{isSelf ? <span className="rounded bg-sky-50 px-1.5 py-0.5 text-[10px] font-medium text-[#20aee3]">You</span> : null}</div>
                      <p className="mt-1 truncate text-xs text-gray-400">{membership.profile.email ?? "No email"} · {membership.profile.authUserId ? "Identity linked" : "Identity pending"}</p>
                    </div>
                    <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
                      {manageable ? (
                        <form action={roleAction} className="grid w-full grid-cols-[1fr_auto] items-center gap-2 sm:flex sm:w-auto">
                          <select name="role" aria-label={`Role for ${displayName}`} defaultValue={membership.role} className="h-9 min-w-0 rounded-md border border-gray-300 bg-white px-2 text-xs text-gray-700">
                            {assignableRoles.map((role) => <option key={role} value={role}>{roleLabels[role]}</option>)}
                          </select>
                          <button type="submit" className="h-9 whitespace-nowrap rounded-md border border-gray-300 bg-white px-3 text-xs font-medium text-gray-600 transition hover:border-sky-200 hover:bg-sky-50 hover:text-[#20aee3]">Save role</button>
                        </form>
                      ) : (
                        <span className="rounded-md border border-gray-200 bg-white px-3 py-2 text-xs text-gray-500">{roleLabels[membership.role]}</span>
                      )}
                      {manageable ? (
                        <form action={statusAction} className="w-full sm:w-auto">
                          <button type="submit" className={membership.isActive ? "h-9 w-full rounded-lg border border-rose-200 bg-white px-3 text-xs font-medium text-rose-600 transition hover:bg-rose-50 sm:w-auto" : "h-9 w-full rounded-lg border border-emerald-200 bg-white px-3 text-xs font-medium text-emerald-700 transition hover:bg-emerald-50 sm:w-auto"}>
                            {membership.isActive ? "Deactivate" : "Reactivate"}
                          </button>
                        </form>
                      ) : null}
                    </div>
                  </div>
                  <p className={membership.isActive ? "mt-3 text-[11px] text-emerald-600" : "mt-3 text-[11px] text-slate-500"}>{membership.isActive ? "Active organization access" : "Organization access disabled"}</p>
                </div>
              );
            })}
          </div>
        </article>
      </section>
    </div>
  );
}

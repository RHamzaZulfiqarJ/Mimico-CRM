"use client";

import { LoaderCircle } from "lucide-react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { inviteMemberAction } from "@/features/team/actions";
import { initialTeamFormState } from "@/features/team/schemas";
import type { MembershipRole } from "@/lib/auth/authorization";

const inputClassName =
  "mt-1.5 h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-700 outline-none transition placeholder:text-gray-400 focus:border-[#20aee3] focus:ring-2 focus:ring-[#20aee3]/15";

function InviteButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#ff5c6c] px-4 text-sm font-medium text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-red-500 hover:shadow-md disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
    >
      {pending ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : null}
      {pending ? "Sending…" : "Send invitation"}
    </button>
  );
}

export function InviteMemberForm({ actorRole }: { actorRole: MembershipRole }) {
  const [state, action] = useActionState(inviteMemberAction, initialTeamFormState);
  const roles = actorRole === "SUPER_ADMIN"
    ? ["CLIENT", "EMPLOYEE", "MANAGER", "SUPER_ADMIN"] as const
    : ["CLIENT", "EMPLOYEE", "MANAGER"] as const;

  return (
    <form action={action} className="space-y-4">
      {state.message ? (
        <p
          role={state.status === "success" ? "status" : "alert"}
          className={state.status === "success" ? "rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700" : "rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-600"}
        >
          {state.message}
        </p>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-xs font-medium text-gray-600">
          First name
          <input name="firstName" required maxLength={100} className={inputClassName} placeholder="Ayesha" />
          {state.errors?.firstName ? <span className="mt-1 block text-rose-600">{state.errors.firstName[0]}</span> : null}
        </label>
        <label className="text-xs font-medium text-gray-600">
          Last name
          <input name="lastName" required maxLength={100} className={inputClassName} placeholder="Khan" />
          {state.errors?.lastName ? <span className="mt-1 block text-rose-600">{state.errors.lastName[0]}</span> : null}
        </label>
      </div>
      <label className="block text-xs font-medium text-gray-600">
        Email
        <input name="email" type="email" required className={inputClassName} placeholder="ayesha@example.com" />
        {state.errors?.email ? <span className="mt-1 block text-rose-600">{state.errors.email[0]}</span> : null}
      </label>
      <label className="block text-xs font-medium text-gray-600">
        Organization role
        <select name="role" defaultValue="EMPLOYEE" className={inputClassName}>
          {roles.map((role) => (
            <option key={role} value={role}>{role.toLowerCase().replace("_", " ")}</option>
          ))}
        </select>
      </label>
      <InviteButton />
    </form>
  );
}

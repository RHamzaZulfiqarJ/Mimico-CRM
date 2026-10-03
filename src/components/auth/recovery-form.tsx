"use client";

import { useActionState } from "react";

import { requestPasswordResetAction } from "@/app/auth/actions";
import { FieldError, FormMessage } from "@/components/auth/form-message";
import { SubmitButton } from "@/components/auth/submit-button";
import { initialAuthFormState } from "@/lib/auth/forms";

export function RecoveryForm() {
  const [state, action] = useActionState(
    requestPasswordResetAction,
    initialAuthFormState,
  );

  return (
    <form action={action} className="space-y-5">
      <FormMessage state={state} />
      <div>
        <label htmlFor="email" className="text-sm font-medium text-gray-600">
          Account email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="mt-2 h-11 w-full rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-700 outline-none transition placeholder:text-gray-400 focus:border-[#20aee3] focus:ring-2 focus:ring-[#20aee3]/15"
          placeholder="you@company.com"
        />
        <FieldError errors={state.errors?.email} />
      </div>
      <SubmitButton idleLabel="Send recovery link" pendingLabel="Sending…" />
    </form>
  );
}

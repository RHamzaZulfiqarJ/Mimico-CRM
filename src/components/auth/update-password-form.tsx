"use client";

import { useActionState } from "react";

import { updatePasswordAction } from "@/app/auth/actions";
import { FieldError, FormMessage } from "@/components/auth/form-message";
import { SubmitButton } from "@/components/auth/submit-button";
import { initialAuthFormState } from "@/lib/auth/forms";

export function UpdatePasswordForm() {
  const [state, action] = useActionState(
    updatePasswordAction,
    initialAuthFormState,
  );

  return (
    <form action={action} className="space-y-5">
      <FormMessage state={state} />
      <div>
        <label
          htmlFor="password"
          className="text-sm font-medium text-gray-600"
        >
          New password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={10}
          className="mt-2 h-11 w-full rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-700 outline-none transition placeholder:text-gray-400 focus:border-[#20aee3] focus:ring-2 focus:ring-[#20aee3]/15"
          placeholder="At least 10 characters"
        />
        <FieldError errors={state.errors?.password} />
      </div>
      <div>
        <label
          htmlFor="confirmPassword"
          className="text-sm font-medium text-gray-600"
        >
          Confirm new password
        </label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          className="mt-2 h-11 w-full rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-700 outline-none transition placeholder:text-gray-400 focus:border-[#20aee3] focus:ring-2 focus:ring-[#20aee3]/15"
          placeholder="Repeat your new password"
        />
        <FieldError errors={state.errors?.confirmPassword} />
      </div>
      <SubmitButton idleLabel="Update password" pendingLabel="Updating…" />
    </form>
  );
}

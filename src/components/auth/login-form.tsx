"use client";

import { Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { useActionState, useState } from "react";

import { loginAction } from "@/app/auth/actions";
import { FieldError, FormMessage } from "@/components/auth/form-message";
import { SubmitButton } from "@/components/auth/submit-button";
import { initialAuthFormState } from "@/lib/auth/forms";

export function LoginForm({ nextPath }: { nextPath: string }) {
  const [state, action] = useActionState(loginAction, initialAuthFormState);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="next" value={nextPath} />
      <FormMessage state={state} />

      <div>
        <label htmlFor="email" className="sr-only">Email address</label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="h-11 w-full border-0 border-b border-gray-300 bg-white px-2 text-sm text-gray-700 outline-none transition placeholder:text-gray-400 focus:border-[#20aee3] focus:bg-sky-50/20"
          placeholder="Email"
        />
        <FieldError errors={state.errors?.email} />
      </div>

      <div className="relative">
        <label htmlFor="password" className="sr-only">Password</label>
        <input
          id="password"
          name="password"
          type={showPassword ? "text" : "password"}
          autoComplete="current-password"
          required
          className="h-11 w-full border-0 border-b border-gray-300 bg-white px-2 pr-10 text-sm text-gray-700 outline-none transition placeholder:text-gray-400 focus:border-[#20aee3] focus:bg-sky-50/20"
          placeholder="Password"
        />
        <button type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? "Hide password" : "Show password"} className="absolute right-1 top-1.5 rounded-md p-2 text-gray-400 transition hover:bg-slate-50 hover:text-[#20aee3]">
          {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
        <FieldError errors={state.errors?.password} />
      </div>

      <label className="flex w-fit items-center gap-2 text-sm text-gray-500">
        <input
          type="checkbox"
          name="remember"
          defaultChecked
          className="size-4 rounded accent-[#20aee3]"
        />
        Remember Me
      </label>

      <div className="flex justify-end">
        <Link
          href="/forgot-password"
          className="text-sm font-light text-gray-500 transition hover:text-gray-700"
        >
          Forgot Password
        </Link>
      </div>

      <SubmitButton idleLabel="Continue" pendingLabel="Submitting…" />
    </form>
  );
}

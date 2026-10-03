"use server";

import type { Route } from "next";
import { redirect } from "next/navigation";

import {
  type AuthFormState,
  emailSchema,
  loginSchema,
  safeNextPath,
  updatePasswordSchema,
} from "@/lib/auth/forms";
import { getPublicEnvironment, hasSupabaseEnvironment } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

function configurationError(): AuthFormState {
  return {
    status: "error",
    message: "Authentication is not configured in this environment.",
  };
}

export async function loginAction(
  _state: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  if (!hasSupabaseEnvironment()) {
    return configurationError();
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    return {
      status: "error",
      message: "The email or password is incorrect.",
    };
  }

  redirect(safeNextPath(formData.get("next")) as Route);
}

export async function requestPasswordResetAction(
  _state: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = emailSchema.safeParse({ email: formData.get("email") });

  if (!parsed.success) {
    return {
      status: "error",
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  if (!hasSupabaseEnvironment()) {
    return configurationError();
  }

  const supabase = await createClient();
  const environment = getPublicEnvironment();
  const { error } = await supabase.auth.resetPasswordForEmail(
    parsed.data.email,
    {
      redirectTo: new URL(
        "/auth/complete/recovery",
        environment.NEXT_PUBLIC_APP_URL,
      ).toString(),
    },
  );

  if (error) {
    return {
      status: "error",
      message: "We could not send the recovery email. Try again shortly.",
    };
  }

  return {
    status: "success",
    message:
      "If that account exists, a password recovery link has been sent.",
  };
}

export async function updatePasswordAction(
  _state: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = updatePasswordSchema.safeParse({
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  if (!hasSupabaseEnvironment()) {
    return configurationError();
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });

  if (error) {
    return {
      status: "error",
      message: "The recovery session expired. Request a new recovery email.",
    };
  }

  // A full sign-in is required after a password change. This also prevents an
  // invitation opened in an administrator's browser from retaining that
  // administrator session.
  await supabase.auth.signOut({ scope: "local" });
  redirect("/login?password=updated");
}

export async function signOutAction() {
  if (hasSupabaseEnvironment()) {
    const supabase = await createClient();
    await supabase.auth.signOut({ scope: "local" });
  }

  redirect("/login");
}

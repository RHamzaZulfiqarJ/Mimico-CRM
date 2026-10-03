import type { AuthFormState } from "@/lib/auth/forms";

export function FormMessage({ state }: { state: AuthFormState }) {
  if (!state.message) {
    return null;
  }

  const isSuccess = state.status === "success";

  return (
    <p
      role={isSuccess ? "status" : "alert"}
      className={
        isSuccess
          ? "rounded border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
          : "rounded border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600"
      }
    >
      {state.message}
    </p>
  );
}

export function FieldError({ errors }: { errors?: string[] }) {
  if (!errors?.length) {
    return null;
  }

  return <p className="mt-1.5 text-xs text-rose-600">{errors[0]}</p>;
}

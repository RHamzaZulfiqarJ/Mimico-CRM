"use client";

import { useEffect } from "react";

export default function ErrorPage({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f6f9fa] px-6 text-[#67757c]">
      <div className="page-enter max-w-md text-center">
        <h1 className="text-2xl font-semibold">Something went wrong</h1>
        <p className="mt-3 text-gray-500">
          The error has been captured. You can safely try this request again.
        </p>
        <button
          type="button"
          onClick={retry}
          className="mt-6 rounded bg-[#20aee3] px-4 py-2 font-medium text-white hover:bg-[#45b8e2]"
        >
          Try again
        </button>
      </div>
    </main>
  );
}

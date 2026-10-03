"use client";

import Image from "next/image";

export default function GlobalError({ retry }: { retry: () => void }) {
  return (
    <html lang="en">
      <body className="bg-[#f6f9fa] text-[#67757c]">
        <main className="flex min-h-screen items-center justify-center px-6">
          <div className="page-enter max-w-md text-center">
            <Image src="/images/Icon-Logo.png" alt="" width={1280} height={1280} className="mx-auto mb-5 size-20 object-contain" priority />
            <h1 className="text-2xl font-semibold">crm.mimico.live is unavailable</h1>
            <p className="mt-3 text-gray-500">
              A critical application error occurred. Please retry the request.
            </p>
            <button
              type="button"
              onClick={retry}
              className="mt-6 rounded bg-[#20aee3] px-4 py-2 font-medium text-white"
            >
              Retry
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}

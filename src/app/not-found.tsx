import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f6f9fa] px-6 text-[#67757c]">
      <div className="page-enter text-center">
        <p className="text-sm font-medium text-[#20aee3]">404</p>
        <h1 className="mt-2 text-3xl font-semibold">Page not found</h1>
        <Link
          href="/"
          className="mt-6 inline-flex rounded bg-[#20aee3] px-4 py-2 font-medium text-white hover:bg-[#45b8e2]"
        >
          Return home
        </Link>
      </div>
    </main>
  );
}

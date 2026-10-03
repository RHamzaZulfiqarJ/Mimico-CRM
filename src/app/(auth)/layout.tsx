import Image from "next/image";
import Link from "next/link";

import { BrandWordmark } from "@/components/brand-wordmark";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#f6f9fa] px-5 py-12 font-sans text-gray-600">
      <div aria-hidden className="absolute -right-24 -top-24 size-72 rounded-full bg-sky-200/20 blur-3xl" />
      <div aria-hidden className="absolute -bottom-32 left-1/3 size-80 rounded-full bg-cyan-100/30 blur-3xl" />
      <Image src="/images/login-1.png" alt="" width={500} height={500} className="page-enter fixed bottom-3 left-3 hidden h-auto w-[28%] max-w-[500px] lg:block" priority />
      <div className="page-enter relative w-full max-w-sm">
        <Link href="/" aria-label="crm.mimico.live home" className="mb-6 flex h-20 items-center justify-center rounded-md sm:h-24"><BrandWordmark className="text-3xl sm:text-4xl" /></Link>
        {children}
      </div>
    </main>
  );
}

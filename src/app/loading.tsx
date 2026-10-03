import Image from "next/image";

export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f6f9fa] text-sm text-[#67757c]">
      <span className="flex items-center gap-3"><Image src="/images/Icon-Logo.png" alt="" width={1280} height={1280} className="size-10 animate-pulse object-contain" priority />Loading crm.mimico.live…</span>
    </div>
  );
}

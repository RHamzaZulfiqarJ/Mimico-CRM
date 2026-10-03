export function BrandWordmark({ className = "" }: { className?: string }) {
  return (
    <span
      aria-label="crm.mimico.live"
      className={`inline-flex items-baseline whitespace-nowrap font-semibold tracking-[-0.035em] ${className}`}
    >
      <span className="text-[#20aee3]">crm.</span>
      <span className="text-slate-800">mimico.live</span>
    </span>
  );
}

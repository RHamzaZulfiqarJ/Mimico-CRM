"use client";

import { useEffect, useState } from "react";

function remainingLabel(expiresAt: string, now: number) {
  const remaining = new Date(expiresAt).getTime() - now;
  if (remaining <= 0) return "Expired";
  const hours = Math.floor(remaining / 3_600_000);
  const minutes = Math.floor((remaining % 3_600_000) / 60_000);
  if (hours >= 1) return `${hours}h ${minutes}m remaining`;
  const seconds = Math.floor((remaining % 60_000) / 1_000);
  return `${minutes}m ${seconds}s remaining`;
}

export function FacebookLeadExpiry({ expiresAt }: { expiresAt: string | null }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  if (!expiresAt) return <span>No expiry</span>;
  return <span suppressHydrationWarning>{remainingLabel(expiresAt, now)}</span>;
}

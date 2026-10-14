import type { Metadata, Viewport } from "next";
import Script from "next/script";

import { AppProviders } from "@/components/providers/app-providers";
import { ThemeToggle } from "@/components/theme-toggle";

import "./globals.css";

export const metadata: Metadata = {
  applicationName: "crm.mimico.live",
  title: {
    default: "crm.mimico.live",
    template: "%s | crm.mimico.live",
  },
  description:
    "A fast, secure CRM for managing leads, sales, tasks, approvals, finance, and teams.",
};

export const viewport: Viewport = {
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f9fa" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1120" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <body className="flex min-h-full flex-col">
        <AppProviders>{children}</AppProviders>
        <ThemeToggle />
        <Script src="/theme-init.js" strategy="beforeInteractive" />
      </body>
    </html>
  );
}

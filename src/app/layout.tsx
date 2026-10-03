import type { Metadata } from "next";

import { AppProviders } from "@/components/providers/app-providers";

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

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}

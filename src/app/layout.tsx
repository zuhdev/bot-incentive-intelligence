import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "BOT Incentive Intelligence",
    template: "%s · BOT Incentive Intelligence",
  },
  description:
    "Independent BOT Chain ecosystem incentive monitoring, readiness and evidence platform. Track incentive requirements, monitor on-chain performance and turn your project's activity into verifiable evidence. Not an official BOT Chain product.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}

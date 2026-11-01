import Link from "next/link";
import {
  LayoutDashboard,
  FolderKanban,
  ScrollText,
  Shapes,
  ArrowLeftRight,
  Users,
  Coins,
  Fuel,
  FileCheck2,
  Bell,
  BarChart3,
  Settings,
} from "lucide-react";
import env from "@/lib/env";

export const dynamic = "force-dynamic";

const NAV = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/projects", label: "My Projects", icon: FolderKanban },
  { href: "/dashboard/programmes", label: "Incentive Programmes", icon: ScrollText },
  { href: "/dashboard/scheme-a", label: "Scheme A · DEX", icon: ArrowLeftRight },
  { href: "/dashboard/scheme-b", label: "Scheme B · CEX", icon: Shapes },
  { href: "/dashboard/scheme-c", label: "Scheme C · Community", icon: Users },
  { href: "/dashboard/scheme-d", label: "Scheme D · TVL", icon: Coins },
  { href: "/dashboard/gas", label: "Gas Rebates", icon: Fuel },
  { href: "/dashboard/evidence", label: "Evidence Centre", icon: FileCheck2 },
  { href: "/dashboard/alerts", label: "Alerts", icon: Bell },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-[var(--color-border-subtle)] bg-[var(--color-bg-secondary)] md:flex">
        <Link href="/" className="flex items-center gap-2 border-b border-[var(--color-border-subtle)] px-5 py-4">
          <div className="h-5 w-5 rounded bg-[var(--color-accent-green)]" />
          <span className="text-sm font-semibold tracking-tight">BOT Incentive Intelligence</span>
        </Link>
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-elevated)] hover:text-white"
            >
              <item.icon size={16} className="shrink-0" />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-[var(--color-border-subtle)] px-5 py-3 text-[10px] leading-relaxed text-[var(--color-text-muted)]">
          Independent software — not an official BOT Chain product. Preliminary results only.
        </div>
      </aside>
      <div className="flex-1 overflow-x-hidden">
        <header className="flex items-center justify-between border-b border-[var(--color-border-subtle)] px-6 py-3 md:hidden">
          <Link href="/" className="flex items-center gap-2">
            <div className="h-5 w-5 rounded bg-[var(--color-accent-green)]" />
            <span className="text-sm font-semibold">BOT II</span>
          </Link>
          <Link href="/dashboard" className="text-sm text-[var(--color-text-secondary)]">Menu</Link>
        </header>
        <main className="mx-auto max-w-6xl px-6 py-8">
          {env.BOT_NETWORK === "testnet" && (
            <div className="mb-6 rounded-md border border-[var(--color-amber)]/40 bg-[var(--color-amber)]/5 px-4 py-3 text-xs leading-relaxed text-[var(--color-amber)]">
              <strong>BOT Chain testnet mode · chain ID {env.BOT_CHAIN_ID}</strong> — testnet activity is for integration testing only. It cannot establish BOT mainnet incentive eligibility; programme reward outputs are suppressed.
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}

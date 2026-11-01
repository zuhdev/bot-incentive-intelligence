import Link from "next/link";
import { ConnectWallet } from "@/components/connect-wallet";
import { getOverview } from "@/lib/overview";

export const dynamic = "force-dynamic";

export default async function DashboardOverview() {
  const data = await getOverview();

  if (!data.authenticated || !data.stats) {
    return (
      <div className="mx-auto max-w-xl py-16 text-center">
        <h1 className="text-2xl font-semibold">Connect your wallet to begin</h1>
        <p className="mt-3 text-sm text-[var(--color-text-secondary)]">
          BOT Incentive Intelligence uses wallet-signature authentication. Prove ownership of your
          project wallet to create workspaces and start producing evidence.
        </p>
        <div className="mt-8 flex justify-center">
          <ConnectWallet />
        </div>
      </div>
    );
  }

  const s = data.stats;
  const cards = [
    ["Projects", String(s.projects)],
    ["Tracked addresses", String(s.trackedAddresses)],
    ["Active programmes", String(s.activeProgrammes)],
    ["Open alerts", String(s.openAlerts)],
  ];

  const ingestCards = [
    ["TVL data points", String(s.tvlDataPoints)],
    ["Swap events indexed", String(s.swapEvents)],
    ["Transfer events indexed", String(s.transferEvents)],
    ["Latest block observed", s.latestBlock ? s.latestBlock.toLocaleString() : "—"],
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Workspace overview</h1>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Data ingestion status and programme readiness at a glance.
          </p>
        </div>
        <ConnectWallet />
      </div>

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map(([label, value]) => (
          <div key={label} className="rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-secondary)] p-4">
            <p className="text-xs text-[var(--color-text-muted)]">{label}</p>
            <p className="mt-1 font-mono text-2xl font-semibold text-white">{value}</p>
          </div>
        ))}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium text-[var(--color-text-secondary)]">Data ingestion</h2>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {ingestCards.map(([label, value]) => (
            <div key={label} className="rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-secondary)] p-4">
              <p className="text-xs text-[var(--color-text-muted)]">{label}</p>
              <p className="mt-1 font-mono text-lg font-semibold text-white">{value}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium text-[var(--color-text-secondary)]">Provider status</h2>
        <div className="overflow-hidden rounded-lg border border-[var(--color-border-subtle)]">
          <table className="w-full text-sm">
            <thead className="bg-[var(--color-bg-secondary)] text-left text-xs text-[var(--color-text-muted)]">
              <tr>
                <th className="px-4 py-2 font-medium">Provider</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Last OK</th>
                <th className="px-4 py-2 font-medium">Latency</th>
                <th className="px-4 py-2 font-medium">Last error</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border-subtle)]">
              {s.providers.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-3 text-center text-[var(--color-text-muted)]">
                    No provider checks recorded yet — start the ingestion worker or trigger a health check.
                  </td>
                </tr>
              )}
              {s.providers.map((p) => {
                const ok = p.lastOkAt !== null;
                return (
                  <tr key={p.name}>
                    <td className="px-4 py-2 font-mono text-xs">{p.name}</td>
                    <td className="px-4 py-2">
                      <span className={!p.enabled ? "text-[var(--color-text-muted)]" : ok ? "text-[var(--color-accent-green)]" : "text-[var(--color-red)]"}>{!p.enabled ? "not available on selected network" : ok ? "operational" : "unavailable"}</span>
                    </td>
                    <td className="px-4 py-2 text-xs text-[var(--color-text-muted)]">{p.lastOkAt ? new Date(p.lastOkAt).toISOString().replace("T", " ").slice(0, 19) : "never"}</td>
                    <td className="px-4 py-2 text-xs text-[var(--color-text-muted)]">{p.latencyMs !== null ? `${p.latencyMs} ms` : "—"}</td>
                    <td className={`max-w-[240px] truncate px-4 py-2 text-xs ${p.enabled ? "text-[var(--color-red)]" : "text-[var(--color-text-muted)]"}`}>{p.lastError ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid gap-8 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 text-sm font-medium text-[var(--color-text-secondary)]">Projects</h2>
          <div className="space-y-2">
            {data.projects?.length === 0 && (
              <div className="rounded-lg border border-dashed border-[var(--color-border-strong)] p-6 text-center text-sm text-[var(--color-text-muted)]">
                No projects yet. <Link href="/dashboard/projects" className="text-[var(--color-accent-green)]">Create your first project</Link>.
              </div>
            )}
            {data.projects?.map((p) => (
              <Link
                key={p.id}
                href={`/dashboard/projects/${p.id}`}
                className="flex items-center justify-between rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-secondary)] px-4 py-3 hover:border-[var(--color-border-strong)]"
              >
                <div>
                  <p className="text-sm font-medium text-white">{p.name}</p>
                  <p className="text-xs text-[var(--color-text-muted)]">{p.category} · {p.role} · {p.addressCount} addresses</p>
                </div>
                <span className="text-xs text-[var(--color-text-secondary)]">open →</span>
              </Link>
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-medium text-[var(--color-text-secondary)]">Recent alerts</h2>
          <div className="space-y-2">
            {data.recentAlerts?.length === 0 && (
              <div className="rounded-lg border border-dashed border-[var(--color-border-strong)] p-6 text-center text-sm text-[var(--color-text-muted)]">
                No open alerts.
              </div>
            )}
            {data.recentAlerts?.map((a) => (
              <div key={a.id} className="rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-secondary)] px-4 py-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-white">{a.title}</p>
                  <span className={`text-[10px] font-semibold uppercase ${a.severity === "critical" ? "text-[var(--color-red)]" : a.severity === "warning" ? "text-[var(--color-amber)]" : "text-[var(--color-text-muted)]"}`}>
                    {a.severity}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">{a.project.name} · {new Date(a.createdAt).toISOString().slice(0, 16).replace("T", " ")} UTC</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

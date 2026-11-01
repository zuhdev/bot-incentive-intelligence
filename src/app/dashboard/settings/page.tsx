import { checkAllProviders } from "@/lib/providers/health";
import env from "@/lib/env";
import { ACTIVE_CHAIN } from "@/lib/chains";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  let providers: Awaited<ReturnType<typeof checkAllProviders>> = [];
  let healthError: string | null = null;
  try {
    providers = await checkAllProviders();
  } catch (err) {
    healthError = err instanceof Error ? err.message : String(err);
  }

  const config = [
    ["Active network", `${env.BOT_NETWORK} · chain ${env.BOT_CHAIN_ID}`],
    ["Database mode", env.DATABASE_ENABLED ? "configured" : "read-only preview (no DATABASE_URL)"],
    ["Active RPC", ACTIVE_CHAIN.rpcUrl],
    ["Active explorer", ACTIVE_CHAIN.explorerUrl],
    ["Active explorer API", ACTIVE_CHAIN.explorerApi],
    ["BDEX mainnet API", env.BDEX_ENABLED ? env.BDEX_API_URL : "disabled in testnet mode"],
    ["DeFiLlama API", env.DEFILLAMA_API_URL],
    ["Default protocol slug", env.DEFAULT_BOT_PROTOCOL_SLUG],
    ["Log chunk size", String(env.INGEST_LOG_CHUNK)],
    ["Backfill max blocks", String(env.INGEST_BACKFILL_MAX_BLOCKS)],
    ["Queue", env.REDIS_URL ? "BullMQ (Redis)" : "in-process scheduler (set REDIS_URL for BullMQ)"],
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold">Settings</h1>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          Environment configuration and provider diagnostics. Secrets are server-side only and are
          never exposed to the frontend bundle.
        </p>
      </div>

      <section>
        <h2 className="mb-3 text-sm font-medium text-[var(--color-text-secondary)]">Configuration</h2>
        <div className="overflow-hidden rounded-lg border border-[var(--color-border-subtle)]">
          <table className="w-full text-sm">
            <tbody className="divide-y divide-[var(--color-border-subtle)]">
              {config.map(([k, v]) => (
                <tr key={k}>
                  <td className="px-4 py-2 text-xs text-[var(--color-text-muted)]">{k}</td>
                  <td className="px-4 py-2 font-mono text-xs">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium text-[var(--color-text-secondary)]">Provider health (live check)</h2>
        {healthError && <p className="text-xs text-[var(--color-red)]">Health check failed: {healthError}</p>}
        <div className="space-y-2">
          {providers.map((p) => (
            <div key={p.name} className="flex items-center justify-between rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-secondary)] px-4 py-3">
              <div>
                <p className="font-mono text-sm">{p.name}</p>
                <p className="text-xs text-[var(--color-text-muted)]">{p.detail ?? p.error ?? ""}</p>
              </div>
              <div className="text-right">
                <p className={`text-xs font-semibold ${!p.supported ? "text-[var(--color-text-muted)]" : p.ok ? "text-[var(--color-accent-green)]" : "text-[var(--color-red)]"}`}>{!p.supported ? "NOT AVAILABLE ON TESTNET" : p.ok ? "OK" : "FAIL"}</p>
                <p className="text-[11px] text-[var(--color-text-muted)]">{p.latencyMs} ms</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

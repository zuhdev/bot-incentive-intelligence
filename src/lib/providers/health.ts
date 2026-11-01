/**
 * Provider health registry — probes each configured provider and records
 * status in the data_providers table. Powers the "Data ingestion status"
 * widgets and prevents silent provider outages.
 */
import { prisma } from "@/lib/db";
import env from "@/lib/env";
import { getBlockNumber } from "./rpc";
import { getPairs } from "./bdex";
import { getChains } from "./defillama";

export type ProviderStatus = {
  name: string;
  kind: string;
  ok: boolean;
  supported: boolean;
  latencyMs: number | null;
  error?: string;
  detail?: string;
};

async function timed<T>(fn: () => Promise<T>): Promise<{ ok: boolean; ms: number; error?: string; value?: T }> {
  const started = Date.now();
  try {
    const value = await fn();
    return { ok: true, ms: Date.now() - started, value };
  } catch (err) {
    return { ok: false, ms: Date.now() - started, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function checkAllProviders(): Promise<ProviderStatus[]> {
  const statuses: ProviderStatus[] = [];

  // RPC
  const rpc = await timed(() => getBlockNumber());
  statuses.push({
    name: `rpc_${env.BOT_NETWORK}`,
    kind: "rpc",
    ok: rpc.ok,
    supported: true,
    latencyMs: rpc.ms,
    error: rpc.error,
    detail: rpc.ok ? `latest block ${rpc.value}` : undefined,
  });

  // BOTScan explorer
  const scan = await timed(async () => {
    const res = await fetch(`${env.BOTSCAN_API_URL.replace(/\/$/, "")}/v2/blocks?items=1`, {
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  });
  statuses.push({ name: `botscan_${env.BOT_NETWORK}`, kind: "explorer", ok: scan.ok, supported: true, latencyMs: scan.ms, error: scan.error });

  // BDEX
  if (env.BDEX_ENABLED) {
    const bdex = await timed(async () => {
      const r = await getPairs("all");
      if (!r.ok) throw new Error(r.error);
      return r.data.length;
    });
    statuses.push({
      name: "bdex_mainnet",
      kind: "dex",
      ok: bdex.ok,
      supported: true,
      latencyMs: bdex.ms,
      error: bdex.error,
      detail: bdex.ok ? `${bdex.value} pairs` : undefined,
    });
  } else {
    statuses.push({
      name: "bdex_mainnet",
      kind: "dex",
      ok: false,
      supported: false,
      latencyMs: null,
      error: "Disabled: verified BDEX public API data is BOT mainnet only.",
    });
  }

  // DeFiLlama
  if (env.DEFILLAMA_BOT_TVL_ENABLED) {
    const llama = await timed(async () => {
      const r = await getChains();
      if (!r.ok) throw new Error(r.error);
      const chain = r.data.find((c) => c.name === "BOT Chain");
      if (!chain) throw new Error("BOT Chain is not listed by DeFiLlama");
      return chain;
    });
    statuses.push({
      name: "defillama_mainnet",
      kind: "tvl",
      ok: llama.ok,
      supported: true,
      latencyMs: llama.ms,
      error: llama.error,
      detail: llama.ok && llama.value ? `BOT Chain TVL $${Math.round(llama.value.tvl)}` : undefined,
    });
  } else {
    statuses.push({
      name: "defillama_mainnet",
      kind: "tvl",
      ok: false,
      supported: false,
      latencyMs: null,
      error: "Disabled: DeFiLlama BOT Chain TVL is mainnet-only, not testnet activity.",
    });
  }

  // Persist
  for (const s of statuses) {
    await prisma.dataProvider.upsert({
      where: { name: s.name },
      create: {
        name: s.name,
        kind: s.kind,
        enabled: s.supported,
        lastCheckAt: new Date(),
        lastOkAt: s.ok ? new Date() : null,
        lastError: s.error ?? null,
        latencyMs: s.latencyMs,
      },
      update: {
        enabled: s.supported,
        lastCheckAt: new Date(),
        lastOkAt: s.ok ? new Date() : undefined,
        lastError: s.error ?? null,
        latencyMs: s.latencyMs,
      },
    });
  }

  return statuses;
}

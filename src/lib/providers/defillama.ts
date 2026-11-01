/**
 * DeFiLlama adapter.
 *
 * Verified live (docs/connectivity-report.md):
 * - /chains → includes "BOT Chain" with chainId 677.
 * - /protocols → BDEX V3 slug "bdex-v3" etc.
 * - /protocol/{slug} → chainTvls["BOT Chain"].tvl daily series.
 * Historical BOT Chain coverage for bdex-v3 begins 2026-08-24 — callers must
 * disclose coverage limits rather than treat earlier dates as zero.
 */
import env from "@/lib/env";
import { httpJson } from "./http";

export interface LlamaChain {
  name: string;
  chainId: number | null;
  tvl: number;
  tokenSymbol: string | null;
}

export interface LlamaProtocolSummary {
  name: string;
  slug: string;
  tvl: number;
  chains: string[];
}

export interface LlamaProtocolDetail {
  id: string;
  name: string;
  slug?: string;
  url?: string;
  description?: string;
  chain?: string;
  chains?: string[];
  currentChainTvlUtc?: number;
  tvlHistory?: { date: number; totalLiquidityUSD: number }[];
  chainTvls?: Record<string, { tvl: { date: number; totalLiquidityUSD: number }[] }>;
}

async function llamaGet<T>(path: string, timeoutMs = 45_000) {
  const base = env.DEFILLAMA_API_URL.replace(/\/$/, "");
  return httpJson<T>(`${base}${path}`, { timeoutMs, retries: 2 });
}

export async function getChains() {
  return llamaGet<LlamaChain[]>("/chains");
}

export async function getProtocols() {
  return llamaGet<LlamaProtocolSummary[]>("/protocols", 120_000);
}

export async function getProtocol(slug: string) {
  return llamaGet<LlamaProtocolDetail>(`/protocol/${slug}`, 90_000);
}

/** Extract the BOT Chain daily TVL series for a protocol slug. */
export async function getBotChainTvlSeries(slug: string): Promise<
  { ok: true; points: { date: Date; usd: number }[]; protocolName: string } | { ok: false; error: string }
> {
  if (!env.DEFILLAMA_BOT_TVL_ENABLED) {
    return { ok: false, error: "DeFiLlama BOT Chain TVL is mainnet data; historical BOT Chain TVL is disabled in testnet mode." };
  }
  const res = await getProtocol(slug);
  if (!res.ok) return { ok: false, error: res.error };
  const series = res.data.chainTvls?.["BOT Chain"]?.tvl;
  if (!series || series.length === 0) {
    return { ok: false, error: `protocol "${slug}" has no BOT Chain TVL series` };
  }
  return {
    ok: true,
    protocolName: res.data.name,
    points: series.map((p) => ({ date: new Date(p.date * 1000), usd: p.totalLiquidityUSD })),
  };
}

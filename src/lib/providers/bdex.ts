/**
 * BDEX public API adapter.
 *
 * Verified live (docs/connectivity-report.md):
 * - Base URL: https://dex-wallet.botchain.ai (from the official Apifox spec)
 * - No authentication.
 * - Envelope: { success: boolean, data: string } — `data` is a JSON string
 *   that must be parsed a second time.
 * - Business errors return HTTP 200 with success:false + error/code.
 * - Params: pool-charts & pool-liquidity-distribution take `pool=`;
 *   lp-positions takes `owner=` (V2 positions only — no V3 NFT coverage).
 */
import env from "@/lib/env";
import { httpJson } from "./http";

export interface BdexPair {
  chain_id: number;
  pair: string;
  poolType: string; // v2 | v3
  token0: string;
  token1: string;
}

export interface BdexPool {
  poolId: string;
  name: string;
  poolType: string;
  dex: string;
  baseTokenAddress: string;
  quoteTokenAddress: string;
  feeTier: string | null;
  volumeUsd24: string | null;
  baseTokenVolume24: string | null;
  quoteTokenVolume24: string | null;
  fees24Usd: string | null;
  transactionsH24: string | null;
  token0Amount: string | null;
  token1Amount: string | null;
  tvlUsd?: string | null;
  tvlChangePercent: string | null;
  volumeChangePercent: string | null;
  feeApr: string | null;
  fdvUsd: string | null;
  hasUserLiquidity: boolean;
}

export interface BdexChartPoint {
  periodStartUnix: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volumeUSD: number;
  feesUSD: number;
  tvlUSD: number;
}

export interface BdexLiquidityDistribution {
  pool: string;
  count: number;
  currentTick: number;
  currentPrice: number;
  token0Price: number;
  token1Price: number;
  ticks: {
    tickIndex: number;
    price0: number;
    price1: number;
    liquidityGross: string;
    liquidityNet: string;
    activeLiquidity: string;
    token0Locked: number;
    token1Locked: number;
    liquidityUSD: number;
    liquidityUSDTotal: number;
    tokenLockedSide: string;
  }[];
}

export interface BdexLpPosition {
  tokenId?: string;
  owner?: string;
  [k: string]: unknown;
}

type Envelope<T> = { success: boolean; data: T | string; error?: string; code?: string };

function unwrap<T>(env: Envelope<T>): { ok: true; data: T } | { ok: false; error: string } {
  if (!env.success) return { ok: false, error: `${env.error ?? "unknown"} (code ${env.code ?? "n/a"})` };
  if (typeof env.data === "string") {
    try {
      return { ok: true, data: JSON.parse(env.data) as T };
    } catch {
      return { ok: false, error: "envelope data is a non-JSON string" };
    }
  }
  return { ok: true, data: env.data };
}

async function bdexGet<T>(path: string, query: string, timeoutMs = 20_000) {
  if (!env.BDEX_ENABLED) {
    return { ok: false as const, error: "BDEX data is mainnet-only; it is disabled in BOT testnet mode." };
  }
  const base = env.BDEX_API_URL.replace(/\/$/, "");
  const res = await httpJson<Envelope<T>>(`${base}${path}${query ? `?${query}` : ""}`, {
    timeoutMs,
    retries: 2,
  });
  if (!res.ok) return { ok: false as const, error: res.error };
  return unwrap<T>(res.data);
}

export async function getPairs(poolType: "all" | "v2" | "v3" = "all") {
  return bdexGet<BdexPair[]>("/api/v1/pairs", `pool_type=${poolType}`);
}

export async function getPools(poolType: "all" | "v2" | "v3" = "all") {
  return bdexGet<BdexPool[]>("/api/v1/pools", `pool_type=${poolType}`);
}

export async function getPool(poolAddress: string) {
  return bdexGet<BdexPool>(`/api/v1/pools/${poolAddress.toLowerCase()}`, "");
}

export async function getPoolCharts(poolAddress: string) {
  return bdexGet<BdexChartPoint[]>(
    "/api/v1/pool-charts",
    `pool=${poolAddress.toLowerCase()}`,
  );
}

export async function getPoolLiquidityDistribution(poolAddress: string) {
  return bdexGet<BdexLiquidityDistribution>(
    "/api/v1/pool-liquidity-distribution",
    `pool=${poolAddress.toLowerCase()}`,
  );
}

/**
 * V2-only LP positions by owner. Per the official docs and live probing this
 * endpoint does NOT cover V3 NFT positions; do not use it for V3 LP tracking.
 */
export async function getV2LpPositions(owner: string) {
  return bdexGet<BdexLpPosition[]>("/api/v1/v2/lp-positions", `owner=${owner.toLowerCase()}`);
}

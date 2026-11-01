/**
 * Price resolution with documented provenance.
 *
 * Primary: DeFiLlama coins API (public, no key, broad coverage).
 * Fallback: BDEX pool-derived prices (on-chain observable, chain-native).
 * Optional: CoinGecko (documented; key optional, rate-limited without one).
 *
 * Every price is persisted with its source + URL + retrieval time so
 * evidence reports can show exact provenance (spec §9).
 */
import env from "@/lib/env";
import { prisma } from "@/lib/db";
import { httpJson } from "./http";

export interface PriceQuote {
  symbol: string;
  priceUsd: number;
  source: string;
  sourceUrl: string;
  takenAt: Date;
}

export async function getPriceFromDefiLlama(coins: string[]): Promise<Map<string, number>> {
  // coins: ["ethereum:0x...", "coingecko:tether", ...]
  const base = env.DEFILLAMA_API_URL.replace(/\/$/, "");
  const url = `${base}/coins/prices?coins=${coins.join(",")}`;
  const res = await httpJson<Record<string, number>>(url, { timeoutMs: 30_000, retries: 2 });
  const out = new Map<string, number>();
  if (res.ok) {
    for (const [k, v] of Object.entries(res.data)) {
      out.set(k, v);
    }
  }
  return out;
}

/**
 * Resolve USD price for a token by symbol with provenance.
 * Persisted in token_prices for evidence reporting.
 */
export async function resolveAndStorePrice(
  symbol: string,
  opts: { address?: string; chainId?: number; coingeckoId?: string; evmChainPrefix?: string } = {},
): Promise<PriceQuote | null> {
  const now = new Date();
  const coins: string[] = [];
  if (opts.evmChainPrefix && opts.address) coins.push(`${opts.evmChainPrefix}:${opts.address.toLowerCase()}`);
  if (opts.coingeckoId) coins.push(`coingecko:${opts.coingeckoId}`);

  if (coins.length > 0) {
    const prices = await getPriceFromDefiLlama(coins);
    for (const coin of coins) {
      const p = prices.get(coin);
      if (typeof p === "number" && p > 0) {
        const quote: PriceQuote = {
          symbol,
          priceUsd: p,
          source: "defillama",
          sourceUrl: `https://coins.llama.fi/prices/current/${coin}`,
          takenAt: now,
        };
        await persist(quote, opts);
        return quote;
      }
    }
  }
  return null;
}

async function persist(q: PriceQuote, opts: { address?: string; chainId?: number }) {
  try {
    await prisma.tokenPrice.create({
      data: {
        symbol: q.symbol,
        address: opts.address?.toLowerCase() ?? null,
        chainId: opts.chainId ?? null,
        priceUsd: q.priceUsd.toString(),
        source: q.source,
        sourceUrl: q.sourceUrl,
        takenAt: q.takenAt,
      },
    });
  } catch {
    // Persisting price history is best-effort; unique constraints on the same
    // timestamp are harmless.
  }
}

/** Store a price that was derived elsewhere (e.g. BDEX pool price). */
export async function storePrice(quote: PriceQuote, opts: { address?: string; chainId?: number } = {}) {
  await persist(quote, opts);
}

/**
 * BOT native price resolution:
 * 1. DeFiLlama coins API via coingecko id (currently absent — BOT is not
 *    listed on CoinGecko; verified 2026-11-01).
 * 2. Fallback: BDEX USDT/WBOT pool-derived price (live on-chain observable,
 *    from pool-liquidity-distribution token1Usd). WBOT tracks BOT 1:1 by
 *    design; the price is labelled as pool-derived with provenance.
 * If neither is available, returns null — callers must show UNAVAILABLE,
 * never zero.
 */
export async function getBotUsdPrice(): Promise<PriceQuote | null> {
  if (env.BOT_NETWORK === "testnet") return null;
  const llama = await resolveAndStorePrice("BOT", { coingeckoId: "bohr" });
  if (llama) return llama;

  const { getPoolLiquidityDistribution } = await import("./bdex");
  const { KNOWN_ADDRESSES } = await import("@/lib/chains");
  const dist = await getPoolLiquidityDistribution(KNOWN_ADDRESSES.usdtWbotPool);
  if (dist.ok && dist.data.currentPrice > 0) {
    // currentPrice = token1 (WBOT) price in token0 (USDT) units ≈ USD.
    const quote: PriceQuote = {
      symbol: "BOT",
      priceUsd: dist.data.currentPrice,
      source: "bdex_pool_derived",
      sourceUrl: `https://dex-wallet.botchain.ai/api/v1/pool-liquidity-distribution?pool=${KNOWN_ADDRESSES.usdtWbotPool}`,
      takenAt: new Date(),
    };
    await storePrice(quote);
    return quote;
  }
  return null;
}

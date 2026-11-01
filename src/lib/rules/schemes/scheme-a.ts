/**
 * Scheme A — DEX Incentive Support calculator. PURE function.
 *
 * Handles the attribution problem explicitly (spec §5): DEX routers and
 * aggregators can obscure trader identity. Every metric that depends on
 * trader attribution carries a confidence level; when attribution is not
 * reliable the metric is flagged PROVISIONAL.
 */
import { Decimal } from "@/lib/calcs/decimal";
import type { MetricResult, SchemeEvaluation, DataSourceRef, AttributionConfidence } from "../types";

export interface LiquidityDay {
  date: string; // YYYY-MM-DD
  tvlUsd: string; // USD decimal string
}

export interface VolumeDay {
  date: string; // YYYY-MM-DD
  volumeUsd: string;
  successfulTxCount: number;
  /** daily per-address volume shares, sorted desc: [{address, sharePct}] */
  addressShares: { address: string; sharePct: string }[];
  /** attribution confidence distribution for the day's swaps */
  attributionCounts: Record<AttributionConfidence, number>;
}

export interface SchemeAInput {
  periodStart: string;
  periodEnd: string;
  pairAddress: string;
  isBotPair: boolean; // pair contains native BOT / WBOT (20% enhancement, provisional)
  liquidity: LiquidityDay[];
  volume: VolumeDay[];
  sources: DataSourceRef[];
  rulesVersion: string;
  sourceUrl: string;
}

const TIER_THRESHOLDS = [
  { tier: 5, lpUsd: 10_000_000, volumeUsd: 20_000_000, txCount: 100_000, base: 20_000, max: 240_000 },
  { tier: 4, lpUsd: 5_000_000, volumeUsd: 8_000_000, txCount: 50_000, base: 15_000, max: 160_000 },
  { tier: 3, lpUsd: 1_000_000, volumeUsd: 2_000_000, txCount: 15_000, base: 8_000, max: 40_000 },
  { tier: 2, lpUsd: 200_000, volumeUsd: 500_000, txCount: 5_000, base: 5_000, max: 16_000 },
  { tier: 1, lpUsd: 50_000, volumeUsd: 125_000, txCount: 1_250, base: 1_250, max: 4_000 },
];

const SUSTAINED_DAYS = 7;
const VOLUME_DAYS = 15;
const MAX_SINGLE_ADDRESS_DAILY_SHARE = new Decimal(40);

export function evaluateSchemeA(input: SchemeAInput): SchemeEvaluation {
  const warnings: string[] = [];
  const unresolved: string[] = [
    "First-transaction-volume-from-pair-address within 24h restriction is unresolved — NOT applied as a definitive rule.",
    "20% BOT-pair enhancement is provisional pending verification of eligibility conditions.",
  ];

  const liquidityAvailable = input.liquidity.length > 0;
  const volumeAvailable = input.volume.length > 0;

  // Seven-consecutive-day liquidity requirement. A day "qualifies" when pool
  // TVL is at or above the tier-1 minimum LP value; withdrawals below the
  // minimum break the streak.
  const MIN_QUALIFYING_LP = new Decimal(TIER_THRESHOLDS[TIER_THRESHOLDS.length - 1].lpUsd);
  let liquidityStreak = 0;
  let longestLiquidityStreak = 0;
  let prev: string | null = null;
  let minLiquidityInStreak = new Decimal(0);
  for (const l of input.liquidity) {
    const consecutive = prev !== null && Date.parse(`${l.date}T00:00:00Z`) - Date.parse(`${prev}T00:00:00Z`) === 86_400_000;
    const qualifies = new Decimal(l.tvlUsd).gte(MIN_QUALIFYING_LP);
    liquidityStreak = qualifies ? (consecutive ? liquidityStreak + 1 : 1) : 0;
    if (qualifies && liquidityStreak === 1) minLiquidityInStreak = new Decimal(l.tvlUsd);
    else if (qualifies && liquidityStreak > 1) minLiquidityInStreak = Decimal.min(minLiquidityInStreak, new Decimal(l.tvlUsd));
    longestLiquidityStreak = Math.max(longestLiquidityStreak, liquidityStreak);
    prev = l.date;
  }
  const sustainedLiquidityDays = Math.min(longestLiquidityStreak, SUSTAINED_DAYS);

  // 15-day volume window (last 15 days of provided series)
  const volumeWindow = input.volume.slice(-VOLUME_DAYS);
  const totalVolume = volumeWindow.reduce((acc, v) => acc.plus(v.volumeUsd), new Decimal(0));
  const totalTx = volumeWindow.reduce((acc, v) => acc + v.successfulTxCount, 0);

  // Daily concentration: days where any single address exceeded 40% of volume
  const concentrationBreaches = volumeWindow.filter((v) =>
    v.addressShares.some((s) => new Decimal(s.sharePct).gt(MAX_SINGLE_ADDRESS_DAILY_SHARE)),
  );

  // Trader attribution reliability: "attributed" means the economic trader is
  // identifiable. Router/aggregator swaps obscure the end user and do NOT
  // count as reliably attributed.
  const attributionTotals: Record<AttributionConfidence, number> = { direct: 0, router: 0, smart_account: 0, unknown: 0 };
  for (const v of volumeWindow) {
    for (const [k, n] of Object.entries(v.attributionCounts)) {
      attributionTotals[k as AttributionConfidence] += n;
    }
  }
  const reliablyAttributed = attributionTotals.direct + attributionTotals.smart_account;
  const attributionCoveragePct = totalTx > 0 ? Math.round((reliablyAttributed / totalTx) * 100) : 0;

  // Tier matching
  const currentLp = liquidityAvailable ? new Decimal(input.liquidity.at(-1)!.tvlUsd) : null;
  const matchedTier = TIER_THRESHOLDS.find(
    (t) =>
      currentLp && currentLp.gte(t.lpUsd) && totalVolume.gte(t.volumeUsd) && totalTx >= t.txCount,
  );

  // Reward estimate: published mechanics are a base reward plus a 30%
  // revenue share on fee + gas revenue, subject to the tier maximum. Without
  // verified fee-revenue data the conservative estimate is the base reward;
  // the tier maximum is displayed alongside it.
  const estimatedBase = matchedTier ? matchedTier.base : null;
  // Upper bound = published tier maximum (enhancement for BOT pairs subject to
  // the enhanced cap is provisional).
  const estimatedMax = matchedTier ? new Decimal(matchedTier.max) : null;

  const metrics: MetricResult[] = [
    {
      key: "lp_value_current",
      label: "Current LP value",
      value: currentLp ? currentLp.toString() : null,
      display: currentLp ? `$${currentLp.toDecimalPlaces(2).toString()}` : "—",
      status: liquidityAvailable ? "verified" : "insufficient_data",
      sources: input.sources,
      methodology: "Latest daily pool TVL (BDEX API / on-chain reserves × priced).",
      unresolved: [],
    },
    {
      key: "liquidity_sustained_days",
      label: "Consecutive qualifying days (7 required)",
      value: sustainedLiquidityDays,
      display: `${sustainedLiquidityDays}/7`,
      target: SUSTAINED_DAYS,
      progressPct: (sustainedLiquidityDays / SUSTAINED_DAYS) * 100,
      status: !liquidityAvailable ? "insufficient_data" : longestLiquidityStreak >= SUSTAINED_DAYS ? "verified" : "at_risk",
      sources: input.sources,
      methodology: "Longest run of consecutive daily snapshots with pool TVL above the tier's minimum LP value.",
      unresolved: [],
      notes: liquidityAvailable && longestLiquidityStreak > 0 ? `Minimum LP value inside best streak: $${minLiquidityInStreak.toDecimalPlaces(2).toString()}` : undefined,
    },
    {
      key: "volume_15d",
      label: "Trading volume (15-day window)",
      value: totalVolume.toString(),
      display: volumeAvailable ? `$${totalVolume.toDecimalPlaces(2).toString()}` : "—",
      status: volumeAvailable ? "verified" : "insufficient_data",
      sources: input.sources,
      methodology: "Sum of daily USD swap volume over the trailing 15-day window (BDEX pool charts / on-chain swaps).",
      unresolved: [],
    },
    {
      key: "unique_successful_transactions",
      label: "Successful transactions (15-day window)",
      value: totalTx,
      display: `${totalTx}`,
      status: volumeAvailable ? "verified" : "insufficient_data",
      sources: input.sources,
      methodology: "Successful swaps counted once per transaction hash (deduplicated across logs).",
      unresolved: [],
    },
    {
      key: "volume_concentration",
      label: "Daily single-address concentration (max 40%)",
      value: concentrationBreaches.length,
      display: concentrationBreaches.length
        ? `${concentrationBreaches.length} breaching day(s)`
        : volumeAvailable
          ? "OK — no breaching days"
          : "—",
      status: !volumeAvailable ? "insufficient_data" : concentrationBreaches.length === 0 ? "verified" : "at_risk",
      sources: input.sources,
      methodology: "For each day, the largest single-address share of daily swap volume is compared with the 40% rule. Breaching days may be excluded from official evaluation (Foundation decision).",
      unresolved: [],
      notes: concentrationBreaches.length
        ? `Breaching days: ${concentrationBreaches.map((b) => b.date).join(", ")}`
        : undefined,
    },
    {
      key: "trader_attribution",
      label: "Trader attribution coverage",
      value: attributionCoveragePct,
      display: `${attributionCoveragePct}% of swaps attributed`,
      status: !volumeAvailable ? "insufficient_data" : attributionCoveragePct >= 80 ? "verified" : "provisional",
      sources: input.sources,
      methodology:
        "Swaps are classified: direct (EOA→pool), router (pool call originated from a known router — end user obscured), smart_account (ERC-4337/smart wallet sender), unknown. Router/aggregator swaps cannot be reliably attributed to end users; affected volume metrics are PROVISIONAL.",
      unresolved: ["Router-obscured volume cannot be attributed to end users without additional indexer support."],
      notes: `direct=${attributionTotals.direct} router=${attributionTotals.router} smart_account=${attributionTotals.smart_account} unknown=${attributionTotals.unknown}`,
    },
  ];

  const status: SchemeEvaluation["status"] = !liquidityAvailable && !volumeAvailable
    ? "insufficient_data"
    : matchedTier
      ? "provisional"
      : "at_risk";

  return {
    schemeCode: "SCHEME_A",
    schemeName: "DEX Incentive Support",
    rulesVersion: input.rulesVersion,
    sourceUrl: input.sourceUrl,
    status,
    overallProgressPct: currentLp ? Number(Decimal.min(100, currentLp.div(TIER_THRESHOLDS[4].lpUsd).times(100)).toFixed(1)) : null,
    metrics,
    tier: matchedTier
      ? { tier: matchedTier.tier, label: `Tier ${matchedTier.tier}`, rewardUsd: matchedTier.max, thresholds: { lpUsd: matchedTier.lpUsd, volumeUsd: matchedTier.volumeUsd, txCount: matchedTier.txCount } }
      : null,
    estimatedRewardUsd: estimatedBase,
    unresolved,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    calculatedAt: new Date().toISOString(),
    warnings,
  };
}

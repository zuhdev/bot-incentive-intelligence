/**
 * Scheme D — TVL Retention Support calculator. PURE function.
 *
 * Principles enforced (spec §5 Scheme D, §15):
 * - Total protocol TVL from DeFiLlama is NEVER treated as qualified TVL.
 * - Qualified TVL comes only from the asset-classification registry
 *   (official/verified classifications). Unverified assets are pending or
 *   excluded — never silently eligible.
 * - Snapshots are at 00:00 UTC precisely.
 * - Rates are support-rate calculations, NOT guaranteed returns.
 */
import { Decimal } from "@/lib/calcs/decimal";
import type { MetricResult, SchemeEvaluation, DataSourceRef } from "../types";

export type AssetCategory =
  | "stablecoin"
  | "bot"
  | "major"
  | "rwa"
  | "lsd_lrt"
  | "unapproved"
  | "pending_review";

/** Annualized support-rate seeds by classification (days 91–180 / 181–359 / 360+). */
export const SUPPORT_RATES: Record<string, { d91_180: number; d181_359: number; d360: number }> = {
  stable_rwa_bot: { d91_180: 1.4, d181_359: 1.7, d360: 2.0 },
  major: { d91_180: 1.1, d181_359: 1.4, d360: 1.7 },
  lsd_lrt: { d91_180: 0.75, d181_359: 1.05, d360: 1.35 },
};

export interface TvlBreakdown {
  stablecoin?: string; // USD strings
  bot?: string;
  major?: string;
  rwa?: string;
  lsd_lrt?: string;
  pending_review?: string;
  unapproved?: string;
}

export interface TvlSnapshotRow {
  date: string; // YYYY-MM-DD (00:00 UTC)
  qualifiedTvlUsd: string | null;
  pendingTvlUsd: string | null;
  excludedTvlUsd: string | null;
  breakdown: TvlBreakdown | null;
  protocolTvlUsd: string | null; // DeFiLlama protocol total (all chains) — reference only
  chainTvlUsd: string | null; // DeFiLlama BOT Chain attribution — reference only
  source: string;
}

export interface SchemeDInput {
  periodStart: string;
  periodEnd: string;
  /** Observation start date (day 1). Usually project registration date. */
  observationStart: string;
  mainnetDeployed: boolean;
  defiLlamaListed: boolean;
  defiLlamaSlug?: string | null;
  snapshots: TvlSnapshotRow[];
  sources: DataSourceRef[];
  rulesVersion: string;
  sourceUrl: string;
}

const MIN_QUALIFIED_USD = new Decimal(250_000);
const SUSTAINED_DAYS = 90;
const QUARTERLY_CAP_USD = new Decimal(1_000_000);

export function dayNumber(observationStart: string, date: string): number {
  const a = Date.parse(`${observationStart}T00:00:00Z`);
  const b = Date.parse(`${date}T00:00:00Z`);
  return Math.floor((b - a) / 86_400_000) + 1;
}

function rateBucket(day: number): keyof (typeof SUPPORT_RATES)["stable_rwa_bot"] {
  if (day <= 180) return "d91_180";
  if (day <= 359) return "d181_359";
  return "d360";
}

function classBucket(category: AssetCategory): keyof typeof SUPPORT_RATES | null {
  switch (category) {
    case "stablecoin":
    case "bot":
    case "rwa":
      return "stable_rwa_bot";
    case "major":
      return "major";
    case "lsd_lrt":
      return "lsd_lrt";
    default:
      return null; // unapproved / pending_review are never eligible
  }
}

/**
 * Indicative daily support amount for a snapshot: sum over qualifying asset
 * classes of (classTVL × annualizedRate / 365). Returns null when the asset
 * breakdown is missing (caller must report INSUFFICIENT DATA, not zero).
 */
export function dailySupportUsd(
  snapshot: TvlSnapshotRow,
  observationDay: number,
): Decimal | null {
  if (!snapshot.breakdown) return null;
  const bucket = rateBucket(observationDay);
  let total = new Decimal(0);
  let hasQualifiedData = false;
  for (const [category, usd] of Object.entries(snapshot.breakdown)) {
    const cat = category as AssetCategory;
    if (cat === "pending_review" || cat === "unapproved") continue;
    const rates = SUPPORT_RATES[classBucket(cat) ?? ""];
    if (!rates) continue;
    const value = new Decimal(usd ?? "0");
    if (value.gt(0)) hasQualifiedData = true;
    total = total.plus(value.times(rates[bucket]).div(100).div(365));
  }
  return hasQualifiedData ? total : null;
}

export interface SchemeDDetailed {
  evaluation: SchemeEvaluation;
  dailySupportSeries: { date: string; supportUsd: string | null; qualifiedTvlUsd: string | null }[];
  quarterly: { label: string; start: string; end: string; supportUsd: string | null }[];
}

export function evaluateSchemeD(input: SchemeDInput): SchemeDDetailed {
  const warnings: string[] = [];
  const unresolved: string[] = [
    "Complete approved-asset whitelist is not publicly available; classifications carry source and verification status and may change when the official list is published.",
    "Support rates are published support-rate calculations, NOT guaranteed returns or automatic investment yields.",
  ];

  if (!input.mainnetDeployed) warnings.push("Mainnet deployment on BOT Chain is required.");
  if (!input.defiLlamaListed)
    warnings.push("DeFiLlama listing with BOT Chain TVL attribution (or approved independent review) is required.");

  const sorted = [...input.snapshots].sort((a, b) => a.date.localeCompare(b.date));
  const withData = sorted.filter((s) => s.qualifiedTvlUsd !== null);

  // Threshold & retention tracking
  const above = withData.filter((s) => new Decimal(s.qualifiedTvlUsd!).gte(MIN_QUALIFIED_USD));
  // Longest consecutive streak of days ≥ threshold, plus the current streak
  // (run ending at the most recent snapshot — a breach resets it to 0).
  let streak = 0;
  let longestStreak = 0;
  let currentStreak = 0;
  let prev: string | null = null;
  for (const s of withData) {
    const isAbove = new Decimal(s.qualifiedTvlUsd!).gte(MIN_QUALIFIED_USD);
    const consecutive = prev !== null && Date.parse(`${s.date}T00:00:00Z`) - Date.parse(`${prev}T00:00:00Z`) === 86_400_000;
    streak = isAbove ? (consecutive ? streak + 1 : 1) : 0;
    longestStreak = Math.max(longestStreak, streak);
    prev = s.date;
  }
  currentStreak = streak;

  const latest = withData.at(-1) ?? null;
  const currentQualified = latest ? new Decimal(latest.qualifiedTvlUsd!) : null;
  const currentPending = latest?.pendingTvlUsd ? new Decimal(latest.pendingTvlUsd) : null;
  const currentExcluded = latest?.excludedTvlUsd ? new Decimal(latest.excludedTvlUsd) : null;
  const thresholdPct = currentQualified ? currentQualified.div(MIN_QUALIFIED_USD).times(100) : null;

  // 90-day retention: consecutive qualifying days starting from first eligible day
  const sustainedOk = longestStreak >= SUSTAINED_DAYS;

  // Observation progress
  const obsDays = dayNumber(input.observationStart, input.periodEnd);
  const observationProgressPct = Math.min(100, Math.max(0, (obsDays / 90) * 100));

  // Daily support series + quarterly aggregation
  const dailySupportSeries: SchemeDDetailed["dailySupportSeries"] = [];
  const quarterMap = new Map<string, { start: string; end: string; total: Decimal; anyNull: boolean }>();
  for (const s of sorted) {
    const d = dayNumber(input.observationStart, s.date);
    const support = d >= 91 ? dailySupportUsd(s, d) : null;
    dailySupportSeries.push({
      date: s.date,
      supportUsd: support ? support.toFixed(2) : null,
      qualifiedTvlUsd: s.qualifiedTvlUsd,
    });
    if (support && d >= 91) {
      const qStartMonth = Math.floor((new Date(`${s.date}T00:00:00Z`).getUTCMonth()) / 3) * 3;
      const qKey = `${new Date(`${s.date}T00:00:00Z`).getUTCFullYear()}-Q${qStartMonth / 3 + 1}`;
      const q = quarterMap.get(qKey) ?? {
        start: s.date,
        end: s.date,
        total: new Decimal(0),
        anyNull: false,
      };
      q.total = q.total.plus(support);
      q.end = s.date;
      quarterMap.set(qKey, q);
    }
  }

  const quarterly = [...quarterMap.entries()].map(([label, q]) => ({
    label,
    start: q.start,
    end: q.end,
    supportUsd: q.total.toDecimalPlaces(2).toString(),
  }));

  // Cap: cumulative across the whole history (bounded by $1M)
  const cumulativeSupport = quarterly.reduce((acc, q) => acc.plus(q.supportUsd ?? 0), new Decimal(0));
  const cappedSupport = Decimal.min(cumulativeSupport, QUARTERLY_CAP_USD);

  const hasSnapshots = withData.length > 0;
  const breakdownAvailable = latest?.breakdown !== null && latest?.breakdown !== undefined;

  const metrics: MetricResult[] = [
    {
      key: "qualified_tvl_usd",
      label: "Qualified TVL (latest 00:00 UTC snapshot)",
      value: currentQualified ? currentQualified.toString() : null,
      display: currentQualified ? `$${currentQualified.toDecimalPlaces(2).toString()}` : "—",
      target: MIN_QUALIFIED_USD.toString(),
      progressPct: thresholdPct ? Number(thresholdPct.toFixed(1)) : null,
      status: !hasSnapshots ? "insufficient_data" : currentQualified!.gte(MIN_QUALIFIED_USD) ? "verified" : "at_risk",
      sources: input.sources,
      methodology:
        "Qualified TVL is computed per the asset-classification registry (official/verified classifications only). DeFiLlama protocol totals are displayed for reference and are NOT counted as qualified.",
      unresolved: latest && !latest.breakdown ? ["Asset-level breakdown missing for the latest snapshot — qualified TVL cannot be decomposed by class."] : [],
    },
    {
      key: "pending_unverified_tvl",
      label: "Pending/unverified TVL (NOT counted)",
      value: currentPending ? currentPending.toString() : null,
      display: currentPending ? `$${currentPending.toDecimalPlaces(2).toString()}` : "—",
      status: hasSnapshots ? "verified" : "insufficient_data",
      sources: input.sources,
      methodology: "TVL attributable to assets without official/verified classification. Explicitly excluded from qualified TVL.",
      unresolved: [],
      notes: currentExcluded && currentExcluded.gt(0) ? `Excluded TVL: $${currentExcluded.toDecimalPlaces(2).toString()}` : undefined,
    },
    {
      key: "sustained_days",
      label: `Consecutive days ≥ $250,000 (target ${SUSTAINED_DAYS})`,
      value: longestStreak,
      display: `${longestStreak}`,
      target: SUSTAINED_DAYS,
      progressPct: Math.min(100, (longestStreak / SUSTAINED_DAYS) * 100),
      status: !hasSnapshots ? "insufficient_data" : sustainedOk ? "verified" : "at_risk",
      sources: input.sources,
      methodology: "Longest run of consecutive daily snapshots with qualified TVL ≥ $250,000.",
      unresolved: [],
      notes: `Current streak: ${currentStreak} day(s).`,
    },
    {
      key: "observation_progress",
      label: "90-day observation period progress",
      value: obsDays,
      display: `${Math.min(obsDays, 90)}/90 days`,
      progressPct: observationProgressPct,
      status: hasSnapshots ? "verified" : "insufficient_data",
      sources: input.sources,
      methodology: "Quarterly settlements begin only after the 90-day observation window.",
      unresolved: [],
    },
    {
      key: "indicative_daily_support",
      label: "Indicative daily support (latest)",
      value: dailySupportSeries.at(-1)?.supportUsd ?? null,
      display: dailySupportSeries.at(-1)?.supportUsd ? `$${dailySupportSeries.at(-1)!.supportUsd}` : "—",
      status: breakdownAvailable && sustainedOk ? "provisional" : "insufficient_data",
      sources: input.sources,
      methodology:
        "Σ(class TVL × annualized support rate / 365) using published rate seeds. ESTIMATE ONLY — not a guaranteed return.",
      unresolved: [
        "Rate application window (days 91–180 / 181–359 / 360+) depends on the official observation start date.",
        ...(latest && !latest.breakdown ? ["Asset breakdown missing — support cannot be computed and is NOT shown as zero."] : []),
      ],
    },
    {
      key: "cumulative_support_cap",
      label: "Cumulative support vs $1M cap",
      value: cappedSupport.toString(),
      display: `$${cumulativeSupport.toDecimalPlaces(2).toString()} / $1,000,000`,
      progressPct: Number(cumulativeSupport.div(QUARTERLY_CAP_USD).times(100).toFixed(2)),
      status: cumulativeSupport.gt(0) ? "provisional" : hasSnapshots ? "verified" : "insufficient_data",
      sources: input.sources,
      methodology: "Sum of indicative quarterly settlements; hard cap $1,000,000 per project.",
      unresolved: [],
    },
  ];

  const status: SchemeEvaluation["status"] = !hasSnapshots
    ? "insufficient_data"
    : !input.mainnetDeployed || !input.defiLlamaListed
      ? "manual_review"
      : sustainedOk && breakdownAvailable
        ? "provisional"
        : "at_risk";

  const evaluation: SchemeEvaluation = {
    schemeCode: "SCHEME_D",
    schemeName: "TVL Retention Support",
    rulesVersion: input.rulesVersion,
    sourceUrl: input.sourceUrl,
    status,
    overallProgressPct: thresholdPct ? Number(thresholdPct.toFixed(1)) : null,
    metrics,
    tier: null,
    estimatedRewardUsd: null,
    unresolved,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    calculatedAt: new Date().toISOString(),
    warnings,
  };

  return { evaluation, dailySupportSeries, quarterly };
}

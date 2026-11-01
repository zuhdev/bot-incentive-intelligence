/**
 * Gas Rebate tracking calculator. PURE function.
 *
 * Published scheme: rebates begin at $50,000 cumulative gas expenditure and
 * rise to 35% at $500,000. The exact curve/measurement period/wallet rules
 * are UNRESOLVED — we model linear interpolation between anchors and label
 * every output as an estimate, never a guaranteed reimbursement.
 */
import { Decimal } from "@/lib/calcs/decimal";
import type { MetricResult, SchemeEvaluation, DataSourceRef } from "../types";

export interface GasDay {
  date: string;
  gasUsed: string; // gas units
  botSpent: string; // BOT decimal
  usdSpent: string | null;
  botPriceUsd: string | null;
}

export interface GasRebateInput {
  periodStart: string;
  periodEnd: string;
  days: GasDay[];
  sources: DataSourceRef[];
  rulesVersion: string;
  sourceUrl: string;
}

const TIER_START_USD = new Decimal(50_000);
const TIER_MAX_USD = new Decimal(500_000);
const REBATE_START_PCT = new Decimal(10);
const REBATE_MAX_PCT = new Decimal(35);

export function rebatePctForSpend(cumulativeUsd: Decimal): Decimal {
  if (cumulativeUsd.lte(TIER_START_USD)) return new Decimal(0);
  if (cumulativeUsd.gte(TIER_MAX_USD)) return REBATE_MAX_PCT;
  const frac = cumulativeUsd.minus(TIER_START_USD).div(TIER_MAX_USD.minus(TIER_START_USD));
  return REBATE_START_PCT.plus(frac.times(REBATE_MAX_PCT.minus(REBATE_START_PCT)));
}

export function evaluateGasRebate(input: GasRebateInput): SchemeEvaluation {
  const warnings: string[] = [];
  const unresolved: string[] = [
    "Tier curve between $50k and $500k, measurement period, eligible-wallet rules and USD conversion methodology are unresolved; a linear model between published anchors is used.",
    "All projected amounts are ESTIMATES, not guaranteed reimbursements.",
  ];

  const hasData = input.days.length > 0;
  const pricedDays = input.days.filter((d) => d.usdSpent !== null);
  const cumulativeUsd = pricedDays.reduce((acc, d) => acc.plus(d.usdSpent!), new Decimal(0));
  const totalBot = input.days.reduce((acc, d) => acc.plus(d.botSpent), new Decimal(0));
  const totalGasUnits = input.days.reduce((acc, d) => acc.plus(d.gasUsed), new Decimal(0));

  const currentPct = rebatePctForSpend(cumulativeUsd);
  const projectedRebate = cumulativeUsd.times(currentPct).div(100);

  // Remaining spend to next 10%-step boundary (display helper)
  const nextPct = currentPct.plus(5).toDecimalPlaces(0);
  const nextTarget =
    nextPct.gte(REBATE_MAX_PCT) ? TIER_MAX_USD : TIER_START_USD.plus(nextPct.minus(REBATE_START_PCT).div(REBATE_MAX_PCT.minus(REBATE_START_PCT)).times(TIER_MAX_USD.minus(TIER_START_USD)));
  const remainingToNext = Decimal.max(0, nextTarget.minus(cumulativeUsd));

  const unpricedDays = input.days.length - pricedDays.length;
  if (unpricedDays > 0)
    warnings.push(
      `${unpricedDays} day(s) could not be valued in USD (missing BOT price) — they are EXCLUDED from cumulative spend, not counted as zero.`,
    );

  const metrics: MetricResult[] = [
    {
      key: "cumulative_gas_spend_usd",
      label: "Cumulative gas expenditure (USD)",
      value: cumulativeUsd.toString(),
      display: `$${cumulativeUsd.toDecimalPlaces(2).toString()}`,
      target: TIER_START_USD.toString(),
      progressPct: Number(Decimal.min(100, cumulativeUsd.div(TIER_MAX_USD).times(100)).toFixed(1)),
      status: pricedDays.length > 0 ? "verified" : "insufficient_data",
      sources: input.sources,
      methodology: "Σ daily (gas used × effective gas price) valued in BOT then USD at recorded price provenance.",
      unresolved: unpricedDays > 0 ? [`${unpricedDays} day(s) without USD valuation excluded from totals.`] : [],
    },
    {
      key: "bot_consumed",
      label: "BOT consumed",
      value: totalBot.toString(),
      display: `${totalBot.toDecimalPlaces(4).toString()} BOT`,
      status: hasData ? "verified" : "insufficient_data",
      sources: input.sources,
      methodology: "Σ daily BOT spent on gas across registered project addresses.",
      unresolved: [],
    },
    {
      key: "current_rebate_pct",
      label: "Indicative rebate rate",
      value: currentPct.toString(),
      display: `${currentPct.toDecimalPlaces(1).toString()}%`,
      status: pricedDays.length > 0 ? "provisional" : "insufficient_data",
      sources: input.sources,
      methodology: "Linear interpolation between published anchors (10% @ $50k → 35% @ $500k). Curve unresolved.",
      unresolved,
    },
    {
      key: "projected_rebate_usd",
      label: "Projected rebate (estimate)",
      value: projectedRebate.toString(),
      display: `$${projectedRebate.toDecimalPlaces(2).toString()}`,
      status: pricedDays.length > 0 ? "provisional" : "insufficient_data",
      sources: input.sources,
      methodology: "Cumulative USD spend × indicative rebate rate. ESTIMATE ONLY.",
      unresolved,
    },
    {
      key: "remaining_to_next_tier",
      label: "Remaining spend to next rebate step",
      value: remainingToNext.toString(),
      display: `$${remainingToNext.toDecimalPlaces(2).toString()}`,
      status: pricedDays.length > 0 ? "verified" : "insufficient_data",
      sources: input.sources,
      methodology: "Distance to the next +5% rebate boundary under the linear model.",
      unresolved: [],
    },
  ];

  return {
    schemeCode: "GAS_REBATE",
    schemeName: "Gas Rebate Tracking",
    rulesVersion: input.rulesVersion,
    sourceUrl: input.sourceUrl,
    status: pricedDays.length > 0 ? "provisional" : "insufficient_data",
    overallProgressPct: Number(Decimal.min(100, cumulativeUsd.div(TIER_MAX_USD).times(100)).toFixed(1)),
    metrics,
    tier: null,
    estimatedRewardUsd: pricedDays.length > 0 ? Number(projectedRebate.toDecimalPlaces(2).toString()) : null,
    unresolved,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    calculatedAt: new Date().toISOString(),
    warnings,
  };
}

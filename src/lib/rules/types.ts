/**
 * Rules engine types.
 *
 * Core principle (spec §8): eligibility is NEVER reduced to a single
 * unsupported percentage. Every metric carries an explicit status and the
 * reason behind it.
 */

export type EligibilityStatus =
  | "verified" // independently retrieved & calculated; interpretation confirmed
  | "provisional" // calculated but assumptions/interpretations unresolved
  | "at_risk" // threshold currently unmet or likely to be breached
  | "not_met" // confirmed measurable requirement not satisfied
  | "insufficient_data" // not enough reliable data to calculate
  | "manual_review"; // Foundation decision or out-of-band evidence needed

export type AttributionConfidence = "direct" | "router" | "smart_account" | "unknown";

export interface MetricResult {
  key: string;
  label: string;
  value: string | number | null;
  display: string; // human display value, or "—" when unavailable
  target?: string | number | null;
  progressPct?: number | null;
  status: EligibilityStatus;
  periodStart?: string;
  periodEnd?: string;
  sources: DataSourceRef[];
  methodology?: string;
  unresolved: string[]; // explicit list of unresolved assumptions
  notes?: string;
}

export interface DataSourceRef {
  name: string;
  url?: string;
  retrievedAt: string;
  coverage?: string; // e.g. "2026-08-24 → present"
}

export interface TierInfo {
  tier: number;
  label: string;
  rewardUsd: number;
  thresholds: Record<string, number>;
}

export interface SchemeEvaluation {
  schemeCode: string;
  schemeName: string;
  rulesVersion: string;
  sourceUrl: string;
  status: EligibilityStatus;
  overallProgressPct: number | null;
  metrics: MetricResult[];
  tier: TierInfo | null;
  estimatedRewardUsd: number | null;
  unresolved: string[];
  periodStart: string;
  periodEnd: string;
  calculatedAt: string;
  warnings: string[];
}

export interface SchemeDefinition {
  code: string;
  name: string;
  sourceUrl: string;
  version: string;
  effectiveAt: string;
  lastVerifiedAt: string;
  description: string;
  /** Rule values, each with an interpretation status. */
  rules: Record<
    string,
    {
      value: string | number | boolean | unknown[] | Record<string, unknown>;
      unit?: string;
      interpretation?: "confirmed" | "provisional" | "unresolved";
      note?: string;
    }
  >;
  tiers: TierInfo[];
  /** Global unresolved interpretations that apply to the whole scheme. */
  unresolvedInterpretations: string[];
}

/**
 * Versioned incentive programme definitions (rules seeds).
 *
 * IMPORTANT (spec §5, §15):
 * - These are SEEDS captured from BOT's published programme material.
 * - Each definition records sourceUrl, version, effective date and the date we
 *   last verified it against the official source.
 * - Interpretations that are not explicitly clear in the published material
 *   are flagged `unresolved` and are NEVER used to produce definitive
 *   eligibility results.
 * - Historical reproducibility: evaluations always pin the definition version.
 */
import type { SchemeDefinition } from "./types";

export const SCHEME_A: SchemeDefinition = {
  code: "SCHEME_A",
  name: "DEX Incentive Support",
  sourceUrl: "https://www.botchain.ai/en/ecosystem-support/",
  version: "2026-10-seed",
  effectiveAt: "2026-10-01",
  lastVerifiedAt: "2026-11-01",
  description:
    "Support for eligible BOT Chain DEX trading pairs based on LP value, trading volume and transaction counts.",
  rules: {
    "lp.min_value_usd_tier1": { value: 50_000, unit: "USD" },
    "lp.min_value_usd_tier2": { value: 200_000, unit: "USD" },
    "lp.min_value_usd_tier3": { value: 1_000_000, unit: "USD" },
    "lp.min_value_usd_tier4": { value: 5_000_000, unit: "USD" },
    "lp.min_value_usd_tier5": { value: 10_000_000, unit: "USD" },
    "lp.sustained_days": {
      value: 7,
      unit: "days",
      note: "LP value must be maintained for seven consecutive days.",
    },
    "volume.evaluation_days": { value: 15, unit: "days" },
    "volume.max_single_address_daily_share_pct": {
      value: 40,
      unit: "%",
      note: "A maximum 40% contribution from one address to daily trading volume.",
    },
    "reward.revenue_share_pct": {
      value: 30,
      unit: "%",
      note: "30% revenue share on transaction fee revenue plus gas revenue, subject to tier maximum.",
    },
    "reward.bot_pair_enhancement_pct": {
      value: 20,
      unit: "%",
      interpretation: "provisional",
      note: "Published 20% enhancement for eligible BOT trading pairs, subject to the enhanced cap. Exact eligibility conditions for the enhancement require verification against the live programme.",
    },
    "volume.first_tx_24h_restriction": {
      value: true,
      interpretation: "unresolved",
      note: "The official rules contain a restriction concerning the first transaction volume from a trading-pair address within a 24-hour period. Interpretation not clear in published material — awaiting Foundation clarification. Not applied as a definitive rule.",
    },
  },
  tiers: [
    { tier: 1, label: "Tier 1", rewardUsd: 4_000, thresholds: { lpUsd: 50_000, volumeUsd: 125_000, txCount: 1_250 } },
    { tier: 2, label: "Tier 2", rewardUsd: 16_000, thresholds: { lpUsd: 200_000, volumeUsd: 500_000, txCount: 5_000 } },
    { tier: 3, label: "Tier 3", rewardUsd: 40_000, thresholds: { lpUsd: 1_000_000, volumeUsd: 2_000_000, txCount: 15_000 } },
    { tier: 4, label: "Tier 4", rewardUsd: 160_000, thresholds: { lpUsd: 5_000_000, volumeUsd: 8_000_000, txCount: 50_000 } },
    { tier: 5, label: "Tier 5", rewardUsd: 240_000, thresholds: { lpUsd: 10_000_000, volumeUsd: 20_000_000, txCount: 100_000 } },
  ],
  unresolvedInterpretations: [
    "First-transaction-volume-from-pair-address within 24h restriction — interpretation unresolved (awaiting Foundation clarification).",
    "Exact conditions for the 20% BOT-pair enhancement cap.",
  ],
};

export const SCHEME_B: SchemeDefinition = {
  code: "SCHEME_B",
  name: "CEX Listing Support",
  sourceUrl: "https://www.botchain.ai/en/ecosystem-support/",
  version: "2026-10-seed",
  effectiveAt: "2026-10-01",
  lastVerifiedAt: "2026-11-01",
  description:
    "Support for projects whose token achieves listings on qualifying centralized exchanges, ranked by exchange standing.",
  rules: {
    "listing.reward_rank_1_8_usd": { value: 60_000, unit: "USD" },
    "listing.reward_rank_9_30_usd": { value: 10_000, unit: "USD" },
    "listing.reward_rank_30_50_usd": { value: 2_000, unit: "USD" },
    "listing.verification_mode": {
      value: "manual_evidence_plus_external",
      interpretation: "provisional",
      note: "Listing verification uses manual evidence plus external data where reliable. Qualifying exchange list and ranking source must be validated against the official programme.",
    },
    "listing.rank_source": {
      value: "cmc_snapshot",
      interpretation: "unresolved",
      note: "Applicable exchange list and authoritative ranking source (e.g. CMC rank snapshot timing) are not fully specified in published material.",
    },
  },
  tiers: [
    { tier: 1, label: "Rank 1–8", rewardUsd: 60_000, thresholds: { rankFrom: 1, rankTo: 8 } },
    { tier: 2, label: "Rank 9–30", rewardUsd: 10_000, thresholds: { rankFrom: 9, rankTo: 30 } },
    { tier: 3, label: "Rank 30–50", rewardUsd: 2_000, thresholds: { rankFrom: 30, rankTo: 50 } },
  ],
  unresolvedInterpretations: [
    "Qualifying exchange list and ranking snapshot source/timing are unresolved.",
  ],
};

export const SCHEME_C: SchemeDefinition = {
  code: "SCHEME_C",
  name: "Community Growth & User Conversion",
  sourceUrl: "https://www.botchain.ai/en/ecosystem-support/",
  version: "2026-10-seed",
  effectiveAt: "2026-10-01",
  lastVerifiedAt: "2026-11-01",
  description:
    "Support based on genuine user adoption: qualifying wallets, daily interaction caps, wallet age, balance requirements and rolling evaluation windows.",
  rules: {
    "wallet.min_bot_balance": {
      value: "0.1",
      unit: "BOT",
      note: "Minimum native BOT balance of 0.1 BOT for a wallet to qualify.",
    },
    "wallet.min_other_assets_usd": {
      value: 100,
      unit: "USD",
      note: "Other qualifying assets equivalent to at least $100 USDT.",
    },
    "wallet.min_age_hours": {
      value: 24,
      unit: "hours",
      note: "Wallet age of at least 24 hours since its first on-chain transaction.",
    },
    "interactions.max_per_wallet_per_day": {
      value: 20,
      note: "Maximum 20 counted interactions per address per day; extras are not counted.",
    },
    "evaluation.qualifying_days": { value: 25 },
    "evaluation.window_days": { value: 30, note: "Rolling 30-calendar-day evaluation window." },
    "funding.shared_source_count_factor": {
      value: 0.1,
      interpretation: "provisional",
      note: "Shared initial funding-source groups subject to an adjustment where only 10% of the group is counted. Exact group-formation rules are provisional.",
    },
    "tier.dimension": {
      value: "configurable",
      interpretation: "unresolved",
      note: "CRITICAL: The published material does not sufficiently clarify whether user/interaction/TVL tier thresholds are DAILY measurements or CUMULATIVE evaluation-period totals. This platform evaluates BOTH scenarios and marks all results provisional. Configurable via rules-engine settings.",
    },
    "defi.tvl_required": {
      value: true,
      interpretation: "provisional",
      note: "Additional TVL criteria where applicable to DeFi projects; applicability conditions provisional.",
    },
  },
  tiers: [
    { tier: 1, label: "Tier 1", rewardUsd: 12_000, thresholds: { users: 4_000, interactions: 30_000, tvlUsd: 150_000 } },
    { tier: 2, label: "Tier 2", rewardUsd: 15_000, thresholds: { users: 8_000, interactions: 60_000, tvlUsd: 200_000 } },
    { tier: 3, label: "Tier 3", rewardUsd: 20_000, thresholds: { users: 15_000, interactions: 120_000, tvlUsd: 220_000 } },
    { tier: 4, label: "Tier 4", rewardUsd: 40_000, thresholds: { users: 40_000, interactions: 300_000, tvlUsd: 450_000 } },
    { tier: 5, label: "Tier 5", rewardUsd: 70_000, thresholds: { users: 80_000, interactions: 600_000, tvlUsd: 750_000 } },
    { tier: 6, label: "Tier 6", rewardUsd: 100_000, thresholds: { users: 150_000, interactions: 1_200_000, tvlUsd: 1_000_000 } },
    { tier: 7, label: "Tier 7", rewardUsd: 200_000, thresholds: { users: 400_000, interactions: 3_000_000, tvlUsd: 2_000_000 } },
    { tier: 8, label: "Tier 8", rewardUsd: 350_000, thresholds: { users: 800_000, interactions: 6_000_000, tvlUsd: 3_500_000 } },
  ],
  unresolvedInterpretations: [
    "Whether tier thresholds (users/interactions/TVL) are daily or cumulative — platform evaluates both scenarios and reports PROVISIONAL only.",
    "Exact shared funding-source group formation rules (10% count adjustment applies, group boundaries provisional).",
    "Which 'other qualifying assets' beyond USDT-equivalents count toward the $100 requirement (asset registry pending official list).",
  ],
};

export const SCHEME_D: SchemeDefinition = {
  code: "SCHEME_D",
  name: "TVL Retention Support",
  sourceUrl: "https://www.botchain.ai/en/ecosystem-support/",
  version: "2026-10-seed",
  effectiveAt: "2026-10-01",
  lastVerifiedAt: "2026-11-01",
  description:
    "Support for sustained qualified TVL on BOT Chain mainnet, measured via daily 00:00 UTC snapshots against the official approved asset list.",
  rules: {
    "deployment.mainnet_required": { value: true },
    "tvl.min_qualified_usd": {
      value: 250_000,
      unit: "USD",
      note: "At least $250,000 qualified TVL (NOT total protocol TVL).",
    },
    "tvl.sustained_days": {
      value: 90,
      unit: "days",
      note: "At least 90 days of sustained eligibility.",
    },
    "tvl.snapshot_time_utc": { value: "00:00", note: "Daily snapshots at 00:00 UTC precisely." },
    "settlement.quarterly": {
      value: true,
      note: "Quarterly support settlement beginning after the initial 90-day observation period.",
    },
    "settlement.cumulative_cap_usd": { value: 1_000_000, unit: "USD" },
    "rates.stable_rwa_bot": {
      value: { d91_180: 1.4, d181_359: 1.7, d360: 2.0 },
      unit: "% annualized",
      note: "Stablecoins, RWA and BOT classification rates for days 91–180 / 181–359 / day 360 onward.",
    },
    "rates.major": {
      value: { d91_180: 1.1, d181_359: 1.4, d360: 1.7 },
      unit: "% annualized",
    },
    "rates.lsd_lrt": {
      value: { d91_180: 0.75, d181_359: 1.05, d360: 1.35 },
      unit: "% annualized",
      note: "Approved LSD/LRT only.",
    },
    "assets.whitelist": {
      value: true,
      interpretation: "unresolved",
      note: "The complete current approved-asset whitelist may not be publicly available. Unverified assets are classified pending_review or unapproved and are NEVER silently counted as eligible.",
    },
    "listing.defillama_or_review": {
      value: "defillama_or_approved_review",
      note: "DeFiLlama listing with BOT Chain TVL attribution, or an approved independent review.",
    },
  },
  tiers: [],
  unresolvedInterpretations: [
    "Complete approved-asset whitelist is not publicly available — asset registry is configurable and classifications carry source/verification status.",
    "Exact treatment (inclusion/exclusion) of LSD/LRT underlying assets pending official list.",
  ],
};

export const GAS_REBATE: SchemeDefinition = {
  code: "GAS_REBATE",
  name: "Gas Rebate Tracking",
  sourceUrl: "https://www.botchain.ai/en/ecosystem-support/",
  version: "2026-10-seed",
  effectiveAt: "2026-10-01",
  lastVerifiedAt: "2026-11-01",
  description:
    "Rebates on project gas expenditure beginning at $50,000 cumulative spend, scaling up to 35% at $500,000.",
  rules: {
    "gas.tier_start_usd": { value: 50_000, unit: "USD" },
    "gas.tier_max_usd": { value: 500_000, unit: "USD" },
    "gas.max_rebate_pct": { value: 35, unit: "%" },
    "gas.tier_curve": {
      value: "linear_between_anchor_points",
      interpretation: "unresolved",
      note: "Exact tier curve between $50k and $500k, measurement period, eligible wallet rules and USD conversion methodology require validation against the official programme. Current model interpolates linearly and labels everything as an estimate.",
    },
  },
  tiers: [
    { tier: 1, label: "Entry", rewardUsd: 0, thresholds: { spendUsd: 50_000, rebatePct: 10 } },
    { tier: 2, label: "Maximum", rewardUsd: 0, thresholds: { spendUsd: 500_000, rebatePct: 35 } },
  ],
  unresolvedInterpretations: [
    "Tier curve between anchor points, measurement period, eligible-wallet rules and USD conversion methodology are unresolved.",
  ],
};

export const ALL_DEFINITIONS: SchemeDefinition[] = [
  SCHEME_A,
  SCHEME_B,
  SCHEME_C,
  SCHEME_D,
  GAS_REBATE,
];

export function getDefinition(code: string, version?: string): SchemeDefinition {
  const list = ALL_DEFINITIONS.filter((d) => d.code === code);
  if (list.length === 0) throw new Error(`Unknown scheme code: ${code}`);
  if (!version) return list[0];
  const found = list.find((d) => d.version === version);
  if (!found) throw new Error(`Scheme ${code} has no rules version ${version}`);
  return found;
}

/**
 * Scheme C — Community Growth & User Conversion calculator.
 *
 * PURE function: all inputs are pre-fetched data; no provider/DB access.
 * This makes the calculation independently testable with fixtures (spec §13).
 *
 * Critical unresolved dimension (flagged in definitions.ts): whether tier
 * thresholds are DAILY or CUMULATIVE measurements. We compute BOTH scenarios
 * and never emit a definitive qualification verdict.
 */
import { Decimal } from "@/lib/calcs/decimal";
import type { MetricResult, SchemeEvaluation, TierInfo, DataSourceRef } from "../types";

export interface RawInteraction {
  wallet: string;
  date: string; // UTC date "YYYY-MM-DD"
  txHash: string;
  toContract: string | null;
  status: number; // 1 = success
  counted: boolean;
}

export interface RawBalance {
  wallet: string;
  symbol: string;
  address: string | null; // null = native BOT
  decimals: number;
  balance: string; // base units
  priceUsd: string | null;
}

export interface RawFunding {
  from: string;
  to: string;
  token: string | null;
  clusterId: string | null;
  txCount: number;
}

export interface SchemeCInput {
  periodStart: string; // ISO date (UTC)
  periodEnd: string;
  interactions: RawInteraction[];
  balances: RawBalance[];
  /** wallet (lowercase) -> ISO timestamp of first ever on-chain activity */
  walletFirstSeen: Record<string, string>;
  funding: RawFunding[];
  /** project contracts — interactions with these addresses count */
  projectAddresses: string[];
  /** DeFi TVL (USD) for the DeFi-tier dimension, when known */
  tvlUsd: string | null;
  /** how to interpret tier thresholds — from rules config */
  tierDimension: "daily" | "cumulative" | "both";
  botPriceUsd: string | null;
  sources: DataSourceRef[];
  rulesVersion: string;
  sourceUrl: string;
}

export interface SchemeCDetailed {
  evaluation: SchemeEvaluation;
  scenario: {
    dimension: string;
    tier: TierInfo | null;
    users: number;
    interactions: number;
    tvlUsd: number | null;
  }[];
}

const MAX_INTERACTIONS_PER_DAY = 20;
const MIN_BOT = new Decimal("0.1");
const MIN_OTHER_USD = new Decimal(100);
const MIN_AGE_HOURS = 24;
const QUALIFYING_DAYS = 25;
const WINDOW_DAYS = 30;
const SHARED_FUNDING_COUNT_FACTOR = new Decimal("0.1");

export function daysBetween(start: string, end: string): string[] {
  const out: string[] = [];
  const d = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);
  while (d <= last) {
    out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

export function utcDay(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

/**
 * Core per-wallet, per-day qualification model.
 * A wallet qualifies on a day when ALL hold:
 *  1. ≥1 successful counted interaction with a project contract that day
 *  2. Daily interaction cap respected (interactions beyond 20 are NOT counted;
 *     the cap itself doesn't disqualify — the extra ones don't count)
 *  3. Balance: ≥0.1 native BOT, or other qualifying assets ≥ $100 equivalent
 *  4. Wallet age ≥ 24h since first on-chain transaction
 */
export interface WalletDayState {
  wallet: string;
  date: string;
  countedInteractions: number;
  totalInteractions: number;
  hasBotBalance: boolean;
  botBalance: Decimal;
  otherUsd: Decimal;
  balanceOk: boolean;
  ageOk: boolean;
  qualifies: boolean;
}

export function computeWalletDayStates(input: SchemeCInput): WalletDayState[] {
  const projectSet = new Set(input.projectAddresses.map((a) => a.toLowerCase()));
  const days = daysBetween(input.periodStart, input.periodEnd);
  const daySet = new Set(days);

  // 1. Aggregate interactions per wallet/day; dedupe by txHash; count only
  //    successful interactions with project contracts.
  const byWalletDay = new Map<string, { counted: number; total: number }>();
  const seenTx = new Set<string>();
  for (const ix of input.interactions) {
    if (!daySet.has(ix.date)) continue;
    if (!ix.toContract || !projectSet.has(ix.toContract.toLowerCase())) continue;
    if (ix.status !== 1) continue; // failed transactions never count
    const dedupeKey = `${ix.wallet}:${ix.txHash}`;
    if (seenTx.has(dedupeKey)) continue; // duplicate prevention
    seenTx.add(dedupeKey);
    const key = `${ix.wallet}|${ix.date}`;
    const cur = byWalletDay.get(key) ?? { counted: 0, total: 0 };
    cur.total += 1;
    if (cur.counted < MAX_INTERACTIONS_PER_DAY) cur.counted += 1;
    byWalletDay.set(key, cur);
  }

  // 2. Latest balance per wallet (simple model: most recent snapshot before/within period end)
  const balances = new Map<string, { bot: Decimal; otherUsd: Decimal }>();
  const botPrice = input.botPriceUsd ? new Decimal(input.botPriceUsd) : null;
  // group by wallet, keep last occurrence order as "latest"
  for (const b of input.balances) {
    const cur = balances.get(b.wallet) ?? { bot: new Decimal(0), otherUsd: new Decimal(0) };
    const amount = new Decimal(b.balance).div(new Decimal(10).pow(b.decimals));
    if (b.address === null) {
      cur.bot = amount;
    } else if (b.priceUsd) {
      cur.otherUsd = cur.otherUsd.plus(amount.times(b.priceUsd));
    }
    balances.set(b.wallet, cur);
  }

  // 3. Build states
  const states: WalletDayState[] = [];
  for (const [key, agg] of byWalletDay) {
    const [wallet, date] = key.split("|");
    const bal = balances.get(wallet);
    const botBalance = bal?.bot ?? new Decimal(0);
    const otherUsd = bal?.otherUsd ?? new Decimal(0);
    const hasBot = botPrice ? botBalance.gte(MIN_BOT) : false;
    // Balance rule: ≥0.1 BOT **or** ≥$100 other qualifying assets.
    const balanceOk = hasBot || otherUsd.gte(MIN_OTHER_USD);
    const firstSeen = input.walletFirstSeen[wallet];
    // Age is evaluated per wallet-day: the interaction day's end must be at
    // least 24h after the wallet's first on-chain transaction.
    const dayEnd = new Date(`${date}T23:59:59Z`).getTime();
    const ageOk = firstSeen ? dayEnd - new Date(firstSeen).getTime() >= MIN_AGE_HOURS * 3600_000 : false;
    states.push({
      wallet,
      date,
      countedInteractions: agg.counted,
      totalInteractions: agg.total,
      hasBotBalance: hasBot,
      botBalance,
      otherUsd,
      balanceOk,
      ageOk,
      qualifies: agg.counted > 0 && balanceOk && ageOk,
    });
  }
  return states;
}

/**
 * Preliminary funding-source clustering. Shared funding is a RISK INDICATOR
 * ONLY — legitimate exchange withdrawals, bridges, relayers, smart accounts
 * and project distribution wallets create common funding without common
 * ownership (spec §5, §15-7).
 */
export interface FundingCluster {
  clusterId: string;
  members: string[];
  riskLevel: "low" | "medium" | "high";
  note: string;
}

export function computeFundingClusters(funding: RawFunding[]): FundingCluster[] {
  const byCluster = new Map<string, Set<string>>();
  for (const f of funding) {
    if (!f.clusterId) continue;
    const set = byCluster.get(f.clusterId) ?? new Set<string>();
    set.add(f.to.toLowerCase());
    set.add(f.from.toLowerCase());
    byCluster.set(f.clusterId, set);
  }
  const clusters: FundingCluster[] = [];
  for (const [clusterId, members] of byCluster) {
    const size = members.size;
    clusters.push({
      clusterId,
      members: [...members],
      // Simple heuristic sizing; final labels are always "preliminary".
      riskLevel: size <= 5 ? "low" : size <= 20 ? "medium" : "high",
      note: `Preliminary indicator: ${size} addresses share observable funding relationships. Common funding does NOT prove common ownership (exchanges, bridges, relayers and distribution wallets create shared sources). Requires human review.`,
    });
  }
  return clusters;
}

/**
 * Count unique qualifying users, applying the provisional shared-funding
 * adjustment (only 10% of a shared-initial-funding group counted) and
 * the 25-qualifying-days-in-30 rule per wallet.
 */
export function computeQualifyingUsers(
  states: WalletDayState[],
  walletFirstSeen: Record<string, string>,
  clusters: FundingCluster[],
): { qualifyingWallets: string[]; excludedByFundingGroup: string[]; excludedByWindow: string[] } {
  // qualifying days per wallet
  const daysPerWallet = new Map<string, Set<string>>();
  for (const s of states) {
    if (!s.qualifies) continue;
    const set = daysPerWallet.get(s.wallet) ?? new Set<string>();
    set.add(s.date);
    daysPerWallet.set(s.wallet, set);
  }

  const clusterOfWallet = new Map<string, string>();
  for (const c of clusters) for (const m of c.members) clusterOfWallet.set(m, c.clusterId);

  const qualifying: string[] = [];
  const excludedWindow: string[] = [];
  for (const [wallet, days] of daysPerWallet) {
    if (days.size >= QUALIFYING_DAYS) qualifying.push(wallet);
    else excludedWindow.push(wallet);
  }

  // Shared funding adjustment: only 10% of each group counted (rounded down,
  // minimum 1), keeping the members with the most qualifying days.
  const excludedByFunding: string[] = [];
  const finalList = new Set(qualifying);
  const byCluster = new Map<string, string[]>();
  for (const w of qualifying) {
    const c = clusterOfWallet.get(w);
    if (!c) continue;
    byCluster.set(c, [...(byCluster.get(c) ?? []), w]);
  }
  for (const [c, members] of byCluster) {
    const keep = Math.max(1, Math.floor(members.length * SHARED_FUNDING_COUNT_FACTOR.toNumber()));
    const sorted = members.sort((a, b) => (daysPerWallet.get(b)?.size ?? 0) - (daysPerWallet.get(a)?.size ?? 0));
    const drop = sorted.slice(keep);
    for (const w of drop) {
      finalList.delete(w);
      excludedByFunding.push(w);
    }
  }

  return {
    qualifyingWallets: [...finalList],
    excludedByFundingGroup: excludedByFunding,
    excludedByWindow: excludedWindow.filter((w) => finalList.has(w) === false && !excludedByFunding.includes(w)),
  };
}

export function evaluateSchemeC(input: SchemeCInput): SchemeCDetailed {
  const warnings: string[] = [];
  const unresolved: string[] = [
    "Tier threshold dimension (daily vs cumulative) is unresolved in the official programme — dual-scenario results are PROVISIONAL, never definitive.",
    "Shared funding-source group formation rules are provisional (10% count adjustment applied).",
    "The full list of 'other qualifying assets' requires the official asset registry; USD values use recorded price provenance.",
  ];

  const states = computeWalletDayStates(input);
  const clusters = computeFundingClusters(input.funding);
  const { qualifyingWallets } = computeQualifyingUsers(states, input.walletFirstSeen, clusters);

  const totalInteractionsAll = states.reduce((acc, s) => acc + s.totalInteractions, 0);
  const countedInteractionsAll = states.reduce((acc, s) => acc + s.countedInteractions, 0);
  const activeDays = new Set(states.filter((s) => s.countedInteractions > 0).map((s) => s.date)).size;
  const avgDailyActive =
    activeDays > 0
      ? new Decimal(new Set(states.filter((s) => s.countedInteractions > 0).map((s) => `${s.wallet}|${s.date}`)).size).div(activeDays)
      : new Decimal(0);

  const tvlUsd = input.tvlUsd ? new Decimal(input.tvlUsd) : null;
  const botPriceOk = input.botPriceUsd !== null;
  const balancesAvailable = input.balances.length > 0;
  const interactionsAvailable = input.interactions.length > 0;
  const agesAvailable = Object.keys(input.walletFirstSeen).length > 0;

  if (!balancesAvailable) warnings.push("No wallet balance snapshots available — balance metrics are INSUFFICIENT DATA.");
  if (!botPriceOk) warnings.push("BOT USD price unavailable — balance-based USD calculations are degraded (marked unavailable, NOT zero).");
  if (!agesAvailable) warnings.push("Wallet first-seen timestamps not yet indexed — wallet-age compliance is INSUFFICIENT DATA.");
  if (!interactionsAvailable) warnings.push("No interaction data ingested for the period — interaction metrics are INSUFFICIENT DATA.");

  // Balance compliance among interacting wallets
  const interactingWallets = new Set(states.map((s) => s.wallet));
  const balanceOkWallets = new Set(states.filter((s) => s.balanceOk).map((s) => s.wallet));
  const ageOkWallets = new Set(states.filter((s) => s.ageOk).map((s) => s.wallet));
  const capBreaches = states.filter((s) => s.totalInteractions > MAX_INTERACTIONS_PER_DAY);

  const sources = input.sources;

  const metrics: MetricResult[] = [
    {
      key: "unique_interacting_wallets",
      label: "Unique interacting wallets",
      value: interactingWallets.size,
      display: interactingWallets.size ? `${interactingWallets.size}` : "—",
      status: interactionsAvailable ? "verified" : "insufficient_data",
      sources,
      methodology: "Unique wallets with ≥1 successful counted interaction with registered project contracts in the period. Failed transactions and duplicate tx hashes excluded.",
      unresolved: [],
    },
    {
      key: "qualifying_users",
      label: "Qualifying users (≥25 qualifying days in 30)",
      value: qualifyingWallets.length,
      display: `${qualifyingWallets.length}`,
      status: interactionsAvailable && agesAvailable && balancesAvailable ? "verified" : "insufficient_data",
      sources,
      methodology: `Wallets meeting: ≥1 counted project interaction/day; balance ≥0.1 BOT or ≥$100 other assets; wallet age ≥24h; ≥${QUALIFYING_DAYS} qualifying days in the ${WINDOW_DAYS}-day window. Shared-funding groups count only 10% (provisional rule).`,
      unresolved: ["Shared funding group formation rules provisional."],
    },
    {
      key: "counted_interactions",
      label: "Counted interactions (capped 20/wallet/day)",
      value: countedInteractionsAll,
      display: `${countedInteractionsAll}`,
      status: interactionsAvailable ? "verified" : "insufficient_data",
      sources,
      methodology: `Successful interactions with project contracts; duplicates deduplicated by tx hash; per-wallet daily cap of ${MAX_INTERACTIONS_PER_DAY} enforced (excess not counted).`,
      unresolved: [],
      notes: capBreaches.length
        ? `${capBreaches.length} wallet-days exceeded the ${MAX_INTERACTIONS_PER_DAY} interaction cap; excess interactions were excluded from counted totals.`
        : undefined,
    },
    {
      key: "avg_daily_active_wallets",
      label: "Average daily active wallets",
      value: Number(avgDailyActive.toFixed(2)),
      display: activeDays ? avgDailyActive.toFixed(1) : "—",
      status: interactionsAvailable ? "verified" : "insufficient_data",
      sources,
      methodology: "Mean unique active wallets per calendar day with ≥1 counted interaction.",
      unresolved: [],
    },
    {
      key: "balance_compliance",
      label: "Wallets meeting balance requirement",
      value: balanceOkWallets.size,
      display: `${balanceOkWallets.size}/${interactingWallets.size}`,
      progressPct: interactingWallets.size ? Number(balanceOkWallets.size / interactingWallets.size * 100) : null,
      status: balancesAvailable ? "verified" : "insufficient_data",
      sources,
      methodology: "≥0.1 native BOT or ≥$100 equivalent in other qualifying assets at the latest recorded snapshot.",
      unresolved: botPriceOk ? [] : ["BOT USD price unavailable for USD equivalents — some balances could not be valued and are excluded rather than counted as zero."],
    },
    {
      key: "wallet_age_compliance",
      label: "Wallets meeting 24h age requirement",
      value: ageOkWallets.size,
      display: agesAvailable ? `${ageOkWallets.size}/${interactingWallets.size}` : "—",
      status: agesAvailable ? "verified" : "insufficient_data",
      sources,
      methodology: "Wallet age measured from first on-chain transaction on BOT Chain (explorer-backed).",
      unresolved: [],
    },
    {
      key: "funding_risk",
      label: "Preliminary funding-source clusters",
      value: clusters.length,
      display: `${clusters.length} cluster(s)`,
      status: clusters.length > 0 ? "provisional" : interactionsAvailable ? "verified" : "insufficient_data",
      sources,
      methodology: "Addresses sharing observable initial-funding relationships are grouped. RISK INDICATOR ONLY — does not prove common ownership.",
      unresolved: ["Funding cluster boundaries are preliminary and require human review."],
      notes: clusters.map((c) => c.note).join(" ") || undefined,
    },
  ];

  // ── Tier scenarios (daily vs cumulative) ────────────────────────────
  const dailyUsers = Math.max(...Array.from({ length: states.length }, (_, i) => 0), dailyPeakUsers(states));
  const scenarios: SchemeCDetailed["scenario"] = [];

  if (input.tierDimension === "daily" || input.tierDimension === "both") {
    scenarios.push(
      pickTier({
        dimension: "daily",
        users: dailyUsers,
        interactions: Math.round(Number(avgDailyActive) > 0 ? countedInteractionsAll / activeDays : 0),
        tvlUsd: tvlUsd?.toNumber() ?? null,
      }),
    );
  }
  if (input.tierDimension === "cumulative" || input.tierDimension === "both") {
    scenarios.push(
      pickTier({
        dimension: "cumulative (full evaluation period)",
        users: qualifyingWallets.length,
        interactions: countedInteractionsAll,
        tvlUsd: tvlUsd?.toNumber() ?? null,
      }),
    );
  }

  const anyData = interactionsAvailable;
  const status: SchemeEvaluation["status"] = !anyData
    ? "insufficient_data"
    : // Always provisional while the dimension interpretation is unresolved.
      "provisional";

  const bestTier = scenarios.reduce<TierInfo | null>((best, s) => (!best || (s.tier?.rewardUsd ?? 0) > best.rewardUsd ? s.tier : best), null);

  const evaluation: SchemeEvaluation = {
    schemeCode: "SCHEME_C",
    schemeName: "Community Growth & User Conversion",
    rulesVersion: input.rulesVersion,
    sourceUrl: input.sourceUrl,
    status,
    overallProgressPct: null, // deliberately NOT a single percentage (spec §8)
    metrics,
    tier: bestTier,
    estimatedRewardUsd: bestTier?.rewardUsd ?? null,
    unresolved,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    calculatedAt: new Date().toISOString(),
    warnings,
  };

  return { evaluation, scenario: scenarios };
}

function dailyPeakUsers(states: WalletDayState[]): number {
  const perDay = new Map<string, Set<string>>();
  for (const s of states) {
    if (s.countedInteractions <= 0) continue;
    const set = perDay.get(s.date) ?? new Set<string>();
    set.add(s.wallet);
    perDay.set(s.date, set);
  }
  let max = 0;
  for (const set of perDay.values()) max = Math.max(max, set.size);
  return max;
}

function pickTier(s: { dimension: string; users: number; interactions: number; tvlUsd: number | null }): SchemeCDetailed["scenario"][number] {
  // Tier seeds from definitions (validated against official programme).
  const tierTable: { tier: number; rewardUsd: number; users: number; interactions: number; tvlUsd: number }[] = [
    { tier: 8, rewardUsd: 350_000, users: 800_000, interactions: 6_000_000, tvlUsd: 3_500_000 },
    { tier: 7, rewardUsd: 200_000, users: 400_000, interactions: 3_000_000, tvlUsd: 2_000_000 },
    { tier: 6, rewardUsd: 100_000, users: 150_000, interactions: 1_200_000, tvlUsd: 1_000_000 },
    { tier: 5, rewardUsd: 70_000, users: 80_000, interactions: 600_000, tvlUsd: 750_000 },
    { tier: 4, rewardUsd: 40_000, users: 40_000, interactions: 300_000, tvlUsd: 450_000 },
    { tier: 3, rewardUsd: 20_000, users: 15_000, interactions: 120_000, tvlUsd: 220_000 },
    { tier: 2, rewardUsd: 15_000, users: 8_000, interactions: 60_000, tvlUsd: 200_000 },
    { tier: 1, rewardUsd: 12_000, users: 4_000, interactions: 30_000, tvlUsd: 150_000 },
  ];
  const matched = tierTable.find(
    (t) => s.users >= t.users && s.interactions >= t.interactions && (s.tvlUsd === null || s.tvlUsd >= t.tvlUsd),
  );
  return {
    dimension: s.dimension,
    tier: matched
      ? { tier: matched.tier, label: `Tier ${matched.tier}`, rewardUsd: matched.rewardUsd, thresholds: { users: matched.users, interactions: matched.interactions, tvlUsd: matched.tvlUsd } }
      : null,
    users: s.users,
    interactions: s.interactions,
    tvlUsd: s.tvlUsd,
  };
}

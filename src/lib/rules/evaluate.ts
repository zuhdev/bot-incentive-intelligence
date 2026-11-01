/**
 * Rules-engine evaluation service: pulls project data from the DB, feeds the
 * pure scheme calculators, persists ProjectMetric + EligibilityResult rows
 * (versioned for historical reproducibility) and raises alerts.
 */
import { prisma } from "@/lib/db";
import env from "@/lib/env";
import { getDefinition } from "./definitions";
import type { DataSourceRef, MetricResult, SchemeEvaluation } from "./types";
import { evaluateSchemeA } from "./schemes/scheme-a";
import { evaluateSchemeC, type RawInteraction } from "./schemes/scheme-c";
import { evaluateSchemeD, type TvlBreakdown, type TvlSnapshotRow } from "./schemes/scheme-d";
import { evaluateGasRebate } from "./schemes/gas-rebate";

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function applyNetworkEligibilityGuard(evaluation: SchemeEvaluation): SchemeEvaluation {
  if (env.BOT_NETWORK === "mainnet") return evaluation;
  return {
    ...evaluation,
    status: "manual_review",
    overallProgressPct: null,
    tier: null,
    estimatedRewardUsd: null,
    unresolved: [
      ...evaluation.unresolved,
      "This run uses BOT Chain testnet data. Testnet activity is for integration testing only and cannot establish BOT mainnet incentive eligibility.",
    ],
    warnings: [
      ...evaluation.warnings,
      "Eligibility and reward outputs are suppressed in testnet mode. Switch BOT_NETWORK=mainnet to evaluate mainnet evidence.",
    ],
  };
}

function daysAgoDate(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return isoDate(d);
}

async function raiseAlert(
  projectId: string,
  kind: string,
  severity: "info" | "warning" | "critical",
  title: string,
  body?: string,
  dedupeKey?: string,
) {
  if (!dedupeKey) return; // dedupeKey required to prevent spam
  await prisma.alert.upsert({
    where: { projectId_dedupeKey: { projectId, dedupeKey } },
    create: { projectId, kind, severity, title, body, dedupeKey, status: "open" },
    update: { title, body, severity },
  }).catch(() => undefined);
}

async function persistEvaluation(projectId: string, evaluation: SchemeEvaluation, metrics: MetricResult[]) {
  const periodStart = new Date(`${evaluation.periodStart}T00:00:00Z`);
  const periodEnd = new Date(`${evaluation.periodEnd}T23:59:59Z`);
  for (const m of metrics) {
    await prisma.projectMetric.upsert({
      where: {
        projectId_schemeId_metricKey_rulesVersion_periodStart_periodEnd: {
          projectId,
          schemeId: evaluation.schemeCode,
          metricKey: m.key,
          rulesVersion: evaluation.rulesVersion,
          periodStart,
          periodEnd,
        },
      },
      create: {
        projectId,
        schemeId: evaluation.schemeCode,
        metricKey: m.key,
        status: m.status,
        value: m.value !== null ? String(m.value) : null,
        target: m.target !== null && m.target !== undefined ? String(m.target) : null,
        progressPct: m.progressPct ?? null,
        periodStart,
        periodEnd,
        evaluatedAt: new Date(evaluation.calculatedAt),
        rulesVersion: evaluation.rulesVersion,
        methodology: m.methodology ?? null,
        attribution: JSON.stringify(m.sources),
        unresolved: JSON.stringify(m.unresolved),
      },
      update: {
        status: m.status,
        value: m.value !== null ? String(m.value) : null,
        progressPct: m.progressPct ?? null,
        evaluatedAt: new Date(evaluation.calculatedAt),
      },
    });
  }

  // Eligibility result (threshold-approach alerts at 80%)
  if (evaluation.overallProgressPct !== null) {
    await prisma.eligibilityResult.create({
      data: {
        projectId,
        schemeId: evaluation.schemeCode,
        schemeCode: evaluation.schemeCode,
        tier: evaluation.tier?.label ?? null,
        status: evaluation.status,
        scorePct: evaluation.overallProgressPct,
        periodStart,
        periodEnd,
        rulesVersion: evaluation.rulesVersion,
        details: JSON.stringify({ metrics: evaluation.metrics, warnings: evaluation.warnings }),
      },
    });
    if (evaluation.overallProgressPct >= 80) {
      await raiseAlert(
        projectId,
        "threshold_approach",
        "info",
        `${evaluation.schemeName}: ${evaluation.overallProgressPct}% of top-tier requirement`,
        `Project is at ${evaluation.overallProgressPct}% of the highest published threshold. Status: ${evaluation.status}.`,
        `thr80:${evaluation.schemeCode}:${evaluation.periodEnd}`,
      );
    }
  }
  if (env.BOT_NETWORK === "mainnet") {
    for (const w of evaluation.warnings) {
      await raiseAlert(projectId, "data_gap", "warning", `${evaluation.schemeName}: data warning`, w, `warn:${evaluation.schemeCode}:${w.slice(0, 60)}`);
    }
  }
}

export async function evaluateProjectSchemeD(projectId: string): Promise<SchemeEvaluation> {
  const def = getDefinition("SCHEME_D");
  const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId } });
  const periodStart = daysAgoDate(120);
  const periodEnd = isoDate(new Date());

  const snapshots = await prisma.tvlSnapshot.findMany({
    where: { projectId, date: { gte: new Date(`${periodStart}T00:00:00Z`) } },
    orderBy: { date: "asc" },
  });

  const rows: TvlSnapshotRow[] = snapshots.map((s) => ({
    date: isoDate(s.date),
    qualifiedTvlUsd: s.qualifiedTvlUsd ? s.qualifiedTvlUsd.toString() : null,
    pendingTvlUsd: s.pendingTvlUsd ? s.pendingTvlUsd.toString() : null,
    excludedTvlUsd: s.excludedTvlUsd ? s.excludedTvlUsd.toString() : null,
    breakdown: s.breakdown ? (JSON.parse(s.breakdown) as TvlBreakdown) : null,
    protocolTvlUsd: s.protocolTvlUsd ? s.protocolTvlUsd.toString() : null,
    chainTvlUsd: s.chainTvlUsd ? s.chainTvlUsd.toString() : null,
    source: s.source,
  }));

  // If qualified TVL has not been computed yet, derive it from the asset
  // registry (only for snapshots that carry a breakdown; DeFiLlama-only
  // snapshots stay unqualified — shown as reference data).
  const sources: DataSourceRef[] = [
    { name: "DeFiLlama", url: `https://api.llama.fi/protocol/${project.defiLlamaSlug ?? env.DEFAULT_BOT_PROTOCOL_SLUG}`, retrievedAt: new Date().toISOString() },
  ];

  const result = evaluateSchemeD({
    periodStart,
    periodEnd,
    observationStart: isoDate(project.createdAt),
    mainnetDeployed: project.deployStatus === "mainnet",
    defiLlamaListed: Boolean(project.defiLlamaSlug),
    defiLlamaSlug: project.defiLlamaSlug,
    snapshots: rows,
    sources,
    rulesVersion: def.version,
    sourceUrl: def.sourceUrl,
  });

  const evaluation = applyNetworkEligibilityGuard(result.evaluation);
  await persistEvaluation(projectId, evaluation, evaluation.metrics);
  return evaluation;
}

export async function evaluateProjectSchemeC(projectId: string): Promise<SchemeEvaluation> {
  const def = getDefinition("SCHEME_C");
  const periodStart = daysAgoDate(30);
  const periodEnd = isoDate(new Date());

  const addresses = await prisma.projectAddress.findMany({ where: { projectId } });
  const contractAddresses = addresses.map((a) => a.address);

  const activities = await prisma.walletActivity.findMany({
    where: {
      chainId: env.BOT_CHAIN_ID,
      date: { gte: new Date(`${periodStart}T00:00:00Z`), lte: new Date(`${periodEnd}T00:00:00Z`) },
      toContract: contractAddresses.length ? { in: contractAddresses } : undefined,
    },
    orderBy: { date: "asc" },
    take: 50_000,
  });

  const interactions: RawInteraction[] = activities.map((a) => ({
    wallet: a.wallet,
    date: isoDate(a.date),
    txHash: a.txHash,
    toContract: a.toContract,
    status: a.status,
    counted: a.counted,
  }));

  const wallets = [...new Set(interactions.map((i) => i.wallet))];
  const walletRecords = wallets.length
    ? await prisma.wallet.findMany({ where: { address: { in: wallets } } })
    : [];
  const walletFirstSeen: Record<string, string> = {};
  for (const w of walletRecords) {
    if (w.firstSeenAt) walletFirstSeen[w.address] = w.firstSeenAt.toISOString();
  }

  // Balance snapshots: latest per wallet
  const balances: { wallet: string; symbol: string; address: string | null; decimals: number; balance: string; priceUsd: string | null }[] = [];
  for (const w of wallets) {
    const snaps = await prisma.walletBalanceSnapshot.findMany({
      where: { wallet: w },
      orderBy: { takenAt: "desc" },
      take: 10,
    });
    const seen = new Set<string>();
    for (const s of snaps) {
      const key = s.address ?? "native";
      if (seen.has(key)) continue;
      seen.add(key);
      const price = s.address === null ? await prisma.tokenPrice.findFirst({ where: { symbol: "BOT" }, orderBy: { takenAt: "desc" } }) : null;
      balances.push({
        wallet: w,
        symbol: s.symbol ?? key,
        address: s.address,
        decimals: s.decimals ?? 18,
        balance: s.balance,
        priceUsd: price ? price.priceUsd.toString() : null,
      });
    }
  }

  const funding = await prisma.walletFundingRelationship.findMany({
    where: { toWallet: { in: wallets }, chainId: env.BOT_CHAIN_ID },
    take: 5_000,
  });

  const botPrice = await prisma.tokenPrice.findFirst({ where: { symbol: "BOT" }, orderBy: { takenAt: "desc" } });

  const result = evaluateSchemeC({
    periodStart,
    periodEnd,
    interactions,
    balances,
    walletFirstSeen,
    funding: funding.map((f) => ({ from: f.fromWallet, to: f.toWallet, token: f.token, clusterId: f.clusterId, txCount: f.txCount })),
    projectAddresses: contractAddresses,
    tvlUsd: null,
    tierDimension: "both",
    botPriceUsd: botPrice ? botPrice.priceUsd.toString() : null,
    sources: [
      { name: "BOTScan explorer", url: env.BOTSCAN_API_URL, retrievedAt: new Date().toISOString() },
      { name: "BOT Chain RPC", url: env.BOT_RPC_URL, retrievedAt: new Date().toISOString() },
    ],
    rulesVersion: def.version,
    sourceUrl: def.sourceUrl,
  });

  const evaluation = applyNetworkEligibilityGuard(result.evaluation);
  await persistEvaluation(projectId, evaluation, evaluation.metrics);
  return evaluation;
}

export async function evaluateProjectGasRebate(projectId: string): Promise<SchemeEvaluation> {
  const def = getDefinition("GAS_REBATE");
  const periodStart = daysAgoDate(90);
  const periodEnd = isoDate(new Date());
  const days = await prisma.gasUsageDaily.findMany({
    where: { projectId, date: { gte: new Date(`${periodStart}T00:00:00Z`) } },
    orderBy: { date: "asc" },
  });

  const botPrice = await prisma.tokenPrice.findFirst({ where: { symbol: "BOT" }, orderBy: { takenAt: "desc" } });
  const botPriceUsd = botPrice ? botPrice.priceUsd.toString() : null;

  const result = evaluateGasRebate({
    periodStart,
    periodEnd,
    days: days.map((d) => ({
      date: isoDate(d.date),
      gasUsed: d.gasUsed,
      botSpent: d.botSpent.toString(),
      usdSpent: d.usdSpent ? d.usdSpent.toString() : null,
      botPriceUsd: d.botPriceUsd ? d.botPriceUsd.toString() : botPriceUsd,
    })),
    sources: [
      { name: "BOT Chain RPC", url: env.BOT_RPC_URL, retrievedAt: new Date().toISOString() },
      ...(botPrice ? [{ name: "BOT price (DeFiLlama)", url: botPrice.sourceUrl ?? undefined, retrievedAt: botPrice.takenAt.toISOString() }] : []),
    ],
    rulesVersion: def.version,
    sourceUrl: def.sourceUrl,
  });

  const evaluation = applyNetworkEligibilityGuard(result);
  await persistEvaluation(projectId, evaluation, evaluation.metrics);
  return evaluation;
}

export async function evaluateAllProjectSchemes(projectId: string): Promise<SchemeEvaluation[]> {
  const results: SchemeEvaluation[] = [];
  for (const fn of [evaluateProjectSchemeC, evaluateProjectSchemeD, evaluateProjectGasRebate]) {
    try {
      results.push(await fn(projectId));
    } catch (err) {
      console.error(`[evaluate:${fn.name}]`, err);
    }
  }
  return results;
}

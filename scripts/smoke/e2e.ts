/**
 * End-to-end smoke test against LIVE providers + local DB.
 * Exercises: project creation → DeFiLlama TVL import → wallet ingestion
 * (live BOTScan) → funding scan → rules evaluation → evidence generation.
 *
 * Run: npx tsx scripts/smoke/e2e.ts
 */
import "dotenv/config";

import { prisma } from "../../src/lib/db";
import { importProjectTvlHistory } from "../../src/lib/ingestion/tvl";
import { ingestWalletActivity, scanFundingRelationships } from "../../src/lib/ingestion/wallets";
import { evaluateProjectSchemeC, evaluateProjectSchemeD, evaluateProjectGasRebate } from "../../src/lib/rules/evaluate";
import { generateEvidenceReport } from "../../src/lib/evidence";
import { resolveAndStorePrice } from "../../src/lib/providers/prices";
import { KNOWN } from "../poc/lib";
import env from "../../src/lib/env";

async function main() {
  if (env.BOT_NETWORK !== "mainnet") {
    throw new Error("This smoke fixture contains verified mainnet-only addresses. Use it only with BOT_NETWORK=mainnet; testnet deployment checks are listed in docs/testnet-deployment.md.");
  }
  console.log("=== E2E smoke test (LIVE data) ===\n");

  // 1. Create a demo project wired to the verified BDEX V3 DeFiLlama slug.
  const project = await prisma.project.create({
    data: {
      name: `Smoke Test ${Date.now()}`,
      description: "E2E smoke project — live data exercise (safe to delete)",
      category: "defi",
      deployStatus: "mainnet",
      defiLlamaSlug: process.env.DEFAULT_BOT_PROTOCOL_SLUG ?? "bdex-v3",
      addresses: {
        create: [
          { address: KNOWN.usdtWbotPool, chainId: env.BOT_CHAIN_ID, type: "dex_pool", label: "BDEX USDT/WBOT V3 pool (live)", schemes: '["SCHEME_A","SCHEME_C"]' },
          { address: KNOWN.trader, chainId: env.BOT_CHAIN_ID, type: "team_wallet", label: "Observed live trader", schemes: '["SCHEME_C"]' },
        ],
      },
    },
    include: { addresses: true },
  });
  console.log(`[1] project created: ${project.id} with ${project.addresses.length} tracked addresses`);

  // 2. Import DeFiLlama historical TVL (live).
  const tvl = await importProjectTvlHistory(project.id);
  console.log(`[2] TVL import (live DeFiLlama): imported=${tvl.imported} skipped=${tvl.skipped} coverage=${tvl.earliest} → ${tvl.latest}${tvl.error ? ` ERROR: ${tvl.error}` : ""}`);

  // 3. Wallet ingestion for the live-observed trader (BOTScan).
  const wallet = await ingestWalletActivity(KNOWN.trader, 1);
  console.log(`[3] wallet ingestion (live BOTScan): txs=${wallet.txsFetched} transfers=${wallet.transfersFetched} firstSeen=${wallet.firstSeen} balance=${wallet.nativeBalance} errors=${wallet.errors.length}`);

  // 4. BOT price (live).
  const price = await resolveAndStorePrice("BOT", { coingeckoId: "bohr" });
  console.log(`[4] BOT price: ${price ? `$${price.priceUsd} via ${price.source}` : "UNAVAILABLE (preserved as data-gap)"}`);

  // 5. Funding scan (uses ingested transfers).
  const funding = await scanFundingRelationships(project.id, 50);
  console.log(`[5] funding relationships written: ${funding}`);

  // 6. Rules evaluation (Scheme C, D, Gas).
  const [c, d, g] = await Promise.all([
    evaluateProjectSchemeC(project.id),
    evaluateProjectSchemeD(project.id),
    evaluateProjectGasRebate(project.id),
  ]);
  console.log(`[6] Scheme C: status=${c.status} metrics=${c.metrics.length} tier=${c.tier?.label ?? "none"}`);
  console.log(`    Scheme D: status=${d.status} metrics=${d.metrics.length}`);
  console.log(`    Gas rebate: status=${g.status} metrics=${g.metrics.length}`);
  for (const m of d.metrics.slice(0, 3)) {
    console.log(`      D·${m.key}: ${m.display} [${m.status}]`);
  }

  // 7. Evidence report generation + hash.
  const evidence = await generateEvidenceReport(project.id, "SCHEME_D");
  console.log(`[7] evidence report: id=${evidence.id} hash=${evidence.reportHash.slice(0, 16)}…`);

  // 8. Verify DB row counts.
  const [tvlCount, activityCount, metricCount, reportCount] = await Promise.all([
    prisma.tvlSnapshot.count({ where: { projectId: project.id } }),
    prisma.walletActivity.count({ where: { wallet: KNOWN.trader } }),
    prisma.projectMetric.count({ where: { projectId: project.id } }),
    prisma.evidenceReport.count({ where: { projectId: project.id } }),
  ]);
  console.log(`[8] DB: tvl=${tvlCount} walletActivity=${activityCount} metrics=${metricCount} evidenceReports=${reportCount}`);

  console.log("\n=== E2E smoke test complete ===");
  console.log(`demo project id (inspect in dashboard): ${project.id}`);
}

main()
  .catch((err) => {
    console.error("SMOKE TEST FAILED:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

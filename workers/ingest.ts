/**
 * Background worker entry point.
 *
 * Runs scheduled ingestion jobs:
 *  - tail ingestion of recent blocks for all tracked addresses (60s)
 *  - daily TVL snapshot import (every 6h; snapshot values normalise to 00:00 UTC)
 *  - provider health checks (5 min)
 *  - BOT price refresh (15 min)
 *
 * Deployable independently (spec §3). Uses the pluggable scheduler
 * (BullMQ when REDIS_URL is set; in-memory otherwise).
 */
import "dotenv/config";

import { prisma } from "../src/lib/db";
import { createScheduler } from "../src/lib/ingestion/scheduler";
import { runTailIngestion } from "../src/lib/ingestion/runner";
import { importProjectTvlHistory } from "../src/lib/ingestion/tvl";
import { checkAllProviders } from "../src/lib/providers/health";
import { getBotUsdPrice } from "../src/lib/providers/prices";
import env from "../src/lib/env";

async function main() {
  if (env.NODE_ENV === "production" && !env.REDIS_URL) {
    throw new Error("REDIS_URL is required for the production ingestion worker; configure Redis rather than using the in-process scheduler.");
  }
  console.log("[worker] starting BOT Incentive Intelligence ingestion worker…");

  const scheduler = createScheduler();

  scheduler.register({
    name: "tail-ingestion",
    intervalMs: 60_000,
    run: async () => {
      const addresses = await prisma.projectAddress.findMany({
        where: { chainId: env.BOT_CHAIN_ID },
        select: { address: true },
        distinct: ["address"],
        take: 50,
      });
      if (addresses.length === 0) return;
      const report = await runTailIngestion({ addresses: addresses.map((a) => a.address) });
      console.log(
        `[worker] tail ingestion: ${report.logs} logs (swaps=${report.swaps}, transfers=${report.transfers}, liquidity=${report.liquidity}) errors=${report.errors.length}`,
      );
    },
  });

  scheduler.register({
    name: "tvl-snapshots",
    intervalMs: 6 * 3600_000,
    run: async () => {
      const projects = await prisma.project.findMany({ select: { id: true } });
      for (const p of projects) {
        const r = await importProjectTvlHistory(p.id);
        console.log(`[worker] tvl ${p.id}: imported=${r.imported} skipped=${r.skipped}${r.error ? ` error=${r.error}` : ""}`);
      }
    },
  });

  scheduler.register({
    name: "provider-health",
    intervalMs: 5 * 60_000,
    run: async () => {
      const statuses = await checkAllProviders();
      const failing = statuses.filter((s) => !s.ok);
      console.log(`[worker] provider health: ${statuses.length - failing.length}/${statuses.length} ok${failing.length ? ` — failing: ${failing.map((f) => f.name).join(",")}` : ""}`);
    },
  });

  scheduler.register({
    name: "bot-price",
    intervalMs: 15 * 60_000,
    run: async () => {
      const price = await getBotUsdPrice();
      console.log(`[worker] BOT price: ${price ? `$${price.priceUsd} via ${price.source}` : "unavailable on this network (not zero — data-gap preserved)"}`);
    },
  });

  await scheduler.start();

  const shutdown = async () => {
    console.log("[worker] shutting down…");
    await scheduler.stop();
    await prisma.$disconnect();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

/**
 * Seed: incentive schemes (versioned definitions), core metrics and the
 * default asset-classification registry entries that can be verified live.
 *
 * Asset classifications are stored with source + verification status.
 * Only classifications that are objectively verifiable (native BOT, BDEX
 * USDT/WBOT pool tokens observed live) are seeded as qualified/pending —
 * everything else starts as pending_review awaiting the official whitelist.
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { ALL_DEFINITIONS } from "../src/lib/rules/definitions";
import env from "../src/lib/env";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding incentive schemes…");
  for (const def of ALL_DEFINITIONS) {
    const scheme = await prisma.incentiveScheme.upsert({
      where: { code: def.code },
      create: {
        code: def.code,
        name: def.name,
        status: "active",
        sourceUrl: def.sourceUrl,
        notes: def.description,
      },
      update: { name: def.name, sourceUrl: def.sourceUrl, notes: def.description },
    });

    await prisma.schemeVersion.upsert({
      where: { schemeId_version: { schemeId: scheme.id, version: def.version } },
      create: {
        schemeId: scheme.id,
        version: def.version,
        effectiveAt: new Date(def.effectiveAt),
        lastVerifiedAt: new Date(def.lastVerifiedAt),
        definition: JSON.stringify(def),
      },
      update: { definition: JSON.stringify(def), lastVerifiedAt: new Date(def.lastVerifiedAt) },
    });

    for (const [key, rule] of Object.entries(def.rules)) {
      await prisma.incentiveRule.upsert({
        where: { schemeId_key_version: { schemeId: scheme.id, key, version: def.version } },
        create: {
          schemeId: scheme.id,
          key,
          value: JSON.stringify(rule.value),
          valueType: typeof rule.value === "number" ? "number" : typeof rule.value === "boolean" ? "boolean" : "json",
          unit: rule.unit,
          description: rule.note,
          interpretation: rule.interpretation ?? "confirmed",
          interpretationNote: rule.note,
          version: def.version,
        },
        update: {
          value: JSON.stringify(rule.value),
          interpretation: rule.interpretation ?? "confirmed",
          interpretationNote: rule.note,
        },
      });
    }
  }

  console.log("Seeding asset classifications (verified live data only)…");
  const liveAssets = [
    // Native BOT — classification "bot" (objectively verifiable)
    {
      chainId: env.BOT_CHAIN_ID,
      address: "native",
      symbol: "BOT",
      decimals: 18,
      category: "bot",
      qualified: env.BOT_NETWORK === "mainnet",
      source: env.BOT_NETWORK === "mainnet" ? "official" : "operator",
      sourceUrl: "https://www.botchain.ai/en/ecosystem-support/",
      verified: env.BOT_NETWORK === "mainnet",
      notes: env.BOT_NETWORK === "mainnet"
        ? "Native mainnet asset. Published Scheme D rate table includes BOT explicitly."
        : "Testnet native token. Testnet balances are not eligible BOT mainnet incentive evidence.",
    },
    // BDEX USDT (observed live via BDEX API + on-chain transfers, 6 decimals).
    // Classified as stablecoin PENDING VERIFICATION of the official whitelist.
    {
      chainId: env.BOT_CHAIN_ID,
      address: "0xababc7ddc03e501d190c676bf3d92ef0e6e87a3c",
      symbol: "USDT",
      decimals: 6,
      category: "pending_review",
      qualified: false,
      source: "community",
      sourceUrl: "https://dex-wallet.botchain.ai/api/v1/pools",
      verified: false,
      notes: "BDEX base token observed live (USDT/WBOT pool, feeTier 3000). Stablecoin classification is likely but pending official whitelist confirmation.",
    },
    // WBOT — wrapped BOT observed live; pending review.
    {
      chainId: env.BOT_CHAIN_ID,
      address: "0xd5452816194a3784dba983426cce7c122f4abd30",
      symbol: "WBOT",
      decimals: 18,
      category: "pending_review",
      qualified: false,
      source: "community",
      sourceUrl: "https://dex-wallet.botchain.ai/api/v1/pools",
      verified: false,
      notes: "Wrapped BOT observed live in BDEX pools. Treatment of wrapped assets pending official clarification.",
    },
  ];
  const classificationsForNetwork = env.BOT_NETWORK === "mainnet" ? liveAssets : liveAssets.slice(0, 1);
  for (const a of classificationsForNetwork) {
    await prisma.assetClassification.upsert({
      where: { chainId_address: { chainId: a.chainId, address: a.address } },
      create: a,
      update: { category: a.category, qualified: a.qualified, notes: a.notes, symbol: a.symbol, decimals: a.decimals },
    });
  }

  // Data provider registry entries
  for (const p of [
    { name: `rpc_${env.BOT_NETWORK}`, kind: "rpc", baseUrl: env.BOT_RPC_URL },
    { name: `botscan_${env.BOT_NETWORK}`, kind: "explorer", baseUrl: env.BOTSCAN_API_URL },
    { name: "bdex", kind: "dex", baseUrl: process.env.BDEX_API_URL ?? "https://dex-wallet.botchain.ai" },
    { name: "defillama", kind: "tvl", baseUrl: process.env.DEFILLAMA_API_URL ?? "https://api.llama.fi" },
  ]) {
    await prisma.dataProvider.upsert({ where: { name: p.name }, create: { enabled: true, ...p }, update: {} });
  }

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

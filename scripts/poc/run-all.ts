/**
 * PoC orchestrator — proves the five data-connectivity requirements against
 * LIVE services. Run: npm run poc
 *
 * Results are written to docs/poc-results.json (raw) and printed as a table.
 * Nothing here is mocked; failures are reported as failures.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  KNOWN,
  MINT_V3_TOPIC,
  SWAP_V3_TOPIC,
  TRANSFER_TOPIC,
  rpc,
  shortHex,
  timedFetch,
  weiToEth,
  type ProbeResult,
} from "./lib";

const results: (ProbeResult & { json?: unknown })[] = [];
function record(r: ProbeResult & { json?: any }) {
  results.push(r);
  const icon = r.ok ? "PASS" : "FAIL";
  console.log(`[${icon}] ${r.name} (${r.ms}ms)${r.error ? ` — ${r.error}` : ""}`);
  return r;
}

async function main() {
  const startedAt = new Date().toISOString();
  console.log(`\n=== BOT Incentive Intelligence — connectivity PoC @ ${startedAt} ===\n`);

  // ── 1. BOT Chain RPC ────────────────────────────────────────────────
  console.log("--- 1. BOT Chain mainnet RPC (https://rpc.botchain.ai) ---");
  const chainId = record(await rpc("eth_chainId", []));
  const blockNum = record(await rpc("eth_blockNumber", []));
  const latest = blockNum.json?.result ? BigInt(blockNum.json.result) : 0n;
  console.log(`    chainId=${chainId.json?.result} latestBlock=${latest}`);

  record(await rpc("eth_getBalance", [KNOWN.trader, "latest"]));
  record(await rpc("eth_getTransactionCount", [KNOWN.trader, "latest"]));
  const block = record(await rpc("eth_getBlockByNumber", [`0x${latest.toString(16)}`, true], 60_000));
  const sampleTx = block.json?.result?.transactions?.[0];
  if (sampleTx) {
    console.log(`    sample tx: ${shortHex(sampleTx.hash, 12)}`);
    record(await rpc("eth_getTransactionReceipt", [sampleTx.hash]));
  }

  // Documented limitation probe: unfiltered full-range getLogs is expected to
  // fail/timeout. Filtered queries are the supported path (verified below).
  console.log("    probing unfiltered full-range eth_getLogs (expected to fail)…");
  const getLogsFull = await rpc(
    "eth_getLogs",
    [{ fromBlock: "0x0", toBlock: `0x${latest.toString(16)}` }],
    30_000,
  );
  record(getLogsFull);

  // ── 2. Historical wallet transactions (BOTScan/Blockscout v2) ───────
  console.log("\n--- 2. Historical wallet transactions (BOTScan Blockscout v2) ---");
  const txs = record(
    await timedFetch(
      "botscan:wallet-transactions",
      `${process.env.BOTSCAN_API_URL ?? "https://scan.botchain.ai/api"}/v2/addresses/${KNOWN.trader}/transactions?items=10`,
    ),
  );
  const txItems: any[] = txs.json?.items ?? [];
  console.log(
    `    retrieved ${txItems.length} historical txs; oldest=${txItems.at(-1)?.timestamp ?? "n/a"} newest=${txItems[0]?.timestamp ?? "n/a"}`,
  );

  // ── 3. ERC-20 token transfers ───────────────────────────────────────
  console.log("\n--- 3. ERC-20 token transfer retrieval ---");
  const tokenTxs = record(
    await timedFetch(
      "botscan:wallet-token-transfers",
      `${process.env.BOTSCAN_API_URL ?? "https://scan.botchain.ai/api"}/v2/addresses/${KNOWN.trader}/token-transfers?items=10`,
    ),
  );
  const tokenItems: any[] = tokenTxs.json?.items ?? [];
  const tokens = [...new Set(tokenItems.map((t: any) => t.token?.symbol).filter(Boolean))];
  console.log(`    retrieved ${tokenItems.length} transfers across tokens: ${tokens.join(", ") || "n/a"}`);

  // ── 4. Historical contract events despite getLogs limits ───────────
  console.log("\n--- 4. Historical contract events (filtered eth_getLogs + explorer fallback) ---");
  // 4a. Filtered RPC getLogs: ~355k-block window for one pool + Swap topic.
  // (V3 pools emit Swap/Mint/Burn — they never emit ERC-20 Transfer themselves.)
  const deepFrom = latest - 350_000n;
  const deepLogs = record(
    await rpc(
      "eth_getLogs",
      [
        {
          fromBlock: `0x${deepFrom.toString(16)}`,
          toBlock: `0x${latest.toString(16)}`,
          address: KNOWN.usdtWbotPool,
          topics: [SWAP_V3_TOPIC],
        },
      ],
      120_000,
    ),
  );
  const deepSwapCount = deepLogs.json?.result?.length ?? 0;
  console.log(`    filtered getLogs (Swap topic) over 350k blocks → ${deepSwapCount} logs`);
  if (deepSwapCount > 0) {
    const first: any = deepLogs.json.result[0];
    console.log(
      `    oldest swap in window: block=${BigInt(first.blockNumber)} tx=${shortHex(first.transactionHash, 12)}`,
    );
  }

  // 4b. Deep history via explorer (pool logs). Note: the explorer is slow for
  // very hot addresses; a cold EOA/token is used as a reliable sample here.
  const logs = await timedFetch(
    "botscan:address-logs",
    `${process.env.BOTSCAN_API_URL ?? "https://scan.botchain.ai/api"}/v2/addresses/${KNOWN.wbot}/logs?items=5`,
    { timeoutMs: 60_000 },
  );
  record(logs);
  const logItems: any[] = logs.json?.items ?? [];
  console.log(`    explorer logs for token ${shortHex(KNOWN.wbot)} → ${logItems.length} items`);

  // 4c. Swap event extraction from the RPC path (Univ3-style Swap topic).
  const swapLogs = record(
    await rpc(
      "eth_getLogs",
      [
        {
          fromBlock: `0x${(latest - 5_000n).toString(16)}`,
          toBlock: `0x${latest.toString(16)}`,
          address: KNOWN.usdtWbotPool,
          topics: [SWAP_V3_TOPIC],
        },
      ],
      60_000,
    ),
  );
  const swaps: any[] = swapLogs.json?.result ?? [];
  if (swaps.length > 0) {
    const s = swaps[0];
    // amount1 is int256 (signed): interpret two's complement.
    const raw = BigInt(`0x${s.data.slice(66, 130)}`);
    const signed = raw >= 2n ** 255n ? raw - 2n ** 256n : raw;
    console.log(
      `    sample Swap: pool=${shortHex(s.address)} tx=${shortHex(s.transactionHash, 12)} amount1(int256)=${signed}`,
    );
  }

  // ── 5. BDEX API ─────────────────────────────────────────────────────
  console.log("\n--- 5. BDEX public API (https://dex-wallet.botchain.ai) ---");
  const pairs = record(await timedFetch("bdex:pairs", `${process.env.BDEX_API_URL ?? "https://dex-wallet.botchain.ai"}/api/v1/pairs?pool_type=all`));
  const pools = record(await timedFetch("bdex:pools", `${process.env.BDEX_API_URL ?? "https://dex-wallet.botchain.ai"}/api/v1/pools?pool_type=all`));
  const charts = record(await timedFetch("bdex:pool-charts", `${process.env.BDEX_API_URL ?? "https://dex-wallet.botchain.ai"}/api/v1/pool-charts?pool=${KNOWN.usdtWbotPool}`));
  const liqDist = record(await timedFetch("bdex:liquidity-distribution", `${process.env.BDEX_API_URL ?? "https://dex-wallet.botchain.ai"}/api/v1/pool-liquidity-distribution?pool=${KNOWN.usdtWbotPool}`));
  const lpPositions = record(await timedFetch("bdex:lp-positions", `${process.env.BDEX_API_URL ?? "https://dex-wallet.botchain.ai"}/api/v1/v2/lp-positions?owner=${KNOWN.trader}`));

  function unwrap(json: any): any {
    if (json && typeof json.data === "string") {
      try { return JSON.parse(json.data); } catch { return json.data; }
    }
    return json?.data ?? json;
  }
  const pairsData = unwrap(pairs.json);
  const poolsData = unwrap(pools.json);
  const chartsData = unwrap(charts.json);
  const liqData = unwrap(liqDist.json);
  console.log(`    pairs=${Array.isArray(pairsData) ? pairsData.length : "?"} pools=${Array.isArray(poolsData) ? poolsData.length : "?"} chartPoints=${Array.isArray(chartsData) ? chartsData.length : "?"} liquidityTicks=${liqData?.ticks?.length ?? "?"}`);
  const topPool = Array.isArray(poolsData)
    ? poolsData.find((p: any) => p.poolId?.toLowerCase() === KNOWN.usdtWbotPool) ?? poolsData[0]
    : null;
  if (topPool) {
    console.log(
      `    live pool: ${topPool.name} tvl/vol24=${topPool.volumeUsd24 ?? "?"} txns24=${topPool.transactionsH24 ?? "?"} feeTier=${topPool.feeTier ?? "?"}`,
    );
  }

  // ── 6. DeFiLlama historical TVL ─────────────────────────────────────
  console.log("\n--- 6. DeFiLlama (https://api.llama.fi) ---");
  const chains = record(await timedFetch("defillama:chains", `${process.env.DEFILLAMA_API_URL ?? "https://api.llama.fi"}/chains`));
  const botChain = (chains.json as any[])?.find((c) => c.name === "BOT Chain");
  console.log(`    BOT Chain on DeFiLlama: chainId=${botChain?.chainId} tvl=${botChain?.tvl}`);

  const slug = process.env.DEFAULT_BOT_PROTOCOL_SLUG ?? "bdex-v3";
  const proto = record(await timedFetch("defillama:protocol-historical-tvl", `${process.env.DEFILLAMA_API_URL ?? "https://api.llama.fi"}/protocol/${slug}`, { timeoutMs: 90_000 }));
  const protoJson: any = proto.json;
  const tvlSeries: any[] = protoJson?.chainTvls?.["BOT Chain"]?.tvl ?? [];
  console.log(
    `    ${protoJson?.name} (${slug}): ${tvlSeries.length} daily BOT Chain TVL points` +
      (tvlSeries.length
        ? `, first=${new Date(tvlSeries[0].date * 1000).toISOString().slice(0, 10)} ($${tvlSeries[0].totalLiquidityUSD}) latest=${new Date(tvlSeries.at(-1).date * 1000).toISOString().slice(0, 10)} ($${tvlSeries.at(-1).totalLiquidityUSD})`
        : ""),
  );

  // ── Summary ─────────────────────────────────────────────────────────
  const passed = results.filter((r) => r.ok).length;
  console.log(`\n=== SUMMARY: ${passed}/${results.length} probes passed ===`);

  const outDir = resolve(process.cwd(), "docs");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(
    resolve(outDir, "poc-results.json"),
    JSON.stringify({ startedAt, finishedAt: new Date().toISOString(), results }, null, 2),
  );
  console.log(`raw results → docs/poc-results.json\n`);

  // The full-range getLogs failure is EXPECTED (documented RPC limitation).
  const unexpectedFailures = results.filter((r) => !r.ok && r.name !== "rpc:eth_getLogs");
  if (unexpectedFailures.length > 0) {
    console.error(`Unexpected failures: ${unexpectedFailures.map((r) => r.name).join(", ")}`);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

/**
 * Checkpointed historical ingestion runner.
 *
 * Design (spec §6):
 * - Historical backfilling is SEPARATE from real-time ingestion.
 * - Checkpoints allow resume after interruption (ingestion_checkpoints).
 * - Filtered getLogs per tracked address (public RPC rejects wide unfiltered
 *   ranges — verified in docs/connectivity-report.md).
 * - Idempotent persistence via deterministic ids.
 * - Every processed range updates the checkpoint transactionally-ish (last).
 */
import { prisma } from "@/lib/db";
import env from "@/lib/env";
import { getBlock, getBlockNumber, getLogsChunked, type EthLog } from "@/lib/providers/rpc";
import { deterministicEventId, persistBlock, persistLogs, TOPICS } from "./events";

export interface IngestionReport {
  fromBlock: bigint;
  toBlock: bigint;
  logs: number;
  blocks: number;
  swaps: number;
  transfers: number;
  liquidity: number;
  errors: string[];
  startedAt: string;
  finishedAt: string;
}

/** Fetch timestamps for the given block numbers (cached per run). */
async function fetchBlockTimestamps(chainId: number, blocks: bigint[], cache: Map<string, Date>) {
  const missing = [...new Set(blocks.map(String))].filter((b) => !cache.has(b));
  for (const b of missing) {
    // Reorg handling note: we trust the latest header; on depth<confirmations
    // conflicts, deterministic ids keep data consistent (no dup) and a
    // separate consistency job can reconcile.
    const block = (await getBlock(BigInt(b), false)) as Record<string, unknown>;
    const tsHex = (block.timestamp as string) ?? "0x0";
    cache.set(b, new Date(Number(BigInt(tsHex)) * 1000));
  }
}

/**
 * Backfill events for a set of tracked addresses over a block range.
 * Uses a single checkpoint cursor shared per chain ("events_backfill").
 */
export async function runEventBackfill(opts: {
  chainId?: number;
  addresses: string[];
  fromBlock?: bigint;
  toBlock?: bigint;
  maxBlocks?: number;
}): Promise<IngestionReport> {
  if (opts.chainId !== undefined && opts.chainId !== env.BOT_CHAIN_ID) {
    throw new Error(`Configured deployment network is ${env.BOT_NETWORK} (chain ${env.BOT_CHAIN_ID}); refusing ingestion for chain ${opts.chainId}.`);
  }
  const chainId = opts.chainId ?? env.BOT_CHAIN_ID;
  const startedAt = new Date().toISOString();
  const errors: string[] = [];
  const latest = await getBlockNumber();
  const toBlock = opts.toBlock ?? latest;
  const maxBlocks = BigInt(opts.maxBlocks ?? env.INGEST_BACKFILL_MAX_BLOCKS);

  const checkpointKey = opts.addresses.join(",").slice(0, 180);
  const cp = await prisma.ingestionCheckpoint.findUnique({
    where: { kind_chainId_key: { kind: "events_backfill", chainId, key: checkpointKey } },
  });
  let fromBlock = opts.fromBlock ?? (cp?.lastBlock ? cp.lastBlock + 1n : toBlock > maxBlocks ? toBlock - maxBlocks : 1n);
  if (fromBlock > toBlock) fromBlock = toBlock;

  const report: IngestionReport = {
    fromBlock,
    toBlock,
    logs: 0,
    blocks: Number(toBlock - fromBlock + 1n),
    swaps: 0,
    transfers: 0,
    liquidity: 0,
    errors,
    startedAt,
    finishedAt: startedAt,
  };

  const tsCache = new Map<string, Date>();
  let lastProcessed = fromBlock - 1n;

  // Interleave address filters to respect provider constraints: one getLogs
  // per address per chunk. Chunks are adaptive inside getLogsChunked.
  try {
    const cursor = { current: fromBlock };
    while (cursor.current <= toBlock) {
      const chunkEnd = cursor.current + BigInt(env.INGEST_LOG_CHUNK) - 1n > toBlock ? toBlock : cursor.current + BigInt(env.INGEST_LOG_CHUNK) - 1n;
      for (const address of opts.addresses) {
        try {
          for await (const { logs, from, to } of getLogsChunked(
            { fromBlock: cursor.current, toBlock: chunkEnd, address },
            env.INGEST_LOG_CHUNK,
          )) {
            const blockIds = logs.map((l) => l.blockNumber);
            await fetchBlockTimestamps(chainId, blockIds, tsCache);
            const stats = await persistLogs(chainId, logs, tsCache, { poolTypeFor: () => "v3" });
            report.logs += logs.length;
            report.swaps += stats.swaps;
            report.transfers += stats.transfers;
            report.liquidity += stats.liquidity;
            lastProcessed = to > lastProcessed ? to : lastProcessed;
          }
        } catch (err) {
          errors.push(`address ${address}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
      cursor.current = chunkEnd + 1n;
      // Update checkpoint after each chunk
      await prisma.ingestionCheckpoint.upsert({
        where: { kind_chainId_key: { kind: "events_backfill", chainId, key: checkpointKey } },
        create: { kind: "events_backfill", chainId, key: checkpointKey, lastBlock: chunkEnd },
        update: { lastBlock: chunkEnd },
      });
    }
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
  }

  report.finishedAt = new Date().toISOString();
  return report;
}

/**
 * Recent-block tail ingestion: processes the last `tailBlocks` for tracked
 * addresses. Designed to run on a schedule (real-time-ish ingestion).
 */
export async function runTailIngestion(opts: { addresses: string[]; tailBlocks?: bigint }): Promise<IngestionReport> {
  const latest = await getBlockNumber();
  const from = latest - (opts.tailBlocks ?? 600n);
  return runEventBackfill({ addresses: opts.addresses, fromBlock: from, toBlock: latest });
}

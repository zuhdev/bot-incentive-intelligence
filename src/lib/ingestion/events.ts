/**
 * Event decoding + idempotent persistence for BOT Chain logs.
 * Deterministic ids (`chainId:txHash:logIndex`) prevent duplicates.
 */
import { createHash } from "node:crypto";
import { prisma } from "@/lib/db";
import { hexToInt256, hexToUint256, topicToAddress } from "@/lib/calcs/decimal";
import type { EthLog } from "@/lib/providers/rpc";

export const TOPICS = {
  Transfer: "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",
  SwapV3: "0xc42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67",
  MintV3: "0x7a53080ba414158be7ec69b987b5fb7d07dee101fe85488f0853ae16239d0bde",
  BurnV3: "0xdc420dac04262d31bf00627b616e836f722068679ae7f382317a54f8fb28cf43",
  SwapV2: "0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822",
  MintV2: "0x4c209b5fc8ad50758f13e2e1088ba56a560dff690a1c6fef26394f4c03821c4f",
  BurnV2: "0xdccd412f0b1252819cb1fd330b93224ca42612892bb3f4f789976e6d81936496",
} as const;

export function deterministicEventId(chainId: number, txHash: string, logIndex: number): string {
  return `${chainId}:${txHash.toLowerCase()}:${logIndex}`;
}

export function reportHash(payload: unknown): string {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

export interface IngestStats {
  transfers: number;
  swaps: number;
  liquidity: number;
  blocks: number;
}

/**
 * Persist a batch of logs with block timestamps. All inserts are idempotent
 * (upsert on deterministic ids). `blockTimestamps` maps blockNumber(hex|bigint)
 * -> Date and must be pre-fetched by the caller.
 */
export async function persistLogs(
  chainId: number,
  logs: EthLog[],
  blockTimestamps: Map<string, Date>,
  meta: { poolTypeFor?: (address: string) => "v2" | "v3" } = {},
): Promise<IngestStats> {
  const stats: IngestStats = { transfers: 0, swaps: 0, liquidity: 0, blocks: 0 };

  for (const log of logs) {
    const ts = blockTimestamps.get(log.blockNumber.toString());
    if (!ts) continue; // caller must supply timestamps; skip unverifiable logs
    const topic0 = log.topics[0]?.toLowerCase();

    if (topic0 === TOPICS.Transfer && log.topics.length >= 3) {
      const id = deterministicEventId(chainId, log.transactionHash, log.logIndex);
      await prisma.transferEvent.upsert({
        where: { id },
        create: {
          id,
          chainId,
          txHash: log.transactionHash.toLowerCase(),
          logIndex: log.logIndex,
          blockId: log.blockNumber,
          timestamp: ts,
          contract: log.address.toLowerCase(),
          from: topicToAddress(log.topics[1]),
          to: topicToAddress(log.topics[2]),
          value: hexToUint256(log.data.slice(0, 66)).toString(),
        },
        update: {},
      });
      stats.transfers++;
    } else if (topic0 === TOPICS.SwapV3) {
      const id = deterministicEventId(chainId, log.transactionHash, log.logIndex);
      // Swap(address sender, address recipient, int256 amount0, int256 amount1,
      //      uint160 sqrtPriceX96, uint128 liquidity, int24 tick)
      const amount0 = hexToInt256(log.data.slice(2, 66));
      const amount1 = hexToInt256(log.data.slice(66, 130));
      const sqrtPriceX96 = hexToUint256(log.data.slice(130, 194));
      const liquidity = hexToUint256(log.data.slice(194, 258));
      const tick = Number(hexToInt256(log.data.slice(258, 322)));
      await prisma.dexSwapEvent.upsert({
        where: { id },
        create: {
          id,
          chainId,
          pool: log.address.toLowerCase(),
          poolType: meta.poolTypeFor?.(log.address) ?? "v3",
          txHash: log.transactionHash.toLowerCase(),
          logIndex: log.logIndex,
          blockId: log.blockNumber,
          timestamp: ts,
          sender: log.topics[1] ? topicToAddress(log.topics[1]) : null,
          recipient: log.topics[2] ? topicToAddress(log.topics[2]) : null,
          txFrom: null, // enriched by tx fetch when needed
          amount0: amount0.toString(),
          amount1: amount1.toString(),
          sqrtPriceX96: sqrtPriceX96.toString(),
          liquidity: liquidity.toString(),
          tick,
        },
        update: {},
      });
      stats.swaps++;
    } else if (topic0 === TOPICS.MintV3 || topic0 === TOPICS.BurnV3) {
      const id = deterministicEventId(chainId, log.transactionHash, log.logIndex);
      const kind = topic0 === TOPICS.MintV3 ? "mint" : "burn";
      // Mint(address sender, address owner, int256 amount0, int256 amount1, ...)
      // Burn(address owner, int24 tickLower, int24 tickUpper, uint128 amount, ...)
      const amount0 = hexToInt256(log.data.slice(2, 66));
      const amount1 = hexToInt256(log.data.slice(66, 130));
      await prisma.liquidityEvent.upsert({
        where: { id },
        create: {
          id,
          chainId,
          pool: log.address.toLowerCase(),
          poolType: "v3",
          kind,
          txHash: log.transactionHash.toLowerCase(),
          logIndex: log.logIndex,
          blockId: log.blockNumber,
          timestamp: ts,
          owner: log.topics[kind === "mint" ? 2 : 1] ? topicToAddress(log.topics[kind === "mint" ? 2 : 1]) : null,
          amount0: amount0.toString(),
          amount1: amount1.toString(),
        },
        update: {},
      });
      stats.liquidity++;
    }
  }
  return stats;
}

/** Upsert block headers (idempotent). */
export async function persistBlock(
  chainId: number,
  block: {
    number: bigint;
    hash: string;
    parentHash: string;
    timestamp: Date;
    txCount: number;
    gasUsed: bigint;
  },
): Promise<void> {
  await prisma.block.upsert({
    where: { id: block.number },
    create: {
      id: block.number,
      chainId,
      hash: block.hash.toLowerCase(),
      parentHash: block.parentHash.toLowerCase(),
      timestamp: block.timestamp,
      txCount: block.txCount,
      gasUsed: block.gasUsed,
    },
    update: {},
  });
}

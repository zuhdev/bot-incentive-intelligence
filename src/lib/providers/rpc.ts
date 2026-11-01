/**
 * BOT Chain JSON-RPC adapter (viem-based for type-safe core calls, raw fetch
 * for chunked log ingestion where we need tight control over range limits).
 *
 * Verified live behaviour (docs/connectivity-report.md):
 * - eth_getLogs FAILS/times out on wide unfiltered ranges.
 * - eth_getLogs WORKS when filtered by address/topic over 350k+ blocks.
 * - ~1 block/sec production rate; `milliTimestamp` non-standard field exists.
 */
import env from "@/lib/env";
import { httpJson } from "./http";

export const botChain = {
  id: env.BOT_CHAIN_ID,
  name: env.BOT_NETWORK === "testnet" ? "BOT Chain Testnet" : "BOT Chain",
  nativeCurrency: { name: "BOT", symbol: "BOT", decimals: 18 },
  rpcUrls: { default: { http: [env.BOT_RPC_URL] } },
  blockExplorers: { default: { name: "BOTScan", url: env.BOT_EXPLORER_URL } },
} as const;

export interface LogFilter {
  fromBlock: bigint;
  toBlock: bigint;
  address?: string | string[];
  topics?: (string | string[] | null)[];
}

export interface EthLog {
  address: string;
  topics: string[];
  data: string;
  blockNumber: bigint;
  transactionHash: string;
  transactionIndex: number;
  blockHash: string;
  logIndex: number;
  removed: boolean;
}

export class RpcError extends Error {
  constructor(
    message: string,
    public readonly method: string,
    public readonly retriable: boolean = false,
  ) {
    super(message);
    this.name = "RpcError";
  }
}

async function rawRpc<T>(method: string, params: unknown[], timeoutMs = 60_000): Promise<T> {
  const res = await httpJson<{ result?: T; error?: { code: number; message: string } }>(
    env.BOT_RPC_URL,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method, params }),
      timeoutMs,
      retries: 2,
    },
  );
  if (!res.ok) throw new RpcError(res.error, method, res.status === 429 || res.status === 503 || /timeout/i.test(res.error));
  if (res.data.error) {
    // -32002 "request timed out" and similar provider limits are retriable
    // with smaller ranges/chunks.
    const retriable = res.data.error.code === -32002 || /timeout|limit|too many/i.test(res.data.error.message);
    throw new RpcError(res.data.error.message, method, retriable);
  }
  return res.data.result as T;
}

export async function getBlockNumber(): Promise<bigint> {
  return BigInt(await rawRpc<string>("eth_blockNumber", []));
}

export async function getBlock(blockNumber: bigint, includeTxs = false): Promise<Record<string, unknown>> {
  return rawRpc("eth_getBlockByNumber", [`0x${blockNumber.toString(16)}`, includeTxs]);
}

export async function getBalance(address: string, blockTag: "latest" | bigint = "latest"): Promise<bigint> {
  const tag = blockTag === "latest" ? "latest" : `0x${blockTag.toString(16)}`;
  return BigInt(await rawRpc<string>("eth_getBalance", [address.toLowerCase(), tag]));
}

/**
 * Chunked, filtered log fetch. Splits [fromBlock, toBlock] into chunks of
 * `chunkSize` (default from env). On a retriable provider timeout, halves the
 * chunk and retries — degrades gracefully to many small requests.
 */
export async function* getLogsChunked(
  filter: LogFilter,
  chunkSize: number = env.INGEST_LOG_CHUNK,
): AsyncGenerator<{ logs: EthLog[]; from: bigint; to: bigint }> {
  let from = filter.fromBlock;
  const to = filter.toBlock;
  let size = chunkSize;

  while (from <= to) {
    const sizeBig = BigInt(size);
    const chunkTo = from + sizeBig - 1n > to ? to : from + sizeBig - 1n;
    try {
      const logs = await rawRpc<EthLog[]>(
        "eth_getLogs",
        [
          {
            fromBlock: `0x${from.toString(16)}`,
            toBlock: `0x${chunkTo.toString(16)}`,
            ...(filter.address ? { address: filter.address } : {}),
            ...(filter.topics ? { topics: filter.topics } : {}),
          },
        ],
        90_000,
      );
      yield { logs: normaliseLogs(logs), from, to: chunkTo };
      from = chunkTo + 1n;
      // Reset chunk size after success (adaptive backoff).
      size = chunkSize;
    } catch (err) {
      if (err instanceof RpcError && err.retriable && size > 100) {
        size = Math.max(100, Math.floor(size / 4));
        continue;
      }
      throw err;
    }
  }
}

function normaliseLogs(logs: EthLog[]): EthLog[] {
  return logs.map((l) => ({
    ...l,
    address: l.address.toLowerCase(),
    blockNumber: BigInt(l.blockNumber),
    logIndex: Number(l.logIndex),
    transactionIndex: Number(l.transactionIndex),
  }));
}

/** Convenience: fetch all logs matching filter (bounded by maxLogs). */
export async function getLogsAll(filter: LogFilter, maxLogs = 200_000): Promise<EthLog[]> {
  const out: EthLog[] = [];
  for await (const { logs } of getLogsChunked(filter)) {
    out.push(...logs);
    if (out.length >= maxLogs) break;
  }
  return out;
}

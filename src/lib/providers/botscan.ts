/**
 * BOTScan (Blockscout v2) explorer adapter — historical transactions,
 * token transfers and logs. Used as a fallback and cross-check source
 * for the RPC ingestion path.
 *
 * Verified live (docs/connectivity-report.md):
 * - GET /api/v2/addresses/{addr}/transactions — paginated, up to 50 items/page
 *   (items < 50 sometimes returns 50), cursor pagination via next_page_params.
 * - Very hot addresses can exceed 60–120s — strict timeouts + RPC fallback.
 */
import env from "@/lib/env";
import { httpJson, toQueryString } from "./http";

export type BlockscoutResult<T> =
  | { ok: true; items: T[]; nextPage: Record<string, string> | null }
  | { ok: false; error: string };

export interface BlockscoutTx {
  hash: string;
  block_number: number;
  index: number;
  from: { hash: string; is_contract: boolean };
  to: { hash: string; is_contract: boolean } | null;
  created_contract: { hash: string } | null;
  value: string;
  fee: string;
  gas_used: string | null;
  gas_price: string | null;
  status: string; // "ok" | "error"
  timestamp: string;
  method: string | null;
  type: number;
  priority_fee: string | null;
  base_fee_per_gas: string | null;
  max_fee_per_gas: string | null;
  result: string;
  raw_input: string;
}

export interface BlockscoutTokenTransfer {
  block_number: number;
  tx_hash: string | null;
  from: { hash: string } | null;
  to: { hash: string } | null;
  total: { value: string; decimals: string | null };
  token: { address: string; symbol: string | null; name: string | null; decimals: string | null; type: string };
  timestamp: string;
}

export interface BlockscoutLog {
  block_number: number;
  block_hash: string;
  transaction_hash: string;
  index: number;
  address: { hash: string } | string;
  topics: string[] | null;
  data: string | null;
  smart_contract?: { name?: string | null };
}

export interface BlockscoutTokenInfo {
  address: string;
  symbol: string | null;
  name: string | null;
  decimals: string | null;
  type: string;
  exchange_rate: string | null;
  total_supply: string | null;
  holders_count?: string | null;
}

export interface BlockscoutAddressCounters {
  transactions_count: string | null;
  token_transfers_count: string | null;
  validations_count?: string | null;
}

async function listEndpoint<T>(
  path: string,
  params: Record<string, string | number | undefined>,
  timeoutMs = 45_000,
): Promise<BlockscoutResult<T>> {
  const base = env.BOTSCAN_API_URL.replace(/\/$/, "");
  const url = `${base}${path}?${toQueryString(params)}`;
  const res = await httpJson<{ items?: T[]; next_page_params?: Record<string, unknown> | null }>(url, {
    timeoutMs,
    retries: 1,
  });
  if (!res.ok) return { ok: false, error: res.error };
  if (!res.data.items) return { ok: false, error: `unexpected response shape from ${path}` };
  const nextPage = res.data.next_page_params
    ? Object.fromEntries(Object.entries(res.data.next_page_params).map(([k, v]) => [k, String(v)]))
    : null;
  return { ok: true, items: res.data.items, nextPage };
}

export async function getAddressTransactions(
  address: string,
  items = 50,
  pageParams?: Record<string, string> | null,
): Promise<BlockscoutResult<BlockscoutTx>> {
  return listEndpoint<BlockscoutTx>(
    `/v2/addresses/${address.toLowerCase()}/transactions`,
    { items, ...(pageParams ?? {}) },
  );
}

export async function getAddressTokenTransfers(
  address: string,
  items = 50,
  pageParams?: Record<string, string> | null,
): Promise<BlockscoutResult<BlockscoutTokenTransfer>> {
  return listEndpoint<BlockscoutTokenTransfer>(
    `/v2/addresses/${address.toLowerCase()}/token-transfers`,
    { items, ...(pageParams ?? {}) },
  );
}

export async function getAddressLogs(
  address: string,
  items = 50,
  pageParams?: Record<string, string> | null,
): Promise<BlockscoutResult<BlockscoutLog>> {
  return listEndpoint<BlockscoutLog>(
    `/v2/addresses/${address.toLowerCase()}/logs`,
    { items, ...(pageParams ?? {}) },
  );
}

export async function getTokenInfo(address: string): Promise<BlockscoutResult<BlockscoutTokenInfo>> {
  const base = env.BOTSCAN_API_URL.replace(/\/$/, "");
  const res = await httpJson<BlockscoutTokenInfo>(
    `${base}/v2/tokens/${address.toLowerCase()}`,
    { timeoutMs: 30_000, retries: 1 },
  );
  if (!res.ok) return { ok: false, error: res.error };
  if (!res.data.address) return { ok: false, error: "unexpected token response" };
  return { ok: true, items: [], nextPage: null, ...(res.data as object) } as never;
}

export async function getAddressCounters(
  address: string,
): Promise<BlockscoutResult<BlockscoutAddressCounters>> {
  const base = env.BOTSCAN_API_URL.replace(/\/$/, "");
  const res = await httpJson<BlockscoutAddressCounters>(
    `${base}/v2/addresses/${address.toLowerCase()}/counters`,
    { timeoutMs: 30_000, retries: 1 },
  );
  if (!res.ok) return { ok: false, error: res.error };
  return { ok: true, items: [], nextPage: null, ...(res.data as object) } as never;
}

/** First-ever transaction timestamp for a wallet (wallet age for Scheme C). */
export async function getWalletFirstTxTimestamp(address: string): Promise<Date | null> {
  // Walk pages backwards is expensive; Blockscout v2 doesn't provide ascending
  // order directly. Use the address "transactions" with descending cursor until
  // exhausted OR use counters heuristic. For deep wallets this may take several
  // pages — the caller runs it as a background job, not per-request.
  let cursor: Record<string, string> | null = null;
  let last: BlockscoutTx | null = null;
  let pages = 0;
  for (;;) {
    const page = await getAddressTransactions(address, 50, cursor ?? undefined);
    if (!page.ok || page.items.length === 0) break;
    last = page.items[page.items.length - 1];
    cursor = page.nextPage;
    pages++;
    if (!cursor || pages > 400) break; // bounded walk (400 pages ≈ 20k txs)
  }
  return last?.timestamp ? new Date(last.timestamp) : null;
}

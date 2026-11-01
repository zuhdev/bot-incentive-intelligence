# BOT Chain Data Connectivity Report

**Status: ALL FIVE POC REQUIREMENTS PROVEN WITH LIVE DATA.**

- PoC run date: 2026-11-01 (UTC)
- Probe script: `scripts/poc/run-all.ts` — run with `npm run poc`
- Raw machine-readable results are generated locally at `docs/poc-results.json` by `npm run poc`; the large response dump is intentionally excluded from Git. The summarized, verified requests and response schemas are documented below.
- Every value below came from a real network request. Nothing is mocked.
- Result: 17/18 probes passed. The single failure is the *expected* unfiltered
  full-range `eth_getLogs` timeout — the documented public RPC limitation.

---

## 1. BOT Chain mainnet RPC

**Endpoint:** `POST https://rpc.botchain.ai` (JSON-RPC 2.0, no authentication)

| Method | Result | Notes |
|---|---|---|
| `eth_chainId` | `0x2a5` (677) | Matches documented mainnet chain ID. |
| `eth_blockNumber` | `0x1b56a93` → 28,662,163 at test time | ~1 block/sec block rate (verified against Blockscout timestamps). |
| `eth_getBalance` | OK | Returned balance for live trader address. |
| `eth_getTransactionCount` | OK | |
| `eth_getBlockByNumber` | OK | Full block body with tx list. Note: blocks expose non-standard `milliTimestamp`; standard `timestamp` field is present and correct. `baseFeePerGas` observed as `0x0` on many blocks — priority fees still exist (confirmed via Blockscout `priority_fee`). |
| `eth_getTransactionReceipt` | OK | Includes `status`, `gasUsed`, `from`, `to`. |
| `eth_getLogs` (unfiltered, full chain range) | **FAILS** — request aborted >30 s | Confirms the documented limitation for wide unfiltered ranges. |
| `eth_getLogs` (filtered by address + topic) | **WORKS** | 27,296 Swap logs retrieved over a 350,000-block window in ~50 s. Recent 20-block unfiltered-by-topic query returned 29 logs in <1 s. |

**Implication for architecture:** historical event ingestion must use *filtered*
`eth_getLogs` (per address/topic) with chunked ranges and checkpoints, and/or
the explorer API as an alternative source. Unfiltered full-range scans are not
viable on the public RPC.

**Testnet:** `https://rpc.bohr.life` (chain 968) configured in `.env.example`;
same adapter code path.

## 2. Historical wallet transaction retrieval — BOTScan (Blockscout v2)

**Endpoint:** `GET https://scan.botchain.ai/api/v2/addresses/{address}/transactions?items=N`

- Live response: 50 historical transactions for a real trader address, with
  `hash`, `from`, `to`, `value`, `timestamp`, `status`, decoded `method`.
- Observed history depth in sample: 2026-10-29 → 2026-10-31 for that wallet
  (pagination via `next_page_params` reaches deeper; pool-contract queries
  showed August/September 2026 transactions).
- Pagination: cursor style — `next_page_params: { block_number, index, items }`
  must be passed as query params for the next page.
- **Quirk:** the endpoint ignores `items < 50` on some addresses (returns 50).
  Plan for page sizes up to 50.
- **Limitation:** for very hot addresses (e.g. the USDT/WBOT pool, ~9.4k tx/24h)
  some Blockscout queries (token-transfers, logs) exceeded 60–120 s and timed
  out. Adapters therefore apply timeouts + RPC fallback + caching. Cold
  addresses respond in 1–7 s.

## 3. ERC-20 token transfer retrieval

**Endpoint:** `GET https://scan.botchain.ai/api/v2/addresses/{address}/token-transfers?items=N`

- Live response for trader `0xf76e…e07c`: 50 transfers in ~1.1 s across WBOT
  (18 decimals) and USDT (6 decimals), each with `token.symbol`,
  `total.decimals`, `total.value`, `from`, `to`, `timestamp`.
- Freshness: transfers seconds old were present in the first page.
- Native BOT balances come from the RPC (`eth_getBalance`); token balances
  historically can be reconstructed from transfer logs.

## 4. Historical contract events despite the eth_getLogs limitation

Two verified paths, used as fallbacks for each other:

1. **Filtered RPC `eth_getLogs`** — `POST https://rpc.botchain.ai` with
   `{ fromBlock, toBlock, address, topics }`:
   - 27,296 Swap logs (`0xc42079f9…` Uniswap-V3-style signature) over 350k
     blocks for pool `0x64f4…ec05` (BDEX USDT/WBOT, feeTier 3000).
   - Chunked + filtered, this is a viable primary ingestion path.
2. **Explorer logs** — `GET /api/v2/addresses/{address}/logs?items=N`:
   - 50 historical log items with `block_number`, `topics`, `data`,
     `transaction_hash`, `index` (slow for hot addresses — 40–50 s observed).

**Notable on-chain finding:** BDEX V3 pools are Uniswap-V3-compatible
(Swap/Mint/Burn topic signatures verified). V3 pools do not emit ERC-20
`Transfer` events themselves — token transfers occur on the token contracts.
The ingestion pipeline decodes `Swap` (int256 amounts via two's complement),
`Mint`, `Burn` and `Transfer` topics.

## 5. BDEX public API

**Base URL (from the official Apifox spec):** `https://dex-wallet.botchain.ai`
No authentication required. Envelope: `{ success: boolean, data: string }` —
`data` is a JSON-encoded string that must be parsed again. Business errors
return HTTP 200 with `success: false` and an `error`/`code` field.

Verified live endpoints (all `success: true`):

| Endpoint | Verified params | Live result |
|---|---|---|
| `GET /api/v1/pairs` | `pool_type=all\|v2\|v3` | 53 pairs, `{chain_id: 677, pair, poolType, token0, token1}` |
| `GET /api/v1/pools` | `pool_type` | 20 pools; sample: `USDT/WBOT` poolId `0x64f4…ec05`, volumeUsd24 ≈ $2.09M, transactionsH24 ≈ 9.4k, feeTier 3000, feeApr, tvlChangePercent, volumeChangePercent |
| `GET /api/v1/pool-charts` | **`pool`** (not `pool_id`) | 168 OHLCV points: `periodStartUnix`, `open/high/low/close`, `volumeUSD`, `feesUSD`, `tvlUSD` |
| `GET /api/v1/pool-liquidity-distribution` | `pool` | Full V3 tick map: 73 ticks, `currentTick`, `currentPrice`, per-tick `liquidityNet`/`liquidityGross` + USD values |
| `GET /api/v1/v2/lp-positions` | **`owner`** (V2 positions only) | Returns `[]` for an owner with no V2 positions (works). V3 positions are NFTs — NOT covered by this endpoint. |
| `GET /api/v1/klines/pair/summary` | requires `pair`, `sell`, `buy` | Error envelope confirms required params; not yet used by the product. |

Freshness: 24h rolling metrics; chart points at ~hourly granularity.

## 6. DeFiLlama

**Endpoints verified (no auth):**

- `GET https://api.llama.fi/chains` → `BOT Chain` present, `chainId: 677`,
  TVL ≈ $32.03M.
- `GET https://api.llama.fi/protocols` → protocols on BOT Chain: **BDEX V3**
  (slug `bdex-v3`, TVL ≈ $31.2M), **BDEX V2** (`bdex-v2`, ≈ $0.84M), vfat.io,
  DexLaunch, BOT Oracle.
- `GET https://api.llama.fi/protocol/bdex-v3` → historical
  `chainTvls["BOT Chain"].tvl`: **70 daily points**, 2026-08-24 → 2026-10-31
  ($30.93M → $31.20M). Historical coverage begins 2026-08-24 — Scheme D
  reports must disclose coverage limits before that date.

## Architecture consequences (implemented in this repo)

1. **Provider adapters** with health checks — no business logic calls external
   APIs directly (`src/lib/providers/*`).
2. **Chunked, checkpointed, filtered** `eth_getLogs` ingestion; explorer as
   fallback; timeouts + retries + rate-limit handling.
3. **Envelope-aware BDEX client** (double-parse `data` string).
4. **DeFiLlama slug configuration** — protocol slug is configured per project
   (`DEFAULT_BOT_PROTOCOL_SLUG=bdex-v3` verified), never guessed from names.
5. **Honest data states** — provider outages, historical coverage limits and
   slow-explorer timeouts surface as `INSUFFICIENT DATA`, never as zeros.

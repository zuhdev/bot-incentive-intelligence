# BOT Chain testnet data verification

**Verified:** 2026-11-01 UTC. Requests below were made against live BOT Chain testnet services; no fixtures were used.

## RPC

Endpoint: `https://rpc.bohr.life` (JSON-RPC 2.0, no authentication)

| Request | Live result |
|---|---|
| `eth_chainId` | `0x3c8` (968) |
| `eth_blockNumber` | `0x1b8a3a9` on the initial probe; the endpoint advanced on subsequent probes |
| `eth_getBlockByNumber` | returned full block object; the latest block sampled at a later request had no transactions |
| `eth_getTransactionReceipt` for `0xa5048dd5fea9db9eeffee9c03050a85ff0680e63a15c6321ec5c8cc45cf97263` | status `0x1`, block `0x1b8a7d0`, 8 logs |
| Filtered `eth_getLogs` | accepted a 10-block Transfer-topic query and returned `[]`; this proves method availability for the query, not historical completeness |

## BOTScan / Blockscout v2

Base: `https://scan.bohr.life/api`

| Request | Live result |
|---|---|
| `GET /api/v2/blocks?items=1` | HTTP 200; returned block 28,877,735 with timestamp `2026-11-01T07:23:05.000000Z` (the query requests one item; Blockscout may return more than one) |
| `GET /api/v2/transactions?filter=validated` | HTTP 200; 50 transactions returned. Sample transaction `0xa5048dd5…cf97263`, block 28,878,800, timestamp `2026-11-01T07:36:23.000000Z` |
| `GET /api/v2/addresses/0xBFBdEF371AAeC4018112125BDbD8F34CbBD6db30/transactions?items=5` | HTTP 200; 50 transactions returned, first hash matched the live transaction list |
| `GET /api/v2/addresses/0x55DA37AbbF8C9141adA4Dd1C2eF7211c0483eC16/token-transfers?items=5` | HTTP 200; 24 transfers returned; sample token symbol `USDT-QUIRK`, sample tx `0x2860a90d…ea8e305` |

The `items=5` request returned 50 rows, matching the mainnet observation that this deployment may use a fixed page size. Cursor pagination must be followed until `next_page_params` is absent.

## Testnet data-source boundaries

- RPC and BOTScan are configured as the active providers when `BOT_NETWORK=testnet`.
- BOTScan historical transaction and token-transfer retrieval were verified with live testnet data.
- BDEX's verified public API is mainnet-only; app requests are blocked in testnet mode and health reports it as unavailable on the selected network.
- DeFiLlama BOT Chain TVL is mainnet data; it is not imported or used in testnet mode.
- BOT price from the mainnet WBOT pool is disabled in testnet mode.
- A testnet `eth_getLogs` request succeeded, but no exhaustive historical testnet log coverage has been established.
- Testnet RPC historical pruning, rate limits, and event-index coverage have not been exhaustively measured. The configured chunked/checkpointed path is retained; a production historical backfill must be monitored.

Testnet metrics may be useful for integration tests, but they cannot establish mainnet incentive eligibility or evidence.

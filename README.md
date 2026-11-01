# BOT Incentive Intelligence

Independent BOT Chain ecosystem **incentive monitoring, readiness and evidence platform** for projects building on BOT Chain.

> **Independent product disclaimer** — This is NOT an official BOT Chain product. It never claims to approve, certify or guarantee ecosystem rewards. BOT Chain retains authority over official eligibility, Sybil detection, application review and reward distribution. All results are preliminary calculations based on publicly documented rules and available evidence.

---

## What it does

1. **Which programmes can my project qualify for?** — maps registered addresses against every published incentive programme.
2. **How close am I to each requirement?** — every metric shows value, target, progress, period, source and confidence.
3. **What is blocking qualification?** — explicit missing requirements, risk indicators and unresolved interpretations.
4. **Can I prove my performance?** — deterministic, hash-stamped evidence reports with full data provenance.

### Eligibility statuses (never a single unsupported percentage)

`VERIFIED` · `PROVISIONAL` · `AT RISK` · `NOT MET` · `INSUFFICIENT DATA` · `MANUAL REVIEW`

Unavailable data is **never presented as zero**; unverified assets are **never counted as qualified**; unresolved rule interpretations are **never used for definitive verdicts**.

---

## Quick start

Requirements: Node.js 20+ (tested on 24), npm. No Docker/Postgres/Redis required for local dev.

```bash
npm install
cp .env.example .env      # local defaults work out of the box (SQLite)
npm run db:migrate        # create local schema + apply migrations
npm run db:seed           # seed versioned scheme definitions + verified asset entries
npm test                  # 35 unit tests (calculators, pure functions)
npm run poc               # live connectivity proof against BOT Chain/BDEX/DeFiLlama
npm run build && npm start # production build + serve
# or
npm run dev               # dev server
```

Open http://localhost:3000 — landing page; http://localhost:3000/dashboard — workspace.

## Testnet deployment

Testnet deployment uses BOT Chain chain ID 968 (`https://rpc.bohr.life`) and requires managed PostgreSQL plus a separate worker/Redis service. Follow [`docs/testnet-deployment.md`](docs/testnet-deployment.md); live testnet RPC and Blockscout v2 checks are recorded in [`docs/testnet-data-verification.md`](docs/testnet-data-verification.md).

Runtime network selection is controlled by `BOT_NETWORK=mainnet|testnet`. Testnet data is explicitly excluded from incentive eligibility outputs. Verified mainnet-only BDEX and DeFiLlama TVL integrations are disabled rather than reused in testnet mode.

### Live-data smoke test (real network calls)

```bash
npx tsx scripts/smoke/e2e.ts
```

Creates a labelled demo project, imports live DeFiLlama TVL history, ingests a live wallet from BOTScan, runs the rules engine and generates a hashed evidence report.

### Background worker (optional locally, required in production)

```bash
npm run worker
```

Scheduled jobs: tail block/event ingestion, TVL snapshots, provider health checks, BOT price refresh. Uses BullMQ when `REDIS_URL` is set; otherwise an in-process scheduler.

---

## Feature status matrix

### Fully implemented and tested
| Feature | Evidence |
|---|---|
| BOT Chain RPC adapter (chunked/filtered getLogs, adaptive backoff) | `src/lib/providers/rpc.ts`, PoC: 27,296 logs / 350k blocks |
| BOTScan (Blockscout v2) adapter: txs, token transfers, logs, counters | `src/lib/providers/botscan.ts`, PoC + E2E |
| BDEX adapter (pairs, pools, charts, tick liquidity, V2 LP positions) | `src/lib/providers/bdex.ts`, PoC: all endpoints live |
| DeFiLlama adapter (chains, protocols, historical BOT Chain TVL) | `src/lib/providers/defillama.ts`, 69 daily snapshots imported |
| Price resolution with provenance (DeFiLlama → BDEX pool-derived) | `src/lib/providers/prices.ts` (BOT $12.40 pool-derived, live) |
| Rules engine: versioned definitions, unresolved-interpretation flags | `src/lib/rules/definitions.ts`, seeded via `prisma/seed.ts` |
| Scheme C calculator (balances, age, caps, dedupe, rolling windows, funding clusters, dual-tier scenarios) | `src/lib/rules/schemes/scheme-c.ts` + 14 unit tests |
| Scheme D calculator (qualified TVL, streaks, rate buckets, quarterly, $1M cap) | `src/lib/rules/schemes/scheme-d.ts` + 11 unit tests |
| Scheme A calculator (LP streaks, volume, concentration, attribution) | `src/lib/rules/schemes/scheme-a.ts` + 6 unit tests |
| Gas rebate calculator (tier interpolation, estimates) | `src/lib/rules/schemes/gas-rebate.ts` + 4 unit tests |
| Checkpointed event ingestion with deterministic ids | `src/lib/ingestion/runner.ts`, `events.ts` |
| Wallet ingestion (activity, first-seen, balances, funding clusters) | `src/lib/ingestion/wallets.ts`, E2E: 50 txs + 50 transfers |
| TVL snapshot ingestion (00:00 UTC normalisation) | `src/lib/ingestion/tvl.ts`, E2E: 69 points |
| Evidence Centre (deterministic hash, manifest, JSON/CSV export) | `src/lib/evidence.ts`, E2E: hashed report |
| Wallet-signature auth (challenge/response, hashed sessions, RBAC) | `src/lib/auth.ts` |
| Provider health monitoring | `src/lib/providers/health.ts`, live in-app status |
| Landing page, dashboard, project workspace, programme reference, alerts, settings UI | `src/app/**` |
| API surface (auth, projects, addresses, evaluate, ingest, evidence, alerts, health, schemes) | `src/app/api/**` |
| Environmental validation, rate limiting, input validation (zod), audit-safe error handling | `src/lib/env.ts`, `src/lib/api.ts` |
| BOT mainnet/testnet selection, wallet chain switching, testnet eligibility guard | `/api/network`, `src/lib/env.ts`, `src/lib/rules/evaluate.ts` |
| PostgreSQL deployment schema + initial migration, isolated from local SQLite migrations | `prisma/postgres/`, `npm run db:deploy:postgres` |
| Testnet EvidenceReportAnchor contract deployed and RPC/Blockscout verified | `contracts/EvidenceReportAnchor.sol`, `deployments/bot-testnet-evidence-anchor.json` |

### Implemented but awaiting external credentials/infrastructure
| Feature | What's needed |
|---|---|
| BullMQ job queue | `REDIS_URL` (worker auto-switches; `bullmq` package added to deployment image) |
| Managed PostgreSQL and Redis instances | Supply the testnet `DATABASE_URL` and `REDIS_URL` through the deployment secret manager; the schema, migrations, and BullMQ adapter are included |
| CoinGecko API key | optional; raises rate limits (`COINGECKO_API_KEY`) |
| Telegram/email alert delivery | architecture supports channels; not built (in-app only in MVP) |

### Partially implemented
| Feature | Gap |
|---|---|
| Scheme B (CEX listing) | Manual evidence model + definitions done; automated CMC rank snapshots blocked (ranking source unresolved) |
| Scheme A live ingestion | Calculator + rules done; per-pair swap aggregation job wired through tail ingestion, needs sustained runtime + multi-pair volume to populate dashboards |
| PDF evidence export | JSON + CSV implemented; PDF renderer not included in MVP |
| Wallet verification for project addresses | Auth-level signature proof exists; per-address marking is manual in MVP |

### Blocked by unavailable external data
| Item | Blocker |
|---|---|
| BOT/USD from CoinGecko/DeFiLlama | BOT token not listed on CoinGecko (verified 2026-11-01); BDEX pool-derived price used as documented fallback |
| Scheme D qualified TVL | Complete approved-asset whitelist not public — registry is seeded conservatively (BOT qualified; USDT/WBOT pending_review) |
| Historical TVL before 2026-08-24 | DeFiLlama's BOT Chain series for bdex-v3 starts 2026-08-24 — coverage disclosed, never zero-filled |
| Deep unfiltered log scans | Public RPC times out on wide unfiltered `eth_getLogs` (verified); filtered chunked queries + explorer fallback used |

### Awaiting official clarification from BOT (unresolved interpretations)
1. **Scheme C tier dimension** — daily vs cumulative thresholds; both scenarios computed, results PROVISIONAL.
2. **Scheme C shared-funding groups** — exact group-formation rules (10% adjustment applied as seed).
3. **Scheme A first-tx-24h restriction** — interpretation unresolved; not applied as definitive rule.
4. **Scheme A 20% BOT-pair enhancement** — conditions provisional.
5. **Scheme D approved-asset whitelist** — registry configurable pending official list.
6. **Gas rebate curve** — linear interpolation between published anchors ($50k/10% → $500k/35%); curve unresolved.
7. **Scheme B qualifying exchange list + ranking snapshot source** — unresolved.

---

## Project structure

```
├─ prisma/                  SQLite dev schema + migrations; PostgreSQL schema/migrations + seed
├─ scripts/poc/             live connectivity proof (npm run poc)
├─ scripts/smoke/           E2E smoke test against live providers
├─ src/app/                 Next.js App Router (frontend + API routes)
├─ src/components/          UI primitives, status badges, scheme pages
├─ src/lib/
│  ├─ providers/            rpc, botscan, bdex, defillama, prices, health
│  ├─ rules/                engine: definitions, calculators, evaluation
│  ├─ ingestion/            runner (checkpoints), events, wallets, tvl, scheduler
│  ├─ calcs/                exact-decimal helpers
│  └─ auth.ts, evidence.ts, overview.ts, chains.ts, api.ts, db.ts, env.ts
├─ workers/ingest.ts        standalone ingestion worker
├─ tests/                   35 unit tests (pure fixtures, no network)
└─ docs/                    connectivity reports, testnet deployment/data checks,
                            poc-results.json
```

## Key documents

- `docs/connectivity-report.md` — **live verification of every external integration** (requests, responses, limits, freshness)
- `docs/testnet-data-verification.md` — live BOT testnet RPC, explorer, transaction and token-transfer checks
- `docs/testnet-deployment.md` — Vercel/Node deployment, PostgreSQL migrations, worker/Redis and smoke checks

The testnet EvidenceReportAnchor address and deployment transaction are documented in `docs/testnet-deployment.md`. Its deployment record contains no wallet key; the local deployer key stays in the ignored `.secrets/` directory.

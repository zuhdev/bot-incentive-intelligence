# BOT Chain mainnet deployment

This runbook deploys the **mainnet** environment. BOT Chain mainnet is chain ID **677**, RPC `https://rpc.botchain.ai`, explorer `https://scan.botchain.ai`. Live endpoint checks are recorded in [`connectivity-report.md`](./connectivity-report.md). Mainnet is the only network that produces incentive eligibility evidence; testnet results are suppressed by design.

> Independent product disclaimer — this is NOT an official BOT Chain product. It never claims to approve, certify or guarantee ecosystem rewards. BOT Chain retains authority over official eligibility, Sybil detection, application review and reward distribution. All results are preliminary calculations based on publicly documented rules and available evidence.

Deploy a dedicated mainnet stack. Never share PostgreSQL, Redis, or app instances with the testnet environment; network-specific data must not cross deployments.

## Deployment topology

- **Web/API:** Vercel (Next.js App Router).
- **Database:** managed PostgreSQL with TLS, used for workspaces, ingestion, alerts and evidence persistence. A database-free read-only preview is also supported.
- **Worker:** separate always-on Node service running `npm run worker` for sustained ingestion (Vercel functions must not run the worker).
- **Queue:** managed Redis for BullMQ when the worker is independently deployed.

The default `prisma/schema.prisma` remains SQLite for local development. The checked-in PostgreSQL migration lives in `prisma/postgres/` and is used explicitly by production commands.

## Required environment

Full-persistence mainnet deployment: start from [`.env.mainnet.example`](../.env.mainnet.example) and provide real managed-service values through the hosting platform's secret manager.

```dotenv
NODE_ENV=production
BOT_NETWORK=mainnet
DATABASE_URL=postgresql://...?...sslmode=require
DIRECT_DATABASE_URL=postgresql://...?...sslmode=require
REDIS_URL=rediss://...
NEXT_PUBLIC_APP_URL=https://your-app.example
BDEX_API_ENABLED=true
```

**Set `BOT_NETWORK=mainnet` explicitly.** If omitted, production defaults to the testnet network; mainnet incentive evaluation only runs when `BOT_NETWORK=mainnet`. `BOT_NETWORK` is read at build and runtime, so rebuild whenever it changes. Mainnet RPC, chain ID and explorer defaults are supplied by the application; override them only for a verified alternative provider.

For a database-free read-only preview, omit `DATABASE_URL`, `DIRECT_DATABASE_URL`, and `REDIS_URL`. Public pages, programme references, network metadata and live mainnet provider checks work; wallet sign-in, workspaces, ingestion, alerts, and evidence persistence stay disabled.

In mainnet mode BDEX and DeFiLlama BOT Chain TVL are enabled (they are blocked in testnet mode). Set `BDEX_API_ENABLED=false` only to disable BDEX deliberately; DeFiLlama's BOT Chain TVL remains enabled.

For a pooled PostgreSQL provider, use its pooled endpoint for `DATABASE_URL` and its direct/unpooled endpoint for `DIRECT_DATABASE_URL` (used by migrations). Secrets must be configured in the host dashboard, not committed.

## PostgreSQL migration and seed

Run from the project root with `BOT_NETWORK=mainnet` and database URLs available:

```bash
npm ci
npm run db:prepare:postgres
npm run db:generate:postgres
npm run db:deploy:postgres
npm run db:seed
npm run build:postgres
```

- `db:deploy:postgres` applies the checked-in PostgreSQL migration. Run migrations as a release/pre-deploy step, not concurrently from every web instance.
- `db:seed` creates the versioned rules and the mainnet asset registry: native BOT is seeded **qualified** (published Scheme D rate table), while USDT and WBOT are seeded `pending_review` until the official whitelist is published. Re-run `db:seed` after rule-definition updates; it upserts.
- To generate a schema-change migration, set `SHADOW_DATABASE_URL` to a disposable PostgreSQL database, run `npm run db:prepare:postgres && npm run db:diff:postgres`, review the timestamped SQL under `prisma/postgres/migrations/`, then commit it. Do not point Prisma's SQLite migration directory at PostgreSQL.

## Vercel web/API service

1. Import the repository into Vercel and configure the project root.
2. Add the environment variables above as protected variables in Production (and Preview if needed). At minimum set `BOT_NETWORK=mainnet` and `NEXT_PUBLIC_APP_URL`.
3. The included `vercel.json` builds with `npm run build:postgres`; the Prisma generator uses a build-only placeholder URL and does not connect to a database.
4. Run the migration and seed steps as a release step before the rollout (locally with the production URLs, or in CI).
5. Deploy. Verify `GET /api/network` returns `network: "mainnet"`, `chainId: 677`, `incentiveEvidenceNetwork: true`, and `databaseConfigured` matching the selected mode; verify `GET /api/health` reports RPC, BOTScan, BDEX and DeFiLlama operational.
6. Configure function duration/region based on the Vercel plan and database region. Long historical ingestion belongs in the worker service, not a user-facing request.

## Worker service

Create a separate Railway/Render/container service from the same revision with the same `DATABASE_URL`, `DIRECT_DATABASE_URL`, `NEXT_PUBLIC_APP_URL`, `BOT_NETWORK=mainnet`, plus `REDIS_URL`. Start command:

```bash
npm run worker
```

The worker uses BullMQ repeatable jobs when `REDIS_URL` is configured, otherwise an in-process scheduler. In mainnet mode it imports DeFiLlama TVL, refreshes BOT price, and can tail mainnet events. Follow the connectivity-report ingestion limits: wide unfiltered `eth_getLogs` ranges fail on the public RPC; use filtered, chunked queries (`INGEST_LOG_CHUNK`, `INGEST_BACKFILL_MAX_BLOCKS`). Health-check its logs and provider rows after startup.

## Container deployment alternative

The repository includes a Dockerfile whose image defaults to `BOT_NETWORK=mainnet`:

```bash
docker build \
  --build-arg DATABASE_URL='postgresql://build:build@127.0.0.1:5432/build?schema=public' \
  --build-arg DIRECT_DATABASE_URL='postgresql://build:build@127.0.0.1:5432/build?schema=public' \
  -t bot-incentive-intelligence:mainnet .
```

Supply production secrets at runtime. Run one container with `npm start` and another from the same image with `npm run worker`. Apply migrations as a separate release step. For a testnet image pass `--build-arg BOT_NETWORK=testnet`.

## Evidence anchor deployment

`EvidenceReportAnchor` was deployed and independently verified on mainnet:

- Address: [`0x5a07beab87972ab36975b2d5642cc162ac186741`](https://scan.botchain.ai/address/0x5a07beab87972ab36975b2d5642cc162ac186741)
- Deployment transaction: [`0x88d38ddb6547e496fc22ecd313827845426c62a40eaac9851651e3ab1500d8ae`](https://scan.botchain.ai/tx/0x88d38ddb6547e496fc22ecd313827845426c62a40eaac9851651e3ab1500d8ae)
- Chain ID 677 · block 29,124,799 · gas used 109,193 · fee 0.00218386 BOT at the observed 20 gwei gas price.
- RPC runtime code and successful receipt were checked; Blockscout returned HTTP 200 and `is_contract: true`.
- Compiler, EVM target, and source SHA-256 are in `deployments/bot-mainnet-evidence-anchor.json`.

The contract emits a report hash and project-identity hash only. It does not validate report contents, prove ownership, certify eligibility, or imply BOT Foundation approval. No report hash has yet been anchored.

Recheck with `BOT_NETWORK=mainnet npm run contract:mainnet:verify` (PowerShell: `$env:BOT_NETWORK='mainnet'; npm run contract:mainnet:verify`). To redeploy or deploy from a fresh account:

1. Create the dedicated deployer account locally (hot key, minimally funded) or import an existing account as `.secrets/bot-mainnet-deployer.json` with fields `{ address, chainId: 677, privateKey }`:

   ```bash
   npm run wallet:mainnet:create
   ```

2. Fund the printed address with only the BOT needed for deployment, then confirm balance and mainnet connectivity:

   ```bash
   npm run wallet:mainnet:balance
   ```

3. Deploy with explicit confirmation. The script compiles `contracts/EvidenceReportAnchor.sol` (solc, optimizer 200, EVM paris), verifies the RPC chain ID, prints the fee estimate, refuses to submit if the estimated fee exceeds the 0.5 BOT safety cap or the balance is insufficient, and writes `deployments/bot-mainnet-evidence-anchor.json` (no key material):

   ```bash
   # PowerShell
   $env:BOT_NETWORK='mainnet'; $env:CONFIRM_MAINNET_DEPLOY='1'; npm run contract:mainnet:deploy
   ```

4. Independently verify runtime code, receipt, source hash and explorer recognition:

   ```bash
   $env:BOT_NETWORK='mainnet'; npm run contract:mainnet:verify
   ```

The deployer key stays in the ignored `.secrets/` directory and must never be committed or copied into deployment artifacts.

## Pre-traffic smoke checks

1. `GET /api/network` returns mainnet, chain ID 677, RPC/explorer URLs and `incentiveEvidenceNetwork: true`.
2. `GET /api/health` reports RPC, BOTScan, BDEX and DeFiLlama operational (all four are supported in mainnet mode).
3. Database-free preview only: run the read-only smoke test with production values.

   ```bash
   # PowerShell
   $env:NODE_ENV='production'; $env:BOT_NETWORK='mainnet'; npm run smoke:readonly
   ```
4. Full stack against live data (requires the configured database; creates a labelled demo project that is safe to delete):

   ```bash
   $env:BOT_NETWORK='mainnet'; npx tsx scripts/smoke/e2e.ts
   ```
5. Open the app and connect an EIP-1193 wallet. It must request a network switch/add for BOT Chain mainnet (677), then request only a plain-text `personal_sign` message.
6. Create a project, register a mainnet address, run wallet ingestion and confirm explorer responses and native balance come from chain 677.
7. Run an evaluation. Outputs are normal mainnet evaluations (no testnet suppression); requirements with unresolved rule interpretations must remain `PROVISIONAL` or `MANUAL REVIEW`, and unavailable data must never be shown as zero.
8. Verify evidence exports carry chain ID 677, mainnet RPC/explorer references, report hash and the independent-product disclaimer.

## Mainnet data caveats

- DeFiLlama's BOT Chain TVL series starts **2026-08-24** (bdex-v3); earlier coverage is disclosed, never zero-filled.
- BOT is not listed on CoinGecko; BDEX pool-derived pricing is the documented fallback with provenance.
- Public RPC unfiltered log scans time out; filtered chunked queries and explorer fallback are used.
- Unresolved official-rule interpretations (Scheme A/C/B/D/gas rebate) remain listed in the README and are never used for definitive verdicts.

## Rollback and isolation

- Keep the mainnet and testnet PostgreSQL databases separate. The wallet address key is scoped to the deployment.
- Roll back the app image independently. Do not reverse a migration destructively without a reviewed backup/restore procedure.
- Back up PostgreSQL before migrations and configure managed point-in-time recovery.
- If a provider fails, the app reports unavailable data; it must never substitute testnet metrics into mainnet or treat missing values as zero.

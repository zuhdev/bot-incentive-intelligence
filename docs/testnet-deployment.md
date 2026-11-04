# BOT Chain testnet deployment

This runbook deploys an isolated **testnet** environment. BOT Chain testnet is chain ID **968**, RPC `https://rpc.bohr.life`, explorer `https://scan.bohr.life`. Live checks are recorded in [`testnet-data-verification.md`](./testnet-data-verification.md). The app supports a database-free read-only preview; configure PostgreSQL later to enable persistent/user-specific features.

For a temporary database-free preview, Vercel can build and serve public pages and live provider checks without `DATABASE_URL` or `DIRECT_DATABASE_URL`. In that mode wallet sign-in, workspaces, ingestion, alerts, and evidence persistence are intentionally unavailable. Add PostgreSQL and run the migration/seed steps below to enable the full application.

## Evidence anchor deployment

At the user's request, `EvidenceReportAnchor` was deployed and independently verified on testnet:

- Address: [`0x2250c8f97c71a1a9dc7d14f7281f5440d3931a65`](https://scan.bohr.life/address/0x2250c8f97c71a1a9dc7d14f7281f5440d3931a65)
- Deployment transaction: [`0x1fafb65a868d61d53466a5e0518393f7f05a13ed3f08f520a1d67752ebab6535`](https://scan.bohr.life/tx/0x1fafb65a868d61d53466a5e0518393f7f05a13ed3f08f520a1d67752ebab6535)
- Chain ID 968 · block 28,882,636 · gas used 109,193 · fee 0.00218386 BOT at the observed 20 gwei gas price.
- RPC runtime code and successful receipt were checked; Blockscout returned HTTP 200 and `is_contract: true`.
- Compiler, EVM target, and source SHA-256 are in `deployments/bot-testnet-evidence-anchor.json`.

The contract emits a report hash and project-identity hash only. It does not validate report contents, prove ownership, certify eligibility, or imply BOT Foundation approval. No report hash has yet been anchored.

Recheck with `BOT_NETWORK=testnet npm run contract:testnet:verify` (PowerShell: `$env:BOT_NETWORK='testnet'; npm run contract:testnet:verify`). The deployer private key remains in the ignored `.secrets/` file and is not part of the deployment artifact.

## Deployment topology

- **Web/API:** Vercel (Next.js App Router) or a Node container.
- **Database:** optional for preview; managed PostgreSQL with TLS for workspaces and persistence.
- **Worker:** separate always-on Node service running `npm run worker` when ingestion is enabled.
- **Queue:** managed Redis for BullMQ when the worker is independently deployed.
- Use a distinct database and Redis instance for testnet; never share the mainnet deployment's state.

The default `prisma/schema.prisma` remains SQLite for local development. The checked-in PostgreSQL migration is generated from that source schema into `prisma/postgres/` and is used explicitly by production commands.

## Required environment

For full functionality, start from `.env.testnet.example` and provide real managed-service values through the hosting platform's secret manager. For a read-only preview, omit `DATABASE_URL`, `DIRECT_DATABASE_URL`, and `REDIS_URL`:

```dotenv
NODE_ENV=production
BOT_NETWORK=testnet
DATABASE_URL=postgresql://...?...sslmode=require
DIRECT_DATABASE_URL=postgresql://...?...sslmode=require
NEXT_PUBLIC_APP_URL=https://your-testnet-app.example
REDIS_URL=rediss://... # TLS URL when supported by provider
BDEX_API_ENABLED=false
```

For a pooled PostgreSQL provider, use its pooled endpoint for `DATABASE_URL` and direct/unpooled endpoint for `DIRECT_DATABASE_URL` (used by migrations). Testnet RPC, chain ID and explorer defaults are supplied by the application. Override them only when operating a verified private/testnet provider. `BDEX_API_ENABLED=false` is explicit; BDEX and DeFiLlama's BOT Chain TVL remain blocked in testnet mode even if somebody accidentally changes that flag. Secrets must be configured in the host dashboard, not committed to this repository.

Production builds accept missing database URLs for read-only preview mode. If `DATABASE_URL` is supplied, it must be PostgreSQL; `DIRECT_DATABASE_URL` is used for migrations. Without a database, wallet sign-in, workspaces, data ingestion, alert persistence, and evidence reports are unavailable. If `BOT_NETWORK` is omitted in production, it defaults to `testnet`. `NEXT_PUBLIC_APP_URL` can be set to the custom production domain; otherwise the app derives it from Vercel's deployment URL. Sessions use random opaque tokens stored as hashes in the database; there is no separate `AUTH_SECRET` requirement.

## Enabling PostgreSQL persistence

To enable user accounts and persistent features later, run from the project root with `DATABASE_URL` and `DIRECT_DATABASE_URL` available; set `BOT_NETWORK=testnet` for clarity:

```bash
npm ci
npm run db:prepare:postgres
npm run db:generate:postgres
npm run db:deploy:postgres
npm run db:seed
npm run build:postgres
```

`db:deploy:postgres` applies the checked-in PostgreSQL migration. Run migrations as a release/pre-deploy step, not concurrently from every web instance. `db:seed` creates the versioned rules and a conservative testnet asset registry; testnet BOT is explicitly **not qualified** for mainnet incentives.

For subsequent deployments, repeat `db:deploy:postgres` before the application rollout when a migration has been added. To generate a schema-change migration, set `SHADOW_DATABASE_URL` to a disposable PostgreSQL database, run `npm run db:prepare:postgres && npm run db:diff:postgres`, review the timestamped SQL under `prisma/postgres/migrations/`, then commit it. Do not point Prisma's SQLite migration directory at PostgreSQL.

## Vercel web/API service

1. Import the repository into Vercel and configure the project root.
2. For read-only preview, no database settings are required. `BOT_NETWORK` defaults to `testnet` in production; optionally set it explicitly. The included `vercel.json` selects `npm run build:postgres`; the Prisma generator uses a build-only placeholder URL and does not connect to a database.
3. To enable persistence, add managed PostgreSQL `DATABASE_URL` and `DIRECT_DATABASE_URL` as protected environment variables, then run the migrations and seed steps above.
4. Set `NEXT_PUBLIC_APP_URL` if using a custom domain; otherwise the app derives it from Vercel's deployment URL. Rebuild whenever `BOT_NETWORK` changes so the build and runtime network stay aligned.
5. Configure function duration/region based on the Vercel plan and database region. Long historical ingestion belongs in the worker service, not a user-facing request.
6. Deploy. Verify `/api/network` reports `network: "testnet"`, `chainId: 968`, `databaseConfigured` matches the selected mode, and check `/api/health`.

Vercel does not keep a background process alive; do not run the ingestion worker inside a serverless function.

## Worker service

Create a separate Railway/Render/container service from the same revision and set the same `DATABASE_URL`, `DIRECT_DATABASE_URL`, `NEXT_PUBLIC_APP_URL`, `BOT_NETWORK=testnet`, plus `REDIS_URL`. Start command:

```bash
npm run worker
```

The worker uses BullMQ repeatable jobs when `REDIS_URL` is configured. Health-check its logs and provider rows after startup. In testnet mode the worker does not import DeFiLlama TVL or use mainnet BDEX/price data.

## Container deployment alternative

The repository includes a Dockerfile. Its image defaults to `BOT_NETWORK=mainnet`; pass `--build-arg BOT_NETWORK=testnet` for this testnet deployment. Build with deployment build args (they are used during Next's build-time environment validation, not baked into browser code):

```bash
docker build \
  --build-arg BOT_NETWORK=testnet \
  --build-arg DATABASE_URL='postgresql://build:build@127.0.0.1:5432/build?schema=public' \
  --build-arg DIRECT_DATABASE_URL='postgresql://build:build@127.0.0.1:5432/build?schema=public' \
  -t bot-incentive-intelligence:testnet .
```

Supply production secrets at runtime. Run one container with `npm start` and another from the same image with `npm run worker`. Apply migrations as a separate release step.

## Pre-traffic smoke checks

1. `GET /api/network` returns testnet, chain ID 968, RPC and explorer URLs.
2. `GET /api/health` reports RPC and BOTScan operational; BDEX and DeFiLlama are explicitly unsupported for testnet and do not make the health state degraded.
3. Open the app and connect an EIP-1193 wallet. It requests a network switch/add for BOT testnet, then requests only a plain-text `personal_sign` message.
4. Create a testnet project and register a testnet address. Project deployment defaults to `testnet`.
5. Run wallet ingestion for an address with activity. Confirm the explorer returns transactions/transfers and native balance comes from chain 968.
6. Run an evaluation. Overall programme output is `MANUAL REVIEW`, with no tier or reward estimate; testnet data is never represented as BOT mainnet eligibility.
7. Verify evidence exports carry chain ID 968, testnet RPC/explorer references, report hash and the independent-product disclaimer.

Do not use mainnet sample addresses from the PoC for testnet ingestion. They are recorded only as mainnet discovery fixtures and are not part of testnet deployment defaults.

## Rollback and isolation

- Keep the mainnet and testnet Postgres databases separate; the wallet address key is scoped to the deployment, not shared across networks in a single DB.
- Roll back the app image independently. Do not reverse a migration destructively without a reviewed backup/restore procedure.
- Back up PostgreSQL before migrations and configure managed point-in-time recovery.
- If a provider fails, the app reports unavailable data; it must not substitute mainnet metrics into testnet or treat missing values as zero.

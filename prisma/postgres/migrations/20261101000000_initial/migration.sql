-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "displayName" TEXT,
    "role" TEXT NOT NULL DEFAULT 'member',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Wallet" (
    "id" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "chainId" INTEGER NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "verifiedBy" TEXT,
    "firstSeenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,

    CONSTRAINT "Wallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthChallenge" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "nonce" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),

    CONSTRAINT "AuthChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "logoUrl" TEXT,
    "website" TEXT,
    "twitter" TEXT,
    "github" TEXT,
    "telegram" TEXT,
    "category" TEXT NOT NULL DEFAULT 'other',
    "deployStatus" TEXT NOT NULL DEFAULT 'planned',
    "defiLlamaSlug" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectMember" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'viewer',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectAddress" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "label" TEXT,
    "type" TEXT NOT NULL DEFAULT 'other',
    "chainId" INTEGER NOT NULL,
    "schemes" TEXT NOT NULL DEFAULT '[]',
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectAddress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IncentiveScheme" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'seed',
    "sourceUrl" TEXT NOT NULL,
    "notes" TEXT,

    CONSTRAINT "IncentiveScheme_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchemeVersion" (
    "id" TEXT NOT NULL,
    "schemeId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "effectiveAt" TIMESTAMP(3) NOT NULL,
    "lastVerifiedAt" TIMESTAMP(3),
    "definition" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SchemeVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IncentiveRule" (
    "id" TEXT NOT NULL,
    "schemeId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "valueType" TEXT NOT NULL DEFAULT 'string',
    "unit" TEXT,
    "description" TEXT,
    "interpretation" TEXT NOT NULL DEFAULT 'confirmed',
    "interpretationNote" TEXT,
    "version" TEXT NOT NULL,

    CONSTRAINT "IncentiveRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IncentiveMetric" (
    "id" TEXT NOT NULL,
    "schemeId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "unit" TEXT,
    "direction" TEXT NOT NULL DEFAULT 'higher_better',

    CONSTRAINT "IncentiveMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectScheme" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "schemeId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectScheme_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectMetric" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "schemeId" TEXT NOT NULL,
    "metricKey" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "value" TEXT,
    "target" TEXT,
    "progressPct" DECIMAL(65,30),
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "evaluatedAt" TIMESTAMP(3) NOT NULL,
    "rulesVersion" TEXT NOT NULL,
    "methodology" TEXT,
    "attribution" TEXT,
    "unresolved" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EligibilityResult" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "schemeId" TEXT NOT NULL,
    "schemeCode" TEXT NOT NULL,
    "tier" TEXT,
    "status" TEXT NOT NULL,
    "scorePct" DECIMAL(65,30),
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "rulesVersion" TEXT NOT NULL,
    "details" TEXT NOT NULL,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EligibilityResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Block" (
    "id" BIGINT NOT NULL,
    "chainId" INTEGER NOT NULL,
    "hash" TEXT NOT NULL,
    "parentHash" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "txCount" INTEGER NOT NULL DEFAULT 0,
    "gasUsed" BIGINT NOT NULL DEFAULT 0,
    "ingestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Block_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "hash" TEXT NOT NULL,
    "chainId" INTEGER NOT NULL,
    "blockId" BIGINT NOT NULL,
    "index" INTEGER NOT NULL,
    "from" TEXT NOT NULL,
    "to" TEXT,
    "value" TEXT NOT NULL DEFAULT '0',
    "gasUsed" TEXT NOT NULL DEFAULT '0',
    "gasPrice" TEXT NOT NULL DEFAULT '0',
    "status" INTEGER NOT NULL,
    "isContractCreation" BOOLEAN NOT NULL DEFAULT false,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "ingestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("hash")
);

-- CreateTable
CREATE TABLE "TransferEvent" (
    "id" TEXT NOT NULL,
    "chainId" INTEGER NOT NULL,
    "txHash" TEXT NOT NULL,
    "logIndex" INTEGER NOT NULL,
    "blockId" BIGINT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "contract" TEXT NOT NULL,
    "from" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "tokenDecimals" INTEGER,
    "tokenSymbol" TEXT,
    "ingestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TransferEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DexSwapEvent" (
    "id" TEXT NOT NULL,
    "chainId" INTEGER NOT NULL,
    "pool" TEXT NOT NULL,
    "poolType" TEXT NOT NULL DEFAULT 'v3',
    "txHash" TEXT NOT NULL,
    "logIndex" INTEGER NOT NULL,
    "blockId" BIGINT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "sender" TEXT,
    "recipient" TEXT,
    "txFrom" TEXT,
    "trader" TEXT,
    "attribution" TEXT NOT NULL DEFAULT 'unknown',
    "amount0" TEXT NOT NULL,
    "amount1" TEXT NOT NULL,
    "sqrtPriceX96" TEXT,
    "liquidity" TEXT,
    "tick" INTEGER,
    "volumeUsd" DECIMAL(65,30),
    "priceUsd" DECIMAL(65,30),
    "ingestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DexSwapEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiquidityEvent" (
    "id" TEXT NOT NULL,
    "chainId" INTEGER NOT NULL,
    "pool" TEXT NOT NULL,
    "poolType" TEXT NOT NULL DEFAULT 'v3',
    "kind" TEXT NOT NULL,
    "txHash" TEXT NOT NULL,
    "logIndex" INTEGER NOT NULL,
    "blockId" BIGINT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "owner" TEXT,
    "amount0" TEXT NOT NULL,
    "amount1" TEXT NOT NULL,
    "amountUsd" DECIMAL(65,30),
    "ingestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LiquidityEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletActivity" (
    "id" SERIAL NOT NULL,
    "chainId" INTEGER NOT NULL,
    "wallet" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "txHash" TEXT NOT NULL,
    "blockId" BIGINT NOT NULL,
    "toContract" TEXT,
    "methodId" TEXT,
    "status" INTEGER NOT NULL,
    "gasUsed" TEXT NOT NULL DEFAULT '0',
    "counted" BOOLEAN NOT NULL DEFAULT true,
    "ingestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WalletActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletBalanceSnapshot" (
    "id" SERIAL NOT NULL,
    "chainId" INTEGER NOT NULL,
    "wallet" TEXT NOT NULL,
    "address" TEXT,
    "symbol" TEXT,
    "decimals" INTEGER,
    "blockId" BIGINT NOT NULL,
    "balance" TEXT NOT NULL,
    "balanceUsd" DECIMAL(65,30),
    "takenAt" TIMESTAMP(3) NOT NULL,
    "ingestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WalletBalanceSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletFundingRelationship" (
    "id" SERIAL NOT NULL,
    "chainId" INTEGER NOT NULL,
    "fromWallet" TEXT NOT NULL,
    "toWallet" TEXT NOT NULL,
    "token" TEXT,
    "totalValueUsd" DECIMAL(65,30),
    "txCount" INTEGER NOT NULL DEFAULT 1,
    "firstSeen" TIMESTAMP(3) NOT NULL,
    "lastSeen" TIMESTAMP(3) NOT NULL,
    "clusterId" TEXT,
    "clusterRole" TEXT,
    "ingestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WalletFundingRelationship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TokenContract" (
    "id" TEXT NOT NULL,
    "chainId" INTEGER NOT NULL,
    "address" TEXT NOT NULL,
    "symbol" TEXT,
    "name" TEXT,
    "decimals" INTEGER,
    "verifiedAt" TIMESTAMP(3),
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TokenContract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetClassification" (
    "id" TEXT NOT NULL,
    "chainId" INTEGER NOT NULL,
    "address" TEXT NOT NULL,
    "symbol" TEXT,
    "decimals" INTEGER,
    "category" TEXT NOT NULL DEFAULT 'pending_review',
    "qualified" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT NOT NULL DEFAULT 'operator',
    "sourceUrl" TEXT,
    "effectiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssetClassification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TokenPrice" (
    "id" SERIAL NOT NULL,
    "symbol" TEXT NOT NULL,
    "address" TEXT,
    "chainId" INTEGER,
    "priceUsd" DECIMAL(65,30) NOT NULL,
    "source" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "takenAt" TIMESTAMP(3) NOT NULL,
    "ingestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TokenPrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DexPair" (
    "id" TEXT NOT NULL,
    "chainId" INTEGER NOT NULL,
    "pair" TEXT NOT NULL,
    "poolType" TEXT NOT NULL DEFAULT 'v3',
    "token0" TEXT NOT NULL,
    "token1" TEXT NOT NULL,
    "symbol0" TEXT,
    "symbol1" TEXT,
    "feeTier" INTEGER,
    "projectId" TEXT,
    "eligible" BOOLEAN NOT NULL DEFAULT false,
    "eligibilitySource" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DexPair_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiquiditySnapshot" (
    "id" SERIAL NOT NULL,
    "chainId" INTEGER NOT NULL,
    "pair" TEXT NOT NULL,
    "tvlUsd" DECIMAL(65,30) NOT NULL,
    "token0Amount" DECIMAL(65,30),
    "token1Amount" DECIMAL(65,30),
    "price0Usd" DECIMAL(65,30),
    "price1Usd" DECIMAL(65,30),
    "source" TEXT NOT NULL,
    "takenAt" TIMESTAMP(3) NOT NULL,
    "ingestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LiquiditySnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TvlSnapshot" (
    "id" SERIAL NOT NULL,
    "projectId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "protocolTvlUsd" DECIMAL(65,30),
    "chainTvlUsd" DECIMAL(65,30),
    "qualifiedTvlUsd" DECIMAL(65,30),
    "pendingTvlUsd" DECIMAL(65,30),
    "excludedTvlUsd" DECIMAL(65,30),
    "breakdown" TEXT,
    "source" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "retrievedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TvlSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GasUsageDaily" (
    "id" SERIAL NOT NULL,
    "projectId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "gasUsed" TEXT NOT NULL,
    "botSpent" DECIMAL(65,30) NOT NULL,
    "botPriceUsd" DECIMAL(65,30),
    "usdSpent" DECIMAL(65,30),
    "txCount" INTEGER NOT NULL DEFAULT 0,
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GasUsageDaily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvidenceReport" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "schemeCode" TEXT NOT NULL,
    "rulesVersion" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "reportHash" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "format" TEXT NOT NULL DEFAULT 'json',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,

    CONSTRAINT "EvidenceReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvidenceItem" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "reference" TEXT NOT NULL,
    "retrievedAt" TIMESTAMP(3) NOT NULL,
    "payload" TEXT,

    CONSTRAINT "EvidenceItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'info',
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "dedupeKey" TEXT,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataProvider" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "baseUrl" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastCheckAt" TIMESTAMP(3),
    "lastOkAt" TIMESTAMP(3),
    "lastError" TEXT,
    "latencyMs" INTEGER,
    "notes" TEXT,

    CONSTRAINT "DataProvider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IngestionJob" (
    "id" SERIAL NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "chainId" INTEGER,
    "params" TEXT,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER,
    "error" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IngestionJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IngestionCheckpoint" (
    "id" SERIAL NOT NULL,
    "jobId" INTEGER,
    "kind" TEXT NOT NULL,
    "chainId" INTEGER NOT NULL,
    "key" TEXT,
    "lastBlock" BIGINT,
    "lastDate" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IngestionCheckpoint_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Wallet_address_key" ON "Wallet"("address");

-- CreateIndex
CREATE UNIQUE INDEX "AuthChallenge_nonce_key" ON "AuthChallenge"("nonce");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectMember_projectId_userId_key" ON "ProjectMember"("projectId", "userId");

-- CreateIndex
CREATE INDEX "ProjectAddress_address_idx" ON "ProjectAddress"("address");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectAddress_projectId_address_chainId_key" ON "ProjectAddress"("projectId", "address", "chainId");

-- CreateIndex
CREATE UNIQUE INDEX "IncentiveScheme_code_key" ON "IncentiveScheme"("code");

-- CreateIndex
CREATE UNIQUE INDEX "SchemeVersion_schemeId_version_key" ON "SchemeVersion"("schemeId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "IncentiveRule_schemeId_key_version_key" ON "IncentiveRule"("schemeId", "key", "version");

-- CreateIndex
CREATE UNIQUE INDEX "IncentiveMetric_schemeId_key_key" ON "IncentiveMetric"("schemeId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectScheme_projectId_schemeId_key" ON "ProjectScheme"("projectId", "schemeId");

-- CreateIndex
CREATE INDEX "ProjectMetric_projectId_schemeId_idx" ON "ProjectMetric"("projectId", "schemeId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectMetric_projectId_schemeId_metricKey_rulesVersion_per_key" ON "ProjectMetric"("projectId", "schemeId", "metricKey", "rulesVersion", "periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "EligibilityResult_projectId_schemeCode_idx" ON "EligibilityResult"("projectId", "schemeCode");

-- CreateIndex
CREATE UNIQUE INDEX "Block_hash_key" ON "Block"("hash");

-- CreateIndex
CREATE INDEX "Block_chainId_timestamp_idx" ON "Block"("chainId", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "Block_chainId_id_key" ON "Block"("chainId", "id");

-- CreateIndex
CREATE INDEX "Transaction_chainId_blockId_idx" ON "Transaction"("chainId", "blockId");

-- CreateIndex
CREATE INDEX "Transaction_chainId_from_timestamp_idx" ON "Transaction"("chainId", "from", "timestamp");

-- CreateIndex
CREATE INDEX "Transaction_chainId_to_timestamp_idx" ON "Transaction"("chainId", "to", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_chainId_hash_key" ON "Transaction"("chainId", "hash");

-- CreateIndex
CREATE INDEX "TransferEvent_chainId_contract_timestamp_idx" ON "TransferEvent"("chainId", "contract", "timestamp");

-- CreateIndex
CREATE INDEX "TransferEvent_chainId_from_timestamp_idx" ON "TransferEvent"("chainId", "from", "timestamp");

-- CreateIndex
CREATE INDEX "TransferEvent_chainId_to_timestamp_idx" ON "TransferEvent"("chainId", "to", "timestamp");

-- CreateIndex
CREATE INDEX "TransferEvent_chainId_blockId_idx" ON "TransferEvent"("chainId", "blockId");

-- CreateIndex
CREATE UNIQUE INDEX "TransferEvent_chainId_txHash_logIndex_key" ON "TransferEvent"("chainId", "txHash", "logIndex");

-- CreateIndex
CREATE INDEX "DexSwapEvent_chainId_pool_timestamp_idx" ON "DexSwapEvent"("chainId", "pool", "timestamp");

-- CreateIndex
CREATE INDEX "DexSwapEvent_chainId_trader_timestamp_idx" ON "DexSwapEvent"("chainId", "trader", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "DexSwapEvent_chainId_txHash_logIndex_key" ON "DexSwapEvent"("chainId", "txHash", "logIndex");

-- CreateIndex
CREATE INDEX "LiquidityEvent_chainId_pool_timestamp_idx" ON "LiquidityEvent"("chainId", "pool", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "LiquidityEvent_chainId_txHash_logIndex_key" ON "LiquidityEvent"("chainId", "txHash", "logIndex");

-- CreateIndex
CREATE INDEX "WalletActivity_chainId_wallet_date_idx" ON "WalletActivity"("chainId", "wallet", "date");

-- CreateIndex
CREATE INDEX "WalletActivity_chainId_date_idx" ON "WalletActivity"("chainId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "WalletActivity_chainId_txHash_wallet_toContract_key" ON "WalletActivity"("chainId", "txHash", "wallet", "toContract");

-- CreateIndex
CREATE INDEX "WalletBalanceSnapshot_chainId_wallet_takenAt_idx" ON "WalletBalanceSnapshot"("chainId", "wallet", "takenAt");

-- CreateIndex
CREATE UNIQUE INDEX "WalletBalanceSnapshot_chainId_wallet_address_blockId_key" ON "WalletBalanceSnapshot"("chainId", "wallet", "address", "blockId");

-- CreateIndex
CREATE INDEX "WalletFundingRelationship_chainId_toWallet_idx" ON "WalletFundingRelationship"("chainId", "toWallet");

-- CreateIndex
CREATE INDEX "WalletFundingRelationship_chainId_clusterId_idx" ON "WalletFundingRelationship"("chainId", "clusterId");

-- CreateIndex
CREATE UNIQUE INDEX "WalletFundingRelationship_chainId_fromWallet_toWallet_token_key" ON "WalletFundingRelationship"("chainId", "fromWallet", "toWallet", "token");

-- CreateIndex
CREATE UNIQUE INDEX "TokenContract_chainId_address_key" ON "TokenContract"("chainId", "address");

-- CreateIndex
CREATE UNIQUE INDEX "AssetClassification_chainId_address_key" ON "AssetClassification"("chainId", "address");

-- CreateIndex
CREATE INDEX "TokenPrice_symbol_takenAt_idx" ON "TokenPrice"("symbol", "takenAt");

-- CreateIndex
CREATE UNIQUE INDEX "TokenPrice_symbol_address_takenAt_source_key" ON "TokenPrice"("symbol", "address", "takenAt", "source");

-- CreateIndex
CREATE UNIQUE INDEX "DexPair_chainId_pair_key" ON "DexPair"("chainId", "pair");

-- CreateIndex
CREATE INDEX "LiquiditySnapshot_chainId_pair_takenAt_idx" ON "LiquiditySnapshot"("chainId", "pair", "takenAt");

-- CreateIndex
CREATE UNIQUE INDEX "LiquiditySnapshot_chainId_pair_takenAt_source_key" ON "LiquiditySnapshot"("chainId", "pair", "takenAt", "source");

-- CreateIndex
CREATE INDEX "TvlSnapshot_projectId_date_idx" ON "TvlSnapshot"("projectId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "TvlSnapshot_projectId_date_source_key" ON "TvlSnapshot"("projectId", "date", "source");

-- CreateIndex
CREATE INDEX "GasUsageDaily_projectId_date_idx" ON "GasUsageDaily"("projectId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "GasUsageDaily_projectId_date_source_key" ON "GasUsageDaily"("projectId", "date", "source");

-- CreateIndex
CREATE INDEX "EvidenceReport_projectId_createdAt_idx" ON "EvidenceReport"("projectId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "EvidenceReport_projectId_schemeCode_rulesVersion_periodStar_key" ON "EvidenceReport"("projectId", "schemeCode", "rulesVersion", "periodStart", "periodEnd", "format");

-- CreateIndex
CREATE INDEX "Alert_projectId_status_idx" ON "Alert"("projectId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Alert_projectId_dedupeKey_key" ON "Alert"("projectId", "dedupeKey");

-- CreateIndex
CREATE UNIQUE INDEX "DataProvider_name_key" ON "DataProvider"("name");

-- CreateIndex
CREATE UNIQUE INDEX "IngestionCheckpoint_kind_chainId_key_key" ON "IngestionCheckpoint"("kind", "chainId", "key");

-- AddForeignKey
ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthChallenge" ADD CONSTRAINT "AuthChallenge_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectAddress" ADD CONSTRAINT "ProjectAddress_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchemeVersion" ADD CONSTRAINT "SchemeVersion_schemeId_fkey" FOREIGN KEY ("schemeId") REFERENCES "IncentiveScheme"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncentiveRule" ADD CONSTRAINT "IncentiveRule_schemeId_fkey" FOREIGN KEY ("schemeId") REFERENCES "IncentiveScheme"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncentiveMetric" ADD CONSTRAINT "IncentiveMetric_schemeId_fkey" FOREIGN KEY ("schemeId") REFERENCES "IncentiveScheme"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectScheme" ADD CONSTRAINT "ProjectScheme_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectScheme" ADD CONSTRAINT "ProjectScheme_schemeId_fkey" FOREIGN KEY ("schemeId") REFERENCES "IncentiveScheme"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMetric" ADD CONSTRAINT "ProjectMetric_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EligibilityResult" ADD CONSTRAINT "EligibilityResult_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DexPair" ADD CONSTRAINT "DexPair_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TvlSnapshot" ADD CONSTRAINT "TvlSnapshot_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GasUsageDaily" ADD CONSTRAINT "GasUsageDaily_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceReport" ADD CONSTRAINT "EvidenceReport_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceItem" ADD CONSTRAINT "EvidenceItem_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "EvidenceReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IngestionCheckpoint" ADD CONSTRAINT "IngestionCheckpoint_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "IngestionJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

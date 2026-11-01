-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT,
    "displayName" TEXT,
    "role" TEXT NOT NULL DEFAULT 'member',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Wallet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "address" TEXT NOT NULL,
    "chainId" INTEGER NOT NULL DEFAULT 677,
    "verifiedAt" DATETIME,
    "verifiedBy" TEXT,
    "firstSeenAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,
    CONSTRAINT "Wallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuthChallenge" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "walletId" TEXT NOT NULL,
    "nonce" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL,
    "consumedAt" DATETIME,
    CONSTRAINT "AuthChallenge_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL,
    CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ProjectMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'viewer',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProjectMember_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProjectMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProjectAddress" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "label" TEXT,
    "type" TEXT NOT NULL DEFAULT 'other',
    "chainId" INTEGER NOT NULL DEFAULT 677,
    "schemes" TEXT NOT NULL DEFAULT '[]',
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProjectAddress_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "IncentiveScheme" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'seed',
    "sourceUrl" TEXT NOT NULL,
    "notes" TEXT
);

-- CreateTable
CREATE TABLE "SchemeVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schemeId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "effectiveAt" DATETIME NOT NULL,
    "lastVerifiedAt" DATETIME,
    "definition" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SchemeVersion_schemeId_fkey" FOREIGN KEY ("schemeId") REFERENCES "IncentiveScheme" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "IncentiveRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schemeId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "valueType" TEXT NOT NULL DEFAULT 'string',
    "unit" TEXT,
    "description" TEXT,
    "interpretation" TEXT NOT NULL DEFAULT 'confirmed',
    "interpretationNote" TEXT,
    "version" TEXT NOT NULL,
    CONSTRAINT "IncentiveRule_schemeId_fkey" FOREIGN KEY ("schemeId") REFERENCES "IncentiveScheme" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "IncentiveMetric" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schemeId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "unit" TEXT,
    "direction" TEXT NOT NULL DEFAULT 'higher_better',
    CONSTRAINT "IncentiveMetric_schemeId_fkey" FOREIGN KEY ("schemeId") REFERENCES "IncentiveScheme" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProjectScheme" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "schemeId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProjectScheme_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProjectScheme_schemeId_fkey" FOREIGN KEY ("schemeId") REFERENCES "IncentiveScheme" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProjectMetric" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "schemeId" TEXT NOT NULL,
    "metricKey" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "value" TEXT,
    "target" TEXT,
    "progressPct" DECIMAL,
    "periodStart" DATETIME,
    "periodEnd" DATETIME,
    "evaluatedAt" DATETIME NOT NULL,
    "rulesVersion" TEXT NOT NULL,
    "methodology" TEXT,
    "attribution" TEXT,
    "unresolved" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProjectMetric_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EligibilityResult" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "schemeId" TEXT NOT NULL,
    "schemeCode" TEXT NOT NULL,
    "tier" TEXT,
    "status" TEXT NOT NULL,
    "scorePct" DECIMAL,
    "periodStart" DATETIME NOT NULL,
    "periodEnd" DATETIME NOT NULL,
    "rulesVersion" TEXT NOT NULL,
    "details" TEXT NOT NULL,
    "calculatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EligibilityResult_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Block" (
    "id" BIGINT NOT NULL PRIMARY KEY,
    "chainId" INTEGER NOT NULL,
    "hash" TEXT NOT NULL,
    "parentHash" TEXT NOT NULL,
    "timestamp" DATETIME NOT NULL,
    "txCount" INTEGER NOT NULL DEFAULT 0,
    "gasUsed" BIGINT NOT NULL DEFAULT 0,
    "ingestedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Transaction" (
    "hash" TEXT NOT NULL PRIMARY KEY,
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
    "timestamp" DATETIME NOT NULL,
    "ingestedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "TransferEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "chainId" INTEGER NOT NULL,
    "txHash" TEXT NOT NULL,
    "logIndex" INTEGER NOT NULL,
    "blockId" BIGINT NOT NULL,
    "timestamp" DATETIME NOT NULL,
    "contract" TEXT NOT NULL,
    "from" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "tokenDecimals" INTEGER,
    "tokenSymbol" TEXT,
    "ingestedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "DexSwapEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "chainId" INTEGER NOT NULL,
    "pool" TEXT NOT NULL,
    "poolType" TEXT NOT NULL DEFAULT 'v3',
    "txHash" TEXT NOT NULL,
    "logIndex" INTEGER NOT NULL,
    "blockId" BIGINT NOT NULL,
    "timestamp" DATETIME NOT NULL,
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
    "volumeUsd" DECIMAL,
    "priceUsd" DECIMAL,
    "ingestedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "LiquidityEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "chainId" INTEGER NOT NULL,
    "pool" TEXT NOT NULL,
    "poolType" TEXT NOT NULL DEFAULT 'v3',
    "kind" TEXT NOT NULL,
    "txHash" TEXT NOT NULL,
    "logIndex" INTEGER NOT NULL,
    "blockId" BIGINT NOT NULL,
    "timestamp" DATETIME NOT NULL,
    "owner" TEXT,
    "amount0" TEXT NOT NULL,
    "amount1" TEXT NOT NULL,
    "amountUsd" DECIMAL,
    "ingestedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "WalletActivity" (
    "id" BIGINT NOT NULL PRIMARY KEY,
    "chainId" INTEGER NOT NULL,
    "wallet" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "txHash" TEXT NOT NULL,
    "blockId" BIGINT NOT NULL,
    "toContract" TEXT,
    "methodId" TEXT,
    "status" INTEGER NOT NULL,
    "gasUsed" TEXT NOT NULL DEFAULT '0',
    "counted" BOOLEAN NOT NULL DEFAULT true,
    "ingestedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "WalletBalanceSnapshot" (
    "id" BIGINT NOT NULL PRIMARY KEY,
    "chainId" INTEGER NOT NULL,
    "wallet" TEXT NOT NULL,
    "address" TEXT,
    "symbol" TEXT,
    "decimals" INTEGER,
    "blockId" BIGINT NOT NULL,
    "balance" TEXT NOT NULL,
    "balanceUsd" DECIMAL,
    "takenAt" DATETIME NOT NULL,
    "ingestedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "WalletFundingRelationship" (
    "id" BIGINT NOT NULL PRIMARY KEY,
    "chainId" INTEGER NOT NULL,
    "fromWallet" TEXT NOT NULL,
    "toWallet" TEXT NOT NULL,
    "token" TEXT,
    "totalValueUsd" DECIMAL,
    "txCount" INTEGER NOT NULL DEFAULT 1,
    "firstSeen" DATETIME NOT NULL,
    "lastSeen" DATETIME NOT NULL,
    "clusterId" TEXT,
    "clusterRole" TEXT,
    "ingestedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "TokenContract" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "chainId" INTEGER NOT NULL,
    "address" TEXT NOT NULL,
    "symbol" TEXT,
    "name" TEXT,
    "decimals" INTEGER,
    "verifiedAt" DATETIME,
    "source" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AssetClassification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "chainId" INTEGER NOT NULL,
    "address" TEXT NOT NULL,
    "symbol" TEXT,
    "decimals" INTEGER,
    "category" TEXT NOT NULL DEFAULT 'pending_review',
    "qualified" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT NOT NULL DEFAULT 'operator',
    "sourceUrl" TEXT,
    "effectiveAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "TokenPrice" (
    "id" BIGINT NOT NULL PRIMARY KEY,
    "symbol" TEXT NOT NULL,
    "address" TEXT,
    "chainId" INTEGER,
    "priceUsd" DECIMAL NOT NULL,
    "source" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "takenAt" DATETIME NOT NULL,
    "ingestedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "DexPair" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DexPair_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LiquiditySnapshot" (
    "id" BIGINT NOT NULL PRIMARY KEY,
    "chainId" INTEGER NOT NULL,
    "pair" TEXT NOT NULL,
    "tvlUsd" DECIMAL NOT NULL,
    "token0Amount" DECIMAL,
    "token1Amount" DECIMAL,
    "price0Usd" DECIMAL,
    "price1Usd" DECIMAL,
    "source" TEXT NOT NULL,
    "takenAt" DATETIME NOT NULL,
    "ingestedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "TvlSnapshot" (
    "id" BIGINT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "protocolTvlUsd" DECIMAL,
    "chainTvlUsd" DECIMAL,
    "qualifiedTvlUsd" DECIMAL,
    "pendingTvlUsd" DECIMAL,
    "excludedTvlUsd" DECIMAL,
    "breakdown" TEXT,
    "source" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "retrievedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TvlSnapshot_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GasUsageDaily" (
    "id" BIGINT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "gasUsed" TEXT NOT NULL,
    "botSpent" DECIMAL NOT NULL,
    "botPriceUsd" DECIMAL,
    "usdSpent" DECIMAL,
    "txCount" INTEGER NOT NULL DEFAULT 0,
    "source" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GasUsageDaily_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EvidenceReport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "schemeCode" TEXT NOT NULL,
    "rulesVersion" TEXT NOT NULL,
    "periodStart" DATETIME NOT NULL,
    "periodEnd" DATETIME NOT NULL,
    "reportHash" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "format" TEXT NOT NULL DEFAULT 'json',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,
    CONSTRAINT "EvidenceReport_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EvidenceItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reportId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "reference" TEXT NOT NULL,
    "retrievedAt" DATETIME NOT NULL,
    "payload" TEXT,
    CONSTRAINT "EvidenceItem_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "EvidenceReport" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'info',
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "dedupeKey" TEXT,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" DATETIME,
    CONSTRAINT "Alert_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DataProvider" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "baseUrl" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastCheckAt" DATETIME,
    "lastOkAt" DATETIME,
    "lastError" TEXT,
    "latencyMs" INTEGER,
    "notes" TEXT
);

-- CreateTable
CREATE TABLE "IngestionJob" (
    "id" BIGINT NOT NULL PRIMARY KEY,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "chainId" INTEGER,
    "params" TEXT,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER,
    "error" TEXT,
    "startedAt" DATETIME,
    "finishedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "IngestionCheckpoint" (
    "id" BIGINT NOT NULL PRIMARY KEY,
    "jobId" BIGINT,
    "kind" TEXT NOT NULL,
    "chainId" INTEGER NOT NULL,
    "key" TEXT,
    "lastBlock" BIGINT,
    "lastDate" DATETIME,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "IngestionCheckpoint_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "IngestionJob" ("id") ON DELETE SET NULL ON UPDATE CASCADE
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
CREATE UNIQUE INDEX "ProjectMetric_projectId_schemeId_metricKey_rulesVersion_periodStart_periodEnd_key" ON "ProjectMetric"("projectId", "schemeId", "metricKey", "rulesVersion", "periodStart", "periodEnd");

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
CREATE UNIQUE INDEX "EvidenceReport_projectId_schemeCode_rulesVersion_periodStart_periodEnd_format_key" ON "EvidenceReport"("projectId", "schemeCode", "rulesVersion", "periodStart", "periodEnd", "format");

-- CreateIndex
CREATE INDEX "Alert_projectId_status_idx" ON "Alert"("projectId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Alert_projectId_dedupeKey_key" ON "Alert"("projectId", "dedupeKey");

-- CreateIndex
CREATE UNIQUE INDEX "DataProvider_name_key" ON "DataProvider"("name");

-- CreateIndex
CREATE UNIQUE INDEX "IngestionCheckpoint_kind_chainId_key_key" ON "IngestionCheckpoint"("kind", "chainId", "key");

/*
  Warnings:

  - The primary key for the `GasUsageDaily` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to alter the column `id` on the `GasUsageDaily` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Int`.
  - The primary key for the `IngestionCheckpoint` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to alter the column `id` on the `IngestionCheckpoint` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Int`.
  - You are about to alter the column `jobId` on the `IngestionCheckpoint` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Int`.
  - The primary key for the `IngestionJob` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to alter the column `id` on the `IngestionJob` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Int`.
  - The primary key for the `LiquiditySnapshot` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to alter the column `id` on the `LiquiditySnapshot` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Int`.
  - The primary key for the `TokenPrice` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to alter the column `id` on the `TokenPrice` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Int`.
  - The primary key for the `TvlSnapshot` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to alter the column `id` on the `TvlSnapshot` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Int`.
  - The primary key for the `WalletActivity` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to alter the column `id` on the `WalletActivity` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Int`.
  - The primary key for the `WalletBalanceSnapshot` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to alter the column `id` on the `WalletBalanceSnapshot` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Int`.
  - The primary key for the `WalletFundingRelationship` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to alter the column `id` on the `WalletFundingRelationship` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Int`.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_GasUsageDaily" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
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
INSERT INTO "new_GasUsageDaily" ("botPriceUsd", "botSpent", "createdAt", "date", "gasUsed", "id", "projectId", "source", "txCount", "usdSpent") SELECT "botPriceUsd", "botSpent", "createdAt", "date", "gasUsed", "id", "projectId", "source", "txCount", "usdSpent" FROM "GasUsageDaily";
DROP TABLE "GasUsageDaily";
ALTER TABLE "new_GasUsageDaily" RENAME TO "GasUsageDaily";
CREATE INDEX "GasUsageDaily_projectId_date_idx" ON "GasUsageDaily"("projectId", "date");
CREATE UNIQUE INDEX "GasUsageDaily_projectId_date_source_key" ON "GasUsageDaily"("projectId", "date", "source");
CREATE TABLE "new_IngestionCheckpoint" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "jobId" INTEGER,
    "kind" TEXT NOT NULL,
    "chainId" INTEGER NOT NULL,
    "key" TEXT,
    "lastBlock" BIGINT,
    "lastDate" DATETIME,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "IngestionCheckpoint_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "IngestionJob" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_IngestionCheckpoint" ("chainId", "id", "jobId", "key", "kind", "lastBlock", "lastDate", "updatedAt") SELECT "chainId", "id", "jobId", "key", "kind", "lastBlock", "lastDate", "updatedAt" FROM "IngestionCheckpoint";
DROP TABLE "IngestionCheckpoint";
ALTER TABLE "new_IngestionCheckpoint" RENAME TO "IngestionCheckpoint";
CREATE UNIQUE INDEX "IngestionCheckpoint_kind_chainId_key_key" ON "IngestionCheckpoint"("kind", "chainId", "key");
CREATE TABLE "new_IngestionJob" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
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
INSERT INTO "new_IngestionJob" ("chainId", "createdAt", "error", "finishedAt", "id", "kind", "params", "progress", "startedAt", "status", "total") SELECT "chainId", "createdAt", "error", "finishedAt", "id", "kind", "params", "progress", "startedAt", "status", "total" FROM "IngestionJob";
DROP TABLE "IngestionJob";
ALTER TABLE "new_IngestionJob" RENAME TO "IngestionJob";
CREATE TABLE "new_LiquiditySnapshot" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
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
INSERT INTO "new_LiquiditySnapshot" ("chainId", "id", "ingestedAt", "pair", "price0Usd", "price1Usd", "source", "takenAt", "token0Amount", "token1Amount", "tvlUsd") SELECT "chainId", "id", "ingestedAt", "pair", "price0Usd", "price1Usd", "source", "takenAt", "token0Amount", "token1Amount", "tvlUsd" FROM "LiquiditySnapshot";
DROP TABLE "LiquiditySnapshot";
ALTER TABLE "new_LiquiditySnapshot" RENAME TO "LiquiditySnapshot";
CREATE INDEX "LiquiditySnapshot_chainId_pair_takenAt_idx" ON "LiquiditySnapshot"("chainId", "pair", "takenAt");
CREATE UNIQUE INDEX "LiquiditySnapshot_chainId_pair_takenAt_source_key" ON "LiquiditySnapshot"("chainId", "pair", "takenAt", "source");
CREATE TABLE "new_TokenPrice" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "symbol" TEXT NOT NULL,
    "address" TEXT,
    "chainId" INTEGER,
    "priceUsd" DECIMAL NOT NULL,
    "source" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "takenAt" DATETIME NOT NULL,
    "ingestedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_TokenPrice" ("address", "chainId", "id", "ingestedAt", "priceUsd", "source", "sourceUrl", "symbol", "takenAt") SELECT "address", "chainId", "id", "ingestedAt", "priceUsd", "source", "sourceUrl", "symbol", "takenAt" FROM "TokenPrice";
DROP TABLE "TokenPrice";
ALTER TABLE "new_TokenPrice" RENAME TO "TokenPrice";
CREATE INDEX "TokenPrice_symbol_takenAt_idx" ON "TokenPrice"("symbol", "takenAt");
CREATE UNIQUE INDEX "TokenPrice_symbol_address_takenAt_source_key" ON "TokenPrice"("symbol", "address", "takenAt", "source");
CREATE TABLE "new_TvlSnapshot" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
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
INSERT INTO "new_TvlSnapshot" ("breakdown", "chainTvlUsd", "createdAt", "date", "excludedTvlUsd", "id", "pendingTvlUsd", "projectId", "protocolTvlUsd", "qualifiedTvlUsd", "retrievedAt", "source", "sourceUrl") SELECT "breakdown", "chainTvlUsd", "createdAt", "date", "excludedTvlUsd", "id", "pendingTvlUsd", "projectId", "protocolTvlUsd", "qualifiedTvlUsd", "retrievedAt", "source", "sourceUrl" FROM "TvlSnapshot";
DROP TABLE "TvlSnapshot";
ALTER TABLE "new_TvlSnapshot" RENAME TO "TvlSnapshot";
CREATE INDEX "TvlSnapshot_projectId_date_idx" ON "TvlSnapshot"("projectId", "date");
CREATE UNIQUE INDEX "TvlSnapshot_projectId_date_source_key" ON "TvlSnapshot"("projectId", "date", "source");
CREATE TABLE "new_WalletActivity" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
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
INSERT INTO "new_WalletActivity" ("blockId", "chainId", "counted", "date", "gasUsed", "id", "ingestedAt", "methodId", "status", "toContract", "txHash", "wallet") SELECT "blockId", "chainId", "counted", "date", "gasUsed", "id", "ingestedAt", "methodId", "status", "toContract", "txHash", "wallet" FROM "WalletActivity";
DROP TABLE "WalletActivity";
ALTER TABLE "new_WalletActivity" RENAME TO "WalletActivity";
CREATE INDEX "WalletActivity_chainId_wallet_date_idx" ON "WalletActivity"("chainId", "wallet", "date");
CREATE INDEX "WalletActivity_chainId_date_idx" ON "WalletActivity"("chainId", "date");
CREATE UNIQUE INDEX "WalletActivity_chainId_txHash_wallet_toContract_key" ON "WalletActivity"("chainId", "txHash", "wallet", "toContract");
CREATE TABLE "new_WalletBalanceSnapshot" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
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
INSERT INTO "new_WalletBalanceSnapshot" ("address", "balance", "balanceUsd", "blockId", "chainId", "decimals", "id", "ingestedAt", "symbol", "takenAt", "wallet") SELECT "address", "balance", "balanceUsd", "blockId", "chainId", "decimals", "id", "ingestedAt", "symbol", "takenAt", "wallet" FROM "WalletBalanceSnapshot";
DROP TABLE "WalletBalanceSnapshot";
ALTER TABLE "new_WalletBalanceSnapshot" RENAME TO "WalletBalanceSnapshot";
CREATE INDEX "WalletBalanceSnapshot_chainId_wallet_takenAt_idx" ON "WalletBalanceSnapshot"("chainId", "wallet", "takenAt");
CREATE UNIQUE INDEX "WalletBalanceSnapshot_chainId_wallet_address_blockId_key" ON "WalletBalanceSnapshot"("chainId", "wallet", "address", "blockId");
CREATE TABLE "new_WalletFundingRelationship" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
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
INSERT INTO "new_WalletFundingRelationship" ("chainId", "clusterId", "clusterRole", "firstSeen", "fromWallet", "id", "ingestedAt", "lastSeen", "toWallet", "token", "totalValueUsd", "txCount") SELECT "chainId", "clusterId", "clusterRole", "firstSeen", "fromWallet", "id", "ingestedAt", "lastSeen", "toWallet", "token", "totalValueUsd", "txCount" FROM "WalletFundingRelationship";
DROP TABLE "WalletFundingRelationship";
ALTER TABLE "new_WalletFundingRelationship" RENAME TO "WalletFundingRelationship";
CREATE INDEX "WalletFundingRelationship_chainId_toWallet_idx" ON "WalletFundingRelationship"("chainId", "toWallet");
CREATE INDEX "WalletFundingRelationship_chainId_clusterId_idx" ON "WalletFundingRelationship"("chainId", "clusterId");
CREATE UNIQUE INDEX "WalletFundingRelationship_chainId_fromWallet_toWallet_token_key" ON "WalletFundingRelationship"("chainId", "fromWallet", "toWallet", "token");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

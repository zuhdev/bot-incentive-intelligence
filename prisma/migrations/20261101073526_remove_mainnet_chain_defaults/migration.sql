-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ProjectAddress" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "label" TEXT,
    "type" TEXT NOT NULL DEFAULT 'other',
    "chainId" INTEGER NOT NULL,
    "schemes" TEXT NOT NULL DEFAULT '[]',
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProjectAddress_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ProjectAddress" ("address", "chainId", "createdAt", "id", "label", "projectId", "schemes", "type", "updatedAt", "verified") SELECT "address", "chainId", "createdAt", "id", "label", "projectId", "schemes", "type", "updatedAt", "verified" FROM "ProjectAddress";
DROP TABLE "ProjectAddress";
ALTER TABLE "new_ProjectAddress" RENAME TO "ProjectAddress";
CREATE INDEX "ProjectAddress_address_idx" ON "ProjectAddress"("address");
CREATE UNIQUE INDEX "ProjectAddress_projectId_address_chainId_key" ON "ProjectAddress"("projectId", "address", "chainId");
CREATE TABLE "new_Wallet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "address" TEXT NOT NULL,
    "chainId" INTEGER NOT NULL,
    "verifiedAt" DATETIME,
    "verifiedBy" TEXT,
    "firstSeenAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,
    CONSTRAINT "Wallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Wallet" ("address", "chainId", "createdAt", "firstSeenAt", "id", "userId", "verifiedAt", "verifiedBy") SELECT "address", "chainId", "createdAt", "firstSeenAt", "id", "userId", "verifiedAt", "verifiedBy" FROM "Wallet";
DROP TABLE "Wallet";
ALTER TABLE "new_Wallet" RENAME TO "Wallet";
CREATE UNIQUE INDEX "Wallet_address_key" ON "Wallet"("address");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

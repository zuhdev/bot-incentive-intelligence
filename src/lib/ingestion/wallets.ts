/**
 * Wallet-level ingestion (Scheme C foundation):
 * - Recent transaction ingestion per tracked wallet (Blockscout, paginated).
 * - Wallet first-seen detection (wallet age requirement).
 * - Native + token balance snapshots (RPC + explorer).
 * - Preliminary funding-relationship extraction from observed transfers.
 *
 * All operations are idempotent and bounded; explorer timeouts degrade to
 * INSUFFICIENT DATA states, never zeros.
 */
import { prisma } from "@/lib/db";
import env from "@/lib/env";
import { getAddressTokenTransfers, getAddressTransactions, getWalletFirstTxTimestamp } from "@/lib/providers/botscan";
import { getBalance } from "@/lib/providers/rpc";

export interface WalletIngestReport {
  wallet: string;
  txsFetched: number;
  transfersFetched: number;
  firstSeen: string | null;
  nativeBalance: string | null;
  errors: string[];
}

/** Upsert wallet activity rows from explorer transactions. */
export async function ingestWalletActivity(wallet: string, maxPages = 3): Promise<WalletIngestReport> {
  const w = wallet.toLowerCase();
  const report: WalletIngestReport = { wallet: w, txsFetched: 0, transfersFetched: 0, firstSeen: null, nativeBalance: null, errors: [] };

  let cursor: Record<string, string> | null = null;
  for (let page = 0; page < maxPages; page++) {
    const res = await getAddressTransactions(w, 50, cursor ?? undefined);
    if (!res.ok) {
      report.errors.push(`transactions: ${res.error}`);
      break;
    }
    for (const tx of res.items) {
      const ts = new Date(tx.timestamp);
      await prisma.walletActivity.upsert({
        where: {
          chainId_txHash_wallet_toContract: {
            chainId: env.BOT_CHAIN_ID,
            txHash: tx.hash.toLowerCase(),
            wallet: w,
            toContract: tx.to?.hash?.toLowerCase() ?? "",
          },
        },
        create: {
          chainId: env.BOT_CHAIN_ID,
          wallet: w,
          date: new Date(Date.UTC(ts.getUTCFullYear(), ts.getUTCMonth(), ts.getUTCDate())),
          txHash: tx.hash.toLowerCase(),
          blockId: BigInt(tx.block_number),
          toContract: tx.to?.hash?.toLowerCase() ?? null,
          methodId: tx.raw_input && tx.raw_input.length >= 10 ? tx.raw_input.slice(0, 10) : null,
          status: tx.status === "ok" ? 1 : 0,
          gasUsed: tx.gas_used ?? "0",
          counted: true,
        },
        update: {},
      }).catch(() => {
        /* unique constraint on composite without toContract null-mismatch: treat as dup */
      });
      report.txsFetched++;
    }
    cursor = res.nextPage;
    if (!cursor) break;
  }

  // Token transfers for qualifying-asset visibility
  let tCursor: Record<string, string> | null = null;
  for (let page = 0; page < maxPages; page++) {
    const res = await getAddressTokenTransfers(w, 50, tCursor ?? undefined);
    if (!res.ok) {
      report.errors.push(`token-transfers: ${res.error}`);
      break;
    }
    for (const t of res.items) {
      if (!t.tx_hash) continue;
      const ts = new Date(t.timestamp);
      await prisma.transferEvent.upsert({
        where: { id: `${env.BOT_CHAIN_ID}:${t.tx_hash.toLowerCase()}:wt` },
        create: {
          id: `${env.BOT_CHAIN_ID}:${t.tx_hash.toLowerCase()}:wt`,
          chainId: env.BOT_CHAIN_ID,
          txHash: t.tx_hash.toLowerCase(),
          logIndex: -1, // explorer-derived; per-log data comes from the log pipeline
          blockId: BigInt(t.block_number),
          timestamp: ts,
          contract: t.token.address.toLowerCase(),
          from: t.from?.hash?.toLowerCase() ?? "",
          to: t.to?.hash?.toLowerCase() ?? "",
          value: t.total.value,
          tokenDecimals: t.total.decimals ? Number(t.total.decimals) : null,
          tokenSymbol: t.token.symbol ?? null,
        },
        update: {},
      }).catch(() => undefined);
      report.transfersFetched++;
      // Token metadata cache
      await prisma.tokenContract.upsert({
        where: { chainId_address: { chainId: env.BOT_CHAIN_ID, address: t.token.address.toLowerCase() } },
        create: {
          chainId: env.BOT_CHAIN_ID,
          address: t.token.address.toLowerCase(),
          symbol: t.token.symbol,
          name: t.token.name,
          decimals: t.total.decimals ? Number(t.total.decimals) : null,
          source: "botscan",
        },
        update: { symbol: t.token.symbol ?? undefined, name: t.token.name ?? undefined },
      }).catch(() => undefined);
    }
    tCursor = res.nextPage;
    if (!tCursor) break;
  }

  // First-seen (bounded background walk; results cached in wallet record)
  const walletRecord = await prisma.wallet.findUnique({ where: { address: w } });
  if (!walletRecord?.firstSeenAt) {
    const first = await getWalletFirstTxTimestamp(w);
    if (first) {
      report.firstSeen = first.toISOString();
      await prisma.wallet.upsert({
        where: { address: w },
        create: { address: w, chainId: env.BOT_CHAIN_ID, firstSeenAt: first },
        update: { firstSeenAt: first },
      });
    }
  } else {
    report.firstSeen = walletRecord.firstSeenAt.toISOString();
  }

  // Native balance snapshot
  try {
    const bal = await getBalance(w);
    report.nativeBalance = bal.toString();
    await prisma.walletBalanceSnapshot.create({
      data: {
        chainId: env.BOT_CHAIN_ID,
        wallet: w,
        address: null,
        symbol: "BOT",
        decimals: 18,
        blockId: 0n, // latest-state snapshot
        balance: bal.toString(),
        takenAt: new Date(),
      },
    });
  } catch (err) {
    report.errors.push(`balance: ${err instanceof Error ? err.message : String(err)}`);
  }

  return report;
}

/**
 * Preliminary funding-relationship scan: group observed wallets by their
 * earliest inbound transfer source. PRELIMINARY indicator only.
 */
export async function scanFundingRelationships(projectId: string, maxWallets = 200): Promise<number> {
  // Take recent inbound transfers to any tracked wallet of this project
  const addresses = await prisma.projectAddress.findMany({
    where: { projectId },
    select: { address: true },
    take: maxWallets,
  });
  if (addresses.length === 0) return 0;
  const addrSet = new Set(addresses.map((a) => a.address.toLowerCase()));

  const transfers = await prisma.transferEvent.findMany({
    where: { to: { in: [...addrSet] }, chainId: env.BOT_CHAIN_ID },
    orderBy: { timestamp: "asc" },
    take: 5_000,
  });

  // First funding source per wallet
  const firstSource = new Map<string, { from: string; token: string | null; ts: Date }>();
  for (const t of transfers) {
    if (addrSet.has(t.from)) continue; // internal project transfers don't establish external funding
    const key = t.to;
    if (!firstSource.has(key)) firstSource.set(key, { from: t.from, token: t.contract, ts: t.timestamp });
  }

  // Cluster by shared source
  const bySource = new Map<string, string[]>();
  for (const [to, f] of firstSource) {
    bySource.set(f.from, [...(bySource.get(f.from) ?? []), to]);
  }

  let written = 0;
  for (const [from, targets] of bySource) {
    const isCluster = targets.length > 1;
    const clusterId = isCluster ? `src:${env.BOT_CHAIN_ID}:${from}` : null;
    for (const to of targets) {
      const f = firstSource.get(to)!;
      await prisma.walletFundingRelationship.upsert({
        where: {
          chainId_fromWallet_toWallet_token: {
            chainId: env.BOT_CHAIN_ID,
            fromWallet: from,
            toWallet: to,
            token: f.token ?? "native",
          },
        },
        create: {
          chainId: env.BOT_CHAIN_ID,
          fromWallet: from,
          toWallet: to,
          token: f.token ?? "native",
          firstSeen: f.ts,
          lastSeen: f.ts,
          txCount: 1,
          clusterId,
          clusterRole: isCluster ? "member" : "source",
        },
        update: { lastSeen: f.ts },
      });
      written++;
    }
  }
  return written;
}

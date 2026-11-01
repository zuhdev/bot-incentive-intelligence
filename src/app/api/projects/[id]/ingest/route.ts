import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireProjectAccess } from "@/lib/auth";
import { jsonError } from "@/lib/api";
import { importProjectTvlHistory } from "@/lib/ingestion/tvl";
import { ingestWalletActivity, scanFundingRelationships } from "@/lib/ingestion/wallets";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Triggers data ingestion for a project:
 *  - tvl: import DeFiLlama historical TVL (Scheme D foundation)
 *  - wallets: ingest wallet activity + balances + funding scan (Scheme C)
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await requireProjectAccess(id, "analyst");
    const body = (await req.json().catch(() => ({}))) as { action?: "tvl" | "wallets"; wallet?: string };

    if (body.action === "wallets" && body.wallet) {
      const report = await ingestWalletActivity(body.wallet);
      return NextResponse.json({ ok: true, report });
    }

    // default: tvl import + funding scan
    const tvl = await importProjectTvlHistory(id);
    const fundingCount = await scanFundingRelationships(id);
    return NextResponse.json({ ok: true, tvl, fundingRelationships: fundingCount });
  } catch (err) {
    return jsonError(err);
  }
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await requireProjectAccess(id);
    const [tvlCount, activityCount, swapCount, transferCount, lastTvl] = await Promise.all([
      prisma.tvlSnapshot.count({ where: { projectId: id } }),
      prisma.walletActivity.count({ where: { toContract: { in: (await prisma.projectAddress.findMany({ where: { projectId: id }, select: { address: true } })).map((a) => a.address) } } }).catch(() => 0),
      prisma.dexSwapEvent.count(),
      prisma.transferEvent.count(),
      prisma.tvlSnapshot.findFirst({ where: { projectId: id }, orderBy: { date: "desc" } }),
    ]);
    return NextResponse.json({
      tvlSnapshots: tvlCount,
      walletActivities: activityCount,
      swapEvents: swapCount,
      transferEvents: transferCount,
      lastTvlDate: lastTvl?.date ?? null,
    });
  } catch (err) {
    return jsonError(err);
  }
}

/**
 * Daily TVL snapshot ingestion (Scheme D foundation).
 *
 * - Pulls DeFiLlama chain-attributed TVL for the configured protocol slug.
 * - Snapshots are stored at 00:00 UTC precisely.
 * - Stores DeFiLlama protocol/chain TVL as REFERENCE columns; qualified TVL is
 *   computed separately by the rules engine against the asset registry and is
 *   NEVER assumed from the raw protocol figure (spec §5, §15-8).
 */
import { prisma } from "@/lib/db";
import env from "@/lib/env";
import { getBotChainTvlSeries } from "@/lib/providers/defillama";

function utcMidnight(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
}

export interface TvlIngestReport {
  protocolSlug: string;
  protocolName: string | null;
  imported: number;
  skipped: number;
  earliest: string | null;
  latest: string | null;
  error?: string;
}

/**
 * Import historical daily TVL for a project from DeFiLlama.
 * `source` records provenance; every snapshot keeps retrieval time.
 */
export async function importProjectTvlHistory(
  projectId: string,
  slugOverride?: string,
): Promise<TvlIngestReport> {
  if (!env.DEFILLAMA_BOT_TVL_ENABLED) {
    return {
      protocolSlug: slugOverride ?? env.DEFAULT_BOT_PROTOCOL_SLUG,
      protocolName: null,
      imported: 0,
      skipped: 0,
      earliest: null,
      latest: null,
      error: "DeFiLlama BOT Chain TVL is mainnet data; no TVL snapshots are imported in testnet mode.",
    };
  }
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  const slug = slugOverride ?? project?.defiLlamaSlug ?? env.DEFAULT_BOT_PROTOCOL_SLUG;

  const series = await getBotChainTvlSeries(slug);
  if (!series.ok) {
    return { protocolSlug: slug, protocolName: null, imported: 0, skipped: 0, earliest: null, latest: null, error: series.error };
  }

  let imported = 0;
  let skipped = 0;
  const retrievedAt = new Date();
  for (const point of series.points) {
    const date = utcMidnight(point.date);
    // DeFiLlama series may include intraday latest point; normalise to 00:00 UTC
    const existing = await prisma.tvlSnapshot.findFirst({
      where: { projectId, date, source: "defillama" },
      select: { id: true },
    });
    if (existing) {
      skipped++;
      continue;
    }
    await prisma.tvlSnapshot.create({
      data: {
        projectId,
        date,
        protocolTvlUsd: point.usd.toString(),
        chainTvlUsd: point.usd.toString(),
        // qualifiedTvlUsd intentionally NULL: computed by rules engine only
        source: "defillama",
        sourceUrl: `https://api.llama.fi/protocol/${slug}`,
        retrievedAt,
      },
    });
    imported++;
  }

  return {
    protocolSlug: slug,
    protocolName: series.protocolName,
    imported,
    skipped,
    earliest: series.points[0] ? series.points[0].date.toISOString().slice(0, 10) : null,
    latest: series.points.at(-1)?.date.toISOString().slice(0, 10) ?? null,
  };
}

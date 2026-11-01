/**
 * Scheme A + Gas Rebate calculator tests.
 */
import { describe, expect, it } from "vitest";
import { evaluateSchemeA, type VolumeDay } from "@/lib/rules/schemes/scheme-a";
import { evaluateGasRebate, rebatePctForSpend } from "@/lib/rules/schemes/gas-rebate";
import { Decimal } from "@/lib/calcs/decimal";

function volDay(date: string, volumeUsd: string, tx: number, shares: { address: string; sharePct: string }[] = [], attribution: Partial<VolumeDay["attributionCounts"]> = {}): VolumeDay {
  return {
    date,
    volumeUsd,
    successfulTxCount: tx,
    addressShares: shares,
    attributionCounts: { direct: 0, router: 0, smart_account: 0, unknown: 0, ...attribution },
  };
}

const BASE_A = {
  periodStart: "2026-10-01",
  periodEnd: "2026-10-20",
  pairAddress: "0x64f418471a1a7932a190e10da5a8551db5abec05",
  isBotPair: false,
  sources: [],
  rulesVersion: "test-1",
  sourceUrl: "https://example.com",
};

describe("Scheme A", () => {
  it("no data → insufficient_data", () => {
    const r = evaluateSchemeA({ ...BASE_A, liquidity: [], volume: [] });
    expect(r.status).toBe("insufficient_data");
  });

  it("seven consecutive qualifying days detected", () => {
    const liquidity = Array.from({ length: 7 }, (_, i) => ({
      date: new Date(Date.UTC(2026, 9, 10 + i)).toISOString().slice(0, 10),
      tvlUsd: "60000",
    }));
    const r = evaluateSchemeA({ ...BASE_A, liquidity, volume: [volDay("2026-10-16", "200000", 2000, [], { direct: 2000 })] });
    expect(r.metrics.find((m) => m.key === "liquidity_sustained_days")?.value).toBe(7);
    expect(r.metrics.find((m) => m.key === "liquidity_sustained_days")?.status).toBe("verified");
  });

  it("LP withdrawal breaks the 7-day streak", () => {
    const liquidity = [
      { date: "2026-10-10", tvlUsd: "60000" },
      { date: "2026-10-11", tvlUsd: "60000" },
      { date: "2026-10-12", tvlUsd: "60000" },
      { date: "2026-10-13", tvlUsd: "10000" }, // withdrawal below tier 1
      { date: "2026-10-14", tvlUsd: "60000" },
    ];
    const r = evaluateSchemeA({ ...BASE_A, liquidity, volume: [] });
    expect(r.metrics.find((m) => m.key === "liquidity_sustained_days")?.value).toBe(3);
  });

  it("daily concentration >40% flagged at_risk", () => {
    const liquidity = Array.from({ length: 7 }, (_, i) => ({ date: `2026-10-1${i}`, tvlUsd: "60000" }));
    const shares = [{ address: "0xwhale", sharePct: "65" }];
    const r = evaluateSchemeA({
      ...BASE_A,
      liquidity,
      volume: [volDay("2026-10-16", "200000", 2000, shares, { router: 2000 })],
    });
    expect(r.metrics.find((m) => m.key === "volume_concentration")?.status).toBe("at_risk");
  });

  it("router attribution lowers coverage → provisional", () => {
    const liquidity = [{ date: "2026-10-16", tvlUsd: "60000" }];
    const r = evaluateSchemeA({
      ...BASE_A,
      liquidity,
      volume: [volDay("2026-10-16", "200000", 1000, [], { router: 950, direct: 50 })],
    });
    expect(r.metrics.find((m) => m.key === "trader_attribution")?.status).toBe("provisional");
  });

  it("tier matching with all thresholds met", () => {
    const liquidity = [{ date: "2026-10-16", tvlUsd: "250000" }];
    const volume = [volDay("2026-10-16", "600000", 6000, [], { direct: 6000 })];
    const r = evaluateSchemeA({ ...BASE_A, liquidity, volume });
    expect(r.tier?.tier).toBe(2);
    // Conservative estimate = published base reward; max exposed on tier info.
    expect(r.estimatedRewardUsd).toBe(5_000);
    expect(r.tier?.rewardUsd).toBe(16_000); // tier maximum
  });
});

describe("Gas rebate", () => {
  it("below $50k → 0%", () => {
    expect(rebatePctForSpend(new Decimal(49_999)).toNumber()).toBe(0);
  });

  it("at $500k → 35%", () => {
    expect(rebatePctForSpend(new Decimal(500_000)).toNumber()).toBe(35);
  });

  it("midpoint interpolation is labelled provisional and flagged unresolved", () => {
    const pct = rebatePctForSpend(new Decimal(275_000)); // midpoint
    expect(pct.toNumber()).toBeCloseTo(22.5, 6);
    const r = evaluateGasRebate({
      periodStart: "2026-08-01",
      periodEnd: "2026-10-31",
      days: [
        { date: "2026-10-01", gasUsed: "1000000", botSpent: "1000", usdSpent: "275000", botPriceUsd: "1" },
      ],
      sources: [],
      rulesVersion: "test-1",
      sourceUrl: "https://example.com",
    });
    expect(r.status).toBe("provisional");
    expect(r.unresolved.length).toBeGreaterThan(0);
    expect(r.estimatedRewardUsd).toBeCloseTo(275000 * 0.225, 0);
  });

  it("unpriced days excluded from cumulative spend (never zero-filled)", () => {
    const r = evaluateGasRebate({
      periodStart: "2026-08-01",
      periodEnd: "2026-10-31",
      days: [
        { date: "2026-10-01", gasUsed: "1000", botSpent: "10", usdSpent: "60000", botPriceUsd: "1" },
        { date: "2026-10-02", gasUsed: "1000", botSpent: "5", usdSpent: null, botPriceUsd: null },
      ],
      sources: [],
      rulesVersion: "test-1",
      sourceUrl: "https://example.com",
    });
    expect(r.warnings.some((w) => w.includes("EXCLUDED"))).toBe(true);
    expect(r.metrics.find((m) => m.key === "cumulative_gas_spend_usd")?.value).toBe("60000");
  });
});

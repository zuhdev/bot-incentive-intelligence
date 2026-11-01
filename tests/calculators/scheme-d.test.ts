/**
 * Scheme D calculator tests (spec §13 test matrix).
 */
import { describe, expect, it } from "vitest";
import { Decimal } from "@/lib/calcs/decimal";
import {
  dailySupportUsd,
  dayNumber,
  evaluateSchemeD,
  type TvlSnapshotRow,
} from "@/lib/rules/schemes/scheme-d";

function snap(date: string, qualified: string | null, breakdown: TvlSnapshotRow["breakdown"] = null): TvlSnapshotRow {
  return {
    date,
    qualifiedTvlUsd: qualified,
    pendingTvlUsd: null,
    excludedTvlUsd: null,
    breakdown,
    protocolTvlUsd: null,
    chainTvlUsd: null,
    source: "test",
  };
}

const BASE = {
  periodStart: "2026-09-01",
  periodEnd: "2026-11-30",
  observationStart: "2026-09-01",
  mainnetDeployed: true,
  defiLlamaListed: true,
  defiLlamaSlug: "test-protocol",
  sources: [],
  rulesVersion: "test-1",
  sourceUrl: "https://example.com",
};

function fullBreakdown(usd: string): TvlSnapshotRow["breakdown"] {
  return { stablecoin: usd };
}

describe("Scheme D — threshold", () => {
  it("TVL above $250k → threshold met, but retention not yet satisfied", () => {
    const result = evaluateSchemeD({ ...BASE, snapshots: [snap("2026-11-30", "300000", fullBreakdown("300000"))] });
    expect(result.evaluation.metrics.find((m) => m.key === "qualified_tvl_usd")?.status).toBe("verified");
    expect(result.evaluation.metrics.find((m) => m.key === "sustained_days")?.status).toBe("at_risk");
    expect(result.evaluation.metrics.find((m) => m.key === "sustained_days")?.value).toBe(1);
  });

  it("TVL below $250k → at_risk with progress < 100%", () => {
    const result = evaluateSchemeD({ ...BASE, snapshots: [snap("2026-11-30", "200000", fullBreakdown("200000"))] });
    const tvl = result.evaluation.metrics.find((m) => m.key === "qualified_tvl_usd")!;
    expect(tvl.status).toBe("at_risk");
    expect(tvl.progressPct).toBeCloseTo(80, 0);
  });

  it("missing daily snapshots gap breaks the streak", () => {
    const result = evaluateSchemeD({
      ...BASE,
      snapshots: [
        snap("2026-11-01", "300000", fullBreakdown("300000")),
        snap("2026-11-02", "300000", fullBreakdown("300000")),
        // gap on 11-03
        snap("2026-11-04", "300000", fullBreakdown("300000")),
      ],
    });
    expect(result.evaluation.metrics.find((m) => m.key === "sustained_days")?.value).toBe(2);
  });

  it("90 consecutive qualifying days → sustained verified", () => {
    const snapshots = Array.from({ length: 90 }, (_, i) => {
      const d = new Date(Date.UTC(2026, 8, 1) + i * 86_400_000);
      return snap(d.toISOString().slice(0, 10), "300000", fullBreakdown("300000"));
    });
    const result = evaluateSchemeD({ ...BASE, snapshots });
    expect(result.evaluation.metrics.find((m) => m.key === "sustained_days")?.value).toBe(90);
    expect(result.evaluation.metrics.find((m) => m.key === "sustained_days")?.status).toBe("verified");
  });

  it("threshold breach during observation: longest streak preserved, current streak resets", () => {
    const snapshots = [
      snap("2026-09-01", "300000", fullBreakdown("300000")),
      snap("2026-09-02", "300000", fullBreakdown("300000")),
      snap("2026-09-03", "100000", fullBreakdown("100000")), // breach
      snap("2026-09-04", "300000", fullBreakdown("300000")),
    ];
    const result = evaluateSchemeD({ ...BASE, snapshots });
    const sustained = result.evaluation.metrics.find((m) => m.key === "sustained_days")!;
    expect(sustained.value).toBe(2); // longest run (days 1–2)
    expect(sustained.notes).toContain("Current streak: 1"); // breach reset
  });
});

describe("Scheme D — asset classification", () => {
  it("unapproved/pending assets are never counted as qualified support", () => {
    const s = snap("2026-10-01", "500000", {
      stablecoin: "100000",
      unapproved: "400000",
      pending_review: "900000",
    });
    const d = dayNumber("2026-06-01", "2026-10-01"); // > 90 → support eligible day
    const support = dailySupportUsd(s, d);
    // Only stablecoin $100k at 1.4%/365 (days 91-180 bucket)
    expect(support!.toFixed(4)).toBe(new Decimal("100000").times(1.4).div(100).div(365).toFixed(4));
  });

  it("missing breakdown → support null (insufficient, not zero)", () => {
    const s = snap("2026-10-01", "500000", null);
    expect(dailySupportUsd(s, 100)).toBeNull();
  });

  it("incorrect chain attribution does not enter qualified TVL", () => {
    // Simulated: snapshot without breakdown (protocol TVL only from DeFiLlama)
    const result = evaluateSchemeD({
      ...BASE,
      snapshots: [snap("2026-11-30", null, null)],
    });
    const tvl = result.evaluation.metrics.find((m) => m.key === "qualified_tvl_usd")!;
    expect(tvl.status).toBe("insufficient_data");
    expect(tvl.display).toBe("—");
  });
});

describe("Scheme D — support calculations", () => {
  const OBS = "2026-01-01";
  const day = (n: number) => new Date(Date.parse(`${OBS}T00:00:00Z`) + (n - 1) * 86_400_000).toISOString().slice(0, 10);

  it("annualized rate bucket selection (91–180 / 181–359 / 360+)", () => {
    const mk = (n: number, stable: string, major: string) =>
      snap(day(n), "400000", { stablecoin: stable, major });
    // Day 100: stable 1.4%/365, major 1.1%/365 on $100k each
    const s100 = mk(100, "100000", "100000");
    const support100 = dailySupportUsd(s100, 100)!;
    const expected100 = 100000 * (0.014 / 365) + 100000 * (0.011 / 365);
    expect(Number(support100)).toBeCloseTo(expected100, 6);

    const s200 = mk(200, "100000", "100000");
    const expected200 = 100000 * (0.017 / 365) + 100000 * (0.014 / 365);
    expect(Number(dailySupportUsd(s200, 200)!)).toBeCloseTo(expected200, 6);

    const s400 = mk(400, "100000", "100000");
    const expected400 = 100000 * (0.02 / 365) + 100000 * (0.017 / 365);
    expect(Number(dailySupportUsd(s400, 400)!)).toBeCloseTo(expected400, 6);
  });

  it("before day 91 there is no support (observation period)", () => {
    const s = snap(day(50), "300000", fullBreakdown("300000"));
    const result = evaluateSchemeD({ ...BASE, observationStart: OBS, snapshots: [s] });
    expect(result.dailySupportSeries[0].supportUsd).toBeNull();
  });

  it("quarterly aggregation and $1M cap", () => {
    // $1B qualified stablecoin TVL generates > $1M support quickly — the
    // reported cumulative figure must respect the cap.
    const snapshots = Array.from({ length: 100 }, (_, i) =>
      snap(day(92 + i), "1000000000", { stablecoin: "1000000000" }),
    );
    const result = evaluateSchemeD({ ...BASE, observationStart: OBS, snapshots });
    const cumulative = result.evaluation.metrics.find((m) => m.key === "cumulative_support_cap")!;
    const sum = result.quarterly.reduce((a, q) => a + Number(q.supportUsd), 0);
    expect(sum).toBeGreaterThan(1_000_000); // raw sum breaches the cap...
    expect(Number(cumulative.value)).toBe(1_000_000); // ...reported value is capped
  });
});

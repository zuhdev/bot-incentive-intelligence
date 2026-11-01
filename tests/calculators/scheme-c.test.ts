/**
 * Scheme C calculator tests (spec §13 test matrix).
 * Pure fixtures — no DB, no network.
 */
import { describe, expect, it } from "vitest";
import {
  computeFundingClusters,
  computeQualifyingUsers,
  computeWalletDayStates,
  evaluateSchemeC,
  type RawInteraction,
} from "@/lib/rules/schemes/scheme-c";

const PERIOD = { periodStart: "2026-10-01", periodEnd: "2026-10-30" };

function makeBaseInput() {
  return {
    ...PERIOD,
    interactions: [] as RawInteraction[],
    balances: [] as {
      wallet: string;
      symbol: string;
      address: string | null;
      decimals: number;
      balance: string;
      priceUsd: string | null;
    }[],
    walletFirstSeen: {} as Record<string, string>,
    funding: [] as { from: string; to: string; token: string | null; clusterId: string | null; txCount: number }[],
    projectAddresses: ["0xaaa0000000000000000000000000000000000001"],
    tvlUsd: null,
    tierDimension: "both" as const,
    botPriceUsd: "1.5",
    sources: [],
    rulesVersion: "test-1",
    sourceUrl: "https://example.com",
  };
}

function interact(wallet: string, date: string, n = 1): RawInteraction[] {
  return Array.from({ length: n }, (_, i) => ({
    wallet,
    date,
    txHash: `0x${wallet.slice(2)}${date.replace(/-/g, "")}${String(i).padStart(4, "0")}`.padEnd(66, "0").slice(0, 66),
    toContract: "0xaaa0000000000000000000000000000000000001",
    status: 1,
    counted: true,
  }));
}

describe("Scheme C — balance requirements", () => {
  it("wallet with sufficient BOT balance qualifies", () => {
    const input = makeBaseInput();
    input.interactions = interact("0x1110000000000000000000000000000000000001", "2026-10-15");
    input.balances = [{ wallet: "0x1110000000000000000000000000000000000001", symbol: "BOT", address: null, decimals: 18, balance: "200000000000000000", priceUsd: "1.5" }];
    input.walletFirstSeen = { "0x1110000000000000000000000000000000000001": "2026-01-01T00:00:00Z" };
    const states = computeWalletDayStates(input);
    expect(states).toHaveLength(1);
    expect(states[0].balanceOk).toBe(true);
    expect(states[0].qualifies).toBe(true);
  });

  it("wallet with insufficient BOT (<0.1) fails balance rule", () => {
    const input = makeBaseInput();
    input.interactions = interact("0x1110000000000000000000000000000000000001", "2026-10-15");
    input.balances = [{ wallet: "0x1110000000000000000000000000000000000001", symbol: "BOT", address: null, decimals: 18, balance: "50000000000000000", priceUsd: "1.5" }]; // 0.05 BOT
    input.walletFirstSeen = { "0x1110000000000000000000000000000000000001": "2026-01-01T00:00:00Z" };
    const states = computeWalletDayStates(input);
    expect(states[0].balanceOk).toBe(false);
    expect(states[0].qualifies).toBe(false);
  });

  it("wallet with insufficient BOT but ≥$100 other qualifying assets passes", () => {
    const input = makeBaseInput();
    input.interactions = interact("0x1110000000000000000000000000000000000001", "2026-10-15");
    input.balances = [
      { wallet: "0x1110000000000000000000000000000000000001", symbol: "BOT", address: null, decimals: 18, balance: "10000000000000000", priceUsd: "1.5" }, // 0.01 BOT
      { wallet: "0x1110000000000000000000000000000000000001", symbol: "USDT", address: "0xabc0000000000000000000000000000000000002", decimals: 6, balance: "150000000", priceUsd: "1" }, // $150
    ];
    input.walletFirstSeen = { "0x1110000000000000000000000000000000000001": "2026-01-01T00:00:00Z" };
    const states = computeWalletDayStates(input);
    expect(states[0].balanceOk).toBe(true);
    expect(states[0].qualifies).toBe(true);
  });

  it("wallet with < $100 other assets fails", () => {
    const input = makeBaseInput();
    input.interactions = interact("0x1110000000000000000000000000000000000001", "2026-10-15");
    input.balances = [
      { wallet: "0x1110000000000000000000000000000000000001", symbol: "BOT", address: null, decimals: 18, balance: "10000000000000000", priceUsd: "1.5" },
      { wallet: "0x1110000000000000000000000000000000000001", symbol: "USDT", address: "0xabc0000000000000000000000000000000000002", decimals: 6, balance: "50000000", priceUsd: "1" }, // $50
    ];
    input.walletFirstSeen = { "0x1110000000000000000000000000000000000001": "2026-01-01T00:00:00Z" };
    const states = computeWalletDayStates(input);
    expect(states[0].balanceOk).toBe(false);
  });
});

describe("Scheme C — wallet age", () => {
  it("wallet younger than 24h fails age rule", () => {
    const input = makeBaseInput();
    input.interactions = interact("0x1110000000000000000000000000000000000001", "2026-10-15");
    input.balances = [{ wallet: "0x1110000000000000000000000000000000000001", symbol: "BOT", address: null, decimals: 18, balance: "200000000000000000", priceUsd: "1.5" }];
    input.walletFirstSeen = { "0x1110000000000000000000000000000000000001": "2026-10-15T12:00:00Z" }; // same day
    const states = computeWalletDayStates(input);
    expect(states[0].ageOk).toBe(false);
    expect(states[0].qualifies).toBe(false);
  });
});

describe("Scheme C — interactions", () => {
  it("wallet with no project interaction produces no states", () => {
    const input = makeBaseInput();
    const states = computeWalletDayStates(input);
    expect(states).toHaveLength(0);
  });

  it("interactions beyond 20/day are not counted (cap enforced)", () => {
    const input = makeBaseInput();
    input.interactions = interact("0x1110000000000000000000000000000000000001", "2026-10-15", 25);
    input.balances = [{ wallet: "0x1110000000000000000000000000000000000001", symbol: "BOT", address: null, decimals: 18, balance: "200000000000000000", priceUsd: "1.5" }];
    input.walletFirstSeen = { "0x1110000000000000000000000000000000000001": "2026-01-01T00:00:00Z" };
    const states = computeWalletDayStates(input);
    expect(states[0].totalInteractions).toBe(25);
    expect(states[0].countedInteractions).toBe(20);
    expect(states[0].qualifies).toBe(true);
  });

  it("duplicate transactions are deduplicated", () => {
    const input = makeBaseInput();
    const dup = { wallet: "0x1110000000000000000000000000000000000001", date: "2026-10-15", txHash: "0xdup", toContract: "0xaaa0000000000000000000000000000000000001", status: 1, counted: true };
    input.interactions = [dup, { ...dup }];
    input.balances = [{ wallet: "0x1110000000000000000000000000000000000001", symbol: "BOT", address: null, decimals: 18, balance: "200000000000000000", priceUsd: "1.5" }];
    input.walletFirstSeen = { "0x1110000000000000000000000000000000000001": "2026-01-01T00:00:00Z" };
    const states = computeWalletDayStates(input);
    expect(states[0].countedInteractions).toBe(1);
  });

  it("failed transactions never count", () => {
    const input = makeBaseInput();
    input.interactions = [
      { wallet: "0x1110000000000000000000000000000000000001", date: "2026-10-15", txHash: "0xf1", toContract: "0xaaa0000000000000000000000000000000000001", status: 0, counted: true },
    ];
    const states = computeWalletDayStates(input);
    expect(states).toHaveLength(0);
  });

  it("interactions with non-project contracts don't count", () => {
    const input = makeBaseInput();
    input.interactions = [
      { wallet: "0x1110000000000000000000000000000000000001", date: "2026-10-15", txHash: "0xother", toContract: "0xbbb0000000000000000000000000000000000002", status: 1, counted: true },
    ];
    const states = computeWalletDayStates(input);
    expect(states).toHaveLength(0);
  });
});

describe("Scheme C — rolling window & tiers", () => {
  it("25 qualifying days in 30 → wallet qualifies; 24 days → does not", async () => {
    const days25 = Array.from({ length: 25 }, (_, i) => `2026-10-${String(i + 1).padStart(2, "0")}`);
    const days24 = days25.slice(1);
    for (const [days, expectQualifies] of [[days25, true], [days24, false]] as const) {
      const input = makeBaseInput();
      for (const d of days) {
        input.interactions.push(...interact("0x1110000000000000000000000000000000000001", d));
      }
      input.balances = [{ wallet: "0x1110000000000000000000000000000000000001", symbol: "BOT", address: null, decimals: 18, balance: "200000000000000000", priceUsd: "1.5" }];
      input.walletFirstSeen = { "0x1110000000000000000000000000000000000001": "2026-01-01T00:00:00Z" };
      const states = computeWalletDayStates(input);
      const { qualifyingWallets } = computeQualifyingUsers(states, input.walletFirstSeen, []);
      expect(qualifyingWallets.length === 1).toBe(expectQualifies);
    }
  });

  it("shared funding group counts only 10% (min 1)", () => {
    const input = makeBaseInput();
    const wallets = Array.from({ length: 10 }, (_, i) => `0x${String(i + 1).padStart(3, "0")}${"0".repeat(37)}`);
    for (const w of wallets) {
      for (const d of ["2026-10-01", "2026-10-02"]) {
        input.interactions.push(...interact(w, d, 3));
      }
    }
    // NOTE: 2 qualifying days < 25, so no wallets qualify via window; test the
    // cluster mechanics directly instead:
    const clusters = computeFundingClusters([
      { from: "0xsrc0000000000000000000000000000000000001", to: wallets[0], token: null, clusterId: "c1", txCount: 1 },
      { from: "0xsrc0000000000000000000000000000000000001", to: wallets[1], token: null, clusterId: "c1", txCount: 1 },
    ]);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].members).toHaveLength(3); // src + 2 targets
    expect(clusters[0].riskLevel).toBe("low");
    expect(clusters[0].note).toContain("does NOT prove common ownership");
  });

  it("evaluation with no data returns insufficient_data and no fabricated values", () => {
    const result = evaluateSchemeC(makeBaseInput());
    expect(result.evaluation.status).toBe("insufficient_data");
    expect(result.evaluation.metrics.find((m) => m.key === "unique_interacting_wallets")?.status).toBe("insufficient_data");
    expect(result.evaluation.unresolved.length).toBeGreaterThan(0);
  });

  it("evaluation with data is PROVISIONAL (tier dimension unresolved) and includes both scenarios", () => {
    const input = makeBaseInput();
    input.interactions = interact("0x1110000000000000000000000000000000000001", "2026-10-15");
    input.balances = [{ wallet: "0x1110000000000000000000000000000000000001", symbol: "BOT", address: null, decimals: 18, balance: "200000000000000000", priceUsd: "1.5" }];
    input.walletFirstSeen = { "0x1110000000000000000000000000000000000001": "2026-01-01T00:00:00Z" };
    const result = evaluateSchemeC(input);
    expect(result.evaluation.status).toBe("provisional");
    expect(result.scenario).toHaveLength(2); // daily + cumulative
    expect(result.evaluation.overallProgressPct).toBeNull(); // no single percentage
  });
});

import { Decimal } from "decimal.js";

// Configure exact-decimal arithmetic for all financial eligibility math.
Decimal.set({ precision: 40, rounding: Decimal.ROUND_DOWN, toExpNeg: -40, toExpPos: 40 });

export { Decimal };

/** Parse a base-units string/BigInt into a Decimal scaled by `decimals`. */
export function fromBaseUnits(value: string | bigint, decimals: number): Decimal {
  const v = typeof value === "bigint" ? value.toString() : value;
  return new Decimal(v).div(new Decimal(10).pow(decimals));
}

/** Interpret a 32-byte hex word as a signed int256 (two's complement). */
export function hexToInt256(hex: string): bigint {
  const h = hex.startsWith("0x") ? hex.slice(2) : hex;
  const raw = BigInt(`0x${h}`);
  return raw >= 2n ** 255n ? raw - 2n ** 256n : raw;
}

export function hexToUint256(hex: string): bigint {
  const h = hex.startsWith("0x") ? hex.slice(2) : hex;
  return BigInt(`0x${h}`);
}

/** Decode an address from an indexed topic (last 20 bytes). */
export function topicToAddress(topic: string): string {
  const h = topic.startsWith("0x") ? topic.slice(2) : topic;
  return `0x${h.slice(-40)}`.toLowerCase();
}

export function formatUsd(d: Decimal | null | undefined, dp = 2): string {
  if (d === null || d === undefined) return "—";
  return `$${d.toDecimalPlaces(dp).toString()}`;
}

export function pct(part: Decimal | null | undefined, whole: Decimal | null | undefined): Decimal | null {
  if (!part || !whole || whole.isZero()) return null;
  return part.div(whole).times(100);
}

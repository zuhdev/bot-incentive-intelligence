/**
 * PoC shared helpers — live connectivity probes for BOT Chain data sources.
 * Every probe performs a REAL network request. No mock data anywhere.
 */

export type ProbeResult = {
  name: string;
  ok: boolean;
  ms: number;
  detail?: unknown;
  error?: string;
};

export async function timedFetch(
  name: string,
  url: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<ProbeResult & { json?: any; status?: number }> {
  const { timeoutMs = 30_000, ...initRest } = init;
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...initRest,
      signal: controller.signal,
      headers: { accept: "application/json", ...(initRest.headers ?? {}) },
    });
    const text = await res.text();
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      json = undefined;
    }
    return { name, ok: res.ok, ms: Date.now() - started, status: res.status, json };
  } catch (err) {
    return {
      name,
      ok: false,
      ms: Date.now() - started,
      error: err instanceof Error ? err.message : String(err),
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function rpc(
  method: string,
  params: unknown[],
  timeoutMs = 60_000,
): Promise<ProbeResult & { json?: any }> {
  const started = Date.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(process.env.BOT_MAINNET_RPC_URL ?? "https://rpc.botchain.ai", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    const json: any = await res.json();
    const ok = !json.error;
    return {
      name: `rpc:${method}`,
      ok,
      ms: Date.now() - started,
      error: json.error ? `${json.error.message} (code ${json.error.code})` : undefined,
      json,
    };
  } catch (err) {
    return {
      name: `rpc:${method}`,
      ok: false,
      ms: Date.now() - started,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export function weiToEth(hex: string, decimals = 18): string {
  const value = BigInt(hex);
  const base = 10n ** BigInt(decimals);
  const whole = value / base;
  const frac = (value % base).toString().padStart(decimals, "0").slice(0, 6);
  return `${whole}.${frac}`;
}

export function shortHex(hex?: string, keep = 10): string {
  if (!hex) return "";
  return hex.length <= keep * 2 + 2 ? hex : `${hex.slice(0, keep + 2)}…${hex.slice(-4)}`;
}

export const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
export const SWAP_V3_TOPIC = "0xc42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67";
export const SWAP_V2_TOPIC = "0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822";
export const MINT_V3_TOPIC = "0x7a53080ba414158be7ec69b987b5fb7d07dee101fe85488f0853ae16239d0bde";
export const BURN_V3_TOPIC = "0xdc420dac04262d31bf00627b616e836f722068679ae7f382317a54f8fb28cf43";

/** Live addresses verified during connectivity probing (see src/lib/chains.ts). */
export const KNOWN = {
  usdtWbotPool: "0x64f418471a1a7932a190e10da5a8551db5abec05",
  wbot: "0xd5452816194a3784dba983426cce7c122f4abd30",
  usdt: "0xababc7ddc03e501d190c676bf3d92ef0e6e87a3c",
  trader: "0xf76ecfbad4313b8daf1e2fe67f30682a9308e07c",
};

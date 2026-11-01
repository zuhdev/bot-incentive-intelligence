/**
 * Shared HTTP layer for all external providers.
 * Provides timeouts, bounded retries with backoff, and basic
 * 429 rate-limit handling. Never throws raw network errors upward —
 * returns typed failures so callers can degrade to INSUFFICIENT_DATA.
 */

export type HttpResult<T> =
  | { ok: true; data: T; status: number; ms: number }
  | { ok: false; error: string; status?: number; ms: number };

export interface HttpOptions extends RequestInit {
  timeoutMs?: number;
  retries?: number;
  retryDelayMs?: number;
}

export async function httpJson<T>(url: string, opts: HttpOptions = {}): Promise<HttpResult<T>> {
  const { timeoutMs = 20_000, retries = 2, retryDelayMs = 750, ...init } = opts;
  const started = Date.now();
  let lastError = "unknown error";
  let lastStatus: number | undefined;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...init, signal: controller.signal });
      clearTimeout(timer);
      lastStatus = res.status;
      if (res.status === 429 || res.status === 503) {
        lastError = `rate limited (${res.status})`;
        if (attempt < retries) {
          await sleep(retryDelayMs * 2 ** attempt);
          continue;
        }
      }
      if (!res.ok) {
        return { ok: false, error: `HTTP ${res.status} from ${url}`, status: res.status, ms: Date.now() - started };
      }
      const data = (await res.json()) as T;
      return { ok: true, data, status: res.status, ms: Date.now() - started };
    } catch (err) {
      clearTimeout(timer);
      lastError = err instanceof Error ? (err.name === "AbortError" ? `timeout after ${timeoutMs}ms` : err.message) : String(err);
      if (attempt < retries) {
        await sleep(retryDelayMs * 2 ** attempt);
        continue;
      }
    }
  }
  return { ok: false, error: lastError, status: lastStatus, ms: Date.now() - started };
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export function toQueryString(params: Record<string, string | number | boolean | undefined>): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
  }
  return qs.toString();
}

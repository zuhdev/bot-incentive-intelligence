import { NextResponse } from "next/server";
import { AuthError } from "@/lib/auth";
import { z } from "zod";

/** Shared JSON error handling for route handlers. */
export function jsonError(err: unknown) {
  if (err instanceof AuthError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  if (err instanceof z.ZodError) {
    return NextResponse.json({ error: "validation failed", issues: err.issues }, { status: 400 });
  }
  console.error("[api]", err);
  const message = err instanceof Error ? err.message : "internal error";
  // Never leak internals in production responses.
  return NextResponse.json(
    { error: process.env.NODE_ENV === "production" ? "internal error" : message },
    { status: 500 },
  );
}

/** Naive in-memory rate limiter (per-IP). Adequate for a single instance. */
const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, limit = 30, windowMs = 60_000): boolean {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  b.count++;
  return b.count <= limit;
}

export function clientKey(req: Request, suffix = ""): string {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  return `${ip}:${suffix}`;
}

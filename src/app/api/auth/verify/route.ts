import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyChallengeAndSignIn } from "@/lib/auth";
import { clientKey, jsonError, rateLimit } from "@/lib/api";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  address: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  signature: z.string().regex(/^0x[0-9a-fA-F]+$/),
});

export async function POST(req: Request) {
  try {
    if (!rateLimit(clientKey(req, "auth-verify"), 10, 60_000)) {
      return NextResponse.json({ error: "rate limited" }, { status: 429 });
    }
    const body = bodySchema.parse(await req.json());
    const result = await verifyChallengeAndSignIn(body.address, body.signature as `0x${string}`);
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: 401 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err);
  }
}

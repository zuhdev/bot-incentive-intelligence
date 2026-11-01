import { NextResponse } from "next/server";
import { z } from "zod";
import { createChallenge } from "@/lib/auth";
import { clientKey, jsonError, rateLimit } from "@/lib/api";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ address: z.string().regex(/^0x[0-9a-fA-F]{40}$/) });

export async function POST(req: Request) {
  try {
    if (!rateLimit(clientKey(req, "auth-challenge"), 10, 60_000)) {
      return NextResponse.json({ error: "rate limited" }, { status: 429 });
    }
    const body = bodySchema.parse(await req.json());
    const challenge = await createChallenge(body.address);
    return NextResponse.json(challenge);
  } catch (err) {
    return jsonError(err);
  }
}

import { NextResponse } from "next/server";
import { checkAllProviders } from "@/lib/providers/health";
import { clientKey, jsonError, rateLimit } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    if (!rateLimit(clientKey(req, "health"), 10, 60_000)) {
      return NextResponse.json({ error: "rate limited" }, { status: 429 });
    }
    const providers = await checkAllProviders();
    return NextResponse.json({
      status: providers.filter((p) => p.supported).every((p) => p.ok) ? "operational" : "degraded",
      checkedAt: new Date().toISOString(),
      providers,
    });
  } catch (err) {
    return jsonError(err);
  }
}

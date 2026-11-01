import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireProjectAccess } from "@/lib/auth";
import { jsonError } from "@/lib/api";
import { evaluateProjectSchemeC, evaluateProjectSchemeD, evaluateProjectGasRebate } from "@/lib/rules/evaluate";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await requireProjectAccess(id, "analyst");
    const url = new URL(req.url);
    const scheme = url.searchParams.get("scheme") ?? "all";

    const results: Record<string, unknown> = {};
    const run = async (code: string, fn: () => Promise<unknown>) => {
      try {
        results[code] = await fn();
      } catch (err) {
        results[code] = { error: err instanceof Error ? err.message : String(err) };
      }
    };

    if (scheme === "all" || scheme === "SCHEME_C") await run("SCHEME_C", () => evaluateProjectSchemeC(id));
    if (scheme === "all" || scheme === "SCHEME_D") await run("SCHEME_D", () => evaluateProjectSchemeD(id));
    if (scheme === "all" || scheme === "GAS_REBATE") await run("GAS_REBATE", () => evaluateProjectGasRebate(id));

    // Count of evaluations stored, for the UI
    const stored = await prisma.eligibilityResult.count({ where: { projectId: id } });
    return NextResponse.json({ ok: true, results, storedEligibilityResults: stored });
  } catch (err) {
    return jsonError(err);
  }
}

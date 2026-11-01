import { NextResponse } from "next/server";
import { ALL_DEFINITIONS } from "@/lib/rules/definitions";
import { jsonError } from "@/lib/api";

export const dynamic = "force-dynamic";

/** Public reference endpoint: versioned programme definitions with unresolved flags. */
export async function GET() {
  try {
    return NextResponse.json({
      disclaimer:
        "Programme definitions are captured from BOT's published ecosystem material and are versioned. Interpretations flagged as unresolved are NOT used for definitive eligibility results. BOT Chain retains authority over official eligibility.",
      schemes: ALL_DEFINITIONS,
    });
  } catch (err) {
    return jsonError(err);
  }
}

import { NextResponse } from "next/server";
import { getOverview } from "@/lib/overview";
import { jsonError } from "@/lib/api";

export const dynamic = "force-dynamic";

/** Workspace overview: ingestion status, projects, recent alerts. */
export async function GET() {
  try {
    const data = await getOverview();
    return NextResponse.json(data);
  } catch (err) {
    return jsonError(err);
  }
}

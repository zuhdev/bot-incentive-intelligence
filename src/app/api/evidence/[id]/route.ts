import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireProjectAccess } from "@/lib/auth";
import { jsonError } from "@/lib/api";
import { reportToCsv } from "@/lib/evidence";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const report = await prisma.evidenceReport.findUnique({ where: { id } });
    if (!report) return NextResponse.json({ error: "not found" }, { status: 404 });
    await requireProjectAccess(report.projectId);
    const format = new URL(req.url).searchParams.get("format") ?? "json";
    if (format === "csv") {
      const csv = reportToCsv(JSON.parse(report.payload));
      return new NextResponse(csv, {
        headers: {
          "content-type": "text/csv; charset=utf-8",
          "content-disposition": `attachment; filename="evidence-${report.schemeCode}-${report.id}.csv"`,
        },
      });
    }
    return NextResponse.json(JSON.parse(report.payload), {
      headers: { "content-disposition": `attachment; filename="evidence-${report.schemeCode}-${report.id}.json"` },
    });
  } catch (err) {
    return jsonError(err);
  }
}

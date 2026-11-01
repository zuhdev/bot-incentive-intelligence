import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireProjectAccess } from "@/lib/auth";
import { jsonError } from "@/lib/api";
import { generateEvidenceReport, reportToCsv } from "@/lib/evidence";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await requireProjectAccess(id);
    const reports = await prisma.evidenceReport.findMany({
      where: { projectId: id },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return NextResponse.json({
      reports: reports.map((r) => ({
        id: r.id,
        schemeCode: r.schemeCode,
        rulesVersion: r.rulesVersion,
        periodStart: r.periodStart,
        periodEnd: r.periodEnd,
        reportHash: r.reportHash,
        format: r.format,
        createdAt: r.createdAt,
      })),
    });
  } catch (err) {
    return jsonError(err);
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { member } = await requireProjectAccess(id, "analyst");
    const body = (await req.json().catch(() => ({}))) as { schemeCode?: string };
    const schemeCode = body.schemeCode ?? "SCHEME_C";
    const result = await generateEvidenceReport(id, schemeCode, member.userId);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return jsonError(err);
  }
}

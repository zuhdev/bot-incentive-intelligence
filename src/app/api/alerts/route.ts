import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser, requireProjectAccess } from "@/lib/auth";
import { jsonError } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ alerts: [] });
    const url = new URL(req.url);
    const status = url.searchParams.get("status") ?? "open";
    const memberships = await prisma.projectMember.findMany({ where: { userId: user.id }, select: { projectId: true } });
    const alerts = await prisma.alert.findMany({
      where: { projectId: { in: memberships.map((m) => m.projectId) }, ...(status !== "all" ? { status } : {}) },
      include: { project: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return NextResponse.json({ alerts });
  } catch (err) {
    return jsonError(err);
  }
}

export async function PATCH(req: Request) {
  try {
    const body = (await req.json()) as { alertId?: string; status?: "acknowledged" | "resolved" };
    if (!body.alertId || !body.status) return NextResponse.json({ error: "alertId and status required" }, { status: 400 });
    const alert = await prisma.alert.findUnique({ where: { id: body.alertId } });
    if (!alert) return NextResponse.json({ error: "not found" }, { status: 404 });
    await requireProjectAccess(alert.projectId, "analyst");
    const updated = await prisma.alert.update({
      where: { id: body.alertId },
      data: { status: body.status, resolvedAt: body.status === "resolved" ? new Date() : null },
    });
    return NextResponse.json({ alert: updated });
  } catch (err) {
    return jsonError(err);
  }
}

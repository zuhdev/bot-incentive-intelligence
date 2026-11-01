import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireProjectAccess } from "@/lib/auth";
import { jsonError } from "@/lib/api";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(2000).optional(),
  website: z.string().url().optional().or(z.literal("")),
  category: z.enum(["defi", "gaming", "infra", "nft", "social", "other"]).optional(),
  deployStatus: z.enum(["planned", "testnet", "mainnet"]).optional(),
  defiLlamaSlug: z.string().max(100).optional().or(z.literal("")),
});

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await requireProjectAccess(id);
    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        addresses: true,
        schemes: { include: { scheme: true } },
        alerts: { where: { status: "open" }, orderBy: { createdAt: "desc" }, take: 20 },
        tvlSnapshots: { orderBy: { date: "asc" }, take: 200 },
        evidence: { orderBy: { createdAt: "desc" }, take: 10 },
      },
    });
    if (!project) return NextResponse.json({ error: "not found" }, { status: 404 });
    const metrics = await prisma.projectMetric.findMany({ where: { projectId: id }, orderBy: { evaluatedAt: "desc" }, take: 200 });
    const eligibility = await prisma.eligibilityResult.findMany({ where: { projectId: id }, orderBy: { calculatedAt: "desc" }, take: 50 });
    return NextResponse.json({ project, metrics, eligibility });
  } catch (err) {
    return jsonError(err);
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await requireProjectAccess(id, "admin");
    const body = patchSchema.parse(await req.json());
    const project = await prisma.project.update({
      where: { id },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.website !== undefined ? { website: body.website || null } : {}),
        ...(body.category !== undefined ? { category: body.category } : {}),
        ...(body.deployStatus !== undefined ? { deployStatus: body.deployStatus } : {}),
        ...(body.defiLlamaSlug !== undefined ? { defiLlamaSlug: body.defiLlamaSlug || null } : {}),
      },
    });
    return NextResponse.json({ project });
  } catch (err) {
    return jsonError(err);
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await requireProjectAccess(id, "owner");
    await prisma.project.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err);
  }
}

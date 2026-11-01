import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireProjectAccess } from "@/lib/auth";
import { jsonError } from "@/lib/api";
import env from "@/lib/env";

export const dynamic = "force-dynamic";

const addressSchema = z.object({
  address: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  label: z.string().max(100).optional(),
  type: z.enum(["project_contract", "token_contract", "treasury", "team_wallet", "dex_pool", "user_contract", "other"]).default("other"),
  schemes: z.array(z.string()).default([]),
});

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await requireProjectAccess(id);
    const addresses = await prisma.projectAddress.findMany({ where: { projectId: id }, orderBy: { createdAt: "asc" } });
    return NextResponse.json({ addresses });
  } catch (err) {
    return jsonError(err);
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await requireProjectAccess(id, "analyst");
    const body = addressSchema.parse(await req.json());
    const address = await prisma.projectAddress.upsert({
      where: { projectId_address_chainId: { projectId: id, address: body.address.toLowerCase(), chainId: env.BOT_CHAIN_ID } },
      create: {
        projectId: id,
        chainId: env.BOT_CHAIN_ID,
        address: body.address.toLowerCase(),
        label: body.label ?? null,
        type: body.type,
        schemes: JSON.stringify(body.schemes),
      },
      update: { label: body.label ?? null, type: body.type, schemes: JSON.stringify(body.schemes) },
    });
    return NextResponse.json({ address }, { status: 201 });
  } catch (err) {
    return jsonError(err);
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await requireProjectAccess(id, "analyst");
    const url = new URL(req.url);
    const addressId = url.searchParams.get("addressId");
    if (!addressId) return NextResponse.json({ error: "addressId required" }, { status: 400 });
    await prisma.projectAddress.deleteMany({ where: { id: addressId, projectId: id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err);
  }
}

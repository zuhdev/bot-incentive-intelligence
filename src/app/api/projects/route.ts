import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSessionUser, requireSession } from "@/lib/auth";
import { clientKey, jsonError, rateLimit } from "@/lib/api";
import env from "@/lib/env";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(2000).optional(),
  website: z.string().url().optional().or(z.literal("")),
  category: z.enum(["defi", "gaming", "infra", "nft", "social", "other"]).default("other"),
  deployStatus: z.enum(["planned", "testnet", "mainnet"]).optional(),
  defiLlamaSlug: z.string().max(100).optional().or(z.literal("")),
  logoUrl: z.string().url().optional().or(z.literal("")),
});

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ projects: [] });
    const memberships = await prisma.projectMember.findMany({
      where: { userId: user.id },
      include: { project: { include: { addresses: { select: { id: true } }, schemes: true } } },
    });
    return NextResponse.json({
      projects: memberships.map((m) => ({
        ...m.project,
        role: m.role,
        addressCount: m.project.addresses.length,
        schemeCount: m.project.schemes.length,
      })),
    });
  } catch (err) {
    return jsonError(err);
  }
}

export async function POST(req: Request) {
  try {
    if (!rateLimit(clientKey(req, "project-create"), 10, 60_000)) {
      return NextResponse.json({ error: "rate limited" }, { status: 429 });
    }
    const user = await requireSession();
    const body = createSchema.parse(await req.json());

    const project = await prisma.project.create({
      data: {
        name: body.name,
        description: body.description ?? null,
        website: body.website || null,
        logoUrl: body.logoUrl || null,
        category: body.category,
        deployStatus: body.deployStatus ?? (env.BOT_NETWORK === "testnet" ? "testnet" : "planned"),
        defiLlamaSlug: body.defiLlamaSlug || null,
        members: { create: { userId: user.id, role: "owner" } },
        schemes: {
          create: [
            { scheme: { connect: { code: "SCHEME_C" } } },
            { scheme: { connect: { code: "SCHEME_D" } } },
            { scheme: { connect: { code: "GAS_REBATE" } } },
          ],
        },
      },
      include: { schemes: true },
    });
    return NextResponse.json({ project }, { status: 201 });
  } catch (err) {
    return jsonError(err);
  }
}

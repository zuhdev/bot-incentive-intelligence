import { NextResponse } from "next/server";
import { getSessionUser, signOut } from "@/lib/auth";
import { jsonError } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getSessionUser();
    return NextResponse.json({ user });
  } catch (err) {
    return jsonError(err);
  }
}

export async function DELETE() {
  try {
    await signOut();
    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err);
  }
}

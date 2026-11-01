/**
 * Authentication: wallet-signature ownership proof + server-side sessions.
 *
 * - Ownership is proven exclusively via personal_sign message signing
 *   (never private keys/seed phrases; never transaction signing).
 * - Sessions are opaque random tokens stored as SHA-256 hashes (leak of DB
 *   does not leak usable session tokens), delivered as httpOnly cookies.
 * - Challenge nonces are single-use and expire in 10 minutes (replay guard).
 */
import { randomBytes, createHash } from "node:crypto";
import { cookies } from "next/headers";
import { verifyMessage } from "viem";
import { databaseAvailable, prisma } from "@/lib/db";
import env from "@/lib/env";

const SESSION_COOKIE = "bii_session";
const SESSION_TTL_MS = 7 * 24 * 3600_000;
const CHALLENGE_TTL_MS = 10 * 60_000;

export function normalizeAddress(a: string): string {
  const trimmed = a.trim().toLowerCase();
  if (!/^0x[0-9a-f]{40}$/.test(trimmed)) throw new Error("invalid address");
  return trimmed;
}

function buildChallengeMessage(address: string, nonce: string, domain: string): string {
  return [
    `${domain} wants you to sign in with your BOT Chain account:`,
    address,
    "",
    "By signing you confirm ownership of this wallet address.",
    "This signature does NOT authorize any transaction or transfer of funds.",
    "",
    `Nonce: ${nonce}`,
  ].join("\n");
}

export async function createChallenge(address: string): Promise<{ message: string; nonce: string }> {
  if (!databaseAvailable) throw new AuthError("Wallet sign-in is unavailable until a database is configured.", 503);
  const addr = normalizeAddress(address);
  const nonce = randomBytes(16).toString("hex");
  const domain = env.NEXT_PUBLIC_APP_URL.replace(/^https?:\/\//, "");
  const wallet = await prisma.wallet.upsert({
    where: { address: addr },
    create: { address: addr, chainId: env.BOT_CHAIN_ID },
    update: {},
  });
  await prisma.authChallenge.create({
    data: {
      walletId: wallet.id,
      nonce,
      message: buildChallengeMessage(addr, nonce, domain),
      expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS),
    },
  });
  const challenge = await prisma.authChallenge.findUniqueOrThrow({ where: { nonce } });
  return { message: challenge.message, nonce };
}

export async function verifyChallengeAndSignIn(
  address: string,
  signature: `0x${string}`,
): Promise<{ sessionToken: string } | { error: string }> {
  if (!databaseAvailable) throw new AuthError("Wallet sign-in is unavailable until a database is configured.", 503);
  const addr = normalizeAddress(address);
  const wallet = await prisma.wallet.findUnique({ where: { address: addr } });
  if (!wallet) return { error: "no challenge found for this address" };

  const challenge = await prisma.authChallenge.findFirst({
    where: { walletId: wallet.id, consumedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  if (!challenge) return { error: "challenge expired or already used" };

  let valid = false;
  try {
    valid = await verifyMessage({ address: addr as `0x${string}`, message: challenge.message, signature });
  } catch {
    valid = false;
  }
  if (!valid) return { error: "signature verification failed" };

  await prisma.authChallenge.update({ where: { id: challenge.id }, data: { consumedAt: new Date() } });
  await prisma.wallet.update({ where: { id: wallet.id }, data: { verifiedAt: new Date(), verifiedBy: "personal_sign" } });

  // Auto-provision a user for this wallet.
  let userId = wallet.userId;
  if (!userId) {
    const user = await prisma.user.create({ data: { displayName: `Owner ${addr.slice(0, 6)}` } });
    await prisma.wallet.update({ where: { id: wallet.id }, data: { userId: user.id } });
    userId = user.id;
  }

  const token = randomBytes(32).toString("hex");
  await prisma.session.create({
    data: {
      userId,
      tokenHash: createHash("sha256").update(token).digest("hex"),
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    },
  });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
  return { sessionToken: token };
}

export interface SessionUser {
  id: string;
  displayName: string | null;
  role: string;
}

export async function getSessionUser(): Promise<SessionUser | null> {
  if (!databaseAvailable) return null;
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await prisma.session.findUnique({
    where: { tokenHash: createHash("sha256").update(token).digest("hex") },
    include: { user: true },
  });
  if (!session || session.expiresAt < new Date()) return null;
  return { id: session.user.id, displayName: session.user.displayName, role: session.user.role };
}

export async function requireSession(): Promise<SessionUser> {
  if (!databaseAvailable) throw new AuthError("This preview is read-only. Configure PostgreSQL to enable sign-in and workspaces.", 503);
  const user = await getSessionUser();
  if (!user) throw new AuthError("authentication required", 401);
  return user;
}

export async function requireProjectAccess(projectId: string, minRole: "viewer" | "analyst" | "admin" | "owner" = "viewer") {
  const user = await requireSession();
  const member = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId: user.id } },
  });
  if (!member) throw new AuthError("no access to this project", 403);
  const hierarchy = { viewer: 0, analyst: 1, admin: 2, owner: 3 } as const;
  if (hierarchy[member.role as keyof typeof hierarchy] ?? 0 < hierarchy[minRole]) {
    throw new AuthError(`role ${member.role} insufficient for ${minRole}`, 403);
  }
  return { user, member };
}

export class AuthError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = "AuthError";
  }
}

export async function signOut() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (databaseAvailable && token) {
    await prisma.session.deleteMany({
      where: { tokenHash: createHash("sha256").update(token).digest("hex") },
    });
  }
  jar.delete(SESSION_COOKIE);
}

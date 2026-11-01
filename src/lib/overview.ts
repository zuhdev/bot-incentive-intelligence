/**
 * Overview data service — shared by the API route and server components
 * (avoids self-fetching and keeps read logic in one place).
 */
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { databaseAvailable } from "@/lib/db";

export async function getOverview() {
  if (!databaseAvailable) return { authenticated: false as const, databaseAvailable: false as const };
  const user = await getSessionUser();
  if (!user) return { authenticated: false as const, databaseAvailable: true as const };

  const memberships = await prisma.projectMember.findMany({
    where: { userId: user.id },
    include: { project: { include: { addresses: true, schemes: true } } },
  });
  const projectIds = memberships.map((m) => m.projectId);

  const [addressCount, alertCount, tvlPoints, swapEvents, transfers, latestBlock, providers] = await Promise.all([
    prisma.projectAddress.count({ where: { projectId: { in: projectIds } } }),
    prisma.alert.count({ where: { projectId: { in: projectIds }, status: "open" } }),
    prisma.tvlSnapshot.count({ where: { projectId: { in: projectIds } } }),
    prisma.dexSwapEvent.count(),
    prisma.transferEvent.count(),
    prisma.block.findFirst({ orderBy: { id: "desc" } }),
    prisma.dataProvider.findMany({ orderBy: { name: "asc" } }),
  ]);

  const recentAlerts = await prisma.alert.findMany({
    where: { projectId: { in: projectIds }, status: "open" },
    orderBy: { createdAt: "desc" },
    take: 10,
    include: { project: { select: { name: true } } },
  });

  return {
    authenticated: true as const,
    databaseAvailable: true as const,
    stats: {
      projects: memberships.length,
      trackedAddresses: addressCount,
      activeProgrammes: [...new Set(memberships.flatMap((m) => m.project.schemes.map((s) => s.schemeId)))].length,
      tvlDataPoints: tvlPoints,
      swapEvents,
      transferEvents: transfers,
      openAlerts: alertCount,
      latestBlock: latestBlock ? Number(latestBlock.id) : null,
      latestBlockTime: latestBlock?.timestamp ?? null,
      providers,
    },
    projects: memberships.map((m) => ({
      id: m.project.id,
      name: m.project.name,
      category: m.project.category,
      role: m.role,
      addressCount: m.project.addresses.length,
    })),
    recentAlerts,
  };
}

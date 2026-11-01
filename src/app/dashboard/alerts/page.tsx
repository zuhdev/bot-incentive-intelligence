import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AlertsPage() {
  const user = await getSessionUser();
  if (!user) {
    return <div className="py-16 text-center text-sm text-[var(--color-text-secondary)]">Connect your wallet to view alerts.</div>;
  }
  const memberships = await prisma.projectMember.findMany({ where: { userId: user.id }, select: { projectId: true } });
  const alerts = await prisma.alert.findMany({
    where: { projectId: { in: memberships.map((m) => m.projectId) } },
    include: { project: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Alerts</h1>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          Threshold approaches, breaches and data gaps. Data unavailability is never reported as a breach.
        </p>
      </div>
      {alerts.length === 0 && (
        <div className="rounded-lg border border-dashed border-[var(--color-border-strong)] p-8 text-center text-sm text-[var(--color-text-muted)]">
          No alerts recorded.
        </div>
      )}
      <div className="space-y-2">
        {alerts.map((a) => (
          <div key={a.id} className="flex items-start justify-between gap-4 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-secondary)] px-4 py-3">
            <div>
              <p className="text-sm text-white">{a.title}</p>
              {a.body && <p className="mt-1 text-xs text-[var(--color-text-secondary)]">{a.body}</p>}
              <p className="mt-1 text-[11px] text-[var(--color-text-muted)]">
                {a.project.name} · {a.kind.replace(/_/g, " ")} · {a.createdAt.toISOString().slice(0, 16).replace("T", " ")} UTC
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <span className={`text-[10px] font-semibold uppercase ${a.severity === "critical" ? "text-[var(--color-red)]" : a.severity === "warning" ? "text-[var(--color-amber)]" : "text-[var(--color-text-muted)]"}`}>
                {a.severity}
              </span>
              <span className={`text-[10px] uppercase ${a.status === "open" ? "text-[var(--color-blue)]" : "text-[var(--color-text-muted)]"}`}>{a.status}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

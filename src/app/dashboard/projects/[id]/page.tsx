import { prisma } from "@/lib/db";
import { requireProjectAccess } from "@/lib/auth";
import { AuthError } from "@/lib/auth";
import Link from "next/link";
import { StatusBadge } from "@/components/status-badge";
import { MetricCard } from "@/components/metric-card";
import { RunActions } from "./run-actions";
import { AddressManager } from "./address-manager";

export const dynamic = "force-dynamic";

function MetricCardFromRow({ m }: { m: { metricKey: string; status: string; value: string | null; target: string | null; progressPct: unknown; methodology: string | null; unresolved: string | null; evaluatedAt: Date; rulesVersion: string } }) {
  return (
    <MetricCard
      metric={{
        key: m.metricKey,
        label: m.metricKey.replace(/_/g, " "),
        value: m.value,
        display: m.value ?? "—",
        target: m.target,
        progressPct: m.progressPct === null || m.progressPct === undefined ? null : Number(m.progressPct),
        status: m.status as never,
        sources: [],
        methodology: m.methodology ?? undefined,
        unresolved: m.unresolved ? JSON.parse(m.unresolved) : [],
        notes: `evaluated ${m.evaluatedAt.toISOString().slice(0, 16).replace("T", " ")} UTC · rules ${m.rulesVersion}`,
      }}
    />
  );
}

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await requireProjectAccess(id);
  } catch (err) {
    if (err instanceof AuthError && err.status === 401) {
      return (
        <div className="py-16 text-center">
          <h1 className="text-xl font-semibold">Authentication required</h1>
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">Connect your wallet to view this project.</p>
          <Link href="/dashboard" className="mt-4 inline-block text-sm text-[var(--color-accent-green)]">← Back to overview</Link>
        </div>
      );
    }
    if (err instanceof AuthError && err.status === 403) {
      return (
        <div className="py-16 text-center">
          <h1 className="text-xl font-semibold">No access</h1>
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">Your account is not a member of this project workspace.</p>
        </div>
      );
    }
    throw err;
  }

  const project = await prisma.project.findUnique({
    where: { id },
    include: { addresses: true, schemes: { include: { scheme: true } } },
  });
  if (!project) return <div className="py-16 text-center text-sm text-[var(--color-text-muted)]">Project not found.</div>;

  const metrics = await prisma.projectMetric.findMany({ where: { projectId: id }, orderBy: [{ evaluatedAt: "desc" }, { metricKey: "asc" }], take: 120 });
  const eligibility = await prisma.eligibilityResult.findMany({ where: { projectId: id }, orderBy: { calculatedAt: "desc" }, take: 10 });
  const alerts = await prisma.alert.findMany({ where: { projectId: id, status: "open" }, orderBy: { createdAt: "desc" }, take: 10 });

  // latest metrics per scheme
  type MetricRow = {
    id: string;
    schemeId: string;
    metricKey: string;
    status: string;
    value: string | null;
    target: string | null;
    progressPct: unknown;
    methodology: string | null;
    unresolved: string | null;
    evaluatedAt: Date;
    rulesVersion: string;
  };
  const latestByScheme = new Map<string, MetricRow>();
  for (const m of metrics) {
    const key = `${m.schemeId}:${m.metricKey}`;
    if (!latestByScheme.has(key)) latestByScheme.set(key, m);
  }
  const grouped = new Map<string, MetricRow[]>();
  for (const m of latestByScheme.values()) {
    grouped.set(m.schemeId, [...(grouped.get(m.schemeId) ?? []), m]);
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold">{project.name}</h1>
            <span className="rounded border border-[var(--color-border-strong)] px-2 py-0.5 text-[10px] uppercase text-[var(--color-text-muted)]">{project.deployStatus}</span>
          </div>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{project.description ?? "No description."}</p>
          {project.defiLlamaSlug && (
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">
              DeFiLlama: <span className="font-mono">{project.defiLlamaSlug}</span>
            </p>
          )}
        </div>
        <RunActions projectId={id} />
      </div>

      {eligibility.length > 0 && (
        <section className="grid gap-3 md:grid-cols-3">
          {eligibility.slice(0, 3).map((e) => (
            <div key={e.id} className="rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-secondary)] p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">{e.schemeCode.replace("SCHEME_", "Scheme ")}</p>
                <StatusBadge status={e.status} />
              </div>
              <p className="mt-2 font-mono text-lg text-white">
                {e.scorePct !== null ? `${Number(e.scorePct).toFixed(1)}%` : "—"}
              </p>
              <p className="mt-1 text-[11px] text-[var(--color-text-muted)]">rules {e.rulesVersion} · {e.calculatedAt.toISOString().slice(0, 10)}</p>
            </div>
          ))}
        </section>
      )}

      {[...grouped.entries()].map(([schemeId, schemeMetrics]) => (
        <section key={schemeId}>
          <div className="mb-3 flex items-center gap-3">
            <h2 className="text-sm font-medium text-[var(--color-text-secondary)]">{schemeId === "GAS_REBATE" ? "Gas Rebate Tracking" : schemeId.replace("SCHEME_", "Scheme ")}</h2>
            <StatusBadge status={schemeMetrics[0].status} />
          </div>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {schemeMetrics.map((m) => <MetricCardFromRow key={m.id} m={m} />)}
          </div>
        </section>
      ))}

      {metrics.length === 0 && (
        <div className="rounded-lg border border-dashed border-[var(--color-border-strong)] p-8 text-center text-sm text-[var(--color-text-muted)]">
          No evaluations yet. Register addresses, then use <span className="text-white">Run ingestion</span> to import data and <span className="text-white">Run evaluation</span> to calculate readiness.
        </div>
      )}

      <AddressManager projectId={id} addresses={project.addresses.map((a) => ({ id: a.id, address: a.address, label: a.label, type: a.type, verified: a.verified }))} />

      {alerts.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-medium text-[var(--color-text-secondary)]">Open alerts</h2>
          <div className="space-y-2">
            {alerts.map((a) => (
              <div key={a.id} className="rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-secondary)] px-4 py-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm">{a.title}</p>
                  <span className={`text-[10px] font-semibold uppercase ${a.severity === "critical" ? "text-[var(--color-red)]" : a.severity === "warning" ? "text-[var(--color-amber)]" : "text-[var(--color-text-muted)]"}`}>{a.severity}</span>
                </div>
                {a.body && <p className="mt-1 text-xs text-[var(--color-text-muted)]">{a.body}</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-secondary)] p-6">
        <h2 className="text-sm font-medium text-white">Evidence reports</h2>
        <p className="mt-1 text-xs text-[var(--color-text-muted)]">Generate deterministic, hash-stamped reports from the Evidence Centre.</p>
        <Link href="/dashboard/evidence" className="mt-3 inline-block text-sm text-[var(--color-accent-green)]">Open Evidence Centre →</Link>
      </section>
    </div>
  );
}

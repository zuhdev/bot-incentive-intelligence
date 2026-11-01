import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import Link from "next/link";
import { StatusBadge } from "@/components/status-badge";
import { databaseAvailable } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function EvidencePage() {
  if (!databaseAvailable) {
    return <div className="py-16 text-center text-sm text-[var(--color-text-secondary)]">Evidence reports require PostgreSQL storage. The rest of the preview remains available.</div>;
  }
  const user = await getSessionUser();
  if (!user) {
    return (
      <div className="py-16 text-center">
        <h1 className="text-xl font-semibold">Connect your wallet</h1>
        <p className="mt-2 text-sm text-[var(--color-text-secondary)]">Evidence Centre requires authentication.</p>
      </div>
    );
  }
  const memberships = await prisma.projectMember.findMany({
    where: { userId: user.id },
    include: { project: { include: { evidence: { orderBy: { createdAt: "desc" }, take: 10 } } } },
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold">Evidence Centre</h1>
        <p className="mt-1 max-w-2xl text-sm text-[var(--color-text-secondary)]">
          Deterministic, hash-stamped reports preserving project identity, rules version, calculation
          period, data sources, retrieval timestamps, price provenance, methodology, exclusions and
          unresolved assumptions. Reports are independent evidence — never official BOT approval.
        </p>
      </div>

      {memberships.map((m) => (
        <section key={m.project.id}>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-medium text-white">{m.project.name}</h2>
            <span className="text-xs text-[var(--color-text-muted)]">{m.project.evidence.length} report(s)</span>
          </div>
          {m.project.evidence.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[var(--color-border-strong)] p-6 text-center text-xs text-[var(--color-text-muted)]">
              No reports yet. Run an evaluation on the project, then generate a report via the API
              (<span className="font-mono">POST /api/projects/{m.project.id.slice(0, 8)}…/evidence</span>).
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-[var(--color-border-subtle)]">
              <table className="w-full text-sm">
                <thead className="bg-[var(--color-bg-secondary)] text-left text-xs text-[var(--color-text-muted)]">
                  <tr>
                    <th className="px-4 py-2 font-medium">Scheme</th>
                    <th className="px-4 py-2 font-medium">Period</th>
                    <th className="px-4 py-2 font-medium">Rules</th>
                    <th className="px-4 py-2 font-medium">Report hash</th>
                    <th className="px-4 py-2 font-medium">Created</th>
                    <th className="px-4 py-2 font-medium">Exports</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border-subtle)]">
                  {m.project.evidence.map((r) => (
                    <tr key={r.id}>
                      <td className="px-4 py-2 text-xs">{r.schemeCode.replace("SCHEME_", "Scheme ")}</td>
                      <td className="px-4 py-2 text-xs text-[var(--color-text-secondary)]">
                        {r.periodStart.toISOString().slice(0, 10)} → {r.periodEnd.toISOString().slice(0, 10)}
                      </td>
                      <td className="px-4 py-2 font-mono text-xs text-[var(--color-text-muted)]">{r.rulesVersion}</td>
                      <td className="px-4 py-2 font-mono text-xs text-[var(--color-accent-green)]" title={r.reportHash}>
                        {r.reportHash.slice(0, 12)}…
                      </td>
                      <td className="px-4 py-2 text-xs text-[var(--color-text-muted)]">{r.createdAt.toISOString().slice(0, 16).replace("T", " ")} UTC</td>
                      <td className="px-4 py-2 text-xs">
                        <a href={`/api/evidence/${r.id}?format=json`} className="mr-3 text-[var(--color-accent-green)] hover:underline">JSON</a>
                        <a href={`/api/evidence/${r.id}?format=csv`} className="text-[var(--color-accent-green)] hover:underline">CSV</a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ))}

      {memberships.length === 0 && (
        <div className="rounded-lg border border-dashed border-[var(--color-border-strong)] p-8 text-center text-sm text-[var(--color-text-muted)]">
          No projects yet. <Link href="/dashboard/projects" className="text-[var(--color-accent-green)]">Create a project</Link> first.
        </div>
      )}
    </div>
  );
}

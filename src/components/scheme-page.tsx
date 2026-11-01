import { ALL_DEFINITIONS } from "@/lib/rules/definitions";
import { StatusBadge } from "@/components/status-badge";
import Link from "next/link";

/**
 * Shared scheme reference page. Shows the versioned rules, tier seeds,
 * unresolved interpretations and the platform's live data coverage for that
 * scheme's data sources.
 */
export function SchemePage({ code, dataSources }: { code: string; dataSources: { name: string; detail: string }[] }) {
  const def = ALL_DEFINITIONS.find((d) => d.code === code);
  if (!def) return <div className="py-16 text-center text-sm text-[var(--color-text-muted)]">Unknown scheme.</div>;

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold">{def.name}</h1>
          <StatusBadge status={def.unresolvedInterpretations.length > 0 ? "provisional" : "verified"} />
        </div>
        <p className="mt-1 max-w-2xl text-sm text-[var(--color-text-secondary)]">{def.description}</p>
        <p className="mt-1 text-xs text-[var(--color-text-muted)]">
          Rules version <span className="font-mono">{def.version}</span> · effective {def.effectiveAt} ·{" "}
          <a href={def.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-[var(--color-accent-green)] hover:underline">official source ↗</a>
        </p>
      </div>

      {def.unresolvedInterpretations.length > 0 && (
        <div className="space-y-2">
          {def.unresolvedInterpretations.map((u) => (
            <div key={u} className="rounded-md border border-[var(--color-amber)]/30 bg-[var(--color-amber)]/5 px-4 py-3 text-xs leading-relaxed text-[var(--color-amber)]">
              ⚠ Unresolved interpretation — {u}
            </div>
          ))}
        </div>
      )}

      <section>
        <h2 className="mb-3 text-sm font-medium text-[var(--color-text-secondary)]">Rules ({Object.keys(def.rules).length})</h2>
        <div className="overflow-hidden rounded-lg border border-[var(--color-border-subtle)]">
          <table className="w-full text-sm">
            <thead className="bg-[var(--color-bg-secondary)] text-left text-xs text-[var(--color-text-muted)]">
              <tr>
                <th className="px-4 py-2 font-medium">Key</th>
                <th className="px-4 py-2 font-medium">Value</th>
                <th className="px-4 py-2 font-medium">Interpretation</th>
                <th className="px-4 py-2 font-medium">Note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border-subtle)]">
              {Object.entries(def.rules).map(([key, rule]) => (
                <tr key={key}>
                  <td className="px-4 py-2 font-mono text-xs">{key}</td>
                  <td className="px-4 py-2 font-mono text-xs text-white">{JSON.stringify(rule.value)}{rule.unit ? ` ${rule.unit}` : ""}</td>
                  <td className="px-4 py-2">
                    <StatusBadge status={rule.interpretation === "confirmed" ? "verified" : rule.interpretation === "provisional" ? "provisional" : "manual_review"} />
                  </td>
                  <td className="max-w-[320px] px-4 py-2 text-xs text-[var(--color-text-muted)]">{rule.note ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {def.tiers.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-medium text-[var(--color-text-secondary)]">Published tier seeds</h2>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            {def.tiers.map((t) => (
              <div key={t.tier} className="rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-secondary)] p-4">
                <p className="text-xs text-[var(--color-text-muted)]">{t.label}</p>
                <p className="mt-1 font-mono text-xl font-semibold text-[var(--color-accent-green)]">${t.rewardUsd.toLocaleString()}</p>
                <ul className="mt-2 space-y-0.5 text-[11px] text-[var(--color-text-secondary)]">
                  {Object.entries(t.thresholds).map(([k, v]) => (
                    <li key={k}>{k}: {typeof v === "number" ? v.toLocaleString() : v}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-sm font-medium text-[var(--color-text-secondary)]">Live data coverage</h2>
        <ul className="space-y-2 text-sm">
          {dataSources.map((s) => (
            <li key={s.name} className="flex items-start gap-2 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-secondary)] px-4 py-3">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-accent-green)]" />
              <div>
                <p className="text-sm text-white">{s.name}</p>
                <p className="text-xs text-[var(--color-text-muted)]">{s.detail}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <p className="text-xs text-[var(--color-text-muted)]">
        Connect a project in <Link href="/dashboard/projects" className="text-[var(--color-accent-green)]">My Projects</Link> to run
        scheme-specific evaluations and generate evidence reports.
      </p>
    </div>
  );
}

import { ALL_DEFINITIONS } from "@/lib/rules/definitions";
import { StatusBadge } from "@/components/status-badge";

export const dynamic = "force-dynamic";

export default function ProgrammesPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold">Incentive Programmes</h1>
        <p className="mt-1 max-w-2xl text-sm text-[var(--color-text-secondary)]">
          Versioned rule definitions captured from BOT's published ecosystem material. Rules flagged
          <span className="text-[var(--color-amber)]"> unresolved </span>
          are recorded but never used to produce definitive eligibility results. Historical reports stay
          traceable to the exact rules version they were calculated under.
        </p>
      </div>

      {ALL_DEFINITIONS.map((def) => (
        <section key={def.code} className="rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-secondary)]">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--color-border-subtle)] px-6 py-4">
            <div>
              <h2 className="font-medium text-white">{def.name}</h2>
              <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
                {def.code} · rules version <span className="font-mono">{def.version}</span> · effective {def.effectiveAt} · last verified {def.lastVerifiedAt}
              </p>
            </div>
            <a href={def.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-[var(--color-accent-green)] hover:underline">
              official source ↗
            </a>
          </div>
          <div className="grid gap-6 px-6 py-5 md:grid-cols-2">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Rules</h3>
              <ul className="mt-3 space-y-2 text-sm">
                {Object.entries(def.rules).map(([key, rule]) => (
                  <li key={key} className="border-b border-[var(--color-border-subtle)] pb-2">
                    <div className="flex items-start justify-between gap-3">
                      <span className="font-mono text-xs text-[var(--color-text-secondary)]">{key}</span>
                      <span className={`text-[10px] font-semibold uppercase ${rule.interpretation === "confirmed" ? "text-[var(--color-accent-green)]" : rule.interpretation === "provisional" ? "text-[var(--color-amber)]" : "text-[var(--color-red)]"}`}>
                        {rule.interpretation}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-white">{JSON.stringify(rule.value)}{rule.unit ? ` ${rule.unit}` : ""}</p>
                    {rule.note && <p className="mt-0.5 text-[11px] leading-snug text-[var(--color-text-muted)]">{rule.note}</p>}
                  </li>
                ))}
              </ul>
            </div>
            <div className="space-y-4">
              {def.tiers.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Tier seeds</h3>
                  <table className="mt-3 w-full text-xs">
                    <tbody className="divide-y divide-[var(--color-border-subtle)]">
                      {def.tiers.map((t) => (
                        <tr key={t.tier}>
                          <td className="py-1.5 pr-3 text-white">{t.label}</td>
                          <td className="py-1.5 pr-3 text-right font-mono text-[var(--color-text-secondary)]">
                            {Object.entries(t.thresholds).map(([k, v]) => `${k}: ${typeof v === "number" ? v.toLocaleString() : v}`).join(" · ")}
                          </td>
                          <td className="py-1.5 text-right font-mono text-[var(--color-accent-green)]">${t.rewardUsd.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Unresolved interpretations</h3>
                {def.unresolvedInterpretations.length === 0 ? (
                  <p className="mt-2 text-xs text-[var(--color-accent-green)]">None recorded.</p>
                ) : (
                  <ul className="mt-2 space-y-2">
                    {def.unresolvedInterpretations.map((u) => (
                      <li key={u} className="rounded border border-[var(--color-amber)]/30 bg-[var(--color-amber)]/5 px-3 py-2 text-[11px] leading-snug text-[var(--color-amber)]">
                        ⚠ {u}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="rounded border border-[var(--color-border-subtle)] bg-[var(--color-bg-primary)] px-3 py-2 text-[11px] text-[var(--color-text-muted)]">
                {def.description}
              </div>
            </div>
          </div>
        </section>
      ))}
    </div>
  );
}

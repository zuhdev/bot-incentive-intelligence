import { StatusBadge } from "./status-badge";
import type { MetricResult } from "@/lib/rules/types";

export function MetricCard({ metric }: { metric: MetricResult }) {
  return (
    <div className="rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-secondary)] p-4">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-medium text-[var(--color-text-secondary)]">{metric.label}</h3>
        <StatusBadge status={metric.status} />
      </div>
      <p className="mt-3 font-mono text-2xl font-semibold text-white">{metric.display}</p>
      {metric.target !== null && metric.target !== undefined && (
        <p className="mt-1 text-xs text-[var(--color-text-muted)]">
          target: {metric.target}
          {metric.progressPct !== null && metric.progressPct !== undefined ? ` · ${metric.progressPct}%` : ""}
        </p>
      )}
      {metric.progressPct !== null && metric.progressPct !== undefined && (
        <div className="mt-2 h-1 w-full overflow-hidden rounded bg-[var(--color-bg-elevated)]">
          <div
            className="h-full rounded bg-[var(--color-accent-green)]"
            style={{ width: `${Math.min(100, Math.max(0, metric.progressPct))}%` }}
          />
        </div>
      )}
      {metric.notes && <p className="mt-2 text-xs text-[var(--color-amber)]">{metric.notes}</p>}
      {metric.unresolved.length > 0 && (
        <ul className="mt-2 space-y-1">
          {metric.unresolved.map((u) => (
            <li key={u} className="text-[11px] leading-snug text-[var(--color-amber)]">⚠ {u}</li>
          ))}
        </ul>
      )}
      {metric.methodology && (
        <details className="mt-2">
          <summary className="cursor-pointer text-[11px] text-[var(--color-text-muted)] hover:text-white">methodology</summary>
          <p className="mt-1 text-[11px] leading-snug text-[var(--color-text-muted)]">{metric.methodology}</p>
        </details>
      )}
    </div>
  );
}

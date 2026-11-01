import type { EligibilityStatus } from "@/lib/rules/types";

const STATUS_STYLES: Record<EligibilityStatus, { label: string; className: string }> = {
  verified: { label: "VERIFIED", className: "border-[var(--color-accent-green-dim)] bg-[var(--color-accent-green)]/10 text-[var(--color-accent-green)]" },
  provisional: { label: "PROVISIONAL", className: "border-[var(--color-amber)]/40 bg-[var(--color-amber)]/10 text-[var(--color-amber)]" },
  at_risk: { label: "AT RISK", className: "border-[var(--color-amber)]/40 bg-[var(--color-amber)]/10 text-[var(--color-amber)]" },
  not_met: { label: "NOT MET", className: "border-[var(--color-red)]/40 bg-[var(--color-red)]/10 text-[var(--color-red)]" },
  insufficient_data: { label: "INSUFFICIENT DATA", className: "border-[var(--color-border-strong)] bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)]" },
  manual_review: { label: "MANUAL REVIEW", className: "border-[var(--color-blue)]/40 bg-[var(--color-blue)]/10 text-[var(--color-blue)]" },
};

export function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLES[status as EligibilityStatus] ?? STATUS_STYLES.insufficient_data;
  return (
    <span className={`inline-flex items-center rounded border px-2 py-0.5 text-[10px] font-semibold tracking-wide ${s.className}`}>
      {s.label}
    </span>
  );
}

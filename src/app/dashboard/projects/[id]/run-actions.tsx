"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function RunActions({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (action: "ingest" | "evaluate") => {
    setBusy(action);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/${action}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "failed");
      if (action === "ingest") {
        const t = body.tvl ? `TVL: imported ${body.tvl.imported}, skipped ${body.tvl.skipped}${body.tvl.error ? ` (${body.tvl.error})` : ""}` : "done";
        setMessage(`Ingestion complete — ${t}; funding relationships: ${body.fundingRelationships ?? 0}`);
      } else {
        setMessage("Evaluation complete.");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex gap-2">
        <button
          onClick={() => run("ingest")}
          disabled={busy !== null}
          className="rounded-md border border-[var(--color-border-strong)] px-4 py-2 text-sm font-medium hover:bg-[var(--color-bg-elevated)] disabled:opacity-60"
        >
          {busy === "ingest" ? "Ingesting…" : "Run ingestion"}
        </button>
        <button
          onClick={() => run("evaluate")}
          disabled={busy !== null}
          className="rounded-md bg-[var(--color-accent-green)] px-4 py-2 text-sm font-medium text-[#04120c] hover:brightness-110 disabled:opacity-60"
        >
          {busy === "evaluate" ? "Evaluating…" : "Run evaluation"}
        </button>
      </div>
      {message && <p className="max-w-sm text-right text-xs text-[var(--color-accent-green)]">{message}</p>}
      {error && <p className="max-w-sm text-right text-xs text-[var(--color-red)]">{error}</p>}
      <p className="max-w-sm text-right text-[10px] text-[var(--color-text-muted)]">
        Ingestion imports live DeFiLlama TVL history + wallet data. Evaluation runs the versioned rules engine.
      </p>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Address {
  id: string;
  address: string;
  label: string | null;
  type: string;
  verified: boolean;
}

const TYPES = ["project_contract", "token_contract", "treasury", "team_wallet", "dex_pool", "user_contract", "other"];

export function AddressManager({ projectId, addresses }: { projectId: string; addresses: Address[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ address: "", label: "", type: "project_contract" });

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/addresses`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ address: form.address, label: form.label || undefined, type: form.type, schemes: ["SCHEME_C", "SCHEME_D", "GAS_REBATE"] }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? body.issues?.[0]?.message ?? "failed");
      setForm({ address: "", label: "", type: form.type });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (addressId: string) => {
    setBusy(true);
    try {
      await fetch(`/api/projects/${projectId}/addresses?addressId=${addressId}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-secondary)] p-6">
      <h2 className="text-sm font-medium text-white">Tracked addresses</h2>
      <p className="mt-1 text-xs text-[var(--color-text-muted)]">
        Every address feeds the scheme calculations. Types determine attribution (contracts, treasuries, team wallets, pools).
      </p>

      {addresses.length > 0 && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-[var(--color-text-muted)]">
              <tr>
                <th className="py-2 pr-4 font-medium">Address</th>
                <th className="py-2 pr-4 font-medium">Label</th>
                <th className="py-2 pr-4 font-medium">Type</th>
                <th className="py-2 pr-4 font-medium">Ownership</th>
                <th className="py-2 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border-subtle)]">
              {addresses.map((a) => (
                <tr key={a.id}>
                  <td className="py-2 pr-4 font-mono text-xs">{a.address.slice(0, 10)}…{a.address.slice(-8)}</td>
                  <td className="py-2 pr-4 text-xs">{a.label ?? "—"}</td>
                  <td className="py-2 pr-4 text-xs text-[var(--color-text-secondary)]">{a.type.replace(/_/g, " ")}</td>
                  <td className="py-2 pr-4 text-xs">
                    <span className={a.verified ? "text-[var(--color-accent-green)]" : "text-[var(--color-amber)]"}>{a.verified ? "verified" : "unverified"}</span>
                  </td>
                  <td className="py-2 text-right">
                    <button onClick={() => remove(a.id)} disabled={busy} className="text-xs text-[var(--color-red)] hover:underline disabled:opacity-50">
                      remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {addresses.length === 0 && (
        <p className="mt-4 rounded border border-dashed border-[var(--color-border-strong)] p-4 text-center text-xs text-[var(--color-text-muted)]">
          No addresses registered yet.
        </p>
      )}

      <form onSubmit={add} className="mt-4 flex flex-wrap items-end gap-3">
        <div className="min-w-[280px] flex-1">
          <label className="mb-1 block text-xs text-[var(--color-text-muted)]">Address (0x…)</label>
          <input
            required
            pattern="^0x[0-9a-fA-F]{40}$"
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            className="w-full rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg-primary)] px-3 py-2 font-mono text-xs outline-none focus:border-[var(--color-accent-green)]"
            placeholder="0x…"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-[var(--color-text-muted)]">Label</label>
          <input
            value={form.label}
            onChange={(e) => setForm({ ...form, label: e.target.value })}
            className="w-36 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg-primary)] px-3 py-2 text-xs outline-none"
            placeholder="Treasury"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-[var(--color-text-muted)]">Type</label>
          <select
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value })}
            className="rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg-primary)] px-3 py-2 text-xs outline-none"
          >
            {TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
          </select>
        </div>
        <button
          type="submit"
          disabled={busy}
          className="rounded-md border border-[var(--color-border-strong)] px-4 py-2 text-xs font-medium hover:bg-[var(--color-bg-elevated)] disabled:opacity-60"
        >
          {busy ? "Working…" : "Add address"}
        </button>
      </form>
      {error && <p className="mt-2 text-xs text-[var(--color-red)]">{error}</p>}
    </section>
  );
}

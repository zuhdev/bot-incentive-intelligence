"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

interface Project {
  id: string;
  name: string;
  category: string;
  deployStatus: string;
  website: string | null;
  defiLlamaSlug: string | null;
  addressCount?: number;
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [databaseConfigured, setDatabaseConfigured] = useState<boolean | null>(null);
  const [form, setForm] = useState({ name: "", category: "defi", deployStatus: "mainnet", website: "", defiLlamaSlug: "", description: "" });

  const load = useCallback(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then((d) => setProjects(d.projects))
      .catch(() => setError("Failed to load projects"));
  }, []);

  useEffect(load, [load]);

  useEffect(() => {
    fetch("/api/network", { cache: "no-store" })
      .then((r) => r.json())
      .then((network) => {
        setDatabaseConfigured(Boolean(network.databaseConfigured));
        if (network.network === "testnet") {
          setForm((current) => current.deployStatus === "planned" ? { ...current, deployStatus: "testnet" } : current);
        }
      })
      .catch(() => undefined);
  }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "creation failed");
      setForm({ name: "", category: "defi", deployStatus: "mainnet", website: "", defiLlamaSlug: "", description: "" });
      setCreating(false);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setCreating(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold">My Projects</h1>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          Project workspaces group your tracked BOT Chain addresses and incentive schemes.
        </p>
      </div>

      {databaseConfigured === false && (
        <div className="rounded-md border border-[var(--color-amber)]/40 bg-[var(--color-amber)]/5 px-4 py-3 text-sm text-[var(--color-amber)]">
          Project workspaces are disabled in this read-only preview. Configure PostgreSQL in Vercel to enable them.
        </div>
      )}

      {error && <p className="rounded-md border border-[var(--color-red)]/40 bg-[var(--color-red)]/10 px-4 py-2 text-sm text-[var(--color-red)]">{error}</p>}

      <section>
        <h2 className="mb-3 text-sm font-medium text-[var(--color-text-secondary)]">Workspaces</h2>
        {projects === null && <p className="text-sm text-[var(--color-text-muted)]">Loading…</p>}
        {projects !== null && projects.length === 0 && (
          <div className="rounded-lg border border-dashed border-[var(--color-border-strong)] p-8 text-center text-sm text-[var(--color-text-muted)]">
            No projects yet. Connect a wallet and create your first workspace below.
          </div>
        )}
        <div className="grid gap-3 md:grid-cols-2">
          {projects?.map((p) => (
            <Link
              key={p.id}
              href={`/dashboard/projects/${p.id}`}
              className="rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-secondary)] p-4 hover:border-[var(--color-border-strong)]"
            >
              <div className="flex items-center justify-between">
                <p className="font-medium text-white">{p.name}</p>
                <span className="rounded border border-[var(--color-border-strong)] px-2 py-0.5 text-[10px] uppercase text-[var(--color-text-muted)]">{p.deployStatus}</span>
              </div>
              <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                {p.category}{p.defiLlamaSlug ? ` · DeFiLlama: ${p.defiLlamaSlug}` : ""}
              </p>
            </Link>
          ))}
        </div>
      </section>

      <section className="max-w-xl rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-secondary)] p-6">
        <h2 className="font-medium text-white">Create project</h2>
        <form onSubmit={create} className="mt-4 space-y-4">
          <div>
            <label className="mb-1 block text-xs text-[var(--color-text-muted)]">Project name *</label>
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg-primary)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent-green)]"
              placeholder="My BOT Chain Project"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs text-[var(--color-text-muted)]">Category</label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg-primary)] px-3 py-2 text-sm outline-none"
              >
                {["defi", "gaming", "infra", "nft", "social", "other"].map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-[var(--color-text-muted)]">Deployment status</label>
              <select
                value={form.deployStatus}
                onChange={(e) => setForm({ ...form, deployStatus: e.target.value })}
                className="w-full rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg-primary)] px-3 py-2 text-sm outline-none"
              >
                {["planned", "testnet", "mainnet"].map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs text-[var(--color-text-muted)]">Website</label>
            <input
              value={form.website}
              onChange={(e) => setForm({ ...form, website: e.target.value })}
              className="w-full rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg-primary)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent-green)]"
              placeholder="https://…"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-[var(--color-text-muted)]">DeFiLlama protocol slug (Scheme D)</label>
            <input
              value={form.defiLlamaSlug}
              onChange={(e) => setForm({ ...form, defiLlamaSlug: e.target.value })}
              className="w-full rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg-primary)] px-3 py-2 text-sm font-mono outline-none focus:border-[var(--color-accent-green)]"
              placeholder="e.g. bdex-v3 (verified live identifier)"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-[var(--color-text-muted)]">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              className="w-full rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg-primary)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent-green)]"
            />
          </div>
          <button
            type="submit"
            disabled={creating || databaseConfigured !== true}
            className="rounded-md bg-[var(--color-accent-green)] px-4 py-2 text-sm font-medium text-[#04120c] hover:brightness-110 disabled:opacity-60"
          >
            {databaseConfigured === false ? "Database required" : databaseConfigured === null ? "Checking configuration…" : creating ? "Creating…" : "Create project"}
          </button>
          <p className="text-[11px] text-[var(--color-text-muted)]">
            A wallet signature session is required to create projects.
          </p>
        </form>
      </section>
    </div>
  );
}

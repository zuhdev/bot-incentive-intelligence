import Link from "next/link";

const PROGRAMMES = [
  {
    code: "Scheme A",
    name: "DEX Incentive Support",
    description: "Eligible BOT Chain DEX trading pairs: LP value, volume, transactions and concentration rules, tracked pool-by-pool.",
    bullets: ["7-day liquidity persistence", "15-day volume window", "40% daily concentration rule", "Trader attribution confidence"],
  },
  {
    code: "Scheme B",
    name: "CEX Listing Support",
    description: "Centralized exchange listings with ranking-tier rewards and verifiable listing evidence, pending official exchange lists.",
    bullets: ["Ranking-tier reward seeds", "Listing evidence vault", "CMC rank snapshots", "Manual review workflow"],
  },
  {
    code: "Scheme C",
    name: "Community Growth & User Conversion",
    description: "Genuine-user measurement: qualifying wallets, balance floors, wallet age, daily caps and rolling 30-day windows.",
    bullets: ["0.1 BOT / $100 asset floor", "24h wallet age", "20 interactions/day cap", "25 qualifying days in 30", "Preliminary funding-risk clusters"],
  },
  {
    code: "Scheme D",
    name: "TVL Retention Support",
    description: "Sustained qualified TVL with 00:00 UTC snapshots, asset-class registry and 90-day retention tracking.",
    bullets: ["$250k qualified TVL", "90-day sustained eligibility", "Quarterly settlement", "Approved-asset registry"],
  },
  {
    code: "Add-on",
    name: "Gas Rebate Tracking",
    description: "Cumulative gas expenditure monitoring with indicative rebate tiers and full price provenance.",
    bullets: ["From $50k spend", "Up to 35% at $500k", "USD-equivalent history", "Estimate labelling"],
  },
];

const STATUS_LEGEND = [
  { status: "VERIFIED", color: "text-[var(--color-accent-green)]", desc: "Independently retrieved and calculated; interpretation confirmed." },
  { status: "PROVISIONAL", color: "text-[var(--color-amber)]", desc: "Calculated, but one or more rule interpretations remain unresolved." },
  { status: "AT RISK", color: "text-[var(--color-amber)]", desc: "A monitored threshold is unmet or likely to be breached." },
  { status: "NOT MET", color: "text-[var(--color-red)]", desc: "A confirmed, measurable requirement is not satisfied." },
  { status: "INSUFFICIENT DATA", color: "text-[var(--color-text-muted)]", desc: "Not enough reliable data to calculate. Never shown as zero." },
  { status: "MANUAL REVIEW", color: "text-[var(--color-blue)]", desc: "A Foundation decision or out-of-band evidence is needed." },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      {/* Nav */}
      <header className="border-b border-[var(--color-border-subtle)]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded bg-[var(--color-accent-green)]" />
            <span className="font-semibold tracking-tight">BOT Incentive Intelligence</span>
          </div>
          <nav className="flex items-center gap-6 text-sm text-[var(--color-text-secondary)]">
            <a href="#programmes" className="hover:text-white">Programmes</a>
            <a href="#how" className="hover:text-white">How it works</a>
            <a href="#faq" className="hover:text-white">FAQ</a>
            <Link href="/dashboard" className="rounded-md bg-[var(--color-accent-green)] px-4 py-2 font-medium text-[#04120c] hover:brightness-110">
              Launch Dashboard
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 pb-20 pt-20">
        <p className="mb-4 inline-block rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-bg-secondary)] px-3 py-1 text-xs text-[var(--color-text-secondary)]">
          Independent analytics · Not an official BOT Chain product
        </p>
        <h1 className="max-w-3xl text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
          Understand Your <span className="text-[var(--color-accent-green)]">BOT Incentive Readiness</span>.
        </h1>
        <p className="mt-5 max-w-2xl text-lg text-[var(--color-text-secondary)]">
          Track ecosystem incentive requirements, monitor on-chain performance and turn your
          project's BOT Chain activity into verifiable evidence.
        </p>
        <div className="mt-8 flex flex-wrap gap-4">
          <Link href="/dashboard" className="rounded-md bg-[var(--color-accent-green)] px-6 py-3 font-medium text-[#04120c] hover:brightness-110">
            Launch Dashboard
          </Link>
          <a href="#programmes" className="rounded-md border border-[var(--color-border-strong)] px-6 py-3 font-medium hover:bg-[var(--color-bg-elevated)]">
            Explore Incentive Programmes
          </a>
        </div>

        <dl className="mt-16 grid grid-cols-2 gap-6 sm:grid-cols-4">
          {[
            ["5", "Programme modules"],
            ["00:00 UTC", "Snapshot precision"],
            ["Versioned", "Rules engine"],
            ["Evidence", "Hashed exports"],
          ].map(([v, l]) => (
            <div key={l} className="rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-secondary)] p-4">
              <dt className="text-xl font-semibold text-white">{v}</dt>
              <dd className="mt-1 text-sm text-[var(--color-text-secondary)]">{l}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Product explanation */}
      <section className="border-y border-[var(--color-border-subtle)] bg-[var(--color-bg-secondary)]">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <h2 className="text-2xl font-semibold">Answers four fundamental questions</h2>
          <div className="mt-8 grid gap-6 md:grid-cols-2">
            {[
              ["Which programmes can my project qualify for?", "Registered addresses and schemes map your project against every published incentive programme."],
              ["How close am I to each requirement?", "Every metric shows current value, target, progress, evaluation period, source and confidence."],
              ["What is blocking qualification?", "Missing requirements and risk indicators are explicit — never hidden behind a single score."],
              ["Can I prove my performance?", "Deterministic, hash-stamped evidence reports with full data provenance."],
            ].map(([q, a]) => (
              <div key={q} className="rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] p-6">
                <h3 className="font-medium text-white">{q}</h3>
                <p className="mt-2 text-sm text-[var(--color-text-secondary)]">{a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Programmes */}
      <section id="programmes" className="mx-auto max-w-6xl px-6 py-20">
        <h2 className="text-2xl font-semibold">Incentive programmes supported</h2>
        <p className="mt-2 max-w-2xl text-[var(--color-text-secondary)]">
          Programme rules are captured as versioned definitions with official sources. Interpretations
          that are unclear in the official material are flagged <span className="text-[var(--color-amber)]">unresolved</span> and
          never produce definitive eligibility verdicts.
        </p>
        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {PROGRAMMES.map((p) => (
            <div key={p.code} className="flex flex-col rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-secondary)] p-6">
              <span className="text-xs font-medium uppercase tracking-wider text-[var(--color-accent-green)]">{p.code}</span>
              <h3 className="mt-1 font-medium text-white">{p.name}</h3>
              <p className="mt-2 text-sm text-[var(--color-text-secondary)]">{p.description}</p>
              <ul className="mt-4 space-y-1 text-xs text-[var(--color-text-muted)]">
                {p.bullets.map((b) => <li key={b}>· {b}</li>)}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="border-y border-[var(--color-border-subtle)] bg-[var(--color-bg-secondary)]">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <h2 className="text-2xl font-semibold">How the platform works</h2>
          <div className="mt-10 grid gap-8 md:grid-cols-4">
            {[
              ["1", "Connect", "Register a workspace with your BOT Chain addresses. Prove wallet ownership by signing a message — never private keys."],
              ["2", "Ingest", "Background workers index blocks, transfers, swaps and liquidity events via filtered RPC + BOTScan, with checkpoints."],
              ["3", "Evaluate", "The versioned rules engine computes readiness per programme with explicit confidence statuses."],
              ["4", "Prove", "Generate deterministic evidence reports (JSON/CSV) with full source provenance for Foundation review."],
            ].map(([n, t, d]) => (
              <div key={n}>
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[var(--color-accent-green)]/10 text-sm font-semibold text-[var(--color-accent-green)]">{n}</div>
                <h3 className="mt-3 font-medium text-white">{t}</h3>
                <p className="mt-2 text-sm text-[var(--color-text-secondary)]">{d}</p>
              </div>
            ))}
          </div>

          <div className="mt-12 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-primary)] p-6">
            <h3 className="text-sm font-medium text-white">Eligibility status system</h3>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {STATUS_LEGEND.map((s) => (
                <div key={s.status} className="text-xs">
                  <span className={`font-semibold ${s.color}`}>{s.status}</span>
                  <p className="mt-1 text-[var(--color-text-muted)]">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="mx-auto max-w-6xl px-6 py-20">
        <h2 className="text-2xl font-semibold">FAQ</h2>
        <div className="mt-8 space-y-6">
          {[
            ["Is this an official BOT Chain product?", "No. BOT Incentive Intelligence is independent software. It never claims to approve, certify or guarantee ecosystem rewards. BOT Chain retains full authority over eligibility, Sybil detection, application review and reward distribution."],
            ["Where does the data come from?", "BOT Chain public RPC, the BOTScan (Blockscout) explorer API, the BDEX public API and DeFiLlama — each through verified provider adapters with recorded provenance. All live integrations are documented in the connectivity report."],
            ["Why are some metrics marked PROVISIONAL?", "Parts of the published programme (for example whether Scheme C tier thresholds are daily or cumulative) are not fully clear in the official material. We compute alternative scenarios, label them provisional and await Foundation clarification instead of guessing."],
            ["What happens when data is unavailable?", "The platform shows INSUFFICIENT DATA with the reason. Unavailable data is never presented as zero."],
            ["Is my wallet safe?", "Ownership is proven by signing a plain-text message (personal_sign). The platform never requests private keys, seed phrases or fund-moving transactions."],
            ["Can I export my evidence?", "Yes — deterministic JSON and CSV exports with a SHA-256 report hash, full source manifest and retrieval timestamps. PDF export is planned."],
          ].map(([q, a]) => (
            <div key={q} className="border-b border-[var(--color-border-subtle)] pb-6">
              <h3 className="font-medium text-white">{q}</h3>
              <p className="mt-2 text-sm text-[var(--color-text-secondary)]">{a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-[var(--color-border-subtle)] bg-[var(--color-bg-secondary)]">
        <div className="mx-auto flex max-w-6xl flex-col items-center px-6 py-16 text-center">
          <h2 className="text-2xl font-semibold">Ready to measure your readiness?</h2>
          <p className="mt-2 text-[var(--color-text-secondary)]">Create a workspace, register your addresses and start producing verifiable evidence.</p>
          <Link href="/dashboard" className="mt-6 rounded-md bg-[var(--color-accent-green)] px-6 py-3 font-medium text-[#04120c] hover:brightness-110">
            Launch Dashboard
          </Link>
        </div>
      </section>

      <footer className="border-t border-[var(--color-border-subtle)]">
        <div className="mx-auto max-w-6xl px-6 py-8 text-xs text-[var(--color-text-muted)]">
          <p className="font-medium text-[var(--color-text-secondary)]">
            Independent product disclaimer: BOT Incentive Intelligence is not affiliated with, endorsed by, or operated by BOT Chain.
            Preliminary readiness calculations are based on publicly documented rules and available evidence; official eligibility
            decisions rest solely with the BOT Chain Foundation.
          </p>
          <div className="mt-4 flex flex-wrap gap-4">
            <a href="https://www.botchain.ai/en/" target="_blank" rel="noopener noreferrer" className="hover:text-white">botchain.ai</a>
            <a href="https://dev-docs.botchain.ai/docs/intro/" target="_blank" rel="noopener noreferrer" className="hover:text-white">Developer docs</a>
            <a href="https://www.botchain.ai/en/ecosystem-support/" target="_blank" rel="noopener noreferrer" className="hover:text-white">Ecosystem Support Programme</a>
            <a href="https://scan.botchain.ai/" target="_blank" rel="noopener noreferrer" className="hover:text-white">BOTScan</a>
            <a href="/api/schemes" className="hover:text-white">Rules API</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

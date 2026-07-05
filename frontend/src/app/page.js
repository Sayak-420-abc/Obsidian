"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useAuth, UserButton, SignInButton } from "@clerk/nextjs";

export default function LandingPage() {
  const [terminalStep, setTerminalStep] = useState(0);
  const { isSignedIn } = useAuth();

  // Simple interval to simulate agent workflow animation on landing page
  useEffect(() => {
    const timer = setInterval(() => {
      setTerminalStep((s) => (s + 1) % 5);
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="min-h-screen bg-[#0c0c0c] text-[#ededed] font-sans flex flex-col justify-between selection:bg-[var(--color-supabase-green)] selection:text-black">
      {/* ── HEADER ── */}
      <header className="max-w-6xl w-full mx-auto px-6 py-4 flex items-center justify-between border-b border-[var(--color-supabase-border)] shrink-0">
        <div className="flex items-center gap-3">
          <svg className="w-8 h-8 text-[var(--color-supabase-green)] shrink-0" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2L3 9L12 22L21 9L12 2Z" fill="url(#obsidianGrad)" stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round" />
            <path d="M12 2V22" stroke="currentColor" strokeWidth={1} strokeOpacity="0.3" />
            <path d="M3 9H21" stroke="currentColor" strokeWidth={1} strokeOpacity="0.3" />
            <path d="M12 2L8 9L12 22L16 9L12 2Z" stroke="currentColor" strokeWidth={1} strokeOpacity="0.5" />
            <defs>
              <linearGradient id="obsidianGrad" x1="12" y1="2" x2="12" y2="22" gradientUnits="userSpaceOnUse">
                <stop stopColor="#3ecf8e" stopOpacity="0.25" />
                <stop offset="1" stopColor="#10b981" stopOpacity="0.03" />
              </linearGradient>
            </defs>
          </svg>
          <span className="text-sm font-semibold tracking-wide uppercase text-white font-mono">
            Obsidian
          </span>
        </div>

        <nav className="flex items-center gap-4">
          <Link
            href="/docs"
            className="text-xs text-[var(--color-supabase-text-muted)] hover:text-white transition-colors"
          >
            Docs
          </Link>
          {isSignedIn ? (
            <>
              <Link href="/dashboard" className="supabase-btn-primary py-1.5 px-4 text-xs font-semibold">
                Launch Console
              </Link>
              <UserButton />
            </>
          ) : (
            <SignInButton mode="modal">
              <button className="supabase-btn-primary py-1.5 px-4 text-xs font-semibold cursor-pointer">
                Sign In
              </button>
            </SignInButton>
          )}
        </nav>
      </header>


      {/* ── HERO SECTION ── */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-12 md:py-20 flex flex-col md:flex-row gap-12 items-center">
        {/* Left column — Copy & CTA */}
        <div className="flex-1 space-y-6 text-center md:text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[var(--color-supabase-border)] bg-[#141414] text-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-supabase-green)] animate-pulse" />
            <span className="text-[var(--color-supabase-text-muted)] font-mono">
              Grounding & Self-Correction enabled
            </span>
          </div>

          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight leading-tight max-w-xl">
            Query your database in{" "}
            <span className="text-[var(--color-supabase-green)]">plain English</span>.
          </h1>

          <p className="text-sm md:text-base text-[var(--color-supabase-text-muted)] leading-relaxed max-w-lg">
            Obsidian is an open-source, developer-centric Text-to-SQL Agent console. Generates safe SQLite SELECT queries, performs multi-level security audits, and automatically heals syntax errors in real-time execution loops.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center md:justify-start gap-3 pt-2">
            {isSignedIn ? (
              <Link href="/dashboard?tab=database" className="supabase-btn-primary text-sm font-semibold w-full sm:w-auto text-center">
                Upload CSV
              </Link>
            ) : (
              <SignInButton mode="modal" forceRedirectUrl="/dashboard?tab=database">
                <button className="supabase-btn-primary text-sm font-semibold w-full sm:w-auto text-center cursor-pointer">
                  Upload CSV
                </button>
              </SignInButton>
            )}
            {isSignedIn ? (
              <Link href="/dashboard" className="supabase-btn-secondary text-sm font-semibold w-full sm:w-auto text-center">
                Launch Console
              </Link>
            ) : (
              <SignInButton mode="modal" forceRedirectUrl="/dashboard">
                <button className="supabase-btn-secondary text-sm font-semibold w-full sm:w-auto text-center cursor-pointer">
                  Launch Console
                </button>
              </SignInButton>
            )}
          </div>
        </div>

        {/* Right column — Interactive terminal mock */}
        <div className="flex-1 w-full max-w-lg">
          <div className="supabase-card overflow-hidden">
            {/* Top Bar */}
            <div className="flex items-center justify-between px-4 py-2.5 bg-[#171717] border-b border-[var(--color-supabase-border)]">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-[#ef4444] opacity-80" />
                <div className="w-2.5 h-2.5 rounded-full bg-[#f59e0b] opacity-80" />
                <div className="w-2.5 h-2.5 rounded-full bg-[#10b981] opacity-80" />
              </div>
              <span className="text-[10px] font-mono text-[var(--color-supabase-text-dim)] uppercase">
                agent_simulation.log
              </span>
            </div>

            {/* Simulated steps */}
            <div className="p-5 font-mono text-xs space-y-4 min-h-[260px] bg-[#121212]">
              {/* Question */}
              <div className="flex items-start gap-2">
                <span className="text-[var(--color-supabase-green)] font-bold">&gt;</span>
                <span className="text-[var(--color-supabase-text)]">
                  "Find top 3 customers in Delhi by order values"
                </span>
              </div>

              {/* Step 1: Schema */}
              {terminalStep >= 1 && (
                <div className="space-y-1 text-[var(--color-supabase-text-muted)] animate-fade-in">
                  <span className="text-[var(--color-supabase-green)]">[OK]</span> Mapping schema... Found table 'customers', 'orders', 'order_items'
                </div>
              )}

              {/* Step 2: Synthesis */}
              {terminalStep >= 2 && (
                <div className="space-y-1 animate-fade-in text-[var(--color-supabase-text-muted)]">
                  <span className="text-accent-indigo text-indigo-400">[AI]</span> Synthesizing SQLite code block...
                  <code className="block mt-1 text-[11px] p-2 bg-[#1a1a1a] rounded text-[var(--color-supabase-green)]">
                    SELECT c.name, SUM(oi.quantity * p.price_inr) AS total_spent FROM customers c JOIN orders o ...
                  </code>
                </div>
              )}

              {/* Step 3: Auditing */}
              {terminalStep >= 3 && (
                <div className="space-y-1 text-[var(--color-supabase-text-muted)] animate-fade-in">
                  <span className="text-teal-400">[SEC]</span> Security audit checks: Only SELECT statements detected. Passed.
                </div>
              )}

              {/* Step 4: Complete */}
              {terminalStep >= 4 && (
                <div className="space-y-1 text-[var(--color-supabase-green)] animate-fade-in font-bold flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[var(--color-supabase-green)] animate-ping" />
                  Successfully loaded 3 records (9ms)
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* ── FEATURE GRID ── */}
      <section className="border-t border-[var(--color-supabase-border)] bg-[#121212] py-16 shrink-0">
        <div className="max-w-6xl w-full mx-auto px-6">
          <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--color-supabase-green)] mb-10 text-center">
            Console Highlights
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                title: "Grounded Schema Synthesis",
                desc: "Analyzes tables, foreign key boundaries, and database samples dynamically for accurate SQL grounding.",
                icon: (
                  <svg className="w-5 h-5 text-[var(--color-supabase-green)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                ),
              },
              {
                title: "Safety Audits Gate",
                desc: "Prevents execution of DML/DDL commands (updates, deletes, truncates) using flattening token-level syntax parsers.",
                icon: (
                  <svg className="w-5 h-5 text-[var(--color-supabase-green)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                ),
              },
              {
                title: "Recursive Error Healing",
                desc: "Feeds query compile logs back into the model in a closed-loop sequence to self-correct and execute successfully.",
                icon: (
                  <svg className="w-5 h-5 text-[var(--color-supabase-green)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 8H18.5" />
                  </svg>
                ),
              },
              {
                title: "Local Database Support",
                desc: "Inject raw CSV data tables or upload SQLite database files directly to parse schemas and run agentic queries.",
                icon: (
                  <svg className="w-5 h-5 text-[var(--color-supabase-green)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                ),
              },
            ].map((f, idx) => (
              <div key={idx} className="supabase-card p-5 space-y-3">
                <div className="w-10 h-10 rounded border border-[var(--color-supabase-border)] bg-[#171717] flex items-center justify-center">
                  {f.icon}
                </div>
                <h3 className="text-xs font-semibold text-white uppercase tracking-wider">{f.title}</h3>
                <p className="text-[11px] text-[var(--color-supabase-text-muted)] leading-relaxed">
                  {f.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-[var(--color-supabase-border)] bg-[#0c0c0c] py-6 shrink-0 text-center">
        <div className="max-w-6xl w-full mx-auto px-6 flex flex-col sm:flex-row items-center justify-between text-[11px] text-[var(--color-supabase-text-dim)]">
          <span>&copy; 2026 Obsidian. Open source under MIT.</span>
          <span>Powered by Next.js &amp; Gemini AI</span>
        </div>
      </footer>
    </div>
  );
}

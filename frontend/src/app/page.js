"use client";

import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { useAuth, UserButton, SignInButton } from "@clerk/nextjs";

// ── Custom SVG Icons ──
const SchemaIcon = () => (
  <svg className="w-5 h-5 text-[var(--color-supabase-green)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
    <rect x="3" y="3" width="7" height="7" rx="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <rect x="14" y="3" width="7" height="7" rx="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <rect x="8" y="14" width="8" height="7" rx="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M6.5 10V12.5C6.5 13.05 6.95 13.5 7.5 13.5H8" strokeLinecap="round" />
    <path d="M17.5 10V12.5C17.5 13.05 17.05 13.5 16.5 13.5H16" strokeLinecap="round" />
  </svg>
);

const ShieldIcon = () => (
  <svg className="w-5 h-5 text-[var(--color-supabase-green)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
    <path d="M12 2L3.5 6.5V11.5C3.5 16.74 7.11 21.61 12 22.75C16.89 21.61 20.5 16.74 20.5 11.5V6.5L12 2Z" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M8.5 12L10.5 14L15.5 9" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const RecursiveHealIcon = () => (
  <svg className="w-5 h-5 text-[var(--color-supabase-green)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
    {/* Circular loop arrows */}
    <path d="M21 12C21 16.97 16.97 21 12 21C7.03 21 3 16.97 3 12C3 7.03 7.03 3 12 3C14.76 3 17.22 4.24 18.87 6.18" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M21 3V7H17" strokeLinecap="round" strokeLinejoin="round" />
    {/* Inner sparkle / healing symbol */}
    <path d="M12 8V12L14.5 14.5" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
  </svg>
);

const UploadIcon = () => (
  <svg className="w-5 h-5 text-[var(--color-supabase-green)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
    <path d="M4 17V19C4 20.1 4.9 21 6 21H18C19.1 21 20 20.1 20 19V17" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M7 9L12 4L17 9" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M12 4V16" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const GitHubIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
  </svg>
);

// ── Terminal Step Data ──
const TERMINAL_STEPS = [
  {
    tag: "OK",
    tagColor: "text-[var(--color-supabase-green)]",
    text: "Mapping schema... Found 'customers', 'orders', 'order_items'",
  },
  {
    tag: "AI",
    tagColor: "text-indigo-400",
    text: "Synthesizing SQLite query...",
    code: "SELECT c.name, SUM(oi.quantity * p.price_inr) AS total_spent FROM customers c JOIN orders o ON c.id = o.customer_id ...",
  },
  {
    tag: "SEC",
    tagColor: "text-teal-400",
    text: "Audit passed — read-only SELECT detected. No DML/DDL found.",
  },
  {
    tag: "✓",
    tagColor: "text-[var(--color-supabase-green)] font-bold",
    text: "Query executed — 3 records returned (9ms)",
    isSuccess: true,
  },
];

// ── Feature Card Data ──
const FEATURES = [
  {
    title: "Grounded Schema Synthesis",
    desc: "Dynamically analyzes your tables, foreign keys, and sample data to ground the AI in your actual database structure.",
    icon: <SchemaIcon />,
  },
  {
    title: "Safety Audits Gate",
    desc: "Token-level syntax parsing blocks all DML/DDL commands — your data can never be modified, deleted, or corrupted.",
    icon: <ShieldIcon />,
  },
  {
    title: "Recursive Error Healing",
    desc: "Failed queries are automatically fed back into the AI in a closed-loop sequence until they self-correct and execute.",
    icon: <RecursiveHealIcon />,
  },
  {
    title: "Local Database Support",
    desc: "Drag-and-drop CSV files or upload SQLite databases directly. Schemas are parsed automatically for instant querying.",
    icon: <UploadIcon />,
  },
];

export default function LandingPage() {
  const [terminalStep, setTerminalStep] = useState(0);
  const [typingText, setTypingText] = useState("");
  const [isTypingDone, setIsTypingDone] = useState(false);
  const { isSignedIn } = useAuth();
  const typingRef = useRef(null);

  const QUERY_TEXT = '"Find top 3 customers in Delhi by order value"';

  // Typing animation for the query
  useEffect(() => {
    let charIndex = 0;
    setTypingText("");
    setIsTypingDone(false);
    setTerminalStep(0);

    typingRef.current = setInterval(() => {
      if (charIndex < QUERY_TEXT.length) {
        setTypingText(QUERY_TEXT.slice(0, charIndex + 1));
        charIndex++;
      } else {
        clearInterval(typingRef.current);
        setIsTypingDone(true);
      }
    }, 45);

    return () => clearInterval(typingRef.current);
  }, []);

  // Step-by-step terminal animation after typing finishes
  useEffect(() => {
    if (!isTypingDone) return;

    let step = 0;
    const timer = setInterval(() => {
      step++;
      if (step <= TERMINAL_STEPS.length) {
        setTerminalStep(step);
      } else {
        // Reset the whole cycle
        clearInterval(timer);
        setTimeout(() => {
          setTerminalStep(0);
          setTypingText("");
          setIsTypingDone(false);
          // Re-trigger the typing effect
          let charIndex = 0;
          typingRef.current = setInterval(() => {
            if (charIndex < QUERY_TEXT.length) {
              setTypingText(QUERY_TEXT.slice(0, charIndex + 1));
              charIndex++;
            } else {
              clearInterval(typingRef.current);
              setIsTypingDone(true);
            }
          }, 45);
        }, 3000);
      }
    }, 2200);

    return () => clearInterval(timer);
  }, [isTypingDone]);

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
          <a
            href="https://github.com/Sayak-420-abc/Obsidian"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--color-supabase-text-muted)] hover:text-white transition-colors"
          >
            <GitHubIcon />
          </a>
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
      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-12 md:py-20 flex flex-col md:flex-row gap-12 items-center relative">
        {/* Background glows */}
        <div className="hero-glow" />
        <div className="hero-glow-secondary" />

        {/* Left column — Copy & CTA */}
        <div className="flex-1 space-y-6 text-center md:text-left relative z-10">
          <div className="badge-glow inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[var(--color-supabase-border)] bg-[#141414] text-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-supabase-green)] animate-pulse" />
            <span className="text-[var(--color-supabase-text-muted)] font-mono tracking-wide">
              AI-Powered · Self-Healing · Read-Only Safe
            </span>
          </div>

          <h1 className="text-4xl md:text-5xl lg:text-[3.5rem] font-extrabold tracking-tight leading-[1.1] max-w-xl">
            Query your database in{" "}
            <span className="gradient-text">plain English</span>.
          </h1>

          <p className="text-sm md:text-base text-[var(--color-supabase-text-muted)] leading-relaxed max-w-lg">
            Obsidian is an open-source AI analytics console that turns natural language questions into safe, read-only SQL. Upload a CSV, ask a question, get instant results — <span className="text-[var(--color-supabase-text)]">no SQL knowledge required</span>.
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
        <div className="flex-1 w-full max-w-lg relative z-10">
          <div className="supabase-card overflow-hidden" style={{ borderRadius: '12px' }}>
            {/* Top Bar */}
            <div className="flex items-center justify-between px-4 py-2.5 bg-[#171717] border-b border-[var(--color-supabase-border)]">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-[#ef4444] opacity-80" />
                <div className="w-2.5 h-2.5 rounded-full bg-[#f59e0b] opacity-80" />
                <div className="w-2.5 h-2.5 rounded-full bg-[#10b981] opacity-80" />
              </div>
              <span className="text-[10px] font-mono text-[var(--color-supabase-text-dim)] uppercase tracking-wider">
                obsidian_agent.log
              </span>
            </div>

            {/* Simulated steps */}
            <div className="p-5 font-mono text-xs space-y-4 min-h-[280px] bg-[#121212] relative terminal-scanline">
              {/* Query with typing animation */}
              <div className="flex items-start gap-2">
                <span className="text-[var(--color-supabase-green)] font-bold shrink-0">❯</span>
                <span className="text-[var(--color-supabase-text)]">
                  {typingText}
                  {!isTypingDone && <span className="typing-cursor" />}
                </span>
              </div>

              {/* Animated Steps */}
              {TERMINAL_STEPS.map((step, idx) =>
                terminalStep > idx ? (
                  <div
                    key={idx}
                    className={`animate-fade-in ${
                      step.isSuccess
                        ? "text-[var(--color-supabase-green)] font-bold flex items-center gap-1.5"
                        : "space-y-1 text-[var(--color-supabase-text-muted)]"
                    }`}
                  >
                    {step.isSuccess && (
                      <span className="w-2 h-2 rounded-full bg-[var(--color-supabase-green)] animate-ping shrink-0" />
                    )}
                    <span>
                      <span className={step.tagColor}>[{step.tag}]</span>{" "}
                      {step.text}
                    </span>
                    {step.code && (
                      <code className="block mt-1.5 text-[11px] p-2.5 bg-[#1a1a1a] rounded-md text-[var(--color-supabase-green)] border border-[var(--color-supabase-border)] leading-relaxed">
                        {step.code}
                      </code>
                    )}
                  </div>
                ) : null
              )}
            </div>
          </div>
        </div>
      </main>

      {/* ── FEATURE GRID ── */}
      <section className="border-t border-[var(--color-supabase-border)] bg-[#0f0f0f] py-16 shrink-0">
        <div className="max-w-6xl w-full mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--color-supabase-green)] mb-3">
              Console Highlights
            </h2>
            <p className="text-sm text-[var(--color-supabase-text-dim)] max-w-md mx-auto">
              Everything you need to go from raw data to actionable insights, safely and instantly.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {FEATURES.map((f, idx) => (
              <div
                key={idx}
                className="feature-card p-5 space-y-3"
                style={{ animationDelay: `${idx * 100}ms` }}
              >
                <div className="feature-icon-box">
                  {f.icon}
                </div>
                <h3 className="text-xs font-semibold text-white uppercase tracking-wider">
                  {f.title}
                </h3>
                <p className="text-[11px] text-[var(--color-supabase-text-muted)] leading-relaxed">
                  {f.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-[var(--color-supabase-border)] bg-[#0c0c0c] py-6 shrink-0">
        <div className="max-w-6xl w-full mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-[var(--color-supabase-text-dim)]">
          <span>&copy; 2026 Obsidian. Open source under MIT.</span>
          <div className="flex items-center gap-4">
            <a
              href="https://github.com/Sayak-420-abc/Obsidian"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white transition-colors flex items-center gap-1.5"
            >
              <GitHubIcon />
              <span>GitHub</span>
            </a>
            <span className="text-[var(--color-supabase-border)]">·</span>
            <span>Powered by Next.js &amp; Gemini AI</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

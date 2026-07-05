"use client";

import Link from "next/link";
import { useAuth } from "@clerk/nextjs";

export default function DocsPage() {
  const { isSignedIn } = useAuth();

  const sections = [
    { id: "overview", name: "Overview" },
    { id: "features", name: "Feature List" },
    { id: "audience", name: "Who It's For" },
    { id: "architecture", name: "Agent Architecture" },
    { id: "safety", name: "Read-Only by Design" },
    { id: "ingestion", name: "CSV & Upload Guide" },
    { id: "api-reference", name: "API Reference" }
  ];

  return (
    <div className="min-h-screen bg-[#0c0c0c] text-[#ededed] font-sans flex flex-col selection:bg-[var(--color-supabase-green)] selection:text-black">
      {/* ── HEADER ── */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-[#0c0c0c]/80 border-b border-[var(--color-supabase-border)] shrink-0">
        <div className="max-w-6xl w-full mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2 group">
              <svg className="w-8 h-8 text-[var(--color-supabase-green)] shrink-0 transition-transform group-hover:scale-105" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2L3 9L12 22L21 9L12 2Z" fill="url(#obsidianDocsGrad)" stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round" />
                <path d="M12 2V22" stroke="currentColor" strokeWidth={1} strokeOpacity="0.3" />
                <path d="M3 9H21" stroke="currentColor" strokeWidth={1} strokeOpacity="0.3" />
                <path d="M12 2L8 9L12 22L16 9L12 2Z" stroke="currentColor" strokeWidth={1} strokeOpacity="0.5" />
                <defs>
                  <linearGradient id="obsidianDocsGrad" x1="12" y1="2" x2="12" y2="22" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#3ecf8e" stopOpacity="0.25" />
                    <stop offset="1" stopColor="#10b981" stopOpacity="0.03" />
                  </linearGradient>
                </defs>
              </svg>
              <span className="text-sm font-semibold tracking-wide uppercase text-white font-mono">
                Obsidian Documentation
              </span>
            </Link>
          </div>

          <nav className="flex items-center gap-4">
            <Link
              href="/"
              className="text-xs text-[var(--color-supabase-text-muted)] hover:text-white transition-colors"
            >
              Home
            </Link>
            {isSignedIn ? (
              <Link href="/dashboard" className="supabase-btn-primary py-1.5 px-4 text-xs font-semibold">
                Launch Console
              </Link>
            ) : (
              <Link href="/sign-in" className="supabase-btn-primary py-1.5 px-4 text-xs font-semibold">
                Sign In
              </Link>
            )}
          </nav>
        </div>
      </header>

      {/* ── DOCS CORE LAYOUT ── */}
      <div className="flex-1 max-w-6xl w-full mx-auto px-6 py-10 flex flex-col md:flex-row gap-10 items-start">
        {/* Left Sidebar Navigation */}
        <aside className="w-full md:w-52 shrink-0 sticky top-24 md:flex flex-col gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-supabase-text-dim)] px-3 mb-2 block font-mono">
            Navigation Outline
          </span>
          <nav className="flex flex-col gap-1">
            {sections.map((sec) => (
              <a
                key={sec.id}
                href={`#${sec.id}`}
                className="text-xs font-medium px-3 py-1.5 rounded-md hover:bg-[#171717] text-[var(--color-supabase-text-muted)] hover:text-white transition-all font-mono"
              >
                {sec.name}
              </a>
            ))}
          </nav>
        </aside>

        {/* Center Content Document */}
        <main className="flex-1 space-y-12 min-w-0 pb-16">
          
          {/* Section: Overview */}
          <section id="overview" className="scroll-mt-24 space-y-4">
            <h1 className="text-3xl font-extrabold tracking-tight text-white border-b border-[var(--color-supabase-border)] pb-3">
              Developer Documentation
            </h1>
            <p className="text-sm leading-relaxed text-[var(--color-supabase-text-muted)]">
              Welcome to the <strong>Obsidian</strong> documentation. Obsidian is an AI-powered analytics console that lets you explore and query your data using plain English — no SQL expertise needed. Upload a CSV or SQLite file, ask questions in natural language, and get instant tables and charts.
            </p>
            <p className="text-sm leading-relaxed text-[var(--color-supabase-text-muted)]">
              Behind the scenes, Obsidian uses schema-grounded AI models to generate accurate SQL, automatically detects and fixes query errors through self-healing retry loops, and enforces <strong>read-only access</strong> so your data is never at risk.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4">
              <div className="supabase-card p-4 space-y-1.5">
                <span className="text-xs font-bold text-white uppercase tracking-wider block">Grounded Prompting</span>
                <span className="text-[11px] text-[var(--color-supabase-text-muted)] leading-relaxed block">Reads table schemas, constraints, and column samples dynamically to supply precise context to Gemini models.</span>
              </div>
              <div className="supabase-card p-4 space-y-1.5">
                <span className="text-xs font-bold text-white uppercase tracking-wider block">Safety Sandboxing</span>
                <span className="text-[11px] text-[var(--color-supabase-text-muted)] leading-relaxed block">Forces SELECT-only checks on AST and SQL token levels, preventing write-access or schema destruction commands.</span>
              </div>
              <div className="supabase-card p-4 space-y-1.5">
                <span className="text-xs font-bold text-white uppercase tracking-wider block">Self-Healing Retries</span>
                <span className="text-[11px] text-[var(--color-supabase-text-muted)] leading-relaxed block">Catches query compilation errors, feeds execution traces back to the model, and retries dynamically.</span>
              </div>
            </div>
          </section>

          {/* Section: Feature List */}
          <section id="features" className="scroll-mt-24 space-y-4">
            <h2 className="text-xl font-bold tracking-tight text-white border-b border-[var(--color-supabase-border)] pb-2">
              Console Feature List
            </h2>
            <p className="text-sm leading-relaxed text-[var(--color-supabase-text-muted)]">
              Obsidian bundles a comprehensive suite of features built for visual exploration and query execution:
            </p>
            <div className="grid grid-cols-1 gap-3">
              <div className="supabase-card p-4 space-y-2">
                <strong className="text-xs text-[var(--color-supabase-green)] uppercase tracking-wider block">1. Natural Language to SQL Execution</strong>
                <p className="text-[11px] text-[var(--color-supabase-text-muted)] leading-relaxed">
                  Submit plain text questions (e.g. <em>"Show the total number of records"</em>) and watch the agent resolve the question into audited SQL query statements, fetch actual rows, and format them into interactive data grids.
                </p>
              </div>

              <div className="supabase-card p-4 space-y-2">
                <strong className="text-xs text-[var(--color-supabase-green)] uppercase tracking-wider block">2. SQL Workspace</strong>
                <p className="text-[11px] text-[var(--color-supabase-text-muted)] leading-relaxed">
                  An optional SQL editor for users who want to write or fine-tune queries directly. Supports instant execution feedback and tabular result views.
                </p>
              </div>

              <div className="supabase-card p-4 space-y-2">
                <strong className="text-xs text-[var(--color-supabase-green)] uppercase tracking-wider block">3. CSV & Database Upload</strong>
                <p className="text-[11px] text-[var(--color-supabase-text-muted)] leading-relaxed">
                  Upload your `.csv` spreadsheets or SQLite `.db` files directly. Obsidian automatically handles encoding issues (including Excel exports), cleans up column names, and prepares your data for instant querying.
                </p>
              </div>

              <div className="supabase-card p-4 space-y-2">
                <strong className="text-xs text-[var(--color-supabase-green)] uppercase tracking-wider block">4. Interactive Schema Catalog & Drawer</strong>
                <p className="text-[11px] text-[var(--color-supabase-text-muted)] leading-relaxed">
                  A collapsible sidebar panel displaying column metadata, data types, primary key flags, and real-time database table row counts, keeping active schemas accessible.
                </p>
              </div>

              <div className="supabase-card p-4 space-y-2">
                <strong className="text-xs text-[var(--color-supabase-green)] uppercase tracking-wider block">5. Automatic Visualization & Chart Generation</strong>
                <p className="text-[11px] text-[var(--color-supabase-text-muted)] leading-relaxed">
                  Dynamically detects tabular output schemas and automatically renders matching charts (bar charts, line charts, etc.) using key categorical and numeric dimensions, speeding up trend inspections.
                </p>
              </div>

              <div className="supabase-card p-4 space-y-2">
                <strong className="text-xs text-[var(--color-supabase-green)] uppercase tracking-wider block">6. Live Agent Progress Tracker</strong>
                <p className="text-[11px] text-[var(--color-supabase-text-muted)] leading-relaxed">
                  Watch the AI think in real time. See each step of the process — from understanding your question, to generating the query, to fixing any errors — with clear status indicators and timing.
                </p>
              </div>

              <div className="supabase-card p-4 space-y-2">
                <strong className="text-xs text-[var(--color-supabase-green)] uppercase tracking-wider block">7. Agent Configuration</strong>
                <p className="text-[11px] text-[var(--color-supabase-text-muted)] leading-relaxed">
                  Fine-tune how the AI behaves. Adjust the instruction prompts, choose between different AI model sizes, control creativity levels, and set how many times the agent retries failed queries.
                </p>
              </div>
            </div>
          </section>


          {/* Section: Target Audience */}
          <section id="audience" className="scroll-mt-24 space-y-4">
            <h2 className="text-xl font-bold tracking-tight text-white border-b border-[var(--color-supabase-border)] pb-2">
              Who Is Obsidian For?
            </h2>
            <p className="text-sm leading-relaxed text-[var(--color-supabase-text-muted)]">
              Obsidian is built for anyone who works with data but shouldn't have to write SQL to get answers:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="supabase-card p-4 space-y-1">
                <strong className="text-xs text-white uppercase tracking-wider block">Business & Data Analysts</strong>
                <span className="text-[11px] text-[var(--color-supabase-text-muted)] leading-relaxed block">
                  Ask questions about your data in plain English. Get tables, aggregates, and trend charts without writing a single SQL query.
                </span>
              </div>
              <div className="supabase-card p-4 space-y-1">
                <strong className="text-xs text-white uppercase tracking-wider block">Product & Operations Managers</strong>
                <span className="text-[11px] text-[var(--color-supabase-text-muted)] leading-relaxed block">
                  Pull reports on sales, user metrics, and operational KPIs on demand — no engineering tickets or waiting for dashboards to be built.
                </span>
              </div>
              <div className="supabase-card p-4 space-y-1">
                <strong className="text-xs text-white uppercase tracking-wider block">Non-Technical Teams</strong>
                <span className="text-[11px] text-[var(--color-supabase-text-muted)] leading-relaxed block">
                  Marketing, finance, HR, and other teams can self-serve their data needs. Upload a spreadsheet, ask a question, get an answer.
                </span>
              </div>
            </div>
          </section>

          {/* Section: Architecture */}
          <section id="architecture" className="scroll-mt-24 space-y-4">
            <h2 className="text-xl font-bold tracking-tight text-white border-b border-[var(--color-supabase-border)] pb-2">
              Agent Architecture & Workflow
            </h2>
            <p className="text-sm leading-relaxed text-[var(--color-supabase-text-muted)]">
              The agent coordinates dynamic schema mappings, LLM synthesis, safety checks, execution pipelines, and error tracing in a single continuous pipeline.
            </p>

            {/* Mermaid ASCII Diagram (Styled as a Premium terminal component) */}
            <div className="supabase-card overflow-hidden">
              {/* Top Bar */}
              <div className="flex items-center justify-between px-4 py-2 bg-[#1b1b1b] border-b border-[var(--color-supabase-border)]">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-[#ef4444] opacity-80" />
                  <div className="w-2 h-2 rounded-full bg-[#f59e0b] opacity-80" />
                  <div className="w-2 h-2 rounded-full bg-[#10b981] opacity-80" />
                </div>
                <span className="text-[9px] font-mono text-[var(--color-supabase-text-dim)] uppercase">
                  agent_architecture.flow
                </span>
              </div>
              {/* Diagram content */}
              <div className="p-5 bg-[#141414] font-mono text-[11px] leading-relaxed text-[var(--color-supabase-green)] overflow-x-auto space-y-1.5">
                <div>[USER PROMPT] → "Total sales by category"</div>
                <div>&nbsp;&nbsp;│</div>
                <div>&nbsp;&nbsp;▼</div>
                <div>[SCHEMA EXTRACTOR] → Analyzes active CSV column metadata and types</div>
                <div>&nbsp;&nbsp;│</div>
                <div>&nbsp;&nbsp;▼</div>
                <div>[LLM SYNTHESIS] → Gemini models formulate raw PostgreSQL query</div>
                <div>&nbsp;&nbsp;│</div>
                <div>&nbsp;&nbsp;▼</div>
                <div>[SAFETY AUDIT GATE] → Audits table structures and verifies SELECT command constraints</div>
                <div>&nbsp;&nbsp;│</div>
                <div>&nbsp;&nbsp;├─► [FAILED] ──► Block execute, return 403 authorization error</div>
                <div>&nbsp;&nbsp;▼ [PASSED]</div>
                <div>[DB PIPELINE EXECUTE] → Connects and runs query in isolated database layer</div>
                <div>&nbsp;&nbsp;│</div>
                <div>&nbsp;&nbsp;├─► [ERROR DETECTED] ──► [SELF-HEALING RETRY] (Feeds error logs to LLM, limit 3)</div>
                <div>&nbsp;&nbsp;▼ [SUCCESS]</div>
                <div>[FRONTEND VIEW] ──► Displays interactive tables and auto-generates charts</div>
              </div>
            </div>
          </section>

          {/* Section: Safety & Audit Gates */}
          <section id="safety" className="scroll-mt-24 space-y-4">
            <h2 className="text-xl font-bold tracking-tight text-white border-b border-[var(--color-supabase-border)] pb-2">
              Read-Only by Design
            </h2>
            <p className="text-sm leading-relaxed text-[var(--color-supabase-text-muted)]">
              Obsidian is read-only by design. Your uploaded data can never be modified, deleted, or corrupted through the console. This isn't a security patch — it's a core design principle that makes the tool safe for everyone:
            </p>
            <ul className="list-disc list-inside text-sm text-[var(--color-supabase-text-muted)] space-y-2.5 pl-2">
              <li>
                <strong className="text-white">SELECT-Only by Design:</strong> The AI is instructed to only generate read-only queries. Any query containing <code className="text-accent-red font-mono px-1 py-0.5 rounded bg-[#1a1a1a]">INSERT</code>, <code className="text-accent-red font-mono px-1 py-0.5 rounded bg-[#1a1a1a]">UPDATE</code>, <code className="text-accent-red font-mono px-1 py-0.5 rounded bg-[#1a1a1a]">DELETE</code>, <code className="text-accent-red font-mono px-1 py-0.5 rounded bg-[#1a1a1a]">DROP</code>, or <code className="text-accent-red font-mono px-1 py-0.5 rounded bg-[#1a1a1a]">ALTER</code> is automatically blocked before it ever touches your data.
              </li>
              <li>
                <strong className="text-white">Isolated Data Sessions:</strong> Each uploaded dataset lives in its own isolated session. You can only query your own data — there is no cross-session access.
              </li>
              <li>
                <strong className="text-white">Read-Only Connections:</strong> Database connections are established with read-only credentials at the infrastructure level, providing a second layer of protection.
              </li>
            </ul>
          </section>

          {/* Section: Database Ingestion */}
          <section id="ingestion" className="scroll-mt-24 space-y-4">
            <h2 className="text-xl font-bold tracking-tight text-white border-b border-[var(--color-supabase-border)] pb-2">
              Database Ingestion & CSV Parsing
            </h2>
            <p className="text-sm leading-relaxed text-[var(--color-supabase-text-muted)]">
              Relational databases or flat CSV datasets are ingested dynamically into the central data schema:
            </p>
            <div className="supabase-card p-4 space-y-3">
              <span className="text-xs font-bold text-white uppercase tracking-wider block font-mono">CSV File Requirements & Handling:</span>
              <ul className="list-decimal list-inside text-xs text-[var(--color-supabase-text-muted)] space-y-2 pl-1">
                <li>
                  <strong className="text-white">Headers and Separators:</strong> First row is treated as the column headers. Columns are sanitized into lower_snake_case (e.g. <code className="font-mono bg-[#141414] px-1 py-0.5 text-white">Student ID</code> becomes <code className="font-mono bg-[#141414] px-1 py-0.5 text-white">student_id</code>) and duplicate headers are automatically numbered.
                </li>
                <li>
                  <strong className="text-white">Unicode Encoding Fallbacks:</strong> The ingestion system parses standard UTF-8 (with or without BOM) and dynamically handles UTF-16 files (commonly exported from Microsoft Excel on Windows) without failing or producing empty cells.
                </li>
                <li>
                  <strong className="text-white">Auto-casting Numeric Types:</strong> Integers (which Pandas parses as floats if they contain nulls) are automatically cast to nullable <code className="font-mono bg-[#141414] px-1 py-0.5 text-white">Int64</code> types so SQL operations like joins on IDs do not break.
                </li>
              </ul>
            </div>
          </section>

          {/* Section: API Reference */}
          <section id="api-reference" className="scroll-mt-24 space-y-4">
            <h2 className="text-xl font-bold tracking-tight text-white border-b border-[var(--color-supabase-border)] pb-2">
              API Reference
            </h2>
            <p className="text-sm leading-relaxed text-[var(--color-supabase-text-muted)]">
              The backend FastAPI exposes clean API endpoints for processing data uploads and triggering structured agent queries.
            </p>

            {/* API card 1 */}
            <div className="supabase-card overflow-hidden">
              <div className="px-4 py-2.5 bg-[#171717] border-b border-[var(--color-supabase-border)] flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-[var(--color-supabase-green)] uppercase">
                  POST /upload-db
                </span>
                <span className="text-[10px] text-[var(--color-supabase-text-dim)] uppercase font-semibold">
                  Ingest Flat Data
                </span>
              </div>
              <div className="p-4 bg-[#171717] space-y-3 border-t border-[var(--color-supabase-border)]">
                <p className="text-xs text-[var(--color-supabase-text-muted)]">
                  Receives a multipart file upload (`.csv` or `.db` SQLite format) and creates schema tables inside PostgreSQL.
                </p>
                <div className="text-[11px] font-mono text-[var(--color-supabase-text-muted)] bg-[#141414] p-3 rounded">
                  <span className="text-white block font-bold mb-1">// Request Headers:</span>
                  <div>Authorization: Bearer &lt;Clerk_Token&gt;</div>
                  <div>Content-Type: multipart/form-data</div>
                  <span className="text-white block font-bold mt-2.5 mb-1">// Response JSON (200 OK):</span>
                  <div>{`{ "db_id": "bcaf9045-aeee-400b-a1ad-3a28377caacc", "db_name": "Student_DB.csv", "tables": ["upload_bcaf9045aeee400ba1ad3a28377caacc"] }`}</div>
                </div>
              </div>
            </div>

            {/* API card 2 */}
            <div className="supabase-card overflow-hidden">
              <div className="px-4 py-2.5 bg-[#171717] border-b border-[var(--color-supabase-border)] flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-indigo-400 uppercase">
                  POST /query
                </span>
                <span className="text-[10px] text-[var(--color-supabase-text-dim)] uppercase font-semibold">
                  Agentic Query Text
                </span>
              </div>
              <div className="p-4 bg-[#171717] space-y-3 border-t border-[var(--color-supabase-border)]">
                <p className="text-xs text-[var(--color-supabase-text-muted)]">
                  Sends a natural language question to be resolved into audited, self-healed SQL query results.
                </p>
                <div className="text-[11px] font-mono text-[var(--color-supabase-text-muted)] bg-[#141414] p-3 rounded">
                  <span className="text-white block font-bold mb-1">// Request Body:</span>
                  <div>{`{ "question": "Show top 5 students", "db_id": "bcaf9045-...", "model": "gemini-2.5-flash" }`}</div>
                  <span className="text-white block font-bold mt-2.5 mb-1">// Response JSON (200 OK):</span>
                  <div>{`{ "sql": "SELECT * FROM csv_data.upload_bcaf9045... LIMIT 5", "result": [{ "student_id": 1, "name": "Student_1" }], "columns": ["student_id", "name"], "attempts": 1, "execution_time_ms": 42 }`}</div>
                </div>
              </div>
            </div>
          </section>

        </main>
      </div>
    </div>
  );
}

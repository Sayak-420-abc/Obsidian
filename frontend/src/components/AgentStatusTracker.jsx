"use client";

export default function AgentStatusTracker({ trace }) {
  if (!trace || trace.length === 0) return null;

  const getStepIcon = (step) => {
    if (step.includes("schema")) return "🔍";
    if (step.includes("generation")) return "🧠";
    if (step.includes("safety")) return "🛡️";
    if (step.includes("execution")) return "⚙️";
    if (step.includes("initialization")) return "🔌";
    return "📋";
  };

  const getStepLabel = (step) => {
    if (step.includes("schema")) return "Schema Mapping";
    if (step.includes("generation")) return "Agent SQL Synthesis";
    if (step.includes("safety")) return "Security Audit Gate";
    if (step.includes("execution")) return "Query Execution Pipeline";
    if (step.includes("initialization")) return "System Init";
    return step;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "success":
        return "var(--color-supabase-green)";
      case "error":
        return "var(--color-accent-red)";
      case "running":
        return "var(--color-accent-indigo)";
      default:
        return "var(--color-supabase-text-dim)";
    }
  };

  const getStatusBg = (status) => {
    switch (status) {
      case "success":
        return "rgba(62, 207, 142, 0.04)";
      case "error":
        return "rgba(239, 68, 68, 0.04)";
      case "running":
        return "rgba(99, 102, 241, 0.04)";
      default:
        return "transparent";
    }
  };

  return (
    <div className="supabase-card p-4 animate-fade-in space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-supabase-text-muted)]">
          Agent Workspace Logs
        </h4>
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-[var(--color-supabase-green)] animate-pulse" />
          <span className="text-[10px] font-mono text-[var(--color-supabase-text-dim)]">LIVE TRACE</span>
        </div>
      </div>

      <div className="space-y-1.5">
        {trace.map((entry, idx) => (
          <div
            key={idx}
            className="flex items-start gap-3 py-2 px-3 rounded border border-[var(--color-supabase-border)] transition-colors duration-200"
            style={{
              background: getStatusBg(entry.status),
              borderColor: entry.status === "error" ? "rgba(239,68,68,0.2)" : "var(--color-supabase-border)",
            }}
          >
            <div className="flex flex-col items-center pt-0.5 shrink-0">
              <div className={`status-dot ${entry.status}`} />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs">{getStepIcon(entry.step)}</span>
                <span
                  className="text-xs font-semibold"
                  style={{ color: getStatusColor(entry.status) }}
                >
                  {getStepLabel(entry.step)}
                </span>
                {entry.duration_ms !== undefined && (
                  <span className="text-[10px] font-mono ml-auto text-[var(--color-supabase-text-dim)]">
                    {entry.duration_ms}ms
                  </span>
                )}
              </div>
              <p className="text-[11px] mt-0.5 leading-relaxed text-[var(--color-supabase-text-muted)] break-words">
                {entry.message}
              </p>
              {entry.sql && (
                <code className="block mt-1.5 text-[11px] font-mono px-2.5 py-1.5 rounded overflow-x-auto bg-[#141414] border border-[var(--color-supabase-border)] text-[var(--color-supabase-green)]">
                  {entry.sql}
                </code>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

"use client";

export default function HistoryPanel({ history, onSelect, activeIndex }) {
  if (!history || history.length === 0) {
    return (
      <div className="flex flex-col h-full p-4 justify-center items-center text-center">
        <svg className="w-8 h-8 text-[var(--color-supabase-text-dim)] mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
        </svg>
        <p className="text-xs text-[var(--color-supabase-text-dim)] leading-relaxed">
          No query logs available.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full p-3 space-y-2 overflow-y-auto">
      <div className="flex items-center justify-between px-1 mb-1">
        <span className="text-[10px] font-semibold tracking-wider text-[var(--color-supabase-text-dim)] uppercase">
          SQL Query History
        </span>
        <span className="text-[10px] font-mono text-[var(--color-supabase-green)] bg-[rgba(62,207,142,0.05)] border border-[rgba(62,207,142,0.1)] px-1.5 py-0.2 rounded-full">
          {history.length}
        </span>
      </div>

      <div className="space-y-1">
        {history.map((entry, idx) => {
          const isActive = idx === activeIndex;
          const hasError = !!entry.error;

          return (
            <button
              key={idx}
              onClick={() => onSelect(idx)}
              className="w-full text-left p-2.5 rounded border transition-all duration-150 cursor-pointer"
              style={{
                background: isActive ? "#1e1e1e" : "transparent",
                borderColor: isActive ? "var(--color-supabase-border)" : "transparent",
              }}
            >
              <div className="flex items-start gap-2">
                <div
                  className="status-dot mt-1 shrink-0"
                  style={{
                    background: hasError ? "var(--color-accent-red)" : "var(--color-supabase-green)",
                  }}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-xs leading-snug font-sans truncate text-[var(--color-supabase-text)]">
                    {entry.question}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[9px] font-mono text-[var(--color-supabase-text-dim)]">
                      {entry.attempts > 1 ? `Retry Loop` : `Direct`}
                    </span>
                    {entry.execution_time_ms && (
                      <span className="text-[9px] font-mono text-[var(--color-supabase-text-dim)]">
                        &middot; {entry.execution_time_ms}ms
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

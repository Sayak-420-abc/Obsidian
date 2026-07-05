"use client";

export default function QueryInput({ onSubmit, isLoading, question = "", setQuestion, showClear, onClear }) {
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!question.trim() || isLoading) return;
    onSubmit(question.trim());
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full" autoComplete="off">
      <div className="flex items-center gap-2 p-1 bg-[#141414] border border-[var(--color-supabase-border)] rounded-md focus-within:border-[var(--color-supabase-green)] transition-all duration-150">
        <div className="flex items-center pl-3 shrink-0">
          <svg className="w-4 h-4 text-[var(--color-supabase-text-dim)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        <input
          id="query-input"
          suppressHydrationWarning
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Enter a natural language query (e.g., 'Show the first 10 rows of the active table')"
          disabled={isLoading}
          autoComplete="off"
          spellCheck="false"
          className="flex-1 bg-transparent border-none outline-none text-[var(--color-supabase-text)] placeholder:text-[var(--color-supabase-text-dim)] font-sans text-sm py-2.5 px-2 disabled:opacity-50"
        />

        {showClear && !isLoading && (
          <button
            id="query-clear-btn"
            suppressHydrationWarning
            type="button"
            onClick={onClear}
            className="px-3 py-1.5 border border-[var(--color-supabase-border)] rounded bg-[#171717] hover:border-[var(--color-supabase-green)] text-[var(--color-supabase-text-muted)] hover:text-white transition-all text-xs font-medium flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            Clear
          </button>
        )}

        <button
          id="query-submit-btn"
          suppressHydrationWarning
          type="submit"
          disabled={!question.trim() || isLoading}
          className="supabase-btn-primary py-1.5 px-4 text-xs font-medium flex items-center gap-1.5 disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
        >
          {isLoading ? (
            <>
              <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="32" strokeLinecap="round" />
              </svg>
              Running
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Run Query
            </>
          )}
        </button>
      </div>
    </form>
  );
}

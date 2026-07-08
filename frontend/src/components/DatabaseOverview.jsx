"use client";

import { useState } from "react";
import api from "@/lib/api";
import { useAuth } from "@clerk/nextjs";

// A custom, lightweight Markdown parser designed to render headers, bullet lists, inline code,
// and tables formatted in markdown, with premium Obsidian/Supabase styles.
function RenderMarkdown({ text }) {
  if (!text) return null;

  const lines = text.split("\n");
  const elements = [];
  
  let inCodeBlock = false;
  let codeContent = [];
  let codeLang = "";
  
  let inTable = false;
  let tableRows = [];
  
  let inList = false;
  let listItems = [];

  const formatInline = (str) => {
    // Replace **text** with bold styled text
    let formatted = str.replace(/\*\*(.*?)\*\*/g, '<strong class="text-white font-semibold">$1</strong>');
    // Replace `code` with inline code span
    formatted = formatted.replace(/`(.*?)`/g, '<code class="px-1.5 py-0.5 rounded bg-[#141414] border border-[var(--color-supabase-border)] text-[var(--color-supabase-green)] font-mono text-[11px]">$1</code>');
    return formatted;
  };

  const flushList = (key) => {
    if (listItems.length > 0) {
      elements.push(
        <ul key={`list-${key}`} className="list-disc list-inside ml-4 space-y-1.5 text-xs text-[var(--color-supabase-text-muted)] my-2">
          {listItems.map((item, idx) => (
            <li key={idx} dangerouslySetInnerHTML={{ __html: formatInline(item) }} />
          ))}
        </ul>
      );
      listItems = [];
      inList = false;
    }
  };

  const flushTable = (key) => {
    if (tableRows.length > 0) {
      // Clean and split rows
      const parsedRows = tableRows.map(row => 
        row.split("|")
           .map(cell => cell.trim())
           // Filter out first and last elements since they are empty for lines starting/ending with |
           .filter((_, idx, arr) => idx > 0 && idx < arr.length - 1)
      ).filter(row => row.length > 0);

      if (parsedRows.length > 0) {
        const headers = parsedRows[0];
        // The second row is typically separator like |---| or |:---|
        // Skip separator row when mapping data
        const hasSeparator = parsedRows[1] && parsedRows[1].every(cell => cell.startsWith("-") || cell.startsWith(":") || cell.includes("-"));
        const dataRows = hasSeparator ? parsedRows.slice(2) : parsedRows.slice(1);

        elements.push(
          <div key={`table-${key}`} className="overflow-x-auto my-4 border border-[var(--color-supabase-border)] rounded-lg">
            <table className="min-w-full divide-y divide-[var(--color-supabase-border)] font-sans text-xs">
              <thead className="bg-[#171717]">
                <tr>
                  {headers.map((h, idx) => (
                    <th key={idx} className="px-4 py-2.5 text-left font-semibold text-white uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-supabase-border)] bg-[#121212]">
                {dataRows.map((row, rIdx) => (
                  <tr key={rIdx} className="hover:bg-[#1a1a1a] transition-colors">
                    {row.map((cell, cIdx) => (
                      <td key={cIdx} className="px-4 py-2.5 text-[var(--color-supabase-text-muted)] font-mono whitespace-pre-line" dangerouslySetInnerHTML={{ __html: formatInline(cell) }} />
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }
      tableRows = [];
      inTable = false;
    }
  };

  const flushCodeBlock = (key) => {
    if (codeContent.length > 0) {
      elements.push(
        <pre key={`code-${key}`} className="p-3 my-3 bg-[#141414] border border-[var(--color-supabase-border)] rounded-md font-mono text-xs text-[var(--color-supabase-green)] overflow-x-auto">
          <code>{codeContent.join("\n")}</code>
        </pre>
      );
      codeContent = [];
      inCodeBlock = false;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Code block check
    if (line.trim().startsWith("```")) {
      if (inCodeBlock) {
        flushCodeBlock(i);
      } else {
        flushList(i);
        flushTable(i);
        inCodeBlock = true;
        codeLang = line.replace("```", "").trim();
      }
      continue;
    }

    if (inCodeBlock) {
      codeContent.push(line);
      continue;
    }

    // Table check
    if (line.trim().startsWith("|")) {
      flushList(i);
      inTable = true;
      tableRows.push(line);
      continue;
    } else if (inTable) {
      flushTable(i);
    }

    // List item check
    if (line.trim().startsWith("- ") || line.trim().startsWith("* ")) {
      inList = true;
      listItems.push(line.trim().substring(2));
      continue;
    } else if (inList) {
      // If we encounter a line that isn't a list item, flush the list
      flushList(i);
    }

    // Headings
    if (line.startsWith("### ")) {
      elements.push(
        <h4 key={i} className="text-xs font-bold uppercase tracking-wider text-[var(--color-supabase-green)] mt-4 mb-2">
          {line.substring(4)}
        </h4>
      );
    } else if (line.startsWith("## ")) {
      elements.push(
        <h3 key={i} className="text-sm font-semibold text-white border-b border-[var(--color-supabase-border)] pb-1.5 mt-5 mb-3">
          {line.substring(3)}
        </h3>
      );
    } else if (line.startsWith("# ")) {
      elements.push(
        <h2 key={i} className="text-base font-bold text-white mt-6 mb-4">
          {line.substring(2)}
        </h2>
      );
    } else if (line.trim() === "") {
      elements.push(<div key={i} className="h-2" />);
    } else {
      // Normal paragraph
      elements.push(
        <p key={i} className="text-xs text-[var(--color-supabase-text-muted)] leading-relaxed mb-2" dangerouslySetInnerHTML={{ __html: formatInline(line) }} />
      );
    }
  }

  // Flush remaining blocks
  flushList(lines.length);
  flushTable(lines.length);
  flushCodeBlock(lines.length);

  return <div className="space-y-1">{elements}</div>;
}

export default function DatabaseOverview({ dbId, dbName }) {
  const [question, setQuestion] = useState("");
  const [insight, setInsight] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const { getToken } = useAuth();

  const handleSubmit = async (e, customQuestion = "") => {
    if (e) e.preventDefault();
    const activeQuestion = customQuestion || question;
    if (!activeQuestion.trim() || isLoading) return;

    setIsLoading(true);
    setError(null);
    setInsight("");

    try {
      const token = await getToken();
      const res = await api.post("/insights", {
        question: activeQuestion.trim(),
        db_id: dbId,
      }, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      setInsight(res.data.insight);
    } catch (err) {
      const detail = err.response?.data?.detail || err.message || "Failed to fetch database insights.";
      setError(detail);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExampleClick = (q) => {
    setQuestion(q);
    handleSubmit(null, q);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const exampleQuestions = [
    "What is this database about?",
    "How many tables are there and what are their names?",
    "What are the primary keys and foreign key relationships?",
    "Give me a high-level summary of the data in this database.",
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Query Form */}
      <form onSubmit={handleSubmit} className="w-full">
        <div className="flex items-center gap-2 p-1.5 bg-[#141414] border border-[var(--color-supabase-border)] rounded-md focus-within:border-[var(--color-supabase-green)] transition-all duration-150">
          <div className="flex items-center pl-3 shrink-0">
            <svg className="w-4 h-4 text-[var(--color-supabase-text-dim)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>

          <input
            id="overview-query-input"
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about this database (e.g. 'What is this database about?')"
            disabled={isLoading}
            className="flex-1 bg-transparent border-none outline-none text-[var(--color-supabase-text)] placeholder:text-[var(--color-supabase-text-dim)] font-sans text-sm py-2 px-2 disabled:opacity-50"
          />

          {(insight || error) && !isLoading && (
            <button
              id="overview-query-clear-btn"
              type="button"
              onClick={() => {
                setInsight("");
                setQuestion("");
                setError(null);
              }}
              className="px-3 py-1.5 border border-[var(--color-supabase-border)] rounded bg-[#171717] hover:border-[var(--color-supabase-green)] text-[var(--color-supabase-text-muted)] hover:text-white transition-all text-xs font-semibold flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              Clear
            </button>
          )}

          <button
            id="overview-query-submit-btn"
            type="submit"
            disabled={!question.trim() || isLoading}
            className="supabase-btn-primary py-1.5 px-4 text-xs font-semibold flex items-center gap-1.5 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="32" strokeLinecap="round" />
                </svg>
                Analyzing
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Ask Agent
              </>
            )}
          </button>
        </div>
      </form>

      {/* Loading Skeleton */}
      {isLoading && (
        <div className="border border-[var(--color-supabase-border)] bg-[#171717] rounded-lg p-5 space-y-4 animate-pulse">
          <div className="h-3.5 bg-[#262626] rounded w-1/4" />
          <div className="space-y-2.5">
            <div className="h-3 bg-[#262626] rounded w-full" />
            <div className="h-3 bg-[#262626] rounded w-5/6" />
            <div className="h-3 bg-[#262626] rounded w-4/5" />
          </div>
          <div className="h-10 bg-[#262626] rounded w-full mt-4" />
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="p-4 border border-[rgba(239,68,68,0.2)] bg-[rgba(239,68,68,0.03)] rounded-lg animate-fade-in">
          <span className="text-xs font-semibold text-[var(--color-accent-red)] uppercase block mb-1">
            Analysis Failed
          </span>
          <p className="text-xs text-[var(--color-supabase-text-muted)]">{error}</p>
        </div>
      )}

      {/* Insight Result */}
      {insight && !isLoading && (
        <div className="border border-[var(--color-supabase-border)] bg-[#171717] rounded-lg p-6 animate-fade-in shadow-lg">
          <div className="flex items-center justify-between border-b border-[var(--color-supabase-border)] pb-3 mb-4">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-supabase-green)] flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-supabase-green)]" />
              Agent Analysis Response
            </span>
            <span className="text-[10px] font-mono text-[var(--color-supabase-text-dim)] uppercase">
              conceptual insights
            </span>
          </div>

          <div className="prose prose-invert max-w-none">
            <RenderMarkdown text={insight} />
          </div>
        </div>
      )}

      {/* Centered Empty State */}
      {!isLoading && !insight && !error && (
        <div className="h-[320px] flex flex-col justify-center items-center text-center">
          <div className="w-12 h-12 rounded border border-[var(--color-supabase-border)] bg-[#171717] flex items-center justify-center mb-4 text-[var(--color-supabase-green)]">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <h3 className="text-sm font-semibold mb-1">Explore Database Structure</h3>
          <p className="text-xs text-[var(--color-supabase-text-dim)] max-w-sm leading-relaxed mb-6">
            Ask conceptual questions about schemas, tables, or relationships of <span className="text-[var(--color-supabase-green)] font-mono">{dbName}</span> to get a clear understanding.
          </p>

          <div className="flex flex-wrap gap-2 justify-center max-w-md">
            {exampleQuestions.map((q) => (
              <button
                key={q}
                onClick={() => handleExampleClick(q)}
                className="text-[11px] px-3 py-1.5 border border-[var(--color-supabase-border)] rounded bg-[#171717] hover:border-[var(--color-supabase-green)] text-[var(--color-supabase-text-muted)] hover:text-white transition-all cursor-pointer"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

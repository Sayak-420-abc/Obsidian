"use client";

import { useState, useEffect } from "react";
import ApiExporter from "./ApiExporter";

const SQL_KEYWORDS = [
  "SELECT", "FROM", "WHERE", "JOIN", "INNER", "LEFT", "RIGHT", "OUTER",
  "ON", "AND", "OR", "NOT", "IN", "BETWEEN", "LIKE", "IS", "NULL",
  "AS", "ORDER", "BY", "GROUP", "HAVING", "LIMIT", "OFFSET", "DISTINCT",
  "COUNT", "SUM", "AVG", "MIN", "MAX", "CASE", "WHEN", "THEN", "ELSE",
  "END", "ASC", "DESC", "UNION", "ALL", "EXISTS",
];

function highlightSQL(sql) {
  if (!sql) return "";

  let escaped = sql
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  escaped = escaped.replace(
    /('(?:[^'\\]|\\.)*')/g,
    '<span class="sql-string">$1</span>'
  );

  escaped = escaped.replace(
    /\b(\d+(?:\.\d+)?)\b/g,
    '<span class="sql-number">$1</span>'
  );

  for (const kw of SQL_KEYWORDS) {
    const regex = new RegExp(`\\b(${kw})\\b`, "gi");
    escaped = escaped.replace(
      regex,
      '<span class="sql-keyword">$1</span>'
    );
  }

  return escaped;
}

export default function SqlCodeBlock({ sql, attempts, executionTimeMs, onRunRaw, question, dbId }) {
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedSql, setEditedSql] = useState("");
  const [showExporter, setShowExporter] = useState(false);

  // Sync edits when incoming query changes
  useEffect(() => {
    setEditedSql(sql);
    setIsEditing(false);
    setShowExporter(false);
  }, [sql]);

  if (!sql) return null;

  const handleCopy = async () => {
    const textToCopy = isEditing ? editedSql : sql;
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = textToCopy;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="supabase-card overflow-hidden animate-fade-in">
      {/* Code block Toolbar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#171717] border-b border-[var(--color-supabase-border)]">
        {isEditing ? (
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-supabase-text-dim)] animate-pulse">
              Tweak SQL Query
            </span>
            <span className="text-[9px] font-mono px-2 py-0.5 rounded border border-[rgba(239,68,68,0.2)] bg-[rgba(239,68,68,0.03)] text-[var(--color-accent-red)] uppercase font-semibold">
              Manual Mode
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-supabase-text-muted)]">
              Generated SQL Command
            </span>
            {attempts && (
              <span
                className="text-[10px] font-mono px-2 py-0.5 rounded border"
                style={{
                  background: "rgba(62, 207, 142, 0.04)",
                  borderColor: "rgba(62, 207, 142, 0.2)",
                  color: "var(--color-supabase-green)",
                }}
              >
                {attempts > 1 ? `Corrected (Attempt ${attempts})` : "Attempt 1"}
              </span>
            )}
            {executionTimeMs !== undefined && (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded border border-[var(--color-supabase-border)] bg-[#1e1e1e] text-[var(--color-supabase-text-muted)]">
                {executionTimeMs}ms
              </span>
            )}
          </div>
        )}

        {/* Action Controls */}
        <div className="flex items-center gap-1.5">
          {isEditing ? (
            <>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="supabase-btn-secondary py-1 px-3 text-xs cursor-pointer select-none"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (editedSql.trim()) {
                    onRunRaw(editedSql.trim());
                  }
                }}
                className="supabase-btn-primary py-1 px-3 text-xs flex items-center gap-1 cursor-pointer select-none"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span>Run SQL</span>
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={handleCopy}
                className="supabase-btn-secondary py-1 px-3 text-xs select-none cursor-pointer"
              >
                {copied ? "Copied" : "Copy"}
              </button>
              {onRunRaw && (
                <button
                  type="button"
                  onClick={() => {
                    setEditedSql(sql);
                    setIsEditing(true);
                  }}
                  className="supabase-btn-secondary py-1 px-3 text-xs flex items-center gap-1 cursor-pointer select-none"
                  title="Edit SQL code manually"
                >
                  <svg className="w-3.5 h-3.5 text-[var(--color-supabase-text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                  <span>Edit</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowExporter(!showExporter)}
                className={`supabase-btn-secondary py-1 px-3 text-xs flex items-center gap-1 cursor-pointer select-none ${
                  showExporter ? "bg-[rgba(62,207,142,0.08)] border-[rgba(62,207,142,0.3)] text-[var(--color-supabase-green)] font-semibold" : ""
                }`}
                title="Export query as API code snippet"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span>API Code</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Code Textarea or Highlighter Rendering */}
      {isEditing ? (
        <div className="p-4 bg-[#121212] border-t border-[var(--color-supabase-border)]">
          <textarea
            value={editedSql}
            onChange={(e) => setEditedSql(e.target.value)}
            className="w-full min-h-[120px] bg-[#141414] border border-[var(--color-supabase-border)] rounded p-3 text-[11px] font-mono text-[var(--color-supabase-green)] outline-none focus:border-[var(--color-supabase-green)] resize-y leading-relaxed"
            placeholder="SELECT * FROM table_name..."
            autoFocus
          />
        </div>
      ) : (
        <pre
          className="sql-code m-0 rounded-none border-none cursor-pointer hover:bg-[rgba(255,255,255,0.01)] transition-colors"
          dangerouslySetInnerHTML={{ __html: highlightSQL(sql) }}
          onClick={() => {
            if (onRunRaw) {
              setEditedSql(sql);
              setIsEditing(true);
            }
          }}
          title="Click to edit query"
        />
      )}

      {/* Snippet Exporter Panel */}
      {!isEditing && showExporter && (
        <ApiExporter question={question} dbId={dbId} />
      )}
    </div>
  );
}

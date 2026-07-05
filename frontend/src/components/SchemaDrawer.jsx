"use client";

export default function SchemaDrawer({ schema, dbName }) {
  return (
    <div className="flex flex-col h-full p-3 space-y-3 overflow-y-auto">
      {/* DB Active Header */}
      <div className="px-1 shrink-0">
        <span className="text-[10px] font-semibold tracking-wider text-[var(--color-supabase-text-dim)] uppercase">
          Database Schema Catalog
        </span>
        <div className="flex items-center gap-2 mt-1.5 p-2 bg-[#141414] border border-[var(--color-supabase-border)] rounded">
          <svg className="w-3.5 h-3.5 text-[var(--color-supabase-green)] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
          </svg>
          <span className="text-xs font-mono text-[var(--color-supabase-text)] truncate" title={dbName}>
            {dbName}
          </span>
        </div>
      </div>

      {/* Schema Tables */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-0.5">
        {schema && schema.length > 0 ? (
          schema.map((table) => (
            <div key={table.table_name} className="border border-[var(--color-supabase-border)] bg-[#171717] rounded">
              {/* Header */}
              <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--color-supabase-border)] bg-[#1a1a1a] min-w-0">
                <span className="text-xs font-mono text-[var(--color-supabase-green)] font-semibold truncate mr-2" title={table.display_name || table.table_name}>
                  {table.display_name || table.table_name}
                </span>
                <span className="text-[9px] font-mono text-[var(--color-supabase-text-dim)] shrink-0">
                  {table.row_count !== undefined && table.row_count !== null ? `${table.row_count} rows` : "0 rows"}
                </span>
              </div>

              {/* Columns */}
              <div className="p-2 space-y-0.5">
                {table.columns.map((col) => (
                  <div key={col.name} className="flex items-center justify-between px-1.5 py-0.5 text-[11px] font-mono">
                    <div className="flex items-center gap-1 min-w-0 flex-1">
                      {col.is_primary_key && (
                        <span className="text-[8px] font-bold text-[var(--color-supabase-green)] px-0.5 border border-[rgba(62,207,142,0.3)] rounded bg-[rgba(62,207,142,0.05)] shrink-0">
                          PK
                        </span>
                      )}
                      {!col.is_primary_key && <span className="w-4 shrink-0" />}
                      <span className="text-[var(--color-supabase-text)] truncate" title={col.name}>{col.name}</span>
                    </div>
                    <span className="text-[var(--color-supabase-text-dim)] ml-2 shrink-0">{col.type.toLowerCase()}</span>
                  </div>
                ))}
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-6 text-xs text-[var(--color-supabase-text-dim)]">
            No schemas present.
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";

export default function ResultsTable({ result, columns }) {
  const [currentPage, setCurrentPage] = useState(1);
  const [copyStatus, setCopyStatus] = useState(""); // "", "copied", "csv_success", "excel_success", "exporting_excel"
  const rowsPerPage = 12;

  // Reset page to 1 when results change
  useEffect(() => {
    setCurrentPage(1);
  }, [result]);

  if (!result || result.length === 0) return null;

  const cols = columns || Object.keys(result[0]);
  const totalPages = Math.ceil(result.length / rowsPerPage);
  const startIdx = (currentPage - 1) * rowsPerPage;
  const visibleRows = result.slice(startIdx, startIdx + rowsPerPage);

  // 1. Export CSV Handler
  const exportToCSV = () => {
    const csvRows = [];
    
    // Header Row
    csvRows.push(cols.map(col => {
      const escaped = String(col).replace(/"/g, '""');
      return `"${escaped}"`;
    }).join(","));
    
    // Data Rows
    result.forEach(row => {
      const values = cols.map(col => {
        const val = row[col];
        if (val === null || val === undefined) {
          return '""';
        }
        const escaped = String(val).replace(/"/g, '""');
        return `"${escaped}"`;
      });
      csvRows.push(values.join(","));
    });
    
    // Add UTF-8 BOM so Excel opens special characters cleanly
    const csvContent = "\uFEFF" + csvRows.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `query_results_${Date.now()}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    setCopyStatus("csv_success");
    setTimeout(() => setCopyStatus(""), 2000);
  };

  // 2. Export Excel Handler
  const exportToExcel = async () => {
    try {
      setCopyStatus("exporting_excel");
      const XLSX = await import("xlsx");
      
      // Filter row keys to match exact column order and list of visible/specified columns
      const cleanData = result.map(row => {
        const cleanRow = {};
        cols.forEach(col => {
          cleanRow[col] = row[col];
        });
        return cleanRow;
      });
      
      const ws = XLSX.utils.json_to_sheet(cleanData, { header: cols });
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Query Results");
      XLSX.writeFile(wb, `query_results_${Date.now()}.xlsx`);
      
      setCopyStatus("excel_success");
      setTimeout(() => setCopyStatus(""), 2000);
    } catch (err) {
      console.error("Failed to export Excel file:", err);
      setCopyStatus("");
    }
  };

  // 3. Copy to Clipboard (TSV format) Handler
  const copyToClipboard = async () => {
    try {
      const headerRow = cols.join("\t");
      const bodyRows = result.map(row => 
        cols.map(col => {
          const val = row[col];
          if (val === null || val === undefined) return "";
          // Sanitize tabs & newlines from value strings to maintain cell alignment
          return String(val).replace(/\t/g, " ").replace(/\r?\n/g, " ");
        }).join("\t")
      );
      
      const tsvContent = [headerRow, ...bodyRows].join("\n");
      await navigator.clipboard.writeText(tsvContent);
      
      setCopyStatus("copied");
      setTimeout(() => setCopyStatus(""), 2000);
    } catch (err) {
      console.error("Failed to copy table data:", err);
    }
  };

  return (
    <div className="supabase-card overflow-hidden animate-fade-in">
      {/* Table Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-2.5 bg-[#171717] border-b border-[var(--color-supabase-border)]">
        {/* Left Side Info */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-supabase-text-muted)]">
            Query Results Table
          </span>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded border border-[var(--color-supabase-border)] bg-[#1e1e1e] text-[var(--color-supabase-text-muted)]">
            {result.length} row{result.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Right Side Tools & Pagination */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Action Toolbar */}
          <div className="flex items-center gap-1.5 border-r border-[var(--color-supabase-border)] pr-3 mr-1">
            {/* Copy Button */}
            <button
              onClick={copyToClipboard}
              disabled={copyStatus === "exporting_excel"}
              className="supabase-btn-secondary py-1 px-2.5 text-[11px] flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed select-none"
              title="Copy to Clipboard (TSV)"
            >
              {copyStatus === "copied" ? (
                <>
                  <svg className="w-3.5 h-3.5 text-[var(--color-supabase-green)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-[var(--color-supabase-green)] font-semibold">Copied!</span>
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5 text-[var(--color-supabase-text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                  </svg>
                  <span>Copy</span>
                </>
              )}
            </button>

            {/* CSV Button */}
            <button
              onClick={exportToCSV}
              disabled={copyStatus === "exporting_excel"}
              className="supabase-btn-secondary py-1 px-2.5 text-[11px] flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed select-none"
              title="Download CSV"
            >
              {copyStatus === "csv_success" ? (
                <>
                  <svg className="w-3.5 h-3.5 text-[var(--color-supabase-green)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-[var(--color-supabase-green)] font-semibold">Downloaded!</span>
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5 text-[var(--color-supabase-text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  <span>CSV</span>
                </>
              )}
            </button>

            {/* Excel Button */}
            <button
              onClick={exportToExcel}
              disabled={copyStatus === "exporting_excel"}
              className="supabase-btn-secondary py-1 px-2.5 text-[11px] flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed select-none"
              title="Download Excel (.xlsx)"
            >
              {copyStatus === "exporting_excel" ? (
                <>
                  <svg className="animate-spin w-3.5 h-3.5 text-[var(--color-supabase-green)]" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span className="text-[var(--color-supabase-green)] font-semibold">Exporting...</span>
                </>
              ) : copyStatus === "excel_success" ? (
                <>
                  <svg className="w-3.5 h-3.5 text-[var(--color-supabase-green)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-[var(--color-supabase-green)] font-semibold">Downloaded!</span>
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5 text-[var(--color-supabase-text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span>Excel</span>
                </>
              )}
            </button>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="supabase-btn-secondary py-0.5 px-2 text-xs disabled:opacity-30 disabled:cursor-not-allowed select-none"
              >
                &larr; Prev
              </button>
              <span className="text-[10px] font-mono text-[var(--color-supabase-text-dim)] select-none">
                {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="supabase-btn-secondary py-0.5 px-2 text-xs disabled:opacity-30 disabled:cursor-not-allowed select-none"
              >
                Next &rarr;
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Table Data View */}
      <div className="overflow-x-auto max-h-[380px] overflow-y-auto bg-[#141414]">
        <table className="data-table">
          <thead>
            <tr>
              {cols.map((col) => (
                <th key={col}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row, rowIdx) => (
              <tr key={rowIdx}>
                {cols.map((col) => (
                  <td key={col}>
                    {row[col] === null || row[col] === undefined ? (
                      <span className="text-[var(--color-supabase-text-dim)] italic font-mono">NULL</span>
                    ) : (
                      String(row[col])
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}


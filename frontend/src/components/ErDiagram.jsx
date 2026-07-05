"use client";

import { useState } from "react";

export default function ErDiagram({ schema }) {
  const [hoveredTable, setHoveredTable] = useState(null);

  if (!schema || schema.length === 0) {
    return (
      <div className="p-8 text-center text-xs border border-[var(--color-supabase-border)] bg-[#171717] rounded-lg text-[var(--color-supabase-text-dim)]">
        No active database tables mapped. Grounding list is empty.
      </div>
    );
  }

  // ── Layout Constants ──
  const cardWidth = 210;
  const headerHeight = 38;
  const colRowHeight = 26;
  const cardPaddingBottom = 10;
  const getCardHeight = (table) => headerHeight + table.columns.length * colRowHeight + cardPaddingBottom;
  const gutterWidth = 100; // space between columns reserved for routing lines
  const vGap = 50;

  // ── Dependency-based column assignment ──
  const getDependencyLevels = (tables) => {
    const levels = {};
    tables.forEach((t) => { levels[t.table_name] = 0; });
    for (let iter = 0; iter < tables.length; iter++) {
      let changed = false;
      tables.forEach((t) => {
        if (t.foreign_keys && t.foreign_keys.length > 0) {
          let maxRefLevel = -1;
          t.foreign_keys.forEach((fk) => {
            const refLevel = levels[fk.to_table] !== undefined ? levels[fk.to_table] : 0;
            if (refLevel > maxRefLevel) maxRefLevel = refLevel;
          });
          const newLevel = maxRefLevel + 1;
          if (newLevel !== levels[t.table_name]) {
            levels[t.table_name] = newLevel;
            changed = true;
          }
        }
      });
      if (!changed) break;
    }
    return levels;
  };

  const levels = getDependencyLevels(schema);

  // Group tables by their dependency column
  const columnGroups = {};
  schema.forEach((t) => {
    const lvl = levels[t.table_name] || 0;
    if (!columnGroups[lvl]) columnGroups[lvl] = [];
    columnGroups[lvl].push(t);
  });

  // ── Position Calculation ──
  const positions = {};
  let maxCol = 0;

  // Compute total height per column
  const colHeights = {};
  Object.keys(columnGroups).forEach((colStr) => {
    const col = parseInt(colStr);
    if (col > maxCol) maxCol = col;
    const tables = columnGroups[col];
    let totalH = 0;
    tables.forEach((t, i) => {
      totalH += getCardHeight(t);
      if (i < tables.length - 1) totalH += vGap;
    });
    colHeights[col] = totalH;
  });

  let maxColHeight = 0;
  Object.values(colHeights).forEach((h) => { if (h > maxColHeight) maxColHeight = h; });
  const canvasHeight = Math.max(maxColHeight + 80, 400);

  // Assign (x, y) positions — each column starts at x = col * (cardWidth + gutterWidth)
  Object.keys(columnGroups).forEach((colStr) => {
    const col = parseInt(colStr);
    const tables = columnGroups[col];
    const totalH = colHeights[col];
    const startY = Math.max(30, (canvasHeight - totalH) / 2);
    const x = 40 + col * (cardWidth + gutterWidth);

    let currentY = startY;
    tables.forEach((table) => {
      positions[table.table_name] = { x, y: currentY, col };
      currentY += getCardHeight(table) + vGap;
    });
  });

  const canvasWidth = (maxCol + 1) * (cardWidth + gutterWidth) + 40;

  // ── Helper: is a column a foreign key? ──
  const isForeignKey = (table, colName) => {
    return table.foreign_keys && table.foreign_keys.some((fk) => fk.from_col === colName);
  };

  // ── Build connector data ──
  // Collect all raw connectors first, then assign gutter lane offsets to avoid overlap
  const rawConnectors = [];
  schema.forEach((t) => {
    const srcTable = t.table_name;
    const pSrc = positions[srcTable];
    if (!pSrc || !t.foreign_keys) return;

    t.foreign_keys.forEach((fk) => {
      const destTable = fk.to_table;
      const pDest = positions[destTable];
      if (!pDest) return;
      const targetTableObj = schema.find((tbl) => tbl.table_name === destTable);
      if (!targetTableObj) return;

      const srcColIdx = t.columns.findIndex((c) => c.name === fk.from_col);
      const destColIdx = targetTableObj.columns.findIndex((c) => c.name === fk.to_col);

      // Y anchored to specific column row center
      const y1 = pSrc.y + headerHeight + (srcColIdx >= 0 ? srcColIdx : 0) * colRowHeight + colRowHeight / 2;
      const y2 = pDest.y + headerHeight + (destColIdx >= 0 ? destColIdx : 0) * colRowHeight + colRowHeight / 2;

      // Determine which gutter the vertical segment should run through
      // The gutter is the space between the two columns involved
      const srcCol = pSrc.col;
      const destCol = pDest.col;
      const gutterCol = Math.min(srcCol, destCol); // gutter index = the lower column

      rawConnectors.push({
        id: `${srcTable}-${fk.from_col}-${destTable}-${fk.to_col}`,
        srcTable,
        destTable,
        y1,
        y2,
        srcCol,
        destCol,
        gutterCol,
        label: `${fk.from_col} → ${fk.to_col}`,
      });
    });
  });

  // Group connectors by gutterCol and assign lane offsets within each gutter
  const gutterGroups = {};
  rawConnectors.forEach((c) => {
    if (!gutterGroups[c.gutterCol]) gutterGroups[c.gutterCol] = [];
    gutterGroups[c.gutterCol].push(c);
  });

  const connectors = [];
  Object.keys(gutterGroups).forEach((gutterStr) => {
    const gutterCol = parseInt(gutterStr);
    const group = gutterGroups[gutterCol];
    const laneCount = group.length;
    // The gutter center X is between the right edge of gutterCol cards and left edge of (gutterCol+1) cards
    const gutterLeftX = 40 + gutterCol * (cardWidth + gutterWidth) + cardWidth;
    const gutterRightX = gutterLeftX + gutterWidth;
    const gutterCenterX = (gutterLeftX + gutterRightX) / 2;

    group.forEach((c, laneIdx) => {
      // Spread lanes evenly across gutter width (with padding)
      const laneSpacing = Math.min(16, (gutterWidth - 20) / Math.max(laneCount, 1));
      const laneOffset = (laneIdx - (laneCount - 1) / 2) * laneSpacing;
      const midX = gutterCenterX + laneOffset;

      // Source exits from the edge facing the destination
      let x1, x2;
      if (c.srcCol > c.destCol) {
        x1 = positions[c.srcTable].x;             // left edge of source
        x2 = positions[c.destTable].x + cardWidth; // right edge of dest
      } else {
        x1 = positions[c.srcTable].x + cardWidth;  // right edge of source
        x2 = positions[c.destTable].x;             // left edge of dest
      }

      // Build orthogonal path: horizontal → vertical (in gutter) → horizontal
      const pathData = `M ${x1} ${c.y1} H ${midX} V ${c.y2} H ${x2}`;

      connectors.push({
        ...c,
        pathData,
        midX,
        midY: (c.y1 + c.y2) / 2,
      });
    });
  });

  // ── Deterministic header color ──
  const getHeaderColor = (tableName) => {
    const hash = tableName.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
    const colors = ["#3ecf8e", "#6366f1", "#ec4899", "#3b82f6", "#f59e0b", "#8b5cf6", "#06b6d4"];
    return colors[hash % colors.length];
  };

  return (
    <div className="border border-[var(--color-supabase-border)] bg-[#171717] rounded-lg p-5 space-y-4 shadow-lg overflow-x-auto relative">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--color-supabase-border)] pb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-supabase-green)]">
            Database ER Model Diagram
          </span>
          <span className="text-[10px] bg-[#141414] border border-[var(--color-supabase-border)] px-2 py-0.5 rounded text-[var(--color-supabase-text-dim)] uppercase font-mono">
            interactive
          </span>
        </div>
        <span className="text-[10px] text-[var(--color-supabase-text-dim)]">
          Hover over tables to highlight relationships
        </span>
      </div>

      {/* Canvas */}
      <div
        className="relative"
        style={{ width: `${canvasWidth}px`, height: `${canvasHeight}px`, minWidth: "100%" }}
      >
        {/* SVG layer for connectors */}
        <svg
          className="absolute inset-0 pointer-events-none"
          width={canvasWidth}
          height={canvasHeight}
          style={{ zIndex: 5 }}
        >
          <defs>
            {/* Crow's foot (many side) — FK source */}
            <marker id="cf-dim" viewBox="0 0 12 12" refX="2" refY="6" markerWidth="10" markerHeight="10" orient="auto-start-reverse">
              <line x1="10" y1="2" x2="2" y2="6" stroke="#555" strokeWidth="1.5" />
              <line x1="10" y1="10" x2="2" y2="6" stroke="#555" strokeWidth="1.5" />
              <line x1="10" y1="6" x2="2" y2="6" stroke="#555" strokeWidth="1.5" />
            </marker>
            <marker id="cf-lit" viewBox="0 0 12 12" refX="2" refY="6" markerWidth="10" markerHeight="10" orient="auto-start-reverse">
              <line x1="10" y1="2" x2="2" y2="6" stroke="#3ecf8e" strokeWidth="2" />
              <line x1="10" y1="10" x2="2" y2="6" stroke="#3ecf8e" strokeWidth="2" />
              <line x1="10" y1="6" x2="2" y2="6" stroke="#3ecf8e" strokeWidth="2" />
            </marker>

            {/* One side (PK/referenced) — single bar + circle */}
            <marker id="one-dim" viewBox="0 0 12 12" refX="10" refY="6" markerWidth="9" markerHeight="9" orient="auto-start-reverse">
              <line x1="10" y1="2" x2="10" y2="10" stroke="#555" strokeWidth="1.5" />
              <circle cx="4" cy="6" r="3" fill="none" stroke="#555" strokeWidth="1.5" />
            </marker>
            <marker id="one-lit" viewBox="0 0 12 12" refX="10" refY="6" markerWidth="9" markerHeight="9" orient="auto-start-reverse">
              <line x1="10" y1="2" x2="10" y2="10" stroke="#3ecf8e" strokeWidth="2" />
              <circle cx="4" cy="6" r="3" fill="none" stroke="#3ecf8e" strokeWidth="2" />
            </marker>
          </defs>

          {connectors.map((c) => {
            const hovered = hoveredTable !== null;
            const connected = hoveredTable === c.srcTable || hoveredTable === c.destTable;
            const active = hovered && connected;
            const opacity = hovered ? (connected ? 1 : 0.1) : 0.7;

            return (
              <g key={c.id}>
                <path
                  d={c.pathData}
                  fill="none"
                  stroke={active ? "#3ecf8e" : "#555"}
                  strokeWidth={active ? 2.5 : 1.5}
                  opacity={opacity}
                  markerStart={`url(#${active ? "cf-lit" : "cf-dim"})`}
                  markerEnd={`url(#${active ? "one-lit" : "one-dim"})`}
                  style={{ transition: "stroke 0.15s, stroke-width 0.15s, opacity 0.15s" }}
                />
                {active && (
                  <text
                    x={c.midX}
                    y={c.midY - 8}
                    textAnchor="middle"
                    fill="#3ecf8e"
                    fontSize="9"
                    fontFamily="monospace"
                  >
                    {c.label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {/* HTML table cards */}
        {schema.map((table) => {
          const pos = positions[table.table_name];
          if (!pos) return null;

          const isHovered = hoveredTable === table.table_name;
          const isDimmed = hoveredTable !== null && !isHovered;
          const headerColor = getHeaderColor(table.table_name);

          return (
            <div
              key={table.table_name}
              className="absolute"
              style={{
                left: pos.x,
                top: pos.y,
                width: cardWidth,
                zIndex: isHovered ? 20 : 10,
                opacity: isDimmed ? 0.55 : 1,
                transform: isHovered ? "scale(1.02)" : "scale(1)",
                transition: "opacity 0.15s, transform 0.15s",
              }}
              onMouseEnter={() => setHoveredTable(table.table_name)}
              onMouseLeave={() => setHoveredTable(null)}
            >
              <div
                className="rounded overflow-hidden shadow-lg"
                style={{
                  borderLeft: `1px solid ${isHovered ? "#3ecf8e" : "var(--color-supabase-border)"}`,
                  borderRight: `1px solid ${isHovered ? "#3ecf8e" : "var(--color-supabase-border)"}`,
                  borderBottom: `1px solid ${isHovered ? "#3ecf8e" : "var(--color-supabase-border)"}`,
                  borderTop: `3px solid ${headerColor}`,
                  transition: "border-color 0.15s",
                }}
              >
                {/* Header */}
                <div
                  className="flex items-center justify-between px-3 shrink-0"
                  style={{
                    height: `${headerHeight}px`,
                    background: "#1a1a1a",
                    borderBottom: "1px solid var(--color-supabase-border)",
                  }}
                >
                  <span
                    className="text-xs font-mono font-bold truncate"
                    style={{ color: isHovered ? headerColor : "var(--color-supabase-text)" }}
                  >
                    {table.table_name}
                  </span>
                  <span className="text-[9px] font-mono text-[var(--color-supabase-text-dim)] bg-[#121212] px-1.5 py-0.5 border border-[var(--color-supabase-border)] rounded shrink-0 ml-2">
                    {table.row_count} rows
                  </span>
                </div>

                {/* Columns */}
                <div style={{ background: "#121212" }}>
                  {table.columns.map((col) => {
                    const isPk = col.is_primary_key;
                    const isFk = isForeignKey(table, col.name);

                    return (
                      <div
                        key={col.name}
                        className="flex items-center justify-between px-3 font-mono"
                        style={{
                          height: `${colRowHeight}px`,
                          fontSize: "11px",
                          borderBottom: "1px solid rgba(255,255,255,0.04)",
                        }}
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          {isPk ? (
                            <span className="text-[8px] font-bold px-1 rounded shrink-0" style={{ color: "#3ecf8e", border: "1px solid rgba(62,207,142,0.3)", background: "rgba(62,207,142,0.06)" }}>
                              PK
                            </span>
                          ) : isFk ? (
                            <span className="text-[8px] font-bold px-1 rounded shrink-0" style={{ color: "#f59e0b", border: "1px solid rgba(245,158,11,0.3)", background: "rgba(245,158,11,0.06)" }}>
                              FK
                            </span>
                          ) : (
                            <span className="shrink-0" style={{ width: 20 }} />
                          )}
                          <span className="truncate" style={{ color: "var(--color-supabase-text)" }} title={col.name}>
                            {col.name}
                          </span>
                        </div>
                        <span className="ml-2 shrink-0" style={{ color: "var(--color-supabase-text-dim)" }}>
                          {col.type.toLowerCase()}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

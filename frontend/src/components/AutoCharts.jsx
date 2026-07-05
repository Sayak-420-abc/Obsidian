"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

// Curated colors for Pie chart slices matching the Obsidian/Supabase ecosystem
const COLORS = [
  "#3ecf8e", // Supabase green
  "#3b82f6", // Indigo blue
  "#f59e0b", // Amber yellow
  "#ec4899", // Pink red
  "#8b5cf6", // Violet purple
  "#ef4444", // Crimson red
  "#14b8a6", // Teal cyan
  "#a855f7", // Purple
];

export default function AutoCharts({ result, columns }) {
  const cols = useMemo(() => columns || (result && result.length > 0 ? Object.keys(result[0]) : []), [result, columns]);

  // 1. Columns classification: Identify numeric vs. categorical fields
  const { numericCols, categoricalCols } = useMemo(() => {
    const numerics = [];
    const categoricals = [];
    if (result && result.length > 0) {
      const sample = result[0];
      cols.forEach((col) => {
        const val = sample[col];
        // Classify as numeric if type is number and is not NaN
        if (typeof val === "number" && !isNaN(val)) {
          numerics.push(col);
        } else {
          categoricals.push(col);
        }
      });
    }
    return { numericCols: numerics, categoricalCols: categoricals };
  }, [result, cols]);

  // Check if Y axis looks like an ID (e.g. customer_id, id)
  const looksLikeId = (name) => {
    const ln = name.toLowerCase();
    return ln === "id" || ln.endsWith("id") || ln.includes("_id");
  };

  // 2. State hooks for axes & chart type selection
  const [chartType, setChartType] = useState("bar"); // "bar", "line", "pie"
  const [xAxisKey, setXAxisKey] = useState("");
  const [yAxisKey, setYAxisKey] = useState("");

  // 3. Automatically assign default axes on load or data updates
  useEffect(() => {
    if (numericCols.length > 0) {
      // Prioritize numeric fields that aren't IDs for Y axis
      const bestY = numericCols.find((col) => !looksLikeId(col)) || numericCols[0];
      setYAxisKey(bestY);
    } else {
      setYAxisKey("");
    }

    if (cols.length > 0) {
      // Prioritize categorical columns (strings, codes, dates) for X axis
      const bestX = categoricalCols[0] || cols[0];
      setXAxisKey(bestX);
    } else {
      setXAxisKey("");
    }
  }, [result, numericCols, categoricalCols, cols]);

  // Render placeholder if data list is empty
  if (!result || result.length === 0) {
    return (
      <div className="h-[280px] flex items-center justify-center text-center text-xs text-[var(--color-supabase-text-dim)] bg-[#121212] border border-[var(--color-supabase-border)] rounded-md">
        No data available to construct visualizations.
      </div>
    );
  }

  // Render warning if there are no numeric fields to map
  if (numericCols.length === 0) {
    return (
      <div className="h-[280px] flex flex-col justify-center items-center text-center p-6 bg-[#121212] border border-[var(--color-supabase-border)] rounded-md">
        <svg className="w-8 h-8 text-[var(--color-supabase-text-dim)] mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-1">
          No Quantitative Fields Found
        </h3>
        <p className="text-[10px] text-[var(--color-supabase-text-muted)] max-w-xs leading-relaxed">
          No numeric columns (prices, counts, sums) were detected in the query output to plot on the Y-axis.
        </p>
      </div>
    );
  }

  // Custom tooltips to maintain Obsidian UX consistency
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-[#171717] border border-[var(--color-supabase-border)] p-3 rounded shadow-xl font-mono text-[11px] space-y-1.5 animate-fade-in">
          <p className="text-[var(--color-supabase-text-dim)] uppercase tracking-wider text-[9px] font-bold">
            {xAxisKey}: <span className="text-white ml-1 font-semibold">{label}</span>
          </p>
          <p className="text-[var(--color-supabase-green)] uppercase tracking-wider text-[9px] font-bold">
            {yAxisKey}: <span className="text-white ml-1 font-extrabold">{payload[0].value}</span>
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-4">
      {/* Dynamic Controls Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-[#141414] border border-[var(--color-supabase-border)] rounded-md">
        {/* Chart Selector Buttons */}
        <div className="flex items-center gap-1.5 p-0.5 bg-[#121212] border border-[var(--color-supabase-border)] rounded-md">
          {["bar", "line", "pie"].map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setChartType(type)}
              className={`px-3 py-1 text-[10px] uppercase font-mono font-bold tracking-wider rounded-md transition-all cursor-pointer ${
                chartType === type
                  ? "bg-[#171717] text-[var(--color-supabase-green)] border border-[var(--color-supabase-border)]"
                  : "text-[var(--color-supabase-text-dim)] hover:text-white"
              }`}
            >
              {type}
            </button>
          ))}
        </div>

        {/* Axes Selectors */}
        <div className="flex flex-wrap items-center gap-3">
          {/* X Axis Selector */}
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] uppercase font-mono text-[var(--color-supabase-text-dim)] font-bold">
              X-Axis:
            </span>
            <select
              value={xAxisKey}
              onChange={(e) => setXAxisKey(e.target.value)}
              className="bg-[#121212] border border-[var(--color-supabase-border)] rounded px-2.5 py-1 text-[11px] text-white outline-none focus:border-[var(--color-supabase-green)]"
            >
              {cols.map((col) => (
                <option key={col} value={col}>
                  {col}
                </option>
              ))}
            </select>
          </div>

          {/* Y Axis Selector */}
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] uppercase font-mono text-[var(--color-supabase-text-dim)] font-bold">
              Y-Axis:
            </span>
            <select
              value={yAxisKey}
              onChange={(e) => setYAxisKey(e.target.value)}
              className="bg-[#121212] border border-[var(--color-supabase-border)] rounded px-2.5 py-1 text-[11px] text-white outline-none focus:border-[var(--color-supabase-green)]"
            >
              {numericCols.map((col) => (
                <option key={col} value={col}>
                  {col}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Render Chart */}
      <div className="h-[300px] w-full p-4 bg-[#121212] border border-[var(--color-supabase-border)] rounded-md flex items-center justify-center">
        <ResponsiveContainer width="100%" height="100%">
          {chartType === "bar" ? (
            <BarChart data={result} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#202020" vertical={false} />
              <XAxis
                dataKey={xAxisKey}
                stroke="#525252"
                fontSize={10}
                tickLine={false}
                dy={8}
                fontFamily="Courier New, monospace"
              />
              <YAxis
                stroke="#525252"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                dx={-8}
                fontFamily="Courier New, monospace"
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.02)" }} />
              <Bar
                dataKey={yAxisKey}
                fill="var(--color-supabase-green)"
                radius={[4, 4, 0, 0]}
                maxBarSize={45}
              />
            </BarChart>
          ) : chartType === "line" ? (
            <LineChart data={result} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#202020" vertical={false} />
              <XAxis
                dataKey={xAxisKey}
                stroke="#525252"
                fontSize={10}
                tickLine={false}
                dy={8}
                fontFamily="Courier New, monospace"
              />
              <YAxis
                stroke="#525252"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                dx={-8}
                fontFamily="Courier New, monospace"
              />
              <Tooltip content={<CustomTooltip />} />
              <Line
                type="monotone"
                dataKey={yAxisKey}
                stroke="var(--color-supabase-green)"
                strokeWidth={2}
                dot={{ stroke: "#121212", strokeWidth: 1.5, fill: "var(--color-supabase-green)", r: 4 }}
                activeDot={{ r: 6, strokeWidth: 0 }}
              />
            </LineChart>
          ) : (
            <PieChart>
              <Pie
                data={result}
                dataKey={yAxisKey}
                nameKey={xAxisKey}
                cx="50%"
                cy="50%"
                outerRadius={85}
                innerRadius={45}
                paddingAngle={3}
                labelLine={false}
                label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                fontSize={9}
                fontFamily="Courier New, monospace"
                stroke="#121212"
                strokeWidth={2}
              >
                {result.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

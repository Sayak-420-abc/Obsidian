"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import { useAuth } from "@clerk/nextjs";

export default function SettingsPanel({
  dbId,
  model,
  setModel,
  temperature,
  setTemperature,
  systemInstruction,
  setSystemInstruction,
}) {
  const { getToken } = useAuth();
  const [previewData, setPreviewData] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewError, setPreviewError] = useState(null);
  const [activePreviewTab, setActivePreviewTab] = useState("full"); // "full" | "schema" | "sample"

  // Fetch settings preview from API when instruction base or dbId changes
  useEffect(() => {
    let active = true;
    const fetchPreview = async () => {
      if (!dbId) {
        if (active) {
          setPreviewError("No database connection active. Upload or select a database first.");
          setLoadingPreview(false);
        }
        return;
      }
      setLoadingPreview(true);
      setPreviewError(null);
      try {
        const token = await getToken();
        const res = await axios.get("/api/settings/preview", {
          params: {
            db_id: dbId,
            custom_instruction: systemInstruction,
          },
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        if (active) {
          setPreviewData(res.data);
          // Set initial default instruction base if none was provided/customized yet
          if (!systemInstruction && res.data.default_instruction_base) {
            setSystemInstruction(res.data.default_instruction_base);
          }
        }
      } catch (err) {
        if (active) {
          setPreviewError(err.response?.data?.detail || err.message || "Failed to fetch preview.");
        }
      } finally {
        if (active) {
          setLoadingPreview(false);
        }
      }
    };

    // Debounce preview fetch to avoid overload on keypresses
    const delayDebounceFn = setTimeout(() => {
      fetchPreview();
    }, 450);

    return () => {
      active = false;
      clearTimeout(delayDebounceFn);
    };
  }, [dbId, systemInstruction]);

  const handleResetInstruction = () => {
    if (previewData?.default_instruction_base) {
      setSystemInstruction(previewData.default_instruction_base);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT COLUMN: Controls & Parameters */}
        <div className="lg:col-span-1 space-y-6">
          <div className="supabase-card p-5 space-y-5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--color-supabase-green)]">
              Model & Parameters
            </h3>

            {/* Model Selection */}
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-mono text-[var(--color-supabase-text-dim)] font-bold block">
                Model Choice
              </label>
              <div className="relative">
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="w-full bg-[#141414] border border-[var(--color-supabase-border)] text-white text-xs py-2 px-3 rounded outline-none appearance-none cursor-pointer focus:border-[var(--color-supabase-green)] font-mono"
                >
                  <option value="gemini-2.5-flash">gemini-2.5-flash</option>
                  <option value="gemini-2.5-pro">gemini-2.5-pro</option>
                </select>
                <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-[var(--color-supabase-text-dim)]">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
              <p className="text-[10px] text-[var(--color-supabase-text-dim)] font-sans leading-relaxed">
                Choose the Gemini LLM. Pro offers stronger reasoning for complex schemas, while Flash delivers speed.
              </p>
            </div>

            {/* Temperature Slider */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[10px] uppercase font-mono text-[var(--color-supabase-text-dim)] font-bold">
                  Temperature
                </label>
                <span className="text-xs font-mono font-semibold text-[var(--color-supabase-green)] bg-[rgba(62,207,142,0.05)] border border-[rgba(62,207,142,0.1)] px-1.5 py-0.5 rounded">
                  {temperature.toFixed(2)}
                </span>
              </div>
              <input
                type="range"
                min="0.0"
                max="1.0"
                step="0.05"
                value={temperature}
                onChange={(e) => setTemperature(parseFloat(e.target.value))}
                className="w-full accent-[var(--color-supabase-green)] bg-[#141414] h-1 rounded cursor-pointer"
              />
              <div className="flex justify-between text-[9px] font-mono text-[var(--color-supabase-text-dim)]">
                <span>0.0 (Deterministic)</span>
                <span>1.0 (Creative)</span>
              </div>
              <p className="text-[10px] text-[var(--color-supabase-text-dim)] leading-relaxed">
                SQL generation typically defaults to 0.0 to guarantee code accuracy.
              </p>
            </div>
          </div>

          {/* Prompt Guidelines Card */}
          <div className="p-4 border border-[rgba(99,102,241,0.15)] bg-[rgba(99,102,241,0.02)] rounded-lg space-y-2">
            <div className="flex items-center gap-2 text-[var(--color-accent-indigo)]">
              <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h4 className="text-xs font-bold uppercase tracking-wider font-mono">Dynamic Prompting</h4>
            </div>
            <p className="text-[10px] text-[var(--color-supabase-text-muted)] leading-relaxed">
              The dynamic Database Schema context and Sample Data rows are automatically compiled and injected underneath your custom rules before being submitted to Gemini.
            </p>
          </div>
        </div>

        {/* RIGHT COLUMN: Grounding prompt base instruction & Preview */}
        <div className="lg:col-span-2 space-y-6">
          <div className="supabase-card p-5 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--color-supabase-green)]">
                Grounding Instructions (System Prompt Rules)
              </h3>
              <button
                type="button"
                onClick={handleResetInstruction}
                className="text-[10px] text-[var(--color-supabase-text-dim)] hover:text-white border border-[var(--color-supabase-border)] rounded py-1 px-2.5 bg-[#141414] hover:bg-[#1e1e1e] transition-colors cursor-pointer font-semibold"
              >
                Reset to Default
              </button>
            </div>

            <textarea
              value={systemInstruction}
              onChange={(e) => setSystemInstruction(e.target.value)}
              placeholder="Enter base grounding rules..."
              className="w-full h-[220px] bg-[#141414] border border-[var(--color-supabase-border)] rounded p-4 text-xs font-mono leading-relaxed outline-none focus:border-[var(--color-supabase-green)] text-[#e5e7eb] resize-y"
            />
          </div>

          {/* Preview Tabs */}
          <div className="supabase-card p-5 space-y-4 flex flex-col h-[400px]">
            <div className="flex items-center justify-between border-b border-[var(--color-supabase-border)] pb-2 shrink-0">
              <div className="flex gap-4">
                {[
                  { id: "full", label: "Full Assembled Prompt" },
                  { id: "schema", label: "Raw Schema Context" },
                  { id: "sample", label: "Raw Sample Rows" },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActivePreviewTab(tab.id)}
                    className={`pb-1.5 text-xs font-mono font-bold tracking-wider transition-all cursor-pointer ${
                      activePreviewTab === tab.id
                        ? "text-[var(--color-supabase-green)] border-b-2 border-[var(--color-supabase-green)] font-extrabold"
                        : "text-[var(--color-supabase-text-dim)] hover:text-white"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              
              {loadingPreview && (
                <div className="flex items-center gap-1.5 text-[var(--color-supabase-text-dim)] text-[10px] font-mono">
                  <svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Syncing Prompt...</span>
                </div>
              )}
            </div>

            <div className="flex-1 min-h-0 bg-[#141414] border border-[var(--color-supabase-border)] rounded overflow-y-auto p-4 font-mono text-[11px] text-[var(--color-supabase-text-muted)] select-text relative">
              {previewError ? (
                <div className="text-[var(--color-accent-red)] p-2 font-semibold space-y-1">
                  <div>Error loading settings preview:</div>
                  <div className="text-xs font-sans mt-1 text-red-400 font-normal">
                    {typeof previewError === "string" ? (
                      previewError
                    ) : Array.isArray(previewError) ? (
                      previewError.map((e, i) => (
                        <div key={i}>• {e.msg || JSON.stringify(e)}</div>
                      ))
                    ) : (
                      previewError.msg || previewError.detail || JSON.stringify(previewError)
                    )}
                  </div>
                </div>
              ) : activePreviewTab === "full" ? (
                <pre className="whitespace-pre-wrap leading-relaxed select-text font-mono text-xs">
                  {previewData?.full_system_instruction || "No prompt instruction loaded."}
                </pre>
              ) : activePreviewTab === "schema" ? (
                <pre className="whitespace-pre-wrap leading-relaxed select-text font-mono text-xs">
                  {previewData?.schema_context || "No schema context loaded."}
                </pre>
              ) : (
                <pre className="whitespace-pre-wrap leading-relaxed select-text font-mono text-xs">
                  {previewData?.sample_rows_context || "No sample rows loaded (database may be empty)."}
                </pre>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

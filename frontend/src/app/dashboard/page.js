"use client";

import { useState, useEffect, useRef } from "react";
import api from "@/lib/api";
import Link from "next/link";
import { useAuth, UserButton } from "@clerk/nextjs";
import QueryInput from "@/components/QueryInput";
import AgentStatusTracker from "@/components/AgentStatusTracker";
import SqlCodeBlock from "@/components/SqlCodeBlock";
import ResultsTable from "@/components/ResultsTable";
import HistoryPanel from "@/components/HistoryPanel";
import SchemaDrawer from "@/components/SchemaDrawer";
import DatabaseOverview from "@/components/DatabaseOverview";
import AutoCharts from "@/components/AutoCharts";
import SettingsPanel from "@/components/SettingsPanel";

export default function Dashboard() {
  const { getToken } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Active tab in Supabase-style sidebar
  const [activeTab, setActiveTab] = useState("editor");
  const [showHistory, setShowHistory] = useState(false);

  // Agent Parameter Settings State (synced with localStorage)
  const [model, setModel] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("agent_model") || "gemini-2.5-flash";
    }
    return "gemini-2.5-flash";
  });
  const [temperature, setTemperature] = useState(() => {
    if (typeof window !== "undefined") {
      const val = localStorage.getItem("agent_temperature");
      return val !== null ? parseFloat(val) : 0.0;
    }
    return 0.0;
  });
  const [systemInstruction, setSystemInstruction] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("agent_system_instruction") || "";
    }
    return "";
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("agent_model", model);
    }
  }, [model]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("agent_temperature", temperature.toString());
    }
  }, [temperature]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("agent_system_instruction", systemInstruction);
    }
  }, [systemInstruction]);

  // Database Sessions State (cached in localStorage)
  // Each session: { db_id, db_name, tables: [], history: [] }
  const [dbSessions, setDbSessions] = useState([]);
  const [activeSessionIdx, setActiveSessionIdx] = useState(0);

  // Active session shortcuts derived from state
  const activeSession = dbSessions[activeSessionIdx] || null;
  const dbId = activeSession ? activeSession.db_id : null;
  const dbName = activeSession ? activeSession.db_name : "store.db";
  const schema = activeSession ? activeSession.tables : [];
  const history = activeSession ? activeSession.history : [];

  // Active query/response state for the active session
  const [activeIndex, setActiveIndex] = useState(-1);
  const [currentResponse, setCurrentResponse] = useState(null);
  const [liveTrace, setLiveTrace] = useState([]);
  const [editorQuestion, setEditorQuestion] = useState("");

  // Database session renaming states
  const [editingSessionIdx, setEditingSessionIdx] = useState(-1);
  const [editName, setEditName] = useState("");

  // Sub-sidebar width resizing states
  const [sidebarWidth, setSidebarWidth] = useState(256);

  // Results workspace tab state: "table" vs. "chart"
  const [resultsView, setResultsView] = useState("table");
  const [isResizing, setIsResizing] = useState(false);

  // File Upload states inside the main database panel
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);



  // 1. Load sessions from backend database on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get("tab");
      if (tab === "database") {
        setActiveTab("database");
      }
    }
    loadSessionsFromBackend();
  }, []);

  const loadSessionsFromBackend = async (selectedId = null) => {
    try {
      setIsLoading(true);
      const token = await getToken();
      const res = await api.get("/sessions", {
        headers: { Authorization: `Bearer ${token}` }
      });
      const sessions = res.data.map(s => ({
        db_id: s.db_id,
        db_name: s.db_name,
        db_type: s.db_type,
        tables: s.tables || [],
        history: [] // will load history on demand
      }));
      
      setDbSessions(sessions);
      
      // Select appropriate session
      if (sessions.length > 0) {
        let targetIdx = 0;
        if (selectedId) {
          const idx = sessions.findIndex(s => s.db_id === selectedId);
          if (idx !== -1) targetIdx = idx;
        }
        setActiveSessionIdx(targetIdx);
      }
    } catch (err) {
      console.error("Failed to load sessions from backend:", err);
      setError("Failed to load database connection profiles.");
    } finally {
      setIsLoading(false);
    }
  };

  // 2. Fetch schema & query history for the active database session if not loaded
  useEffect(() => {
    if (dbSessions.length > 0 && activeSession) {
      const needsFetch = activeSession.tables.length === 0 ||
        (activeSession.tables.length > 0 && !activeSession.tables[0].foreign_keys) ||
        !activeSession.history || activeSession.history.length === 0;
      if (needsFetch) {
        fetchSchemaForSession(activeSessionIdx);
      }
    }
  }, [activeSessionIdx, dbSessions.length]);

  // 3. Sub-sidebar resize listener
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isResizing) return;
      const newWidth = Math.max(180, Math.min(480, e.clientX - 64));
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.classList.add("select-none");
    } else {
      document.body.classList.remove("select-none");
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.classList.remove("select-none");
    };
  }, [isResizing]);

  const handleMouseDown = (e) => {
    e.preventDefault();
    setIsResizing(true);
  };

  const fetchSchemaForSession = async (idx) => {
    const session = dbSessions[idx];
    if (!session) return;
    try {
      const token = await getToken();
      const params = session.db_id ? { db_id: session.db_id } : {};
      const res = await api.get("/schema", {
        params,
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Fetch query execution history logs for this database session
      const historyRes = await api.get(`/sessions/${session.db_id || "default"}/history`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const updated = [...dbSessions];
      updated[idx] = {
        ...session,
        tables: res.data.tables || [],
        db_name: res.data.db_name || session.db_name,
        history: historyRes.data || []
      };
      setDbSessions(updated);
    } catch (err) {
      console.error("Failed to fetch schema & history:", err);
    }
  };

  // Sync active query panel when switching history index
  const handleHistorySelect = (idx) => {
    setActiveIndex(idx);
    setResultsView("table");
    const entry = history[idx];
    if (entry) {
      setCurrentResponse(entry);
      setLiveTrace(entry.trace || []);
      setError(entry.error || null);
      setEditorQuestion(entry.question || "");
    } else {
      setCurrentResponse(null);
      setLiveTrace([]);
      setError(null);
      setEditorQuestion("");
    }
  };

  const handleQuery = async (question) => {
    setIsLoading(true);
    setError(null);
    setCurrentResponse(null);
    setResultsView("table");
    setLiveTrace([
      { step: "schema_extraction", status: "running", message: `Mapping database schema for ${dbName}...` },
    ]);

    try {
      const token = await getToken();
      const res = await api.post("/query", {
        question,
        db_id: dbId,
        model_name: model,
        temperature,
        system_instruction: systemInstruction || undefined,
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const data = res.data;
      setCurrentResponse(data);
      setLiveTrace(data.trace || []);

      const entry = {
        question,
        sql: data.sql,
        result: data.result,
        columns: data.columns,
        error: data.error,
        attempts: data.attempts,
        execution_time_ms: data.execution_time_ms,
        trace: data.trace,
      };

      // Append query to current session's history locally for fast UI response
      const updatedSessions = [...dbSessions];
      updatedSessions[activeSessionIdx] = {
        ...activeSession,
        history: [entry, ...history]
      };
      setDbSessions(updatedSessions);
      setActiveIndex(0);
    } catch (err) {
      const detail = err.response?.data?.detail || err.message || "Request failed.";
      setError(detail);
      setLiveTrace((prev) => [
        ...prev,
        { step: "api_error", status: "error", message: detail },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearEditor = () => {
    setCurrentResponse(null);
    setError(null);
    setLiveTrace([]);
    setEditorQuestion("");
    setActiveIndex(-1);
  };

  const handleRawQuery = async (rawSql) => {
    setIsLoading(true);
    setError(null);
    setCurrentResponse(null);
    setResultsView("table");
    setLiveTrace([
      { step: "safety_validation_raw", status: "running", message: "Auditing raw query execution permissions..." },
    ]);

    try {
      const token = await getToken();
      const res = await api.post("/query/raw", {
        sql: rawSql,
        db_id: dbId,
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const data = res.data;
      setCurrentResponse(data);
      setLiveTrace(data.trace || []);

      const entry = {
        question: `Manual query: ${rawSql.substring(0, 50)}...`,
        sql: data.sql,
        result: data.result,
        columns: data.columns,
        error: data.error,
        attempts: data.attempts,
        execution_time_ms: data.execution_time_ms,
        trace: data.trace,
      };

      // Append query to current session's history locally for fast UI response
      const updatedSessions = [...dbSessions];
      updatedSessions[activeSessionIdx] = {
        ...activeSession,
        history: [entry, ...history]
      };
      setDbSessions(updatedSessions);
      setActiveIndex(0);
    } catch (err) {
      const detail = err.response?.data?.detail || err.message || "Manual run failed.";
      setError(detail);
      setLiveTrace((prev) => [
        ...prev,
        { step: "api_error", status: "error", message: detail },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // Switch database session
  const selectSession = (idx) => {
    setActiveSessionIdx(idx);
    setCurrentResponse(null);
    setLiveTrace([]);
    setError(null);
    setActiveIndex(-1);
  };

  // Clear a database session from history
  const deleteSession = async (e, idx) => {
    e.stopPropagation();
    if (e.preventDefault) e.preventDefault();
    const session = dbSessions[idx];
    if (!session) return;
    
    if (session.db_id === "default" || !session.db_id) {
      alert("Cannot delete the default store.db profile.");
      return;
    }

    try {
      const token = await getToken();
      await api.delete(`/sessions/${session.db_id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const isDeletingActive = session.db_id === dbId;
      const nextActiveId = isDeletingActive ? "default" : dbId;
      
      await loadSessionsFromBackend(nextActiveId);
      
      if (isDeletingActive) {
        setCurrentResponse(null);
        setLiveTrace([]);
        setError(null);
        setActiveIndex(-1);
      }
    } catch (err) {
      console.error("Failed to delete session:", err);
      alert("Failed to delete connection profile: " + (err.response?.data?.detail || err.message));
    }
  };

  // Rename session handlers
  const startRenameSession = (e, idx, currentName) => {
    e.stopPropagation();
    if (e.preventDefault) e.preventDefault();
    setEditingSessionIdx(idx);
    setEditName(currentName);
  };

  const saveRenameSession = async (e, idx) => {
    e.stopPropagation();
    if (e.preventDefault) e.preventDefault();
    const session = dbSessions[idx];
    if (!session || !editName.trim()) {
      setEditingSessionIdx(-1);
      return;
    }

    try {
      const token = await getToken();
      await api.post(`/sessions/rename/${session.db_id}`, {
        name: editName.trim()
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const updated = [...dbSessions];
      updated[idx] = {
        ...updated[idx],
        db_name: editName.trim()
      };
      setDbSessions(updated);
      setEditingSessionIdx(-1);
    } catch (err) {
      console.error("Failed to rename session:", err);
      alert("Rename failed: " + (err.response?.data?.detail || err.message));
    }
  };

  const cancelRenameSession = (e) => {
    e.stopPropagation();
    if (e.preventDefault) e.preventDefault();
    setEditingSessionIdx(-1);
  };



  // Callback when database is uploaded via the sidebar drawer
  const handleDbUploaded = (data) => {
    const newSession = {
      db_id: data.db_id,
      db_name: data.db_name,
      db_type: "sqlite",
      tables: data.tables || [],
      history: []
    };

    const updated = [newSession, ...dbSessions];
    setDbSessions(updated);
    setActiveSessionIdx(0);

    // Reset states
    setCurrentResponse(null);
    setLiveTrace([]);
    setError(null);
    setActiveIndex(-1);
  };

  // Uploader trigger
  const handleFileUpload = async (file) => {
    if (!file) return;

    const ext = file.name.split(".").pop().toLowerCase();
    if (!["db", "sqlite", "csv"].includes(ext)) {
      setUploadMsg("Invalid database format. Use .db, .sqlite, or .csv files.");
      return;
    }

    setUploading(true);
    setUploadMsg("");

    const formData = new FormData();
    formData.append("file", file);

    try {
      const token = await getToken();
      const res = await api.post("/upload-db", formData, {
        headers: { 
          "Content-Type": "multipart/form-data",
          Authorization: `Bearer ${token}`
        },
      });
      setUploadMsg(`Successfully uploaded: ${res.data.db_name}`);
      
      const newSession = {
        db_id: res.data.db_id,
        db_name: res.data.db_name,
        db_type: "sqlite",
        tables: res.data.tables || [],
        history: []
      };

      const updated = [newSession, ...dbSessions];
      setDbSessions(updated);
      setActiveSessionIdx(0);

      setCurrentResponse(null);
      setLiveTrace([]);
      setError(null);
      setActiveIndex(-1);
    } catch (err) {
      const detail = err.response?.data?.detail || "Upload failed.";
      setUploadMsg(detail);
    } finally {
      setUploading(false);
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="flex h-screen bg-[#1c1c1c] text-[#ededed] overflow-hidden font-sans">
      {/* ── LEFT NAVIGATION SIDEBAR (Supabase Style) ── */}
      <aside className="w-16 shrink-0 bg-[#121212] border-r border-[var(--color-supabase-border)] flex flex-col items-center py-4 justify-between">
        <div className="flex flex-col items-center gap-6 w-full">
          {/* Logo */}
          <Link href="/" className="group" title="Back to Home">
            <svg className="w-8 h-8 text-[var(--color-supabase-green)] shrink-0 transition-transform group-hover:scale-105" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2L3 9L12 22L21 9L12 2Z" fill="url(#obsidianDashGrad)" stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round" />
              <path d="M12 2V22" stroke="currentColor" strokeWidth={1} strokeOpacity="0.3" />
              <path d="M3 9H21" stroke="currentColor" strokeWidth={1} strokeOpacity="0.3" />
              <path d="M12 2L8 9L12 22L16 9L12 2Z" stroke="currentColor" strokeWidth={1} strokeOpacity="0.5" />
              <defs>
                <linearGradient id="obsidianDashGrad" x1="12" y1="2" x2="12" y2="22" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#3ecf8e" stopOpacity="0.25" />
                  <stop offset="1" stopColor="#10b981" stopOpacity="0.03" />
                </linearGradient>
              </defs>
            </svg>
          </Link>

          {/* Navigation icons */}
          <div className="flex flex-col gap-2 w-full px-2">
            {[
              { id: "database", icon: (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                </svg>
              ), label: "Database Catalog" },
              { id: "overview", icon: (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              ), label: "Database Overview" },
              { id: "editor", icon: (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              ), label: "SQL Editor" },
              { id: "settings", icon: (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              ), label: "Agent Settings" },
            ].map((tab) => (
              <button
                key={tab.id}
                suppressHydrationWarning
                onClick={() => {
                  setActiveTab(tab.id);
                  if (typeof window !== "undefined") {
                    window.history.replaceState({}, document.title, window.location.pathname);
                  }
                }}
                title={tab.label}
                className="w-full aspect-square rounded flex items-center justify-center transition-colors cursor-pointer"
                style={{
                  color: activeTab === tab.id ? "var(--color-supabase-green)" : "var(--color-supabase-text-dim)",
                  background: activeTab === tab.id ? "#1e1e1e" : "transparent",
                }}
              >
                {tab.icon}
              </button>
            ))}
          </div>
        </div>

        {/* Back Link bottom */}
        <Link href="/" title="Home Page" className="text-[var(--color-supabase-text-dim)] hover:text-white transition-colors">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </Link>
      </aside>

      {/* ── SECONDARY CONTENT BAR (Sub-sidebar) ── */}
      {(activeTab === "editor" || activeTab === "overview" || activeTab === "database") && (
        <>
          <aside
            className="shrink-0 bg-[#171717] flex flex-col overflow-hidden"
            style={{ width: `${sidebarWidth}px` }}
          >
            <SchemaDrawer schema={schema} dbName={dbName} />
          </aside>
          {/* ── DRAGGABLE DIVIDER HANDLE (Col-resize split line) ── */}
          <div
            onMouseDown={handleMouseDown}
            className={`w-0.5 hover:w-1 active:w-1 bg-[#2e2e2e] hover:bg-[var(--color-supabase-green)] active:bg-[var(--color-supabase-green)] cursor-col-resize shrink-0 transition-all duration-150 relative z-10 ${
              isResizing ? "bg-[var(--color-supabase-green)] w-1" : ""
            }`}
          />
        </>
      )}

      {/* ── MAIN WORKSPACE ── */}
      <main className="flex-1 flex flex-col bg-[#1c1c1c] overflow-hidden min-w-0">
        {/* Dashboard sub-header */}
        <header className="h-14 border-b border-[var(--color-supabase-border)] flex items-center justify-between px-6 bg-[#171717] shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-[var(--color-supabase-text-muted)] uppercase tracking-wider">
              {activeTab === "editor" 
                ? "Text-to-SQL Workspace" 
                : activeTab === "overview"
                ? "Database Overview"
                : activeTab === "settings"
                ? "Agent Parameter Settings"
                : "Database Catalog"}
            </span>
            <div className="h-4 w-px bg-[var(--color-supabase-border)]" />
            <span className="text-xs font-mono text-[var(--color-supabase-green)] font-medium">
              {dbName}
            </span>
          </div>

          <div className="flex items-center gap-4">
            {activeTab === "editor" && (
              <button
                onClick={() => setShowHistory(!showHistory)}
                suppressHydrationWarning
                title="Toggle Query History"
                className={`p-1.5 rounded hover:bg-[#2e2e2e] transition-colors cursor-pointer flex items-center justify-center ${
                  showHistory ? "text-[var(--color-supabase-green)] bg-[#1e1e1e]" : "text-[var(--color-supabase-text-dim)] hover:text-white"
                }`}
              >
                <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </button>
            )}

            <div className="flex items-center gap-4 border-l border-[var(--color-supabase-border)] pl-4">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-supabase-green)]" />
                <span className="text-[10px] font-mono text-[var(--color-supabase-text-dim)] uppercase">Connected</span>
              </div>
              <UserButton />
            </div>
          </div>
        </header>

        {/* Main Content Workspace Layout */}
        <div className="flex-1 flex overflow-hidden min-w-0">
          {/* Content body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {(activeTab === "editor" || activeTab === "overview") && dbSessions.length > 0 && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-[#171717] border border-[var(--color-supabase-border)] rounded-md animate-fade-in">
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-bold text-[var(--color-supabase-text-dim)] uppercase tracking-wider">
                  Active Workspace Database:
                </span>
                <div className="relative shrink-0">
                  <select
                    value={activeSessionIdx}
                    onChange={(e) => selectSession(Number(e.target.value))}
                    className="bg-[#141414] border border-[var(--color-supabase-border)] text-white text-xs font-mono py-1 pl-3 pr-8 rounded outline-none appearance-none cursor-pointer focus:border-[var(--color-supabase-green)] font-semibold"
                  >
                    {dbSessions.map((session, idx) => (
                      <option key={idx} value={idx}>
                        {session.db_name} ({session.tables.length} tables)
                      </option>
                    ))}
                  </select>
                  <div className="absolute inset-y-0 right-2 flex items-center pointer-events-none text-[var(--color-supabase-text-dim)]">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 text-[10px] text-[var(--color-supabase-text-dim)] uppercase font-semibold">
                <span>Session Logs:</span>
                <span className="font-mono text-[var(--color-supabase-green)] bg-[rgba(62,207,142,0.05)] border border-[rgba(62,207,142,0.1)] px-1.5 py-0.5 rounded">
                  {history.length} Queries
                </span>
              </div>
            </div>
          )}

          {activeTab === "editor" ? (
            <>
              <QueryInput
                onSubmit={handleQuery}
                isLoading={isLoading}
                question={editorQuestion}
                setQuestion={setEditorQuestion}
                showClear={!!currentResponse || !!error || liveTrace.length > 0}
                onClear={handleClearEditor}
              />

              {error && !currentResponse?.trace && (
                <div className="p-4 border border-[rgba(239,68,68,0.2)] bg-[rgba(239,68,68,0.03)] rounded-md animate-fade-in">
                  <span className="text-xs font-semibold text-[var(--color-accent-red)] uppercase block mb-1">Execution Fail</span>
                  <p className="text-xs text-[var(--color-supabase-text-muted)]">{error}</p>
                </div>
              )}

              {liveTrace.length > 0 && <AgentStatusTracker trace={liveTrace} />}
              {currentResponse?.sql && (
                <SqlCodeBlock
                  sql={currentResponse.sql}
                  attempts={currentResponse.attempts}
                  executionTimeMs={currentResponse.execution_time_ms}
                  onRunRaw={handleRawQuery}
                  question={currentResponse.question}
                  dbId={dbId}
                />
              )}
              {currentResponse?.result && (
                <div className="space-y-4">
                  {/* Results Toolbar tabs */}
                  <div className="flex items-center gap-4 border-b border-[var(--color-supabase-border)] pb-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => setResultsView("table")}
                      className={`pb-1 text-xs uppercase font-mono font-bold tracking-wider transition-all cursor-pointer ${
                        resultsView === "table"
                          ? "text-[var(--color-supabase-green)] border-b-2 border-[var(--color-supabase-green)] font-extrabold"
                          : "text-[var(--color-supabase-text-dim)] hover:text-white"
                      }`}
                    >
                      Table View
                    </button>
                    <button
                      type="button"
                      onClick={() => setResultsView("chart")}
                      className={`pb-1 text-xs uppercase font-mono font-bold tracking-wider transition-all cursor-pointer ${
                        resultsView === "chart"
                          ? "text-[var(--color-supabase-green)] border-b-2 border-[var(--color-supabase-green)] font-extrabold"
                          : "text-[var(--color-supabase-text-dim)] hover:text-white"
                      }`}
                    >
                      Chart View
                    </button>
                  </div>

                  {resultsView === "table" ? (
                    <ResultsTable
                      result={currentResponse.result}
                      columns={currentResponse.columns}
                    />
                  ) : (
                    <AutoCharts
                      result={currentResponse.result}
                      columns={currentResponse.columns}
                    />
                  )}
                </div>
              )}

              {!isLoading && !currentResponse && liveTrace.length === 0 && (
                <div className="h-[320px] flex flex-col justify-center items-center text-center">
                  <div className="w-12 h-12 rounded border border-[var(--color-supabase-border)] bg-[#171717] flex items-center justify-center mb-4 text-[var(--color-supabase-green)]">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 21l8.904-4.452M18 10.5V18a3 3 0 01-3 3H9a3 3 0 01-3-3v-7.5M12 3v13.5M9 6h6m-3-3v3" />
                    </svg>
                  </div>
                  <h3 className="text-sm font-semibold mb-1">Query with Natural Language</h3>
                  <p className="text-xs text-[var(--color-supabase-text-dim)] max-w-sm leading-relaxed mb-6">
                    Enter plain English queries. The schema-grounded LLM compiles to optimized SQL with recursive self-correction.
                  </p>

                  <div className="flex flex-wrap gap-2 justify-center max-w-md">
                    {[
                      "Show the first 10 rows of the table",
                      "How many total records are in the active table?",
                      "List the names of all columns",
                      "Show a summary or preview of the data structure",
                    ].map((q) => (
                      <button
                        key={q}
                        suppressHydrationWarning
                        onClick={() => {
                          setEditorQuestion(q);
                          handleQuery(q);
                        }}
                        className="text-[11px] px-3 py-1.5 border border-[var(--color-supabase-border)] rounded bg-[#171717] hover:border-[var(--color-supabase-green)] text-[var(--color-supabase-text-muted)] hover:text-white transition-all cursor-pointer"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : activeTab === "overview" ? (
            <DatabaseOverview dbId={dbId} dbName={dbName} />
          ) : activeTab === "settings" ? (
            <SettingsPanel
              dbId={dbId}
              model={model}
              setModel={setModel}
              temperature={temperature}
              setTemperature={setTemperature}
              systemInstruction={systemInstruction}
              setSystemInstruction={setSystemInstruction}
            />
          ) : (
            <div className="space-y-6">
              {/* Uploader Section */}
              <div
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current.click()}
                className={`py-12 px-6 border-2 border-dashed rounded-lg transition-all duration-200 cursor-pointer flex flex-col items-center justify-center text-center ${
                  dragActive
                    ? "border-[var(--color-supabase-green)] bg-[rgba(62,207,142,0.04)]"
                    : "border-[var(--color-supabase-border)] bg-[#171717] hover:bg-[#1f1f1f]"
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".db,.sqlite,.csv"
                  className="hidden"
                  onChange={(e) => handleFileUpload(e.target.files[0])}
                />

                <div className="w-12 h-12 rounded-full border border-[var(--color-supabase-border)] bg-[#141414] flex items-center justify-center mb-3">
                  <svg className={`w-6 h-6 text-[var(--color-supabase-green)] ${uploading ? "animate-pulse" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                  </svg>
                </div>

                <h3 className="text-xs font-bold text-white mb-1 uppercase tracking-wider">
                  Inject SQLite or CSV
                </h3>
                <p className="text-[10px] text-[var(--color-supabase-text-muted)] max-w-xs leading-relaxed mb-3">
                  Drag & drop your local database files here, or upload CSV tables to convert.
                </p>

                <button
                  type="button"
                  className="supabase-btn-primary text-[10px] font-semibold py-1 px-3.5"
                >
                  Browse Files
                </button>

                {uploadMsg && (
                  <div
                    className="mt-3 text-[10px] font-semibold"
                    style={{
                      color: uploadMsg.startsWith("Successfully")
                        ? "var(--color-supabase-green)"
                        : "var(--color-accent-red)",
                    }}
                  >
                    {uploadMsg}
                  </div>
                )}
              </div>


              {/* Database Connection History */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-supabase-text-muted)] border-b border-[var(--color-supabase-border)] pb-2">
                  Database History
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {dbSessions.map((session, idx) => {
                    const isActive = idx === activeSessionIdx;
                    const isEditing = idx === editingSessionIdx;

                    return (
                      <div
                        key={idx}
                        onClick={() => !isEditing && selectSession(idx)}
                        className="p-3 border rounded-lg bg-[#171717] hover:bg-[#1f1f1f] cursor-pointer transition-all duration-150 flex items-center justify-between group min-h-[62px]"
                        style={{
                          borderColor: isActive ? "var(--color-supabase-green)" : "var(--color-supabase-border)",
                        }}
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <svg className={`w-4 h-4 shrink-0 ${isActive ? "text-[var(--color-supabase-green)]" : "text-[var(--color-supabase-text-dim)]"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                          </svg>
                          
                          {isEditing ? (
                            <div className="flex items-center gap-1.5 min-w-0 flex-1" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="text"
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") saveRenameSession(e, idx);
                                  if (e.key === "Escape") cancelRenameSession(e);
                                }}
                                className="bg-[#141414] border border-[var(--color-supabase-green)] text-white text-xs font-mono px-2 py-0.5 rounded outline-none w-full max-w-[140px]"
                                autoFocus
                              />
                              <button
                                onClick={(e) => saveRenameSession(e, idx)}
                                className="p-1 rounded bg-[rgba(62,207,142,0.15)] text-[var(--color-supabase-green)] hover:bg-[rgba(62,207,142,0.25)] shrink-0 cursor-pointer"
                                title="Save Name"
                              >
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                              </button>
                              <button
                                onClick={cancelRenameSession}
                                className="p-1 rounded bg-[rgba(239,68,68,0.15)] text-[var(--color-accent-red)] hover:bg-[rgba(239,68,68,0.25)] shrink-0 cursor-pointer"
                                title="Cancel"
                              >
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                          ) : (
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 min-w-0 max-w-full">
                                <p className="text-xs font-mono font-semibold text-white truncate">
                                  {session.db_name}
                                </p>
                              </div>
                              <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                                <span className="text-[10px] text-[var(--color-supabase-text-dim)] shrink-0">
                                  {session.tables.length} tables &middot; {session.history.length} queries
                                </span>
                                <span className="text-[10px] text-[var(--color-supabase-text-dim)] shrink-0">&middot;</span>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    selectSession(idx);
                                    setActiveTab("editor");
                                  }}
                                  className="text-[10px] text-[var(--color-supabase-green)] hover:underline font-semibold cursor-pointer shrink-0"
                                >
                                  Launch in Console
                                </button>
                              </div>
                            </div>
                          )}
                        </div>

                        {!isEditing && (
                          <div className="flex items-center gap-1 shrink-0 ml-2" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={(e) => startRenameSession(e, idx, session.db_name)}
                              title="Rename database"
                              className="p-1.5 rounded hover:bg-[#2e2e2e] text-[var(--color-supabase-text-dim)] hover:text-white transition-all cursor-pointer shrink-0"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                              </svg>
                            </button>
                            {session.db_id === "default" || !session.db_id ? (
                              <button
                                disabled
                                title="Cannot delete default database"
                                className="p-1.5 rounded text-[var(--color-supabase-border)] opacity-35 cursor-not-allowed shrink-0"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            ) : (
                              <button
                                onClick={(e) => deleteSession(e, idx)}
                                title="Remove database session"
                                className="p-1.5 rounded hover:bg-[#2e2e2e] text-[var(--color-supabase-text-dim)] hover:text-red-400 transition-all cursor-pointer shrink-0"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

          {/* Collapsible right sidebar for SQL Query History */}
          {activeTab === "editor" && showHistory && (
            <aside className="w-64 shrink-0 bg-[#171717] border-l border-[var(--color-supabase-border)] flex flex-col overflow-hidden animate-fade-in">
              <HistoryPanel history={history} onSelect={handleHistorySelect} activeIndex={activeIndex} />
            </aside>
          )}
        </div>
      </main>
    </div>
  );
}

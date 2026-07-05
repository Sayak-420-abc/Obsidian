"use client";

import { useState } from "react";

export default function ApiExporter({ question, dbId }) {
  const [activeTab, setActiveTab] = useState("curl");
  const [copied, setCopied] = useState(false);

  const cleanQuestion = question || "What is the most expensive product?";
  const cleanDbId = dbId || "default";

  // Generate dynamic snippets
  const getSnippet = () => {
    switch (activeTab) {
      case "python":
        return `import requests

url = "http://localhost:8000/query"
payload = {
    "question": ${JSON.stringify(cleanQuestion)},
    "db_id": ${JSON.stringify(cleanDbId)}
}

response = requests.post(url, json=payload)
data = response.json()

if data.get("error"):
    print("Execution failed:", data["error"])
else:
    print("Generated SQL:", data["sql"])
    print("Results:", data["result"])`;

      case "javascript":
        return `const url = "http://localhost:8000/query";
const payload = {
  question: ${JSON.stringify(cleanQuestion)},
  db_id: ${JSON.stringify(cleanDbId)}
};

fetch(url, {
  method: "POST",
  headers: {
    "Content-Type": "application/json"
  },
  body: JSON.stringify(payload)
})
  .then(res => res.json())
  .then(data => {
    if (data.error) {
      console.error("Execution failed:", data.error);
    } else {
      console.log("Generated SQL:", data.sql);
      console.log("Results:", data.result);
    }
  })
  .catch(err => console.error("Request error:", err));`;

      case "curl":
      default:
        return `curl -X POST "http://localhost:8000/query" \\
  -H "Content-Type: application/json" \\
  -d '{"question": ${JSON.stringify(cleanQuestion)}, "db_id": ${JSON.stringify(cleanDbId)}}'`;
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(getSnippet());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = getSnippet();
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="bg-[#121212] border-t border-[var(--color-supabase-border)] p-4 animate-fade-in space-y-3">
      {/* Exporter header tabs */}
      <div className="flex items-center justify-between border-b border-[var(--color-supabase-border)] pb-2">
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-semibold text-[var(--color-supabase-text-dim)] uppercase tracking-wider">
            API Client Snippet
          </span>
          <div className="flex items-center gap-2">
            {[
              { id: "curl", name: "cURL" },
              { id: "python", name: "Python" },
              { id: "javascript", name: "JavaScript" },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`px-2 py-0.5 text-[10px] rounded transition-all cursor-pointer font-mono font-bold select-none ${
                  activeTab === tab.id
                    ? "bg-[rgba(62,207,142,0.08)] text-[var(--color-supabase-green)] border border-[rgba(62,207,142,0.2)]"
                    : "text-[var(--color-supabase-text-dim)] hover:text-white border border-transparent"
                }`}
              >
                {tab.name}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={handleCopy}
          className="supabase-btn-secondary py-0.5 px-2 text-[10px] cursor-pointer select-none"
        >
          {copied ? "Copied!" : "Copy Snippet"}
        </button>
      </div>

      {/* Snippet display container */}
      <pre className="m-0 p-3 bg-[#0d0d0d] rounded border border-[var(--color-supabase-border)] text-[10px] font-mono text-[var(--color-supabase-text-muted)] overflow-x-auto leading-relaxed select-text whitespace-pre">
        {getSnippet()}
      </pre>
    </div>
  );
}

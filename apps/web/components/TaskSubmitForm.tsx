"use client";

import { useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4021";

const EXAMPLES = [
  "Research the top 3 Stellar DeFi projects this week",
  "Summarize recent Soroban smart contract launches",
  "Analyze XLM price action and key ecosystem events",
];

export default function TaskSubmitForm({ onTaskCreated }: { onTaskCreated: (id: string) => void }) {
  const [prompt, setPrompt]   = useState("");
  const [budget, setBudget]   = useState("0.05");
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!prompt.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res  = await fetch(`${API_URL}/api/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, budget: parseFloat(budget) }),
      });
      const data = await res.json();
      onTaskCreated(data.taskId);
      setPrompt("");
    } catch {
      setError("Failed to reach server. Is it running?");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-6 h-6 rounded-md bg-indigo-500/15 flex items-center justify-center text-indigo-400 text-xs">⚡</div>
        <h2 className="font-semibold text-white text-sm">Submit Task</h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs text-[#6b7280] mb-1.5 font-medium">What do you need?</label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g., Research and summarize the top Stellar DeFi protocols..."
            rows={4}
            className="w-full bg-[#111827] border border-[#1f2937] focus:border-indigo-500/60 rounded-lg px-3 py-2.5 text-sm text-white placeholder-[#374151] resize-none outline-none transition-colors"
          />
          <div className="flex flex-wrap gap-1.5 mt-2">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => setPrompt(ex)}
                className="text-xs text-[#6b7280] hover:text-indigo-400 bg-[#111827] hover:bg-indigo-500/10 border border-[#1f2937] hover:border-indigo-500/30 rounded-md px-2 py-1 transition-all text-left"
              >
                {ex.slice(0, 36)}…
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs text-[#6b7280] font-medium">Budget (USDC)</label>
            <span className="text-xs text-[#4b5563] font-mono">max $0.50</span>
          </div>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6b7280] text-sm">$</span>
            <input
              type="number"
              step="0.01"
              min="0.01"
              max="0.50"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              className="w-full bg-[#111827] border border-[#1f2937] focus:border-indigo-500/60 rounded-lg pl-7 pr-3 py-2.5 text-sm text-white font-mono outline-none transition-colors"
            />
          </div>
          <div className="grid grid-cols-3 gap-2 mt-2">
            {[
              { label: "Scraper",    cost: "$0.001" },
              { label: "Summarizer", cost: "$0.002" },
              { label: "Analyst",    cost: "$0.003" },
            ].map((a) => (
              <div key={a.label} className="bg-[#111827] border border-[#1f2937] rounded-md px-2 py-1.5 text-center">
                <p className="text-[10px] text-[#4b5563]">{a.label}</p>
                <p className="text-xs font-mono text-green-400">{a.cost}</p>
              </div>
            ))}
          </div>
        </div>

        {error && (
          <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading || !prompt.trim()}
          className="w-full py-2.5 rounded-lg font-medium text-sm transition-all bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-900/30 disabled:bg-[#1f2937] disabled:text-[#4b5563] disabled:shadow-none flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Deploying agents…
            </>
          ) : (
            <><span>🚀</span> Launch Agent Swarm</>
          )}
        </button>
      </form>
    </div>
  );
}

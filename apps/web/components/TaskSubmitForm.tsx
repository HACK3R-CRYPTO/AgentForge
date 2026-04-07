"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, X, Rocket } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4021";

const EXAMPLES = [
  "Research the top 3 Stellar DeFi projects this week",
  "Summarize recent Soroban smart contract launches",
  "Analyze XLM price action and key ecosystem events",
];

interface Props {
  onTaskCreated: (id: string) => void;
  prefillPrompt?: string;
  prefillBudget?: number;
  autoSubmit?: boolean;
}

export default function TaskSubmitForm({ onTaskCreated, prefillPrompt, prefillBudget, autoSubmit }: Props) {
  const [open, setOpen]         = useState(false);
  const [prompt, setPrompt]     = useState(prefillPrompt ?? "");
  const [budget, setBudget]     = useState(String(prefillBudget ?? "0.05"));
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");
  const wrapperRef              = useRef<HTMLDivElement>(null);
  const textareaRef             = useRef<HTMLTextAreaElement>(null);

  const openForm = useCallback(() => {
    setOpen(true);
    setTimeout(() => textareaRef.current?.focus(), 60);
  }, []);

  const closeForm = useCallback(() => {
    setOpen(false);
    setError("");
  }, []);

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node) && open) {
        closeForm();
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, closeForm]);

  // Auto-submit after Stripe return
  useEffect(() => {
    if (autoSubmit && prefillPrompt && prefillBudget) {
      submitTask(prefillPrompt, prefillBudget);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSubmit]);

  async function submitTask(p: string, b: number) {
    setLoading(true);
    setError("");
    try {
      const res  = await fetch(`${API_URL}/api/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: p, budget: b }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Server rejected the request."); return; }
      onTaskCreated(data.taskId);
      setPrompt("");
      closeForm();
    } catch {
      setError("Failed to reach server. Is it running?");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!prompt.trim()) return;
    await submitTask(prompt.trim(), parseFloat(budget));
  }

  function handleKeys(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Escape") closeForm();
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); submitTask(prompt.trim(), parseFloat(budget)); }
  }

  return (
    <div ref={wrapperRef} className="relative">
      <motion.div
        className="card overflow-hidden"
        animate={{
          height: open ? "auto" : 52,
        }}
        transition={{ type: "spring", stiffness: 420, damping: 38, mass: 0.8 }}
      >
        {/* Collapsed pill / header */}
        <button
          type="button"
          onClick={open ? closeForm : openForm}
          className="w-full flex items-center gap-2.5 px-4 h-[52px] hover:bg-neutral-800 transition-colors group"
        >
          <div className="w-6 h-6 rounded-md bg-indigo-500/15 flex items-center justify-center text-indigo-400 shrink-0">
            <Zap size={12} />
          </div>
          <span className="font-semibold text-white text-sm">Submit Task</span>
          <span className="text-xs text-neutral-500 ml-1">
            {open ? "" : "— click to expand"}
          </span>
          <motion.div
            className="ml-auto"
            animate={{ rotate: open ? 45 : 0 }}
            transition={{ duration: 0.2 }}
          >
            {open ? <X size={14} className="text-neutral-500" /> : <Zap size={12} className="text-neutral-600 opacity-0 group-hover:opacity-100 transition-opacity" />}
          </motion.div>
        </button>

        {/* Expanded form */}
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ type: "spring", stiffness: 420, damping: 38, delay: 0.05 }}
              className="px-4 pb-4 border-t border-neutral-800"
            >
              <form onSubmit={handleSubmit} className="space-y-4 pt-4">
                {/* Textarea */}
                <div>
                  <label className="block text-xs text-neutral-500 mb-1.5 font-medium">What do you need?</label>
                  <textarea
                    ref={textareaRef}
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    onKeyDown={handleKeys}
                    placeholder="e.g., Research and summarize the top Stellar DeFi protocols..."
                    rows={4}
                    maxLength={1000}
                    className="w-full bg-neutral-950 border border-neutral-800 focus:border-indigo-500/60 rounded-lg px-3 py-2.5 text-sm text-white placeholder-[#374151] resize-none outline-none transition-colors"
                  />
                  {prompt.length > 800 && (
                    <p className="text-[10px] text-yellow-500 mt-1 text-right">{prompt.length}/1000</p>
                  )}
                  {/* Example chips */}
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {EXAMPLES.map((ex) => (
                      <button
                        key={ex}
                        type="button"
                        onClick={() => { setPrompt(ex); textareaRef.current?.focus(); }}
                        className="text-xs text-neutral-500 hover:text-indigo-400 bg-neutral-800 hover:bg-indigo-500/10 border border-neutral-800 hover:border-indigo-500/30 rounded-md px-2 py-1 transition-all text-left"
                      >
                        {ex.slice(0, 36)}…
                      </button>
                    ))}
                  </div>
                </div>

                {/* Budget */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs text-neutral-500 font-medium">Budget (USDC)</label>
                    <span className="text-xs text-neutral-500 font-mono">max $0.50</span>
                  </div>
                  <div className="relative mb-2">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 text-sm">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      max="0.50"
                      value={budget}
                      onChange={(e) => setBudget(e.target.value)}
                      className="w-full bg-neutral-950 border border-neutral-800 focus:border-indigo-500/60 rounded-lg pl-7 pr-3 py-2.5 text-sm text-white font-mono outline-none transition-colors"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: "Scraper",    cost: "$0.001", protocol: "x402", color: "text-indigo-400" },
                      { label: "Summarizer", cost: "$0.002", protocol: "MPP",  color: "text-cyan-400"   },
                      { label: "Analyst",    cost: "$0.003", protocol: "x402", color: "text-indigo-400" },
                    ].map((a) => (
                      <div key={a.label} className="bg-neutral-950 border border-neutral-800 rounded-md px-2 py-1.5 text-center">
                        <p className="text-[10px] text-neutral-500">{a.label}</p>
                        <p className="text-xs font-mono text-green-400">{a.cost}</p>
                        <p className={`text-[9px] font-mono mt-0.5 ${a.color}`}>{a.protocol}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {error && (
                  <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
                )}

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={closeForm}
                    className="px-3 py-2.5 rounded-lg text-sm text-neutral-500 hover:text-white border border-neutral-800 hover:border-neutral-700 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading || !prompt.trim()}
                    className="flex-1 py-2.5 rounded-lg font-medium text-sm transition-all shadow-lg disabled:bg-[#1f2937] disabled:text-neutral-500 disabled:shadow-none flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-900/30"
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
                      <>
                        <Rocket size={14} />
                        Launch Agent Swarm
                        <kbd className="text-[10px] opacity-50 border border-current/30 rounded px-1">⌘↵</kbd>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

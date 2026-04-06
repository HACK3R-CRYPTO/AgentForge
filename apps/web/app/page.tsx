"use client";

import { useState } from "react";
import TaskSubmitForm from "@/components/TaskSubmitForm";
import AgentActivityFeed from "@/components/AgentActivityFeed";
import BudgetWidget from "@/components/BudgetWidget";
import ServiceRegistry from "@/components/ServiceRegistry";
import PaymentExplorer from "@/components/PaymentExplorer";
import TaskResult from "@/components/TaskResult";

const TAGS = [
  { label: "x402",    color: "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20" },
  { label: "MPP",     color: "bg-blue-500/10 text-blue-400 border border-blue-500/20" },
  { label: "Soroban", color: "bg-purple-500/10 text-purple-400 border border-purple-500/20" },
  { label: "Stellar", color: "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20" },
];

type Tab = "activity" | "payments" | "registry";

export default function Home() {
  const [taskId, setTaskId]     = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("activity");

  return (
    <div className="min-h-screen flex flex-col">

      {/* ── Nav ─────────────────────────────────────────────── */}
      <nav className="border-b border-[#1f2937] bg-[#060912]/90 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-5 h-14 flex items-center justify-between">

          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-linear-to-br from-indigo-500 to-violet-600 flex items-center justify-center font-bold text-xs text-white shadow-lg">
              AF
            </div>
            <span className="font-semibold text-white">AgentForge</span>
            <span className="text-[#374151] hidden sm:block">/</span>
            <span className="text-[#6b7280] text-sm hidden sm:block">Multi-Agent Economy</span>
          </div>

          <div className="flex items-center gap-3">
            {TAGS.map((t) => (
              <span key={t.label} className={`hidden lg:inline-flex px-2 py-0.5 rounded-md text-xs font-medium ${t.color}`}>
                {t.label}
              </span>
            ))}
            <a
              href="https://github.com/HACK3R-CRYPTO/AgentForge"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-[#6b7280] hover:text-white transition-colors text-sm border border-[#1f2937] hover:border-[#374151] rounded-lg px-3 py-1.5"
            >
              <GithubIcon />
              <span className="hidden sm:inline">GitHub</span>
            </a>
          </div>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────── */}
      <div className="border-b border-[#1f2937] bg-linear-to-r from-indigo-950/25 via-transparent to-violet-950/15">
        <div className="max-w-7xl mx-auto px-5 py-8">
          <div className="fade-up">
            <h1 className="text-2xl sm:text-3xl font-bold mb-2 tracking-tight">
              <span className="bg-linear-to-r from-indigo-400 via-violet-400 to-blue-400 bg-clip-text text-transparent">
                AI Agents
              </span>
              {"  "}
              <span className="text-white">that pay each other on Stellar</span>
            </h1>
            <p className="text-[#9ca3af] text-sm leading-relaxed max-w-2xl">
              Submit a task → Orchestrator decomposes it → discovers agents from the{" "}
              <span className="text-purple-400 font-medium">Soroban ServiceRegistry</span> →
              checks your <span className="text-yellow-400 font-medium">SpendingPolicy</span> →
              hires specialists and pays them via{" "}
              <span className="text-indigo-400 font-medium">x402 micropayments</span> on Stellar testnet.
              Fully autonomous.
            </p>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 fade-up">
            {[
              { label: "Active Agents",   value: "3",           sub: "on-chain",        color: "text-indigo-400" },
              { label: "Contracts",        value: "2",           sub: "Soroban testnet",  color: "text-purple-400" },
              { label: "Min Cost",         value: "$0.001",      sub: "per x402 call",   color: "text-green-400"  },
              { label: "Settlement",       value: "< 5s",        sub: "Stellar",          color: "text-blue-400"   },
            ].map((s) => (
              <div key={s.label} className="card px-4 py-3">
                <p className={`text-xl font-bold font-mono ${s.color}`}>{s.value}</p>
                <p className="text-xs text-[#9ca3af] font-medium mt-0.5">{s.label}</p>
                <p className="text-xs text-[#4b5563]">{s.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Main grid ──────────────────────────────────────── */}
      <div className="flex-1 max-w-7xl mx-auto w-full px-5 py-6">
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">

          {/* Left */}
          <div className="xl:col-span-1 space-y-5">
            <TaskSubmitForm onTaskCreated={setTaskId} />
            {taskId && <TaskResult taskId={taskId} />}
            <BudgetWidget />
          </div>

          {/* Right */}
          <div className="xl:col-span-2 flex flex-col gap-5">
            {/* Tab switcher */}
            <div className="flex gap-1 bg-[#0d1117] border border-[#1f2937] rounded-xl p-1">
              {([
                { id: "activity",  label: "⚡ Live Activity" },
                { id: "payments",  label: "💸 Payments"      },
                { id: "registry",  label: "🗂 Registry"      },
              ] as { id: Tab; label: string }[]).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                    activeTab === tab.id
                      ? "bg-indigo-600 text-white shadow-md"
                      : "text-[#6b7280] hover:text-[#d1d5db]"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {activeTab === "activity" && <AgentActivityFeed />}
            {activeTab === "payments" && <PaymentExplorer />}
            {activeTab === "registry" && <ServiceRegistry />}
          </div>

        </div>
      </div>

      {/* ── Footer ─────────────────────────────────────────── */}
      <footer className="border-t border-[#1f2937] mt-auto">
        <div className="max-w-7xl mx-auto px-5 py-3 flex items-center justify-between text-xs text-[#4b5563]">
          <span>AgentForge — Stellar Hacks: Agents 2026</span>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 pulse-dot inline-block" />
            <span>Stellar Testnet</span>
          </div>
        </div>
      </footer>

    </div>
  );
}

function GithubIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
  );
}

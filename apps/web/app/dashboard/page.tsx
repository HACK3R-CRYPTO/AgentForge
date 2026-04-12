"use client";

import { useState, useEffect } from "react";
import TaskSubmitForm from "@/components/TaskSubmitForm";
import AgentActivityFeed from "@/components/AgentActivityFeed";
import BudgetWidget from "@/components/BudgetWidget";
import ServiceRegistry from "@/components/ServiceRegistry";
import PaymentExplorer from "@/components/PaymentExplorer";
import TaskResult from "@/components/TaskResult";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4021";

type Tab = "activity" | "payments" | "registry" | "result";

export default function Dashboard() {
  const [taskId, setTaskId]           = useState<string | null>(null);
  const [activeTab, setActiveTab]     = useState<Tab>("activity");
  const [prefillPrompt, setPrefill]   = useState<string | undefined>();
  const [prefillBudget, setBudgetVal] = useState<number | undefined>();
  const [autoSubmit, setAutoSubmit]   = useState(false);
  const [stripeError, setStripeError] = useState("");

  useEffect(() => {
    const params    = new URLSearchParams(window.location.search);
    const sessionId = params.get("session_id");
    const cancelled = params.get("stripe_cancelled");

    if (cancelled) {
      setStripeError("Payment cancelled.");
      window.history.replaceState({}, "", "/dashboard");
      return;
    }
    if (sessionId) {
      window.history.replaceState({}, "", "/dashboard");
      fetch(`${API_URL}/api/stripe/verify/${sessionId}`)
        .then((r) => r.json())
        .then((d) => {
          if (d.paid) { setPrefill(d.prompt); setBudgetVal(d.budget); setAutoSubmit(true); }
          else setStripeError("Payment verification failed.");
        })
        .catch(() => setStripeError("Could not verify payment."));
    }
  }, []);

  function handleTaskCreated(id: string) {
    setTaskId(id);
  }

  return (
    <div className="min-h-screen flex flex-col bg-neutral-950">

      {/* Nav */}
      <nav className="border-b border-neutral-800 bg-neutral-950 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-5 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a href="/" className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-xs text-white">
              AF
            </a>
            <a href="/" className="font-semibold text-white hover:text-indigo-400 transition-colors">AgentForge</a>
            <span className="text-neutral-700 hidden sm:block">/</span>
            <span className="text-neutral-500 text-sm hidden sm:block">Dashboard</span>
          </div>

          <div className="flex items-center gap-1.5">
            <a
              href="/pitch.html"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-neutral-500 hover:text-indigo-400 transition-colors text-sm px-2.5 py-1.5 rounded-lg hover:bg-neutral-900"
              title="Pitch deck"
            >
              <span className="text-sm leading-none">📊</span>
              <span className="hidden md:inline text-xs">Pitch</span>
            </a>
            <a
              href="https://www.moltbook.com/m/agentforgestellar"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-neutral-500 hover:text-orange-400 transition-colors text-sm px-2.5 py-1.5 rounded-lg hover:bg-neutral-900"
              title="Agent social feed on Moltbook"
            >
              <span className="text-sm leading-none">🦞</span>
              <span className="hidden md:inline text-xs">Moltbook</span>
            </a>
            <a
              href="https://github.com/HACK3R-CRYPTO/AgentForge"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-neutral-500 hover:text-white transition-colors text-sm px-2.5 py-1.5 rounded-lg hover:bg-neutral-900"
              title="GitHub"
            >
              <GithubIcon />
              <span className="hidden md:inline text-xs">GitHub</span>
            </a>
          </div>
        </div>
      </nav>

      {/* Main */}
      <div className="flex-1 max-w-7xl mx-auto w-full px-5 py-6">
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">

          {/* Left */}
          <div className="xl:col-span-1 space-y-5">
            {stripeError && (
              <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{stripeError}</p>
            )}
            <TaskSubmitForm
              onTaskCreated={handleTaskCreated}
              prefillPrompt={prefillPrompt}
              prefillBudget={prefillBudget}
              autoSubmit={autoSubmit}
            />
            <BudgetWidget />
          </div>

          {/* Right */}
          <div className="xl:col-span-2 flex flex-col gap-5">
            <div className="flex gap-1 bg-neutral-900 border border-neutral-800 rounded-xl p-1">
              {([
                { id: "activity", label: "⚡ Live Activity" },
                { id: "payments", label: "💸 Payments"      },
                { id: "registry", label: "🗂 Registry"      },
                ...(taskId ? [{ id: "result", label: "📄 Result" }] : []),
              ] as { id: Tab; label: string }[]).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                    activeTab === tab.id
                      ? tab.id === "result"
                        ? "bg-emerald-600 text-white shadow-md"
                        : "bg-indigo-600 text-white shadow-md"
                      : "text-neutral-500 hover:text-neutral-300"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {activeTab === "activity" && <AgentActivityFeed />}
            {activeTab === "payments" && <PaymentExplorer />}
            {activeTab === "registry" && <ServiceRegistry />}
            {activeTab === "result"   && taskId && <TaskResult taskId={taskId} />}
          </div>

        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-neutral-800 mt-auto">
        <div className="max-w-7xl mx-auto px-5 py-3 flex items-center justify-between text-xs text-neutral-600">
          <span>AgentForge — Stellar Hacks: Agents 2026</span>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 pulse-dot inline-block" />
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

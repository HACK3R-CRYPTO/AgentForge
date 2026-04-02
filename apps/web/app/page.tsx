"use client";

import { useState } from "react";
import TaskSubmitForm from "@/components/TaskSubmitForm";
import AgentActivityFeed from "@/components/AgentActivityFeed";
import BudgetWidget from "@/components/BudgetWidget";

export default function Home() {
  const [taskId, setTaskId] = useState<string | null>(null);

  return (
    <main className="min-h-screen p-6 max-w-7xl mx-auto">
      {/* Header */}
      <header className="mb-8">
        <h1 className="text-4xl font-bold mb-2">
          <span className="text-indigo-400">Agent</span>Forge
        </h1>
        <p className="text-gray-400 text-lg">
          Multi-Agent Service Economy on Stellar — AI agents that discover,
          negotiate, and pay each other
        </p>
        <div className="flex gap-2 mt-3">
          <span className="px-2 py-1 bg-indigo-900/50 text-indigo-300 rounded text-xs">
            x402
          </span>
          <span className="px-2 py-1 bg-blue-900/50 text-blue-300 rounded text-xs">
            MPP
          </span>
          <span className="px-2 py-1 bg-purple-900/50 text-purple-300 rounded text-xs">
            Soroban
          </span>
          <span className="px-2 py-1 bg-cyan-900/50 text-cyan-300 rounded text-xs">
            Stellar
          </span>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Task Submit + Budget */}
        <div className="lg:col-span-1 space-y-6">
          <TaskSubmitForm onTaskCreated={setTaskId} />
          <BudgetWidget />
        </div>

        {/* Right: Activity Feed */}
        <div className="lg:col-span-2">
          <AgentActivityFeed />
        </div>
      </div>
    </main>
  );
}

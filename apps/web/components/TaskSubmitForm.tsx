"use client";

import { useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4021";

export default function TaskSubmitForm({
  onTaskCreated,
}: {
  onTaskCreated: (taskId: string) => void;
}) {
  const [prompt, setPrompt] = useState("");
  const [budget, setBudget] = useState("0.05");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!prompt.trim()) return;

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, budget: parseFloat(budget) }),
      });
      const data = await res.json();
      onTaskCreated(data.taskId);
      setPrompt("");
    } catch (err) {
      console.error("Failed to submit task:", err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
      <h2 className="text-xl font-semibold mb-4">Submit Task</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm text-gray-400 mb-1">
            What do you need?
          </label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g., Research and analyze the top 5 Stellar ecosystem developments this week"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white placeholder-gray-500 resize-none h-28 focus:border-indigo-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">
            Budget (USDC)
          </label>
          <input
            type="number"
            step="0.01"
            min="0.01"
            max="0.50"
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white focus:border-indigo-500 focus:outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={loading || !prompt.trim()}
          className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-medium py-3 rounded-lg transition-colors"
        >
          {loading ? "Deploying agents..." : "Launch Agent Swarm"}
        </button>
      </form>
    </div>
  );
}

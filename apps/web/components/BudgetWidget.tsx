"use client";

import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4021";

interface BudgetStatus {
  dailyLimit: number;
  perTxLimit: number;
  dailySpent: number;
  remaining: number;
}

export default function BudgetWidget() {
  const [budget, setBudget] = useState<BudgetStatus | null>(null);

  useEffect(() => {
    async function fetchBudget() {
      try {
        const res = await fetch(`${API_URL}/api/payments/budget`);
        setBudget(await res.json());
      } catch {
        // Server not running yet
      }
    }
    fetchBudget();
    const interval = setInterval(fetchBudget, 5000);
    return () => clearInterval(interval);
  }, []);

  if (!budget) {
    return (
      <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
        <h2 className="text-xl font-semibold mb-4">Spending Policy</h2>
        <p className="text-gray-500">Connecting to Soroban...</p>
      </div>
    );
  }

  const usagePercent = (budget.dailySpent / budget.dailyLimit) * 100;

  return (
    <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
      <h2 className="text-xl font-semibold mb-4">Spending Policy</h2>
      <p className="text-xs text-gray-500 mb-3">
        Enforced by Soroban smart contract
      </p>

      {/* Progress bar */}
      <div className="mb-4">
        <div className="flex justify-between text-sm mb-1">
          <span className="text-gray-400">Daily Budget</span>
          <span className="text-white">
            ${budget.dailySpent.toFixed(4)} / ${budget.dailyLimit.toFixed(2)}
          </span>
        </div>
        <div className="w-full bg-gray-800 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all ${usagePercent > 80 ? "bg-red-500" : usagePercent > 50 ? "bg-yellow-500" : "bg-green-500"}`}
            style={{ width: `${Math.min(usagePercent, 100)}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-gray-500">Remaining</p>
          <p className="text-green-400 font-mono text-lg">
            ${budget.remaining.toFixed(4)}
          </p>
        </div>
        <div>
          <p className="text-gray-500">Per-TX Limit</p>
          <p className="text-yellow-400 font-mono text-lg">
            ${budget.perTxLimit.toFixed(3)}
          </p>
        </div>
      </div>
    </div>
  );
}

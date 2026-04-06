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
  const [budget, setBudget]     = useState<BudgetStatus | null>(null);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    async function fetch_() {
      try {
        const r = await fetch(`${API_URL}/api/payments/budget`);
        setBudget(await r.json());
      } catch { /* server not up yet */ }
      finally { setLoading(false); }
    }
    fetch_();
    const t = setInterval(fetch_, 5000);
    return () => clearInterval(t);
  }, []);

  const pct = budget ? Math.min((budget.dailySpent / budget.dailyLimit) * 100, 100) : 0;
  const barColor = pct > 80 ? "bg-red-500" : pct > 50 ? "bg-yellow-500" : "bg-green-500";

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-purple-500/15 flex items-center justify-center text-purple-400 text-xs">⚖</div>
          <h2 className="font-semibold text-white text-sm">Spending Policy</h2>
        </div>
        <span className="text-xs text-[#4b5563] bg-[#111827] border border-[#1f2937] rounded-md px-2 py-0.5">
          Soroban
        </span>
      </div>

      {loading ? (
        <div className="space-y-3">
          <div className="skeleton h-3 rounded-full w-full" />
          <div className="skeleton h-8 rounded-lg w-24" />
        </div>
      ) : !budget ? (
        <p className="text-xs text-[#4b5563] text-center py-4">Connecting to contract…</p>
      ) : (
        <>
          {/* Progress bar */}
          <div className="mb-4">
            <div className="flex justify-between text-xs mb-2">
              <span className="text-[#6b7280]">Daily Budget Used</span>
              <span className="font-mono text-white">
                <span className="text-[#9ca3af]">${budget.dailySpent.toFixed(4)}</span>
                <span className="text-[#4b5563]"> / </span>
                <span>${budget.dailyLimit.toFixed(2)}</span>
              </span>
            </div>
            <div className="w-full h-1.5 bg-[#111827] rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${barColor}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="text-[10px] text-[#4b5563] mt-1">{pct.toFixed(1)}% used today</p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#111827] border border-[#1f2937] rounded-lg p-3">
              <p className="text-[10px] text-[#4b5563] mb-1">Remaining Today</p>
              <p className="text-green-400 font-mono font-bold">${budget.remaining.toFixed(4)}</p>
            </div>
            <div className="bg-[#111827] border border-[#1f2937] rounded-lg p-3">
              <p className="text-[10px] text-[#4b5563] mb-1">Per-TX Limit</p>
              <p className="text-yellow-400 font-mono font-bold">${budget.perTxLimit.toFixed(3)}</p>
            </div>
          </div>

          {/* Contract link */}
          <a
            href={`https://stellar.expert/explorer/testnet/contract/${process.env.NEXT_PUBLIC_SPENDING_POLICY_ID}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 mt-3 text-[10px] text-[#4b5563] hover:text-indigo-400 transition-colors"
          >
            <span>↗</span>
            <span className="font-mono truncate">View on Stellar Expert</span>
          </a>
        </>
      )}
    </div>
  );
}

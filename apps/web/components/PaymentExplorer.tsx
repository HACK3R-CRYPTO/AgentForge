"use client";

import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4021";

interface Payment {
  id: string;
  type: string;
  amount: string;
  asset: string;
  from: string;
  to: string;
  timestamp: string;
  txHash: string;
}

export default function PaymentExplorer() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading]   = useState(true);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    async function fetch_() {
      try {
        const r = await fetch(`${API_URL}/api/payments/history`);
        setPayments(await r.json());
      } catch { /* server not up yet */ }
      finally { setLoading(false); }
    }
    fetch_();
    const t = setInterval(fetch_, 8000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="card flex flex-col" style={{ height: 520 }}>
      <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-[#1f2937]">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-green-500/15 flex items-center justify-center text-green-400 text-xs">💸</div>
          <h2 className="font-semibold text-white text-sm">Payment Explorer</h2>
        </div>
        <span className="text-xs text-[#4b5563]">Stellar Testnet</span>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        {loading ? (
          <div className="space-y-3">
            {[1,2,3].map((i) => (
              <div key={i} className="skeleton h-16 rounded-lg" />
            ))}
          </div>
        ) : payments.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-[#374151]">
            <div className="text-3xl">💸</div>
            <p className="text-sm">No payments yet</p>
            <p className="text-xs">Submit a task to generate Stellar transactions</p>
          </div>
        ) : (
          <div className="space-y-2">
            {payments.map((p) => (
              <div
                key={p.id}
                onClick={() => setSelected(selected === p.id ? null : p.id)}
                className="bg-[#111827] hover:bg-[#1f2937] border border-[#1f2937] hover:border-[#374151] rounded-lg p-3 cursor-pointer transition-all"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
                    <span className="font-mono text-xs text-white">
                      {p.from ? p.from.slice(0,6) : "?"}…{p.from ? p.from.slice(-4) : ""}
                    </span>
                    <span className="text-[#374151] text-xs">→</span>
                    <span className="font-mono text-xs text-white">
                      {p.to ? p.to.slice(0,6) : "?"}…{p.to ? p.to.slice(-4) : ""}
                    </span>
                  </div>
                  <span className="text-green-400 font-mono text-sm font-semibold">
                    {p.amount} {p.asset}
                  </span>
                </div>

                {selected === p.id && (
                  <div className="mt-2 pt-2 border-t border-[#1f2937] space-y-1 slide-in">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-[#4b5563]">From</span>
                      <span className="font-mono text-[#9ca3af]">{p.from}</span>
                    </div>
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-[#4b5563]">To</span>
                      <span className="font-mono text-[#9ca3af]">{p.to}</span>
                    </div>
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-[#4b5563]">Time</span>
                      <span className="text-[#9ca3af]">{p.timestamp}</span>
                    </div>
                    <a
                      href={`https://stellar.expert/explorer/testnet/tx/${p.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-1 text-indigo-400 hover:text-indigo-300 text-[10px] mt-1"
                    >
                      ↗ View on Stellar Expert
                    </a>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

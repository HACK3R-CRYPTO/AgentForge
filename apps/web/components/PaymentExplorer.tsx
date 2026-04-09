"use client";

import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4021";

interface Payment {
  id: string;
  protocol: "x402" | "mpp";
  type: string;
  amount?: string;
  asset: string;
  from?: string;
  to?: string;
  fromLabel?: string;
  toLabel?: string;
  timestamp: string;
  txHash: string;
}

const PROTOCOL_CONFIG = {
  x402: { label: "x402", color: "text-indigo-400", bg: "bg-indigo-500/10", border: "border-indigo-500/20" },
  mpp:  { label: "MPP",  color: "text-cyan-400",   bg: "bg-cyan-500/10",   border: "border-cyan-500/20"   },
};

export default function PaymentExplorer() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading]   = useState(true);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    async function fetch_() {
      try {
        const r    = await fetch(`${API_URL}/api/payments/history`);
        const data = await r.json();
        setPayments(Array.isArray(data) ? data : (data.payments ?? []));
      } catch { /* server not up yet */ }
      finally { setLoading(false); }
    }
    fetch_();
    const t = setInterval(fetch_, 5000);
    return () => clearInterval(t);
  }, []);

  const x402Count = payments.filter((p) => p.protocol === "x402").length;
  const mppCount  = payments.filter((p) => p.protocol === "mpp").length;

  return (
    <div className="card flex flex-col" style={{ height: 520 }}>
      <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-neutral-800">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-green-500/15 flex items-center justify-center text-green-400 text-xs">💸</div>
          <h2 className="font-semibold text-white text-sm">Payment Explorer</h2>
          {payments.length > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-mono">
                x402 ×{x402Count}
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-mono">
                MPP ×{mppCount}
              </span>
            </div>
          )}
        </div>
        <span className="text-xs text-neutral-500">Stellar Testnet</span>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        {loading ? (
          <div className="space-y-3">
            {[1,2,3].map((i) => <div key={i} className="skeleton h-16 rounded-lg" />)}
          </div>
        ) : payments.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-neutral-600">
            <div className="text-3xl">💸</div>
            <p className="text-sm">No payments yet</p>
            <p className="text-xs text-neutral-500">Submit a task to generate Stellar transactions</p>
          </div>
        ) : (
          <div className="space-y-2">
            {payments.map((p) => {
              const proto = PROTOCOL_CONFIG[p.protocol] ?? PROTOCOL_CONFIG.x402;
              return (
                <div
                  key={p.id}
                  onClick={() => setSelected(selected === p.id ? null : p.id)}
                  className="bg-neutral-800 hover:bg-neutral-800/70 border border-neutral-800 hover:border-neutral-700 rounded-lg p-3 cursor-pointer transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0 inline-block" />
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-mono font-medium border shrink-0 ${proto.bg} ${proto.color} ${proto.border}`}>
                        {proto.label}
                      </span>
                      <span className="text-white text-xs font-medium truncate">{p.fromLabel ?? "—"}</span>
                      <span className="text-neutral-600 text-xs shrink-0">→</span>
                      <span className="text-indigo-300 text-xs font-medium truncate">{p.toLabel ?? "—"}</span>
                    </div>
                    <span className="text-green-400 font-mono text-sm font-semibold shrink-0 ml-2">
                      {p.amount ? `${parseFloat(p.amount).toFixed(4)} ${p.asset}` : p.asset}
                    </span>
                  </div>

                  {selected === p.id && (
                    <div className="mt-2 pt-2 border-t border-neutral-800 space-y-1 slide-in">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-neutral-500">Protocol</span>
                        <span className={`${proto.color} font-mono font-medium`}>{proto.label} — {p.protocol === "mpp" ? "MPP Charge (draft-stellar-charge-00)" : "x402 Pay-per-Request"}</span>
                      </div>
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-neutral-500">From</span>
                        <span className="text-neutral-400">
                          <span className="font-medium text-white">{p.fromLabel}</span>
                          {p.from && <span className="text-neutral-500 ml-1 font-mono">({p.from.slice(0,8)}…)</span>}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-neutral-500">To</span>
                        <span className="text-neutral-400">
                          <span className="font-medium text-indigo-300">{p.toLabel}</span>
                          {p.to && <span className="text-neutral-500 ml-1 font-mono">({p.to.slice(0,8)}…)</span>}
                        </span>
                      </div>
                      {p.amount && (
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="text-neutral-500">Amount</span>
                          <span className="text-green-400 font-mono font-semibold">{p.amount} {p.asset}</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-neutral-500">Time</span>
                        <span className="text-neutral-400">{new Date(p.timestamp).toLocaleString()}</span>
                      </div>
                      {p.txHash && !p.txHash.startsWith("mock-") && !p.txHash.startsWith("pending-") ? (
                        <a
                          href={`https://stellar.expert/explorer/testnet/tx/${p.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center gap-1 text-indigo-400 hover:text-indigo-300 text-[10px] mt-1"
                        >
                          ↗ View on Stellar Expert
                        </a>
                      ) : (
                        <span className="text-[10px] text-neutral-600 mt-1">tx hash pending</span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

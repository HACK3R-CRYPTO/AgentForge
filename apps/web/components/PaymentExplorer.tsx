"use client";

import { useEffect, useState } from "react";

interface Payment {
  id: string;
  from: string;
  to: string;
  amount: string;
  asset: string;
  timestamp: string;
  txHash: string;
}

export default function PaymentExplorer() {
  const [payments, setPayments] = useState<Payment[]>([]);

  return (
    <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
      <h2 className="text-xl font-semibold mb-4">Payment Explorer</h2>
      <p className="text-xs text-gray-500 mb-3">
        Stellar Testnet transactions
      </p>

      {payments.length === 0 ? (
        <p className="text-gray-600 text-center py-8">
          No payments yet. Submit a task to see transactions.
        </p>
      ) : (
        <div className="space-y-3">
          {payments.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between bg-gray-800 rounded-lg p-3"
            >
              <div>
                <p className="text-sm font-mono text-white">
                  {p.from.slice(0, 8)}... → {p.to.slice(0, 8)}...
                </p>
                <p className="text-xs text-gray-500">{p.timestamp}</p>
              </div>
              <div className="text-right">
                <p className="text-green-400 font-mono">
                  {p.amount} {p.asset}
                </p>
                <a
                  href={`https://stellar.expert/explorer/testnet/tx/${p.txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-400 hover:underline"
                >
                  View on Explorer
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

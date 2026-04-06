"use client";

import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4021";

interface AgentService {
  id: string;
  name: string;
  description: string;
  price: number;
  paymentType: "x402" | "mpp";
  category: string;
  reputationScore: number;
  totalCalls: number;
  agentId?: string;
}

const CATEGORY_CONFIG: Record<string, { icon: string; color: string; bg: string }> = {
  scraper:    { icon: "🌐", color: "text-blue-400",   bg: "bg-blue-500/10"   },
  summarizer: { icon: "📝", color: "text-violet-400", bg: "bg-violet-500/10" },
  analyst:    { icon: "📊", color: "text-amber-400",  bg: "bg-amber-500/10"  },
};

export default function ServiceRegistry() {
  const [services, setServices] = useState<AgentService[]>([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    async function fetch_() {
      try {
        const r = await fetch(`${API_URL}/api/agents`);
        setServices(await r.json());
      } catch { /* server not up */ }
      finally { setLoading(false); }
    }
    fetch_();
  }, []);

  return (
    <div className="card flex flex-col" style={{ height: 520 }}>
      <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-[#1f2937]">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-purple-500/15 flex items-center justify-center text-purple-400 text-xs">🗂</div>
          <h2 className="font-semibold text-white text-sm">Service Registry</h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#4b5563]">Soroban on-chain</span>
          <a
            href={`https://stellar.expert/explorer/testnet/contract/${process.env.NEXT_PUBLIC_SERVICE_REGISTRY_ID}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            ↗
          </a>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        {loading ? (
          <div className="space-y-3">
            {[1,2,3].map((i) => <div key={i} className="skeleton h-24 rounded-xl" />)}
          </div>
        ) : services.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-[#374151]">
            <div className="text-3xl">🗂</div>
            <p className="text-sm">No agents registered</p>
          </div>
        ) : (
          <div className="space-y-3">
            {services.map((svc) => {
              const cfg = CATEGORY_CONFIG[svc.category] ?? { icon: "🤖", color: "text-gray-400", bg: "bg-gray-500/10" };
              return (
                <div key={svc.id} className="bg-[#111827] border border-[#1f2937] hover:border-[#374151] rounded-xl p-4 transition-all">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{cfg.icon}</span>
                      <div>
                        <h3 className="text-sm font-medium text-white">{svc.name}</h3>
                        <p className="text-[10px] text-[#6b7280] font-mono mt-0.5">{svc.category}</p>
                      </div>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-md font-medium border ${cfg.bg} ${cfg.color} border-current/20`}>
                      {svc.paymentType.toUpperCase()}
                    </span>
                  </div>

                  <p className="text-xs text-[#6b7280] mb-3 leading-relaxed">{svc.description}</p>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 text-xs">
                      <span className="text-green-400 font-mono font-semibold">${svc.price.toFixed(4)}<span className="text-[#4b5563] font-normal">/call</span></span>
                      <span className="text-[#4b5563]">·</span>
                      <span className="text-[#6b7280]">Rep <span className="text-yellow-400 font-semibold">{svc.reputationScore}</span></span>
                      <span className="text-[#4b5563]">·</span>
                      <span className="text-[#6b7280]"><span className="text-white font-mono">{svc.totalCalls}</span> calls</span>
                    </div>
                    {svc.agentId && (
                      <span className="font-mono text-[10px] text-[#374151]">{svc.agentId.slice(0,8)}…</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

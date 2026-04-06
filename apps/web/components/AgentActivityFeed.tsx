"use client";

import { useEffect, useRef, useState } from "react";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:4021";

interface ActivityEvent {
  type: string;
  taskId?: string;
  message: string;
  agent?: string;
  cost?: number;
  amount?: number;
  timestamp: number;
}

const EVENT_CONFIG: Record<string, { icon: string; color: string; bg: string }> = {
  task_started:    { icon: "▶", color: "text-blue-400",    bg: "bg-blue-500/10"    },
  agent_discovery: { icon: "◎", color: "text-cyan-400",    bg: "bg-cyan-500/10"    },
  agent_hired:     { icon: "◈", color: "text-indigo-400",  bg: "bg-indigo-500/10"  },
  payment_sent:    { icon: "$", color: "text-green-400",   bg: "bg-green-500/10"   },
  budget_check:    { icon: "≡", color: "text-yellow-400",  bg: "bg-yellow-500/10"  },
  task_completed:  { icon: "✓", color: "text-emerald-400", bg: "bg-emerald-500/10" },
  agent_to_agent:  { icon: "⇄", color: "text-pink-400",    bg: "bg-pink-500/10"    },
};

const DEFAULT_CONFIG = { icon: "·", color: "text-[#6b7280]", bg: "bg-[#111827]" };

export default function AgentActivityFeed() {
  const [events, setEvents]       = useState<ActivityEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const feedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let ws: WebSocket;
    let retryTimer: ReturnType<typeof setTimeout>;
    let dead = false;

    function connect() {
      ws = new WebSocket(WS_URL);
      ws.onopen    = () => setConnected(true);
      ws.onclose   = () => {
        setConnected(false);
        if (!dead) retryTimer = setTimeout(connect, 3000);
      };
      ws.onerror   = () => ws.close();
      ws.onmessage = (msg) => {
        const data = JSON.parse(msg.data);
        if (data.type === "history") setEvents(data.events ?? []);
        else setEvents((prev) => [...prev.slice(-200), data]);
      };
    }

    connect();
    return () => {
      dead = true;
      clearTimeout(retryTimer);
      ws.close();
    };
  }, []);

  useEffect(() => {
    if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight;
  }, [events]);

  return (
    <div className="card flex flex-col" style={{ height: 520 }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-[#1f2937]">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-blue-500/15 flex items-center justify-center text-blue-400 text-xs">▶</div>
          <h2 className="font-semibold text-white text-sm">Live Activity</h2>
          {events.length > 0 && (
            <span className="text-xs text-[#4b5563] bg-[#111827] border border-[#1f2937] rounded-md px-1.5 py-0.5 font-mono">
              {events.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {connected ? (
            <span className="flex items-center gap-1.5 text-xs text-green-400">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 pulse-dot inline-block" />
              LIVE
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-xs text-[#6b7280]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#4b5563] inline-block" />
              DISCONNECTED
            </span>
          )}
          {events.length > 0 && (
            <button
              onClick={() => setEvents([])}
              className="text-xs text-[#4b5563] hover:text-[#9ca3af] transition-colors"
            >
              clear
            </button>
          )}
        </div>
      </div>

      {/* Feed */}
      <div ref={feedRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-1 font-mono text-xs">
        {events.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-[#374151]">
            <div className="text-3xl">⚡</div>
            <p className="text-sm">Submit a task to see agents in action</p>
            <p className="text-xs text-[#1f2937]">WebSocket {WS_URL}</p>
          </div>
        ) : (
          events.map((ev, i) => {
            const cfg = EVENT_CONFIG[ev.type] ?? DEFAULT_CONFIG;
            const cost = ev.cost ?? ev.amount;
            return (
              <div key={i} className="flex items-start gap-2 slide-in rounded-lg px-2 py-1.5 hover:bg-[#111827] transition-colors group">
                <span className="text-[#4b5563] min-w-[52px] text-[10px] pt-0.5">
                  {new Date(ev.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                </span>
                <span className={`min-w-[18px] text-center font-bold ${cfg.color}`}>{cfg.icon}</span>
                <span className={cfg.color + " flex-1 break-all"}>
                  {ev.message}
                  {cost != null && (
                    <span className="text-green-400 ml-2 font-semibold">${cost.toFixed(4)}</span>
                  )}
                </span>
                {ev.agent && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-md border ${cfg.bg} ${cfg.color} border-current/20 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap`}>
                    {ev.agent}
                  </span>
                )}
              </div>
            );
          })
        )}
        {connected && events.length > 0 && (
          <div className="flex items-center gap-2 px-2 py-1 text-[#374151]">
            <span className="cursor text-[10px]">waiting</span>
          </div>
        )}
      </div>
    </div>
  );
}

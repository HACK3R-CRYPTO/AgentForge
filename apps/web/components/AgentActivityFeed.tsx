"use client";

import { useEffect, useState, useRef } from "react";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:4021";

interface ActivityEvent {
  type: string;
  taskId?: string;
  message: string;
  amount?: number;
  timestamp: number;
}

const EVENT_COLORS: Record<string, string> = {
  task_started: "text-blue-400",
  agent_discovery: "text-cyan-400",
  agent_hired: "text-indigo-400",
  payment_sent: "text-green-400",
  budget_check: "text-yellow-400",
  task_completed: "text-emerald-400",
};

const EVENT_ICONS: Record<string, string> = {
  task_started: ">>",
  agent_discovery: "??",
  agent_hired: "++",
  payment_sent: "$$",
  budget_check: "##",
  task_completed: "OK",
};

export default function AgentActivityFeed() {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const feedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ws = new WebSocket(WS_URL);

    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);

    ws.onmessage = (msg) => {
      const data = JSON.parse(msg.data);
      if (data.type === "history") {
        setEvents(data.events);
      } else {
        setEvents((prev) => [...prev, data]);
      }
    };

    return () => ws.close();
  }, []);

  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [events]);

  return (
    <div className="bg-gray-900 rounded-xl p-6 border border-gray-800 h-[600px] flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Agent Activity</h2>
        <span
          className={`text-xs px-2 py-1 rounded ${connected ? "bg-green-900/50 text-green-400" : "bg-red-900/50 text-red-400"}`}
        >
          {connected ? "LIVE" : "DISCONNECTED"}
        </span>
      </div>

      <div
        ref={feedRef}
        className="flex-1 overflow-y-auto space-y-2 font-mono text-sm"
      >
        {events.length === 0 ? (
          <p className="text-gray-600 text-center mt-20">
            Submit a task to see agents in action...
          </p>
        ) : (
          events.map((event, i) => (
            <div key={i} className="flex items-start gap-3">
              <span className="text-gray-600 text-xs min-w-[60px]">
                {new Date(event.timestamp).toLocaleTimeString()}
              </span>
              <span
                className={`font-bold min-w-[24px] ${EVENT_COLORS[event.type] || "text-gray-400"}`}
              >
                {EVENT_ICONS[event.type] || "--"}
              </span>
              <span className={EVENT_COLORS[event.type] || "text-gray-400"}>
                {event.message}
                {event.amount && (
                  <span className="text-green-400 ml-2">
                    (${event.amount.toFixed(4)} USDC)
                  </span>
                )}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

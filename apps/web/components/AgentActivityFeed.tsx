"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  Circle,
  CircleAlert,
  CircleDotDashed,
  CircleX,
  ChevronDown,
} from "lucide-react";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:4021";

interface ActivityEvent {
  type: string;
  taskId?: string;
  message: string;
  agent?: string;
  cost?: number;
  amount?: number;
  txHash?: string;
  timestamp: number;
}

type AgentStatus = "pending" | "in-progress" | "completed" | "failed" | "need-help";

interface AgentTask {
  id: string;
  name: string;
  protocol: string;
  protocolColor: string;
  cost: string;
  events: ActivityEvent[];
  status: AgentStatus;
}

const AGENT_DEFS: AgentTask[] = [
  { id: "scraper",    name: "Web Scraper",    protocol: "x402", protocolColor: "text-indigo-400", cost: "$0.001", events: [], status: "pending" },
  { id: "summarizer", name: "Summarizer",     protocol: "MPP",  protocolColor: "text-cyan-400",   cost: "$0.002", events: [], status: "pending" },
  { id: "analyst",    name: "Data Analyst",   protocol: "x402", protocolColor: "text-indigo-400", cost: "$0.003", events: [], status: "pending" },
];

// Derive the actor label for an event
function getActor(ev: ActivityEvent, agentId?: string): { label: string; color: string } | null {
  const src = ev.agent?.toLowerCase() ?? "";
  if (ev.type === "agent_to_agent") return { label: "Scraper → Summarizer", color: "text-pink-400" };
  if (agentId === "summarizer" && (src.includes("scraper") || ev.type === "agent_hired"))
    return { label: "Web Scraper (A2A)", color: "text-pink-400" };
  if (agentId === "scraper"   && (ev.type === "agent_hired" || ev.type === "agent_discovery"))
    return { label: "Orchestrator", color: "text-purple-400" };
  if (agentId === "analyst"   && (ev.type === "agent_hired" || ev.type === "agent_discovery"))
    return { label: "Orchestrator", color: "text-purple-400" };
  if (!agentId && (ev.type === "task_started" || ev.type === "budget_check" || ev.type === "agent_discovery"))
    return { label: "Orchestrator", color: "text-purple-400" };
  return null;
}

const EVENT_ICON: Record<string, string> = {
  task_started:    "▶",
  agent_discovery: "◎",
  agent_hired:     "◈",
  payment_sent:    "$",
  budget_check:    "≡",
  task_completed:  "✓",
  agent_to_agent:  "⇄",
};

const EVENT_COLOR: Record<string, string> = {
  task_started:    "text-blue-400",
  agent_discovery: "text-cyan-400",
  agent_hired:     "text-indigo-400",
  payment_sent:    "text-green-400",
  budget_check:    "text-yellow-400",
  task_completed:  "text-emerald-400",
  agent_to_agent:  "text-pink-400",
};

function matchAgent(ev: ActivityEvent): string | null {
  const msg = ev.message.toLowerCase();
  const agent = ev.agent?.toLowerCase() ?? "";
  if (agent.includes("scraper")    || msg.includes("scraper"))    return "scraper";
  if (agent.includes("summarizer") || msg.includes("summarizer")) return "summarizer";
  if (agent.includes("analyst")    || msg.includes("analyst"))    return "analyst";
  return null;
}


function StatusIcon({ status, size = 16 }: { status: AgentStatus; size?: number }) {
  const props = { size, strokeWidth: 1.75 };
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={status}
        initial={{ opacity: 0, scale: 0.7, rotate: -15 }}
        animate={{ opacity: 1, scale: 1, rotate: 0 }}
        exit={{ opacity: 0, scale: 0.7, rotate: 15 }}
        transition={{ type: "spring", stiffness: 500, damping: 28, duration: 0.2 }}
      >
        {status === "completed"  && <CheckCircle2  {...props} className="text-emerald-400" />}
        {status === "in-progress"&& <CircleDotDashed {...props} className="text-indigo-400" />}
        {status === "need-help"  && <CircleAlert   {...props} className="text-yellow-400" />}
        {status === "failed"     && <CircleX       {...props} className="text-red-400" />}
        {status === "pending"    && <Circle        {...props} className="text-neutral-600" />}
      </motion.div>
    </AnimatePresence>
  );
}

export default function AgentActivityFeed() {
  const [events, setEvents]       = useState<ActivityEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const [expanded, setExpanded]   = useState<Record<string, boolean>>({});
  const feedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let ws: WebSocket;
    let retryTimer: ReturnType<typeof setTimeout>;
    let dead = false;

    function connect() {
      ws = new WebSocket(WS_URL);
      ws.onopen    = () => setConnected(true);
      ws.onclose   = () => { setConnected(false); if (!dead) retryTimer = setTimeout(connect, 3000); };
      ws.onerror   = () => ws.close();
      ws.onmessage = (msg) => {
        const data = JSON.parse(msg.data);
        if (data.type === "history") setEvents(data.events ?? []);
        else setEvents((prev) => [...prev.slice(-300), data]);
      };
    }
    connect();
    return () => { dead = true; clearTimeout(retryTimer); ws?.close(); };
  }, []);

  useEffect(() => {
    if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight;
  }, [events]);

  // Group events by taskId to separate task runs
  const taskGroups: { taskId: string; events: ActivityEvent[] }[] = [];
  for (const ev of events) {
    const id = ev.taskId ?? "unknown";
    const last = taskGroups[taskGroups.length - 1];
    if (last && last.taskId === id) last.events.push(ev);
    else taskGroups.push({ taskId: id, events: [ev] });
  }

  const hasActivity = events.length > 0;

  return (
    <div className="card flex flex-col" style={{ height: 520 }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-neutral-800">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-blue-500/15 flex items-center justify-center text-blue-400 text-xs">▶</div>
          <h2 className="font-semibold text-white text-sm">Live Activity</h2>
          {hasActivity && (
            <span className="text-xs text-neutral-500 bg-neutral-800 border border-neutral-800 rounded-md px-1.5 py-0.5 font-mono">
              {events.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {connected ? (
            <span className="flex items-center gap-1.5 text-xs text-green-400">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 pulse-dot inline-block" />
              LIVE
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-xs text-neutral-500">
              <span className="w-1.5 h-1.5 rounded-full bg-[#374151] inline-block" />
              OFFLINE
            </span>
          )}
          {hasActivity && (
            <button onClick={() => setEvents([])} className="text-xs text-neutral-500 hover:text-neutral-400 transition-colors">
              clear
            </button>
          )}
        </div>
      </div>

      <div ref={feedRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {!hasActivity ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center h-full gap-4 text-neutral-600">
            <div className="flex gap-3">
              {AGENT_DEFS.map((a) => (
                <div key={a.id} className="flex flex-col items-center gap-2">
                  <div className="w-10 h-10 rounded-xl bg-neutral-800 border border-neutral-800 flex items-center justify-center">
                    <Circle size={16} className="text-neutral-600" />
                  </div>
                  <span className="text-[10px] text-neutral-600">{a.name}</span>
                </div>
              ))}
            </div>
            <p className="text-sm text-neutral-500">Submit a task to see agents in action</p>
          </div>
        ) : (
          <>
            {taskGroups.map((group, groupIdx) => {
              const groupEvents = group.events;
              const globalEvs = groupEvents.filter((ev) => matchAgent(ev) === null);
              const agentTasks: AgentTask[] = AGENT_DEFS.map((def) => ({
                ...def,
                events: groupEvents.filter((ev) => matchAgent(ev) === def.id),
                status: groupEvents.length === 0 ? "pending" : (() => {
                  for (let i = groupEvents.length - 1; i >= 0; i--) {
                    const ev = groupEvents[i];
                    if (matchAgent(ev) !== def.id) continue;
                    if (ev.type === "task_completed") return "completed" as AgentStatus;
                    if (ev.type === "payment_sent")   return "completed" as AgentStatus;
                    if (ev.type === "agent_to_agent" && def.id === "summarizer") return "in-progress" as AgentStatus;
                    if (ev.type === "agent_hired")    return "in-progress" as AgentStatus;
                  }
                  if (groupEvents.some((e) => e.type === "task_completed")) return "completed" as AgentStatus;
                  return "pending" as AgentStatus;
                })(),
              }));

              // Find task prompt from task_started event
              const startedEv = groupEvents.find((e) => e.type === "task_started");
              const taskLabel = startedEv?.message?.replace(/^Orchestrator received task:\s*/i, "").replace(/^"(.*)"$/, "$1") ?? group.taskId.slice(0, 8);

              return (
                <div key={group.taskId}>
                  {/* Task group separator — not shown for first group */}
                  {groupIdx > 0 && (
                    <div className="flex items-center gap-2 my-3">
                      <div className="flex-1 border-t border-neutral-800" />
                      <span className="text-[10px] text-neutral-600 font-mono px-1">new task</span>
                      <div className="flex-1 border-t border-neutral-800" />
                    </div>
                  )}

                  {/* Task label pill */}
                  {startedEv && (
                    <div className="mb-2 px-2">
                      <span className="text-[10px] text-neutral-500 font-mono bg-neutral-800 border border-neutral-800 rounded px-2 py-0.5 truncate block max-w-full">
                        ▶ {taskLabel}
                      </span>
                    </div>
                  )}

                  {/* Global events for this task */}
                  {globalEvs.map((ev: ActivityEvent, i: number) => {
                    const color = EVENT_COLOR[ev.type] ?? "text-neutral-500";
                    const icon  = EVENT_ICON[ev.type]  ?? "·";
                    const actor = getActor(ev);
                    return (
                      <motion.div
                        key={`${group.taskId}-global-${i}`}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-start gap-2 px-2 py-1 rounded-lg"
                      >
                        <span className={`font-bold text-xs w-4 text-center mt-0.5 ${color}`}>{icon}</span>
                        <span className="flex-1 min-w-0">
                          {actor && (
                            <span className={`text-[9px] font-mono font-semibold mr-1.5 ${actor.color}`}>[{actor.label}]</span>
                          )}
                          <span className={`text-xs ${color}`}>{ev.message}</span>
                          {ev.txHash && !ev.txHash.startsWith("mock-") && (
                            <a
                              href={`https://stellar.expert/explorer/testnet/tx/${ev.txHash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="ml-2 text-[9px] font-mono text-cyan-500 hover:text-cyan-400 underline underline-offset-2"
                            >
                              view on-chain
                            </a>
                          )}
                        </span>
                        <span className="text-[10px] text-neutral-500 font-mono whitespace-nowrap">
                          {new Date(ev.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                        </span>
                      </motion.div>
                    );
                  })}

                  {/* Agent task cards */}
                  {globalEvs.length > 0 && <div className="border-t border-neutral-800 my-1" />}
                  <div className="space-y-1.5">
                    {agentTasks.map((task: AgentTask, idx: number) => {
                      const key = `${group.taskId}-${task.id}`;
                      const isExpanded = expanded[key] ?? false;
                      return (
                        <motion.div
                          key={key}
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.05 }}
                          className="rounded-lg border border-neutral-800 overflow-hidden"
                        >
                          <button
                            className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-neutral-800 transition-colors text-left"
                            onClick={() => setExpanded((p) => ({ ...p, [key]: !p[key] }))}
                          >
                            <StatusIcon status={task.status} size={15} />
                            <span className={`flex-1 text-sm font-medium ${task.status === "completed" ? "text-neutral-500 line-through" : "text-white"}`}>
                              {task.name}
                            </span>
                            <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${
                              task.protocol === "MPP"
                                ? "text-cyan-400 bg-cyan-500/10 border-cyan-500/20"
                                : "text-indigo-400 bg-indigo-500/10 border-indigo-500/20"
                            }`}>
                              {task.protocol}
                            </span>
                            <span className="text-xs font-mono text-green-400">{task.cost}</span>
                            <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
                              <ChevronDown size={13} className="text-neutral-500" />
                            </motion.div>
                          </button>

                          <AnimatePresence>
                            {isExpanded && task.events.length > 0 && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.22, ease: [0.2, 0.65, 0.3, 0.9] }}
                                className="overflow-hidden"
                              >
                                <div className="relative border-t border-neutral-800 px-3 py-2 space-y-1">
                                  <div className="absolute top-0 bottom-0 left-[22px] border-l border-dashed border-neutral-800" />
                                  {task.events.map((ev: ActivityEvent, i: number) => {
                                    const color = EVENT_COLOR[ev.type] ?? "text-neutral-500";
                                    const icon  = EVENT_ICON[ev.type]  ?? "·";
                                    const cost  = ev.cost ?? ev.amount;
                                    const actor = getActor(ev, task.id);
                                    return (
                                      <motion.div
                                        key={i}
                                        initial={{ opacity: 0, x: -8 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: i * 0.04, type: "spring", stiffness: 400, damping: 28 }}
                                        className="flex items-start gap-2 pl-5"
                                      >
                                        <span className={`font-bold text-[11px] w-3 text-center mt-0.5 ${color}`}>{icon}</span>
                                        <span className={`text-xs flex-1 leading-relaxed ${color}`}>
                                          {actor && (
                                            <span className={`text-[9px] font-mono font-semibold mr-1.5 ${actor.color}`}>[{actor.label}]</span>
                                          )}
                                          {ev.message}
                                          {cost != null && (
                                            <span className="text-green-400 ml-1.5 font-semibold font-mono">${cost.toFixed(4)}</span>
                                          )}
                                          {ev.txHash && !ev.txHash.startsWith("mock-") && (
                                            <a
                                              href={`https://stellar.expert/explorer/testnet/tx/${ev.txHash}`}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="ml-2 text-[9px] font-mono text-cyan-500 hover:text-cyan-400 underline underline-offset-2"
                                            >
                                              view on-chain
                                            </a>
                                          )}
                                        </span>
                                        <span className="text-[10px] text-neutral-600 font-mono whitespace-nowrap">
                                          {new Date(ev.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                                        </span>
                                      </motion.div>
                                    );
                                  })}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {/* Listening indicator */}
            {connected && (
              <div className="flex items-center gap-2 px-2 py-1 text-neutral-600 text-xs">
                <span className="w-1 h-1 rounded-full bg-[#374151] pulse-dot inline-block" />
                <span>listening</span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

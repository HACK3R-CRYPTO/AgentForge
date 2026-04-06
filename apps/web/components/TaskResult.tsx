"use client";

import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4021";

interface TaskData {
  id: string;
  prompt: string;
  status: "running" | "completed" | "failed";
  result?: string;
  createdAt: number;
}

export default function TaskResult({ taskId }: { taskId: string }) {
  const [task, setTask]       = useState<TaskData | null>(null);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    let interval: NodeJS.Timeout;

    async function poll() {
      try {
        const r  = await fetch(`${API_URL}/api/tasks/${taskId}`);
        const data: TaskData = await r.json();
        setTask(data);
        if (data.status !== "running") clearInterval(interval);
      } catch { /* server not up */ }
    }

    poll();
    interval = setInterval(poll, 2000);

    const timer = setInterval(() => setElapsed((e) => e + 1), 1000);

    return () => {
      clearInterval(interval);
      clearInterval(timer);
    };
  }, [taskId]);

  if (!task) return null;

  const isRunning   = task.status === "running";
  const isCompleted = task.status === "completed";
  const isFailed    = task.status === "failed";

  return (
    <div className={`card p-5 transition-all ${isCompleted ? "border-green-500/30 glow-green" : isFailed ? "border-red-500/30" : "border-indigo-500/30 glow-indigo"}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {isRunning   && <span className="w-2 h-2 rounded-full bg-indigo-400 pulse-dot inline-block" />}
          {isCompleted && <span className="text-green-400 text-xs">✓</span>}
          {isFailed    && <span className="text-red-400 text-xs">✗</span>}
          <span className="text-xs font-medium text-white capitalize">
            {isRunning ? "Running" : isCompleted ? "Completed" : "Failed"}
          </span>
          {isRunning && (
            <span className="text-xs text-[#4b5563] font-mono">{elapsed}s</span>
          )}
        </div>
        <span className="font-mono text-[10px] text-[#374151]">{taskId.slice(-12)}</span>
      </div>

      <p className="text-xs text-[#6b7280] mb-3 italic">"{task.prompt}"</p>

      {isRunning && (
        <div className="space-y-2">
          {["Decomposing task…", "Querying ServiceRegistry…", "Checking SpendingPolicy…"].map((s, i) => (
            <div key={i} className="flex items-center gap-2 text-xs text-[#6b7280]">
              <div className="skeleton h-1 rounded-full flex-1" />
              <span className="text-[10px] text-[#374151] whitespace-nowrap">{s}</span>
            </div>
          ))}
        </div>
      )}

      {isCompleted && task.result && (
        <div className="bg-[#111827] border border-[#1f2937] rounded-lg p-3 mt-1 slide-in">
          <p className="text-xs text-[#9ca3af] whitespace-pre-wrap leading-relaxed">{task.result}</p>
        </div>
      )}

      {isFailed && task.result && (
        <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-3 mt-1">
          <p className="text-xs text-red-400 leading-relaxed">{task.result}</p>
        </div>
      )}
    </div>
  );
}

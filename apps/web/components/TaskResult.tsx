"use client";

import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4021";

interface TaskData {
  id: string;
  prompt: string;
  budget: number;
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
        const r    = await fetch(`${API_URL}/api/tasks/${taskId}`);
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

  const costMatch     = task.result?.match(/\$(\d+\.\d+)\s*USDC/);
  const estimatedCost = costMatch ? costMatch[1] : "0.006";

  // Detect if the result is an error message
  const isErrorResult = isFailed && task.result?.startsWith("Error:");

  return (
    <div className={`card p-5 transition-all ${
      isCompleted ? "border-green-500/30 glow-green"
      : isFailed  ? "border-red-500/30"
      : "border-indigo-500/30 glow-indigo"
    }`}>
      {/* Header */}
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
        {isCompleted && (
          <span className="text-green-400 font-mono text-xs font-semibold">${estimatedCost} USDC spent</span>
        )}
        {!isCompleted && (
          <span className="font-mono text-[10px] text-[#374151]">{taskId.slice(-12)}</span>
        )}
      </div>

      <p className="text-xs text-[#6b7280] mb-3 italic">"{task.prompt}"</p>

      {/* Running skeleton */}
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

      {/* Success result */}
      {isCompleted && task.result && (
        <div className="bg-[#111827] border border-[#1f2937] rounded-lg p-4 mt-1 slide-in overflow-y-auto max-h-80">
          <div className="prose prose-invert prose-xs max-w-none
            prose-headings:text-white prose-headings:font-semibold prose-headings:mt-3 prose-headings:mb-1
            prose-h1:text-sm prose-h2:text-sm prose-h3:text-xs
            prose-p:text-[#9ca3af] prose-p:text-xs prose-p:leading-relaxed prose-p:my-1
            prose-strong:text-white prose-strong:font-semibold
            prose-li:text-[#9ca3af] prose-li:text-xs
            prose-table:text-xs prose-td:text-[#9ca3af] prose-th:text-white prose-th:font-medium
            prose-code:text-indigo-300 prose-code:text-[10px] prose-code:bg-[#1f2937] prose-code:px-1 prose-code:rounded
            prose-blockquote:border-indigo-500 prose-blockquote:text-[#6b7280]">
            <ReactMarkdown>{task.result}</ReactMarkdown>
          </div>
        </div>
      )}

      {/* Failure result */}
      {isFailed && (
        <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-4 mt-1 slide-in">
          <div className="flex items-start gap-2 mb-2">
            <span className="text-red-400 text-xs font-semibold">Task failed</span>
          </div>
          {task.result ? (
            <>
              <p className="text-xs text-red-300 leading-relaxed font-mono break-all">
                {isErrorResult ? task.result.replace(/^Error:\s*/, "") : task.result}
              </p>
              <p className="text-[10px] text-[#4b5563] mt-3">
                Check server logs for details. Common causes: insufficient USDC balance, RPC timeout, or Anthropic API error.
              </p>
            </>
          ) : (
            <p className="text-xs text-[#6b7280]">No error details available.</p>
          )}
        </div>
      )}
    </div>
  );
}

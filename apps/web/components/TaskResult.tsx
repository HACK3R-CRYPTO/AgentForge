"use client";

import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

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

  const costMatch     = task.result?.match(/[Tt]otal\s+(?:cost|spent)[^$]*\$([\d.]+)\s*USDC/);
  const estimatedCost = costMatch ? costMatch[1] : "0.006";
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
            <span className="text-xs text-neutral-500 font-mono">{elapsed}s</span>
          )}
        </div>
        {isCompleted && (
          <span className="text-green-400 font-mono text-xs font-semibold">${estimatedCost} USDC spent</span>
        )}
        {!isCompleted && (
          <span className="font-mono text-[10px] text-neutral-600">{taskId.slice(-12)}</span>
        )}
      </div>

      <p className="text-xs text-neutral-500 mb-3 italic">"{task.prompt}"</p>

      {/* Running skeleton */}
      {isRunning && (
        <div className="space-y-2">
          {["Decomposing task…", "Querying ServiceRegistry…", "Checking SpendingPolicy…"].map((s, i) => (
            <div key={i} className="flex items-center gap-2 text-xs text-neutral-500">
              <div className="skeleton h-1 rounded-full flex-1" />
              <span className="text-[10px] text-neutral-600 whitespace-nowrap">{s}</span>
            </div>
          ))}
        </div>
      )}

      {/* Success result */}
      {isCompleted && task.result && (
        <div className="bg-neutral-800 border border-neutral-800 rounded-lg p-4 mt-1 slide-in overflow-y-auto max-h-[600px]">
          <div className="prose prose-invert prose-xs max-w-none
            prose-headings:text-white prose-headings:font-semibold prose-headings:mt-3 prose-headings:mb-1
            prose-h1:text-sm prose-h2:text-sm prose-h3:text-xs
            prose-p:text-neutral-400 prose-p:text-xs prose-p:leading-relaxed prose-p:my-1
            prose-strong:text-white prose-strong:font-semibold
            prose-li:text-neutral-400 prose-li:text-xs
            prose-table:text-xs prose-table:w-full
            prose-thead:border-b prose-thead:border-neutral-700
            prose-th:text-white prose-th:font-semibold prose-th:py-2 prose-th:px-3 prose-th:text-left prose-th:bg-neutral-900
            prose-td:text-neutral-400 prose-td:py-2 prose-td:px-3 prose-td:border-b prose-td:border-neutral-800
            prose-tr:hover:bg-[#334155]/50
            prose-code:text-indigo-300 prose-code:text-[10px] prose-code:bg-[#334155] prose-code:px-1 prose-code:rounded
            prose-blockquote:border-indigo-500 prose-blockquote:text-neutral-500">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{task.result}</ReactMarkdown>
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
              <p className="text-[10px] text-neutral-500 mt-3">
                Check server logs for details. Common causes: insufficient USDC balance, RPC timeout, or Anthropic API error.
              </p>
            </>
          ) : (
            <p className="text-xs text-neutral-500">No error details available.</p>
          )}
        </div>
      )}
    </div>
  );
}

import { Router } from "express";
import { executeTask } from "../agents/orchestrator.js";

export const taskRoutes = Router();

interface TaskRequest {
  prompt: string;
  budget?: number;
}

type TaskStatus = "pending" | "running" | "completed" | "failed";

const tasks = new Map<
  string,
  {
    id: string;
    prompt: string;
    budget: number;
    status: TaskStatus;
    result?: string;
    createdAt: number;
  }
>();

// Submit a new task
taskRoutes.post("/", async (req, res) => {
  const { prompt, budget = 0.05 } = req.body as TaskRequest;

  if (!prompt) {
    res.status(400).json({ error: "prompt is required" });
    return;
  }

  const taskId = `task-${Date.now()}`;
  const task = {
    id: taskId,
    prompt,
    budget,
    status: "running" as TaskStatus,
    createdAt: Date.now(),
  };

  tasks.set(taskId, task);

  // Run async — don't block the response
  executeTask(task)
    .then((result) => {
      const t = tasks.get(taskId);
      if (t) {
        t.status = "completed";
        t.result = result;
      }
    })
    .catch((err) => {
      const t = tasks.get(taskId);
      if (t) {
        t.status = "failed";
        t.result = String(err);
      }
    });

  res.json({ taskId, status: "running" });
});

// Get task status
taskRoutes.get("/:id", (req, res) => {
  const task = tasks.get(req.params.id);
  if (!task) {
    res.status(404).json({ error: "Task not found" });
    return;
  }
  res.json(task);
});

// List all tasks
taskRoutes.get("/", (_req, res) => {
  res.json(Array.from(tasks.values()).reverse());
});

import express from "express";
import cors from "cors";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import dotenv from "dotenv";
import { taskRoutes } from "./routes/tasks.js";
import { agentRoutes } from "./routes/agents.js";
import { paymentRoutes } from "./routes/payments.js";
import { setupActivityFeed } from "./websocket/activity.js";

dotenv.config();

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

app.use(cors({ origin: process.env.FRONTEND_URL || "http://localhost:3000" }));
app.use(express.json());

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "agentforge" });
});

// API routes
app.use("/api/tasks", taskRoutes);
app.use("/api/agents", agentRoutes);
app.use("/api/payments", paymentRoutes);

// WebSocket activity feed
setupActivityFeed(wss);

const PORT = process.env.PORT || 4021;
server.listen(PORT, () => {
  console.log(`AgentForge server running on port ${PORT}`);
  console.log(`WebSocket activity feed on ws://localhost:${PORT}`);
});

export { app, wss };

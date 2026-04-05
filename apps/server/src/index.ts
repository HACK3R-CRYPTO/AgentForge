import express from "express";
import cors from "cors";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import dotenv from "dotenv";
import { taskRoutes } from "./routes/tasks.js";
import { agentRoutes } from "./routes/agents.js";
import { paymentRoutes } from "./routes/payments.js";
import { setupActivityFeed } from "./websocket/activity.js";
import { startFacilitator } from "./payments/facilitator.js";
import { createX402Middleware } from "./payments/x402.js";

dotenv.config();

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

app.use(cors({ origin: process.env.FRONTEND_URL || "http://localhost:3000" }));
app.use(express.json());

// Start x402 facilitator on port 4022
startFacilitator();

// Health check (no payment required)
app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "agentforge" });
});

// API routes
app.use("/api/tasks", taskRoutes);

// Apply x402 payment middleware to agent routes
app.use(createX402Middleware());
app.use("/api/agents", agentRoutes);

app.use("/api/payments", paymentRoutes);

// WebSocket activity feed
setupActivityFeed(wss);

const PORT = process.env.PORT || 4021;
server.listen(PORT, () => {
  console.log(`AgentForge server running on port ${PORT}`);
  console.log(`x402 Facilitator running on port ${process.env.FACILITATOR_PORT || 4022}`);
  console.log(`WebSocket activity feed on ws://localhost:${PORT}`);
  console.log(`\nContracts:`);
  console.log(`  ServiceRegistry: ${process.env.SERVICE_REGISTRY_CONTRACT_ID}`);
  console.log(`  SpendingPolicy:  ${process.env.SPENDING_POLICY_CONTRACT_ID}`);
});

export { app, wss };

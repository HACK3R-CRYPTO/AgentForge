import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import dotenv from "dotenv";
import { taskRoutes } from "./routes/tasks.js";
import { agentRoutes } from "./routes/agents.js";
import { paymentRoutes } from "./routes/payments.js";
import { stripeRoutes } from "./routes/stripe.js";
import { scrapeUrl } from "./agents/scraper.js";
import { summarizeText } from "./agents/summarizer.js";
import { analyzeData } from "./agents/analyst.js";
import { setupActivityFeed } from "./websocket/activity.js";
import { startFacilitator } from "./payments/facilitator.js";
import { createX402Middleware } from "./payments/x402.js";
import { initRegistry } from "./stellar/registry.js";
import { sorobanRpc } from "./stellar/client.js";

dotenv.config();

// ─── Startup contract health check ───────────────────────────────────────────
async function checkContracts() {
  const registryId = process.env.SERVICE_REGISTRY_CONTRACT_ID;
  const policyId   = process.env.SPENDING_POLICY_CONTRACT_ID;

  if (!registryId || !policyId) {
    console.warn("⚠  CONTRACT IDs not set — Soroban integration disabled. Set SERVICE_REGISTRY_CONTRACT_ID and SPENDING_POLICY_CONTRACT_ID in .env");
    return;
  }

  try {
    // Ping the RPC to confirm it's reachable and contracts exist
    await sorobanRpc.getLatestLedger();
    console.log("✓  Soroban RPC reachable");
    console.log(`✓  ServiceRegistry: ${registryId}`);
    console.log(`✓  SpendingPolicy:  ${policyId}`);
  } catch (err) {
    console.error("✗  Soroban RPC unreachable:", String(err).slice(0, 120));
    console.error("   On-chain registry and policy calls will fall back to in-memory.");
  }
}

const app    = express();
const server = createServer(app);
const wss    = new WebSocketServer({ server });

const allowedOrigins = [
  process.env.FRONTEND_URL || "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:3000",
];
app.use(cors({ origin: (origin, cb) => cb(null, !origin || allowedOrigins.includes(origin)) }));
app.use(express.json());

// ─── Rate limiting ────────────────────────────────────────────────────────────
const taskLimiter = rateLimit({ windowMs: 60_000, max: 20, message: { error: "Too many task submissions — try again in a minute" } });
const testLimiter = rateLimit({ windowMs: 60_000, max: 10, message: { error: "Too many test requests" } });

// ─── Start services ───────────────────────────────────────────────────────────
startFacilitator();
checkContracts().then(() => {
  initRegistry().catch((err) => console.warn("[Registry] init error:", err));
});

// ─── Health ───────────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "agentforge",
    contracts: {
      serviceRegistry: process.env.SERVICE_REGISTRY_CONTRACT_ID || "not set",
      spendingPolicy:  process.env.SPENDING_POLICY_CONTRACT_ID  || "not set",
    },
    mockMode: process.env.MOCK_MODE === "true",
  });
});

// ─── Debug test endpoints (rate-limited, bypasses payment) ───────────────────
app.get("/test/scraper", testLimiter, async (req, res) => {
  const url = (req.query.url as string) || "https://stellar.org";
  try {
    const content = await scrapeUrl(url);
    res.json({ agent: "scraper", url, contentLength: content.length, preview: content.slice(0, 300) });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

app.get("/test/summarizer", testLimiter, async (req, res) => {
  const text = (req.query.text as string) || "Stellar is a blockchain network that enables fast, low-cost payments. It supports smart contracts via Soroban and has USDC natively on the network.";
  try {
    const summary = await summarizeText(text, "brief");
    res.json({ agent: "summarizer", summary });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

app.get("/test/analyst", testLimiter, async (_req, res) => {
  const data     = "Soroswap TVL: $2M. Aquarius TVL: $15M. Phoenix TVL: $800K.";
  const question = "Which Stellar DeFi project has the highest TVL?";
  try {
    const report = await analyzeData(data, question);
    res.json({ agent: "analyst", report });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

// ─── API routes ───────────────────────────────────────────────────────────────
app.use("/api/tasks", taskLimiter, taskRoutes);

app.use(createX402Middleware());
app.use("/api/agents", agentRoutes);

app.use("/api/payments", paymentRoutes);
app.use("/api/stripe", stripeRoutes);

setupActivityFeed(wss);

// ─── Start server ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 4021;
server.listen(PORT, () => {
  console.log(`\nAgentForge server  →  http://localhost:${PORT}`);
  console.log(`x402 Facilitator   →  http://localhost:${process.env.FACILITATOR_PORT || 4022}`);
  console.log(`WebSocket feed     →  ws://localhost:${PORT}`);
  console.log(`Mock mode: ${process.env.MOCK_MODE === "true" ? "ON (no real AI/payments)" : "OFF (live)"}\n`);
});

export { app, wss };

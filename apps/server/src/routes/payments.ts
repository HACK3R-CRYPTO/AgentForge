import { Router } from "express";
import { getSpendingStatus } from "../stellar/policy.js";
import { getAccountBalance } from "../stellar/client.js";
import { getPaymentLedger } from "../payments/x402client.js";

export const paymentRoutes = Router();

// Get spending policy status
paymentRoutes.get("/budget", async (_req, res) => {
  const status = await getSpendingStatus();
  res.json(status);
});

// Get wallet balances for all agents
paymentRoutes.get("/balances", async (_req, res) => {
  try {
    const keys = {
      orchestrator: process.env.ORCHESTRATOR_PUBLIC_KEY,
      scraper: process.env.SCRAPER_PUBLIC_KEY,
      summarizer: process.env.SUMMARIZER_PUBLIC_KEY,
      analyst: process.env.ANALYST_PUBLIC_KEY,
      facilitator: process.env.FACILITATOR_PUBLIC_KEY,
    };

    const balances: Record<string, unknown> = {};
    for (const [name, key] of Object.entries(keys)) {
      if (key) balances[name] = await getAccountBalance(key);
    }
    res.json(balances);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// Get wallet balance for a specific public key
paymentRoutes.get("/balances/:publicKey", async (req, res) => {
  try {
    const balances = await getAccountBalance(req.params.publicKey);
    res.json(balances);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// Get x402 micropayment history from internal ledger
paymentRoutes.get("/history", (_req, res) => {
  res.json({ payments: getPaymentLedger() });
});

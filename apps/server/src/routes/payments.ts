import { Router } from "express";
import { getSpendingStatus } from "../stellar/policy.js";
import { getAccountBalance, horizon } from "../stellar/client.js";

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

// Get recent payment operations from Stellar Horizon
paymentRoutes.get("/history", async (req, res) => {
  try {
    const publicKey =
      (req.query.account as string) || process.env.ORCHESTRATOR_PUBLIC_KEY;

    if (!publicKey) {
      res.status(400).json({ error: "account query param or ORCHESTRATOR_PUBLIC_KEY required" });
      return;
    }

    const payments = await horizon
      .payments()
      .forAccount(publicKey)
      .limit(20)
      .order("desc")
      .call();

    const formatted = payments.records.map((p) => {
      const rec = p as unknown as Record<string, unknown>;
      return {
        id: rec.id,
        type: rec.type,
        amount: rec.amount,
        asset: rec.asset_code || "XLM",
        from: rec.from,
        to: rec.to,
        timestamp: rec.created_at,
        txHash: rec.transaction_hash,
      };
    });

    res.json({ payments: formatted });
  } catch (error) {
    res.status(500).json({ error: String(error), payments: [] });
  }
});

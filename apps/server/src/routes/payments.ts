import { Router } from "express";
import { getSpendingStatus } from "../stellar/policy.js";
import { getAccountBalance } from "../stellar/client.js";

export const paymentRoutes = Router();

// Get spending policy status
paymentRoutes.get("/budget", async (_req, res) => {
  const status = await getSpendingStatus();
  res.json(status);
});

// Get wallet balances
paymentRoutes.get("/balances/:publicKey", async (req, res) => {
  try {
    const balances = await getAccountBalance(req.params.publicKey);
    res.json(balances);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// Get recent payment history
paymentRoutes.get("/history", async (_req, res) => {
  // TODO: Query Stellar Horizon for recent payment operations
  res.json({ payments: [] });
});

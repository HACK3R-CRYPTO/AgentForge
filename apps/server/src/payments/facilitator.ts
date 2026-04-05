// Self-hosted x402 Facilitator for Stellar
// Verifies and settles payments on Stellar testnet

import express from "express";
import { createEd25519Signer } from "@x402/stellar";
import { ExactStellarScheme } from "@x402/stellar/exact/facilitator";
import { x402Facilitator } from "@x402/core/facilitator";

export function startFacilitator() {
  const facilitatorApp = express();
  facilitatorApp.use(express.json());

  const secretKey = process.env.FACILITATOR_SECRET_KEY;
  if (!secretKey) {
    console.warn("FACILITATOR_SECRET_KEY not set, facilitator disabled");
    return null;
  }

  const signer = createEd25519Signer(secretKey);
  const scheme = new ExactStellarScheme([signer], {
    rpcConfig: {
      url:
        process.env.STELLAR_RPC_URL || "https://soroban-testnet.stellar.org",
    },
  });

  const facilitator = new x402Facilitator();
  facilitator.register("stellar:testnet", scheme);

  // Supported endpoint
  facilitatorApp.get("/supported", (_req, res) => {
    res.json(facilitator.getSupported());
  });

  // Verify endpoint
  facilitatorApp.post("/verify", async (req, res) => {
    try {
      const { paymentPayload, paymentRequirements } = req.body;
      const result = await facilitator.verify(paymentPayload, paymentRequirements);
      res.json(result);
    } catch (error) {
      res.status(400).json({ error: String(error) });
    }
  });

  // Settle endpoint
  facilitatorApp.post("/settle", async (req, res) => {
    try {
      const { paymentPayload, paymentRequirements } = req.body;
      const result = await facilitator.settle(paymentPayload, paymentRequirements);
      res.json(result);
    } catch (error) {
      res.status(400).json({ error: String(error) });
    }
  });

  // Health
  facilitatorApp.get("/health", (_req, res) => {
    res.json({ status: "ok", service: "x402-facilitator" });
  });

  const port = process.env.FACILITATOR_PORT || 4022;
  facilitatorApp.listen(port, () => {
    console.log(`x402 Facilitator running on port ${port}`);
    console.log(`  Facilitator pubkey: ${process.env.FACILITATOR_PUBLIC_KEY}`);
  });

  return facilitatorApp;
}

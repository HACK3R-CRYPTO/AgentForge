// MPP Charge server — guards the summarizer endpoint
// Distinct from x402: MPP uses the draft-stellar-charge-00 spec where the client
// signs a Soroban auth entry and the server submits the transaction.

import { charge } from "@stellar/mpp/charge/server";
import { Mppx, toNodeListener } from "mppx/server";
import type { Request as ExpressReq, Response as ExpressRes, NextFunction } from "express";

const MPP_AMOUNT = "0.002"; // 0.002 USDC per summarizer call (display units)

let _server: ReturnType<typeof Mppx.create> | null = null;

function getMppServer() {
  if (_server) return _server;

  const recipient = process.env.SUMMARIZER_PUBLIC_KEY;
  const currency = process.env.USDC_CONTRACT_ID;

  if (!recipient || !currency) {
    throw new Error(
      "MPP guard: SUMMARIZER_PUBLIC_KEY and USDC_CONTRACT_ID must be set. " +
      "Check your .env file."
    );
  }

  _server = Mppx.create({
    methods: [
      charge({
        recipient,
        currency,
        network: "stellar:testnet",
        rpcUrl: process.env.STELLAR_RPC_URL || "https://soroban-testnet.stellar.org",
      }),
    ],
    realm: "agentforge-summarizer",
    secretKey: process.env.MPP_SECRET_KEY || process.env.SUMMARIZER_SECRET_KEY || "agentforge-mpp-dev",
  });

  return _server;
}

/**
 * Express middleware that enforces an MPP Charge payment before the summarizer.
 * Issues a 402 WWW-Authenticate challenge; on success sets the Payment-Receipt header.
 */
export async function mppGuard(req: ExpressReq, res: ExpressRes, next: NextFunction) {
  try {
    const server = getMppServer();
    const handler = server.stellar.charge({ amount: MPP_AMOUNT });

    const result = await toNodeListener(handler)(req as any, res as any);

    if (result.status === 402) {
      // Challenge written to response by toNodeListener — stop here
      return;
    }

    // Payment verified — Payment-Receipt header already set, continue to handler
    next();
  } catch (err) {
    const message = String(err);
    console.error("[MPP] Guard error:", message);

    // Surface config errors so they're not silent
    if (message.includes("must be set") || message.includes("not set")) {
      res.status(503).json({
        error: "MPP payment guard misconfigured",
        detail: message,
      });
      return;
    }

    // Unexpected runtime error — surface it rather than silently passing through
    res.status(500).json({ error: "MPP payment verification failed", detail: message });
  }
}

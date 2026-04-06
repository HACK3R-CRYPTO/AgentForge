// MPP Charge server — guards the summarizer endpoint
// Distinct from x402: MPP uses the draft-stellar-charge-00 spec where the client
// signs a Soroban auth entry and the server submits the transaction.

import { charge } from "@stellar/mpp/charge/server";
// mppx/express wraps each intent as a real Express RequestHandler
import { Mppx } from "mppx/express";
import type { Request as ExpressReq, Response as ExpressRes, NextFunction } from "express";

const MPP_AMOUNT = "0.002"; // 0.002 USDC per summarizer call (display units)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _middleware: any = null;

function getMppMiddleware() {
  if (_middleware) return _middleware;

  const recipient = process.env.SUMMARIZER_PUBLIC_KEY;
  const currency = process.env.USDC_CONTRACT_ID;

  if (!recipient || !currency) {
    throw new Error(
      "MPP guard: SUMMARIZER_PUBLIC_KEY and USDC_CONTRACT_ID must be set. " +
      "Check your .env file."
    );
  }

  // Mppx.create from mppx/express returns an object where each transport method
  // (.stellar.charge, .tempo.charge, etc.) is already an Express RequestHandler factory.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const server: any = Mppx.create({
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

  // .charge({ amount }) returns an Express middleware directly (mppx/express wraps it)
  _middleware = server.charge({ amount: MPP_AMOUNT });
  return _middleware;
}

/**
 * Express middleware that enforces an MPP Charge payment before the summarizer.
 * Issues a 402 WWW-Authenticate challenge; on success sets the Payment-Receipt header.
 */
export async function mppGuard(req: ExpressReq, res: ExpressRes, next: NextFunction) {
  try {
    const middleware = getMppMiddleware();
    await middleware(req, res, next);
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

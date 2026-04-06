// MPP Charge server — guards the summarizer endpoint
// Distinct from x402: MPP uses the draft-stellar-charge-00 spec where the client
// signs a Soroban auth entry and the server submits the transaction.

import { charge } from "@stellar/mpp/charge/server";
import { Mppx, toNodeListener } from "mppx/server";
import type { Request as ExpressReq, Response as ExpressRes, NextFunction } from "express";

// 0.002 USDC per summarizer call (display units — toBaseUnits converts internally)
const MPP_AMOUNT = "0.002";

let _server: ReturnType<typeof Mppx.create> | null = null;

function getMppServer() {
  if (_server) return _server;

  const recipient = process.env.SUMMARIZER_PUBLIC_KEY;
  const currency = process.env.USDC_CONTRACT_ID;
  if (!recipient || !currency) {
    console.warn("[MPP] SUMMARIZER_PUBLIC_KEY or USDC_CONTRACT_ID not set");
  }

  _server = Mppx.create({
    methods: [
      charge({
        recipient: recipient || "",
        currency: currency || "",
        network: "stellar:testnet",
        rpcUrl: process.env.STELLAR_RPC_URL || "https://soroban-testnet.stellar.org",
      }),
    ],
    realm: "agentforge-summarizer",
    // Used for HMAC-bound challenge IDs (not the payment key)
    secretKey: process.env.MPP_SECRET_KEY || process.env.SUMMARIZER_SECRET_KEY || "agentforge-mpp-dev",
  });

  return _server;
}

/**
 * Express middleware that enforces an MPP Charge payment.
 *
 * On 402: sends the WWW-Authenticate challenge and ends the response.
 * On success: sets the Payment-Receipt header and calls next().
 */
export async function mppGuard(req: ExpressReq, res: ExpressRes, next: NextFunction) {
  if (!process.env.SUMMARIZER_PUBLIC_KEY || !process.env.USDC_CONTRACT_ID) {
    // Skip MPP if not configured (dev mode)
    return next();
  }

  try {
    const server = getMppServer();
    const handler = server.stellar.charge({ amount: MPP_AMOUNT });

    // toNodeListener bridges Fetch API ↔ Node.js HTTP.
    // Express req/res extend IncomingMessage/ServerResponse — compatible.
    const result = await toNodeListener(handler)(req as any, res as any);

    if (result.status === 402) {
      // Challenge already written to response by toNodeListener
      return;
    }

    // Payment verified — toNodeListener has set the Payment-Receipt header.
    // Continue to the route handler to write the body.
    next();
  } catch (err) {
    console.error("[MPP] Guard error:", err);
    // In case of unexpected error, let the request through so the demo still works
    next();
  }
}

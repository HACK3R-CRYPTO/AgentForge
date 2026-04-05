// x402 Resource Server Middleware for AgentForge
// Puts payment gates on agent endpoints — clients must pay before access

import { paymentMiddleware } from "@x402/express";
import { x402ResourceServer, HTTPFacilitatorClient } from "@x402/core/server";
import { ExactStellarScheme } from "@x402/stellar/exact/server";

const USDC =
  process.env.USDC_CONTRACT_ID ||
  "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA";

export function createX402Middleware() {
  const scraperPayTo = process.env.SCRAPER_PUBLIC_KEY!;
  const summarizerPayTo = process.env.SUMMARIZER_PUBLIC_KEY!;
  const analystPayTo = process.env.ANALYST_PUBLIC_KEY!;

  const facilitatorClient = new HTTPFacilitatorClient({
    url: process.env.FACILITATOR_URL || "http://localhost:4022",
  });

  const server = new x402ResourceServer(facilitatorClient);
  server.register("stellar:testnet", new ExactStellarScheme());

  return paymentMiddleware(
    {
      "GET /api/agents/scraper": {
        accepts: [
          {
            scheme: "exact",
            price: { asset: USDC, amount: "10000" },   // 0.001 USDC in 7-decimal stroops
            network: "stellar:testnet",
            payTo: scraperPayTo,
          },
        ],
        description: "Web scraping service — $0.001/call via x402",
      },
      "POST /api/agents/summarizer": {
        accepts: [
          {
            scheme: "exact",
            price: { asset: USDC, amount: "20000" },   // 0.002 USDC
            network: "stellar:testnet",
            payTo: summarizerPayTo,
          },
        ],
        description: "Text summarizer — $0.002/summary via x402",
      },
      "POST /api/agents/analyst": {
        accepts: [
          {
            scheme: "exact",
            price: { asset: USDC, amount: "30000" },   // 0.003 USDC
            network: "stellar:testnet",
            payTo: analystPayTo,
          },
        ],
        description: "Data analyst — $0.003/report via x402",
      },
    },
    server
  );
}

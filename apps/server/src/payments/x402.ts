import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { ExactStellarScheme } from "@x402/stellar/exact/server";
import { HTTPFacilitatorClient } from "@x402/core/server";
import type { Router } from "express";

const FACILITATOR_URL =
  process.env.FACILITATOR_URL || "http://localhost:4022";
const PAY_TO = process.env.ORCHESTRATOR_SECRET_KEY
  ? "" // Will be derived from secret key
  : "GABC..."; // Placeholder

export function setupX402Middleware(router: Router) {
  const facilitatorClient = new HTTPFacilitatorClient({
    url: FACILITATOR_URL,
  });

  const x402Server = new x402ResourceServer(facilitatorClient).register(
    "stellar:testnet",
    new ExactStellarScheme()
  );

  return paymentMiddleware(
    {
      "GET /api/agents/scraper": {
        accepts: [
          {
            scheme: "exact",
            price: 0.001,
            network: "stellar:testnet",
            asset:
              process.env.USDC_CONTRACT_ID ||
              "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA",
            payTo: PAY_TO,
          },
        ],
        description: "Web scraping service - fetches and extracts content",
      },
      "POST /api/agents/analyst": {
        accepts: [
          {
            scheme: "exact",
            price: 0.003,
            network: "stellar:testnet",
            asset:
              process.env.USDC_CONTRACT_ID ||
              "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA",
            payTo: PAY_TO,
          },
        ],
        description: "Data analysis service - produces structured reports",
      },
    },
    x402Server
  );
}

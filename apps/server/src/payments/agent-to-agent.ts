// Agent-to-Agent Payment Client
// Enables specialist agents to hire other agents and pay them directly.
// The Scraper uses this to hire the Summarizer via MPP using its own wallet.

import { stellar } from "@stellar/mpp/charge/client";
import { Mppx } from "mppx/client";

// Each agent uses its own secret key as the payer — true agent-to-agent economy
let _scraperMppClient: ReturnType<typeof Mppx.create> | null = null;

function getScraperMppClient() {
  if (_scraperMppClient) return _scraperMppClient;

  const secretKey = process.env.SCRAPER_SECRET_KEY;
  if (!secretKey) throw new Error("SCRAPER_SECRET_KEY not set — cannot make agent-to-agent payments");

  _scraperMppClient = Mppx.create({
    methods: [
      stellar.charge({
        secretKey,
        rpcUrl: process.env.STELLAR_RPC_URL || "https://soroban-testnet.stellar.org",
      }),
    ],
    polyfill: false,
  });

  return _scraperMppClient;
}

export interface AgentHireResult {
  output: string;
  amountPaid: number;
  txHash: string;
  hiredBy: string;
  hiredAgent: string;
}

/**
 * The Scraper agent hires the Summarizer agent via MPP.
 * Payment: SCRAPER_PUBLIC_KEY → SUMMARIZER_PUBLIC_KEY (0.002 USDC)
 * This is a true agent-to-agent transaction — no orchestrator involved.
 */
export async function scraperHiresSummarizer(text: string): Promise<AgentHireResult> {
  const client   = getScraperMppClient();
  const base     = `http://localhost:${process.env.PORT || 4021}`;
  const endpoint = `${base}/api/agents/summarizer`;

  const response = await client.fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, style: "brief" }),
  });

  if (!response.ok) {
    throw new Error(`Agent-to-agent call failed: Scraper→Summarizer ${response.status}`);
  }

  const receipt = response.headers.get("Payment-Receipt") || "";
  let txHash = `a2a-${Date.now()}`;
  if (receipt) {
    try {
      const parsed = JSON.parse(atob(receipt));
      // mppx Receipt schema uses `reference` for the Stellar tx hash
      txHash = parsed.reference || parsed.transaction || parsed.hash || parsed.txHash || parsed.tx || txHash;
    } catch {
      if (receipt.length >= 32) txHash = receipt.slice(0, 64);
    }
  }

  const data = (await response.json()) as { summary?: string };

  return {
    output: data.summary ?? "",
    amountPaid: 0.002,
    txHash,
    hiredBy: "Scraper",
    hiredAgent: "Summarizer",
  };
}

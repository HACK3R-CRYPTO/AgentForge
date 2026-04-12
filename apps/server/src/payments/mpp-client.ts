// MPP Charge client — used by the orchestrator to call the summarizer
// Handles the 402 ↔ credential dance using @stellar/mpp/charge/client

import { stellar } from "@stellar/mpp/charge/client";
import { Mppx } from "mppx/client";

let _client: ReturnType<typeof Mppx.create> | null = null;

function getMppClient() {
  if (_client) return _client;

  const secretKey = process.env.PLATFORM_SECRET_KEY || process.env.ORCHESTRATOR_SECRET_KEY;
  if (!secretKey) throw new Error("PLATFORM_SECRET_KEY not set for MPP client");

  _client = Mppx.create({
    methods: [
      stellar.charge({
        secretKey,
        rpcUrl: process.env.STELLAR_RPC_URL || "https://soroban-testnet.stellar.org",
      }),
    ],
    // Don't replace globalThis.fetch — use mppClient.fetch directly
    polyfill: false,
  });

  return _client;
}

export interface MppCallResult {
  output: unknown;
  amountPaid: number;
  txHash: string;
}

/**
 * Call the summarizer via MPP Charge.
 * Automatically handles the 402 → credential → retry flow.
 */
export async function callSummarizerViaMpp(
  text: string,
  style = "brief"
): Promise<MppCallResult> {
  const base = `http://localhost:${process.env.PORT || 4021}`;
  const url = `${base}/api/agents/summarizer`;

  const client = getMppClient();

  const response = await client.fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, style }),
  });

  if (!response.ok) {
    throw new Error(`Summarizer MPP call failed: ${response.status} ${await response.text()}`);
  }

  // Extract the transaction hash from the Payment-Receipt header if present
  const receipt = response.headers.get("Payment-Receipt");
  let txHash = `mock-${Date.now()}`;
  if (receipt) {
    try {
      const parsed = JSON.parse(atob(receipt));
      // mppx Receipt schema uses `reference` for the Stellar tx hash
      txHash = parsed.reference || parsed.transaction || parsed.hash || parsed.txHash || parsed.tx || parsed.id || receipt;
    } catch {
      txHash = receipt.length >= 32 ? receipt.slice(0, 64) : `mock-${Date.now()}`;
    }
  }

  const data = (await response.json()) as { summary?: string };
  return { output: data.summary ?? "", amountPaid: 0.002, txHash };
}

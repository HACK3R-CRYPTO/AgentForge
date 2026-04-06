// MPP (Machine Payment Protocol) — Stellar payment channels for streaming tasks
// The summarizer agent uses x402 (like scraper/analyst) for per-call micropayments.
// MPP channel support is defined here for future streaming-payment use cases.

export interface MPPChallenge {
  id: string;
  method: string;
  intent: string;
  amount: string;
  currency: string;
  recipient: string;
  network: string;
}

export function createMPPChallenge(
  amount: string,
  _description: string
): MPPChallenge {
  return {
    id: crypto.randomUUID(),
    method: "stellar",
    intent: "charge",
    amount,
    currency: "USDC",
    recipient: process.env.SUMMARIZER_PUBLIC_KEY || "",
    network: "stellar:testnet",
  };
}

// x402 HTTP Client for the Orchestrator
// Implements the 402 payment dance: request → 402 → pay → retry

import { x402Client, x402HTTPClient } from "@x402/core/client";
import { ExactStellarScheme } from "@x402/stellar/exact/client";
import { createEd25519Signer } from "@x402/stellar";

let _httpClient: x402HTTPClient | null = null;

function getX402Client(): x402HTTPClient {
  if (_httpClient) return _httpClient;

  // Use PLATFORM wallet (not orchestrator/issuer) so x402 creates real USDC transfers, not mints
  const secretKey = process.env.PLATFORM_SECRET_KEY || process.env.ORCHESTRATOR_SECRET_KEY;
  if (!secretKey) throw new Error("PLATFORM_SECRET_KEY not set");

  const signer = createEd25519Signer(secretKey);
  const stellarScheme = new ExactStellarScheme(signer);

  const coreClient = new x402Client((_version, requirements) => requirements[0]);
  coreClient.register("stellar:testnet", stellarScheme);

  _httpClient = new x402HTTPClient(coreClient);
  return _httpClient;
}

// ─── In-memory payment ledger ────────────────────────────────────────────────
// Tracks successful x402 micropayments for the Payment Explorer tab
export interface PaymentRecord {
  id: string;
  type: string;
  amount: string;
  asset: string;
  from: string;
  to: string;
  fromLabel: string;
  toLabel: string;
  timestamp: string;
  txHash: string;
}

const paymentLedger: PaymentRecord[] = [];

export function getPaymentLedger(): PaymentRecord[] {
  return [...paymentLedger].reverse();
}

function extractTxHash(rawHeader: string): string {
  try {
    const decoded = JSON.parse(Buffer.from(rawHeader, "base64").toString());
    return decoded.transaction || rawHeader;
  } catch {
    return rawHeader;
  }
}

function recordPayment(toLabel: string, toKey: string, amount: string, rawTxHash: string) {
  const fromKey = process.env.PLATFORM_PUBLIC_KEY || process.env.ORCHESTRATOR_PUBLIC_KEY || "";
  paymentLedger.push({
    id: `pay-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    type: "x402_payment",
    amount,
    asset: "USDC",
    from: fromKey,
    to: toKey,
    fromLabel: "Platform",
    toLabel,
    timestamp: new Date().toISOString(),
    txHash: extractTxHash(rawTxHash),
  });
}

// ─── x402 fetch ──────────────────────────────────────────────────────────────

async function x402Fetch(
  url: string,
  init: RequestInit = {}
): Promise<Response> {
  const client = getX402Client();

  let response = await fetch(url, init);

  if (response.status === 402) {
    const body = await response.json();
    const paymentRequired = client.getPaymentRequiredResponse(
      (name) => response.headers.get(name),
      body
    );

    const paymentPayload = await client.createPaymentPayload(paymentRequired);
    const paymentHeader = client.encodePaymentSignatureHeader(paymentPayload);

    response = await fetch(url, {
      ...init,
      headers: {
        ...(init.headers as Record<string, string> || {}),
        ...paymentHeader,
      },
    });
  }

  return response;
}

// ─── Agent call helpers ───────────────────────────────────────────────────────

// Lazy import to avoid circular deps at module load time
let _callSummarizerViaMpp: ((text: string, style?: string) => Promise<{ output: unknown; amountPaid: number; txHash: string }>) | null = null;
async function getMppSummarizer() {
  if (!_callSummarizerViaMpp) {
    const mod = await import("./mpp-client.js");
    _callSummarizerViaMpp = mod.callSummarizerViaMpp;
  }
  return _callSummarizerViaMpp;
}

export interface AgentCallResult {
  status: string;
  output: unknown;
  amountPaid: number;
  txHash?: string;
}

export async function callScraperAgent(url: string): Promise<AgentCallResult> {
  const base = `http://localhost:${process.env.PORT || 4021}`;
  const endpoint = `${base}/api/agents/scraper?url=${encodeURIComponent(url)}`;

  const response = await x402Fetch(endpoint, { method: "GET" });
  if (!response.ok) {
    throw new Error(`Scraper failed: ${response.status} ${await response.text()}`);
  }

  const txHash = response.headers.get("PAYMENT-RESPONSE") || `mock-${Date.now()}`;
  recordPayment("Scraper", process.env.SCRAPER_PUBLIC_KEY || "", "0.0010000", txHash);

  const data = (await response.json()) as { content?: string };
  return { status: "completed", output: data.content ?? "", amountPaid: 0.001, txHash };
}

export async function callSummarizerAgent(
  text: string,
  style = "brief"
): Promise<AgentCallResult> {
  // Summarizer uses MPP Charge (distinct payment rail from x402)
  const callViaMpp = await getMppSummarizer();
  const mppResult = await callViaMpp(text, style);

  recordPayment("Summarizer", process.env.SUMMARIZER_PUBLIC_KEY || "", "0.0020000", mppResult.txHash);

  return { status: "completed", output: mppResult.output, amountPaid: 0.002, txHash: mppResult.txHash };
}

export async function callAnalystAgent(
  data: string,
  question: string
): Promise<AgentCallResult> {
  const base = `http://localhost:${process.env.PORT || 4021}`;
  const endpoint = `${base}/api/agents/analyst`;

  const response = await x402Fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data, question }),
  });
  if (!response.ok) {
    throw new Error(`Analyst failed: ${response.status} ${await response.text()}`);
  }

  const txHash = response.headers.get("PAYMENT-RESPONSE") || `mock-${Date.now()}`;
  recordPayment("Analyst", process.env.ANALYST_PUBLIC_KEY || "", "0.0030000", txHash);

  const result = (await response.json()) as { report?: string };
  return { status: "completed", output: result.report ?? "", amountPaid: 0.003, txHash };
}

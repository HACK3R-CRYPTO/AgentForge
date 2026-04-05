// x402 HTTP Client for the Orchestrator
// Implements the 402 payment dance: request → 402 → pay → retry

import { x402Client, x402HTTPClient } from "@x402/core/client";
import { ExactStellarScheme } from "@x402/stellar/exact/client";
import { createEd25519Signer } from "@x402/stellar";

let _httpClient: x402HTTPClient | null = null;

function getX402Client(): x402HTTPClient {
  if (_httpClient) return _httpClient;

  const secretKey = process.env.ORCHESTRATOR_SECRET_KEY;
  if (!secretKey) throw new Error("ORCHESTRATOR_SECRET_KEY not set");

  const signer = createEd25519Signer(secretKey);
  const stellarScheme = new ExactStellarScheme(signer);

  const coreClient = new x402Client((_version, requirements) => requirements[0]);
  coreClient.register("stellar:testnet", stellarScheme);

  _httpClient = new x402HTTPClient(coreClient);
  return _httpClient;
}

async function x402Fetch(
  url: string,
  init: RequestInit = {}
): Promise<Response> {
  const client = getX402Client();

  // First request — may return 402
  let response = await fetch(url, init);

  if (response.status === 402) {
    const body = await response.json();
    const paymentRequired = client.getPaymentRequiredResponse(
      (name) => response.headers.get(name),
      body
    );

    const paymentPayload = await client.createPaymentPayload(paymentRequired);
    const paymentHeader = client.encodePaymentSignatureHeader(paymentPayload);

    // Retry with payment header
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

  const data = (await response.json()) as { content?: string };
  return { status: "completed", output: data.content ?? "", amountPaid: 0.001 };
}

export async function callSummarizerAgent(
  text: string,
  style = "brief"
): Promise<AgentCallResult> {
  const base = `http://localhost:${process.env.PORT || 4021}`;
  const endpoint = `${base}/api/agents/summarizer`;

  const response = await x402Fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, style }),
  });
  if (!response.ok) {
    throw new Error(`Summarizer failed: ${response.status} ${await response.text()}`);
  }

  const data = (await response.json()) as { summary?: string };
  return { status: "completed", output: data.summary ?? "", amountPaid: 0.002 };
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

  const result = (await response.json()) as { report?: string };
  return { status: "completed", output: result.report ?? "", amountPaid: 0.003 };
}

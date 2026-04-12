/**
 * MoltbookService — agents post about their work to Moltbook social feed.
 *
 * Posts fire when:
 *   - A payment lands on Stellar
 *   - A task completes
 *
 * Rate limited to avoid spam. Uses Claude to write the posts in the agent's voice.
 * Submolt: m/agentforgestellar
 */

import Anthropic from "@anthropic-ai/sdk";

const BASE_URL = process.env.MOLTBOOK_API_URL || "https://www.moltbook.com/api/v1";
const API_KEY  = process.env.MOLTBOOK_API_KEY  || "";
const SUBMOLT  = "agentforgestellar";

// One post per agent per 10 minutes max
const lastPostTime: Record<string, number> = {};
const COOLDOWN_MS = 10 * 60 * 1000;

let _anthropic: Anthropic | null = null;
function getAnthropic() {
  if (!_anthropic) _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _anthropic;
}

// ── Core API call ─────────────────────────────────────────────────────────────

async function apiRequest(endpoint: string, body: Record<string, unknown>) {
  if (!API_KEY) return null;
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  return res.json() as Promise<{
    success: boolean;
    error?: string;
    verification_required?: boolean;
    verification?: { code?: string; verification_code?: string; challenge?: string };
  }>;
}

// ── Solve math verification challenge ────────────────────────────────────────

async function solveVerification(challenge: string): Promise<string | null> {
  try {
    const res = await getAnthropic().messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 64,
      messages: [{ role: "user", content: `Solve this math problem. Return ONLY the numerical answer, nothing else.\n\n${challenge}` }],
    });
    const block = res.content[0];
    return block.type === "text" ? block.text.trim() : null;
  } catch {
    return null;
  }
}

async function handleVerification(data: Awaited<ReturnType<typeof apiRequest>>) {
  if (!data?.verification_required || !data.verification) return;
  const code      = data.verification.code || data.verification.verification_code;
  const challenge = data.verification.challenge;
  if (!code || !challenge) return;

  const answer = await solveVerification(challenge);
  if (answer) {
    await apiRequest("/verify", { verification_code: code, answer });
  }
}

// ── Generate post content via Claude ─────────────────────────────────────────

async function generatePost(agentName: string, context: string): Promise<string> {
  try {
    const res = await getAnthropic().messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 100,
      messages: [{
        role: "user",
        content: `You are ${agentName}, an autonomous AI agent on the AgentForge marketplace on Stellar blockchain. Write a short social post (under 250 characters) about what you just did. Be direct and factual. Mention USDC payments and Stellar if relevant. No hashtags. No emojis.\n\nContext: ${context}`,
      }],
    });
    const block = res.content[0];
    return block.type === "text" ? block.text.trim().slice(0, 250) : context.slice(0, 250);
  } catch {
    return context.slice(0, 250);
  }
}

// ── Public post function ──────────────────────────────────────────────────────

async function post(agentName: string, title: string, context: string) {
  if (!API_KEY) return;

  const now = Date.now();
  const key = agentName.toLowerCase();
  if (now - (lastPostTime[key] || 0) < COOLDOWN_MS) return;
  lastPostTime[key] = now;

  try {
    const content = await generatePost(agentName, context);
    const data    = await apiRequest("/posts", { submolt: SUBMOLT, title, content });

    if (data?.success) {
      console.log(`[Moltbook] ${agentName} posted to m/${SUBMOLT}: "${title}"`);
      await handleVerification(data);
    } else if (data?.error) {
      console.warn(`[Moltbook] Post failed: ${data.error}`);
    }
  } catch (err) {
    console.warn(`[Moltbook] Error: ${String(err).slice(0, 80)}`);
  }
}

// ── Event-specific helpers ────────────────────────────────────────────────────

export async function postPaymentReceived(
  agent: string,
  amount: number,
  txHash: string,
  paidBy: string,
  protocol: "x402" | "mpp" = "x402"
) {
  const names: Record<string, string> = {
    scraper:    "Web Scraper Agent",
    summarizer: "Summarizer Agent",
    analyst:    "Data Analyst Agent",
  };
  const name    = names[agent.toLowerCase()] || agent;
  const payer   = paidBy.toLowerCase().includes("scraper") ? "the Scraper agent (agent-to-agent)" : "the Orchestrator";
  const txLink  = txHash && !txHash.startsWith("pending-") ? ` Tx: ${txHash}` : "";
  const context = `I received $${amount} USDC from ${payer} on Stellar via ${protocol.toUpperCase()}.${txLink}`;
  await post(name, `Payment received: $${amount} USDC`, context);
}

export async function postTaskCompleted(prompt: string, totalSpent: number) {
  await post(
    "AgentForge Orchestrator",
    "Task completed",
    `Task "${prompt.slice(0, 80)}" completed. Total spent: $${totalSpent.toFixed(4)} USDC across agents on Stellar.`
  );
}

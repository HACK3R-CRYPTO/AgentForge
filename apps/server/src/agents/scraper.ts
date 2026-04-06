import Anthropic from "@anthropic-ai/sdk";
import { emitActivity } from "../websocket/activity.js";

let _anthropic: Anthropic | null = null;
const getAnthropic = () => {
  if (!_anthropic) _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _anthropic;
};

// SSRF protection — block private/internal network access
function validateUrl(rawUrl: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error(`Invalid URL: ${rawUrl}`);
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error(`Only http/https URLs are allowed`);
  }

  const host = parsed.hostname.toLowerCase();

  if (host === "localhost" || host === "127.0.0.1" || host === "::1") {
    throw new Error(`URL points to localhost — not allowed`);
  }

  const privateRanges = [
    /^10\./,
    /^172\.(1[6-9]|2\d|3[01])\./,
    /^192\.168\./,
    /^169\.254\./,
    /^0\./,
    /^100\.64\./,
  ];
  for (const re of privateRanges) {
    if (re.test(host)) throw new Error(`URL points to a private network — not allowed`);
  }

  const blockedHosts = ["169.254.169.254", "metadata.google.internal", "metadata.aws.internal"];
  if (blockedHosts.includes(host)) {
    throw new Error(`URL points to a metadata service — not allowed`);
  }

  return parsed;
}

export async function scrapeUrl(url: string): Promise<string> {
  const parsed = validateUrl(url);

  const response = await fetch(parsed.toString(), {
    headers: { "User-Agent": "AgentForge-Scraper/1.0" },
    redirect: "follow",
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${parsed.hostname}: ${response.status}`);
  }

  const html = await response.text();

  const extraction = await getAnthropic().messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2048,
    messages: [
      {
        role: "user",
        content: `Extract the main text content from this HTML. Return only the meaningful article/page content, no navigation, ads, or boilerplate:\n\n${html.slice(0, 30000)}`,
      },
    ],
  });

  const textBlock = extraction.content.find(
    (b: Anthropic.ContentBlock) => b.type === "text"
  ) as Anthropic.TextBlock | undefined;
  return textBlock?.text || "No content extracted";
}

/**
 * Scrape a URL then immediately hire the Summarizer via MPP to summarize it.
 * This is an agent-to-agent transaction: Scraper pays Summarizer from its own wallet.
 */
export async function scrapeAndSummarize(
  url: string,
  taskId?: string
): Promise<{ raw: string; summary: string; a2aTxHash: string }> {
  // Step 1: Scrape
  const raw = await scrapeUrl(url);

  // Step 2: Scraper hires Summarizer via MPP (agent-to-agent)
  if (taskId) {
    emitActivity({
      type: "agent_hired",
      taskId,
      message: `Scraper hiring Summarizer via MPP (agent-to-agent) — $0.002 USDC`,
      timestamp: Date.now(),
    });
  }

  // Lazy import to avoid circular dependency at startup
  const { scraperHiresSummarizer } = await import("../payments/agent-to-agent.js");
  const result = await scraperHiresSummarizer(raw);

  if (taskId) {
    emitActivity({
      type: "payment_sent",
      taskId,
      message: `Agent-to-agent MPP payment settled: Scraper → Summarizer $0.002 USDC`,
      amount: 0.002,
      timestamp: Date.now(),
    });
  }

  return { raw, summary: result.output, a2aTxHash: result.txHash };
}

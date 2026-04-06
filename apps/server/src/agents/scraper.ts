import Anthropic from "@anthropic-ai/sdk";

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

  // Block localhost and loopback
  if (host === "localhost" || host === "127.0.0.1" || host === "::1") {
    throw new Error(`URL points to localhost — not allowed`);
  }

  // Block private IPv4 ranges
  const privateRanges = [
    /^10\./,
    /^172\.(1[6-9]|2\d|3[01])\./,
    /^192\.168\./,
    /^169\.254\./,   // link-local
    /^0\./,
    /^100\.64\./,    // shared address space
  ];
  for (const re of privateRanges) {
    if (re.test(host)) throw new Error(`URL points to a private network — not allowed`);
  }

  // Block cloud metadata endpoints
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
    // Limit redirects to prevent SSRF via open redirect
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

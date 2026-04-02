import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();

export async function scrapeUrl(url: string): Promise<string> {
  // Fetch the URL content
  const response = await fetch(url, {
    headers: {
      "User-Agent": "AgentForge-Scraper/1.0",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }

  const html = await response.text();

  // Use Claude to extract meaningful content from HTML
  const extraction = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2048,
    messages: [
      {
        role: "user",
        content: `Extract the main text content from this HTML. Return only the meaningful article/page content, no navigation, ads, or boilerplate:\n\n${html.slice(0, 30000)}`,
      },
    ],
  });

  const textBlock = extraction.content.find((b) => b.type === "text");
  return textBlock?.text || "No content extracted";
}

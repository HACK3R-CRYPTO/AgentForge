import Anthropic from "@anthropic-ai/sdk";

let _anthropic: Anthropic | null = null;
const getAnthropic = () => {
  if (!_anthropic) _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _anthropic;
};

export async function scrapeUrl(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: { "User-Agent": "AgentForge-Scraper/1.0" },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
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

  const textBlock = extraction.content.find((b: Anthropic.ContentBlock) => b.type === "text") as Anthropic.TextBlock | undefined;
  return textBlock?.text || "No content extracted";
}

import Anthropic from "@anthropic-ai/sdk";

let _anthropic: Anthropic | null = null;
const getAnthropic = () => {
  if (!_anthropic) _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _anthropic;
};

export async function summarizeText(
  text: string,
  style: "brief" | "detailed" = "brief"
): Promise<string> {
  const prompt =
    style === "brief"
      ? "Summarize the following text in 2-3 concise sentences:"
      : "Provide a detailed summary of the following text with key points:";

  const response = await getAnthropic().messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: `${prompt}\n\n${text}`,
      },
    ],
  });

  const textBlock = response.content.find((b: Anthropic.ContentBlock) => b.type === "text") as Anthropic.TextBlock | undefined;
  return textBlock?.text || "No summary generated";
}

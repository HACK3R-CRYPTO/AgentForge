import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();

export async function summarizeText(
  text: string,
  style: "brief" | "detailed" = "brief"
): Promise<string> {
  const prompt =
    style === "brief"
      ? "Summarize the following text in 2-3 concise sentences:"
      : "Provide a detailed summary of the following text with key points:";

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: `${prompt}\n\n${text}`,
      },
    ],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  return textBlock?.text || "No summary generated";
}

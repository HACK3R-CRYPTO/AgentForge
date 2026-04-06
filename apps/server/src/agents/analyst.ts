import Anthropic from "@anthropic-ai/sdk";

let _anthropic: Anthropic | null = null;
const getAnthropic = () => {
  if (!_anthropic) _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _anthropic;
};

interface AnalysisReport {
  title: string;
  summary: string;
  keyFindings: string[];
  recommendations: string[];
  dataPoints: Record<string, string>;
}

export async function analyzeData(
  data: string,
  question: string
): Promise<AnalysisReport> {
  const response = await getAnthropic().messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2048,
    messages: [
      {
        role: "user",
        content: `Analyze the following data and answer the question. Return your analysis as JSON with this structure:
{
  "title": "Report title",
  "summary": "Executive summary",
  "keyFindings": ["finding 1", "finding 2", ...],
  "recommendations": ["rec 1", "rec 2", ...],
  "dataPoints": { "metric": "value", ... }
}

QUESTION: ${question}

DATA:
${data}`,
      },
    ],
  });

  const textBlock = response.content.find((b: Anthropic.ContentBlock) => b.type === "text") as Anthropic.TextBlock | undefined;
  try {
    // Extract JSON from the response (handle markdown code blocks)
    const text = textBlock?.text || "{}";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    return JSON.parse(jsonMatch?.[0] || "{}");
  } catch {
    return {
      title: "Analysis Report",
      summary: textBlock?.text || "Analysis failed",
      keyFindings: [],
      recommendations: [],
      dataPoints: {},
    };
  }
}

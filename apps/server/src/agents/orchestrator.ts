import Anthropic from "@anthropic-ai/sdk";
import { queryServiceRegistry, incrementCallCount, recordHireOnChain } from "../stellar/registry.js";
import { checkBudget, recordSpend } from "../stellar/policy.js";
import { emitActivity } from "../websocket/activity.js";
import {
  callScraperAgent,
  callSummarizerAgent,
  callAnalystAgent,
} from "../payments/x402client.js";
import { scrapeAndSummarize } from "./scraper.js";

// Lazy init so dotenv has time to load before the constructor reads env vars
let _anthropic: Anthropic | null = null;
function getAnthropic() {
  if (!_anthropic) _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _anthropic;
}

interface Task {
  id: string;
  prompt: string;
  budget: number;
  status: "pending" | "running" | "completed" | "failed";
}

interface SubTask {
  type: "scrape" | "summarize" | "analyze";
  input: string;
  agentEndpoint: string;
  price: number;
}

const TOOLS: Anthropic.Tool[] = [
  {
    name: "discover_agents",
    description:
      "Search the on-chain ServiceRegistry for available specialist agents by category",
    input_schema: {
      type: "object" as const,
      properties: {
        category: {
          type: "string",
          description:
            'Category to search: "scraper", "summarizer", or "analyst"',
        },
      },
      required: ["category"],
    },
  },
  {
    name: "hire_agent",
    description:
      "Hire a specialist agent to perform a subtask. Payment is made via x402 or MPP on Stellar.",
    input_schema: {
      type: "object" as const,
      properties: {
        service_id: { type: "string", description: "Service ID from registry" },
        task_description: {
          type: "string",
          description: "What the agent should do",
        },
        input_data: {
          type: "string",
          description: "Input data for the agent",
        },
      },
      required: ["service_id", "task_description"],
    },
  },
  {
    name: "check_remaining_budget",
    description:
      "Check remaining daily budget from the Soroban SpendingPolicy contract",
    input_schema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "scrape_and_summarize",
    description:
      "Agent-to-agent operation: hire the Scraper ($0.001 x402) which then autonomously hires the Summarizer ($0.002 MPP) — demonstrating a true multi-hop agent economy on Stellar. Returns pre-summarized content. Use this when you need both scraping and summarization of the same URL.",
    input_schema: {
      type: "object" as const,
      properties: {
        url: { type: "string", description: "URL to scrape and summarize" },
      },
      required: ["url"],
    },
  },
];

// Mock mode — runs without real Anthropic credits for demo/frontend dev
async function executeTaskMock(task: Task): Promise<string> {
  const steps = [
    { type: "agent_hired", agent: "scraper", cost: 0.001, message: `Scraper hired — fetching data for: "${task.prompt}"` },
    { type: "payment_sent", agent: "scraper", cost: 0.001, message: "x402 payment sent: 0.001 USDC → scraper via Stellar" },
    { type: "agent_hired", agent: "summarizer", cost: 0.002, message: "Summarizer hired — processing scraped content" },
    { type: "payment_sent", agent: "summarizer", cost: 0.002, message: "x402 payment sent: 0.002 USDC → summarizer via Stellar" },
    { type: "agent_hired", agent: "analyst", cost: 0.003, message: "Analyst hired — generating final report" },
    { type: "payment_sent", agent: "analyst", cost: 0.003, message: "x402 payment sent: 0.003 USDC → analyst via Stellar" },
    { type: "task_completed", message: "All agents completed. Total spent: $0.006 USDC" },
  ];
  for (const step of steps) {
    await new Promise((r) => setTimeout(r, 800));
    emitActivity({ ...step, taskId: task.id, timestamp: Date.now() });
  }
  return `## AgentForge Result (mock)\n\nTask: "${task.prompt}"\n\n**Scraper** collected 3 sources.\n**Summarizer** distilled key insights.\n**Analyst** produced structured report.\n\nTotal cost: $0.006 USDC across 3 Stellar micropayments.`;
}

export async function executeTask(task: Task): Promise<string> {
  if (process.env.MOCK_MODE === "true") return executeTaskMock(task);
  emitActivity({
    type: "task_started",
    taskId: task.id,
    message: `Orchestrator received task: "${task.prompt}"`,
    timestamp: Date.now(),
  });

  const messages: Anthropic.MessageParam[] = [
    {
      role: "user",
      content: `You are the AgentForge Orchestrator. You manage a network of specialist AI agents on Stellar blockchain.

Your job: decompose the user's task into subtasks, discover available agents from the on-chain ServiceRegistry, check budget from the SpendingPolicy contract, and hire specialists to complete the work.

Available agent types:
- scraper: Fetches web content ($0.001/call via x402)
- summarizer: Summarizes text ($0.002/summary via MPP Charge)
- analyst: Produces analysis reports ($0.003/report via x402)

Agent-to-agent tool:
- scrape_and_summarize: The Scraper autonomously hires the Summarizer — true multi-hop agent economy. Use this for $0.003 total when you need both scraping and summarization of a URL. The Scraper pays the Summarizer directly via MPP without going through the Orchestrator.

Budget for this task: $${task.budget}

USER TASK: ${task.prompt}

Decompose this task, discover agents, check budget, and hire them to complete the work.`,
    },
  ];

  let finalResult = "";
  let iterationCount = 0;
  const maxIterations = 10;

  while (iterationCount < maxIterations) {
    iterationCount++;

    const response = await getAnthropic().messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      tools: TOOLS,
      messages,
    });

    // Collect text and tool uses
    const toolUseBlocks = response.content.filter(
      (b: Anthropic.ContentBlock): b is Anthropic.ToolUseBlock => b.type === "tool_use"
    );
    const textBlocks = response.content.filter(
      (b: Anthropic.ContentBlock): b is Anthropic.TextBlock => b.type === "text"
    );

    if (textBlocks.length > 0) {
      finalResult += textBlocks.map((b: Anthropic.TextBlock) => b.text).join("\n");
    }

    if (response.stop_reason === "end_turn" || toolUseBlocks.length === 0) {
      break;
    }

    // Process tool calls
    const toolResults: Anthropic.ToolResultBlockParam[] = [];

    for (const toolUse of toolUseBlocks) {
      let result: string;

      switch (toolUse.name) {
        case "discover_agents": {
          const input = toolUse.input as { category: string };
          emitActivity({
            type: "agent_discovery",
            taskId: task.id,
            message: `Searching registry for "${input.category}" agents...`,
            timestamp: Date.now(),
          });
          const services = await queryServiceRegistry(input.category);
          result = JSON.stringify(services);
          break;
        }
        case "hire_agent": {
          const input = toolUse.input as {
            service_id: string;
            task_description: string;
            input_data?: string;
          };
          emitActivity({
            type: "agent_hired",
            taskId: task.id,
            message: `Hiring agent ${input.service_id}: "${input.task_description}"`,
            timestamp: Date.now(),
          });

          try {
            let agentResult;
            if (input.service_id.startsWith("scraper")) {
              const url = input.input_data || "https://stellar.org";
              agentResult = await callScraperAgent(url);
            } else if (input.service_id.startsWith("summarizer")) {
              agentResult = await callSummarizerAgent(
                input.input_data || input.task_description
              );
            } else {
              agentResult = await callAnalystAgent(
                input.input_data || "",
                input.task_description
              );
            }

            const category = input.service_id.startsWith("scraper") ? "scraper" : input.service_id.startsWith("summarizer") ? "summarizer" : "analyst";
            const protocol: "x402" | "mpp" = category === "summarizer" ? "mpp" : "x402";
            const amountPaid = agentResult.amountPaid || 0.001;
            await recordSpend(amountPaid);
            incrementCallCount(category);
            recordHireOnChain(
              category,
              process.env.PLATFORM_PUBLIC_KEY || "",
              amountPaid,
              protocol
            );

            emitActivity({
              type: "payment_sent",
              taskId: task.id,
              message: `${protocol.toUpperCase()} payment of $${amountPaid} settled on Stellar testnet for ${input.service_id}`,
              amount: amountPaid,
              txHash: agentResult.txHash,
              timestamp: Date.now(),
            });

            result = JSON.stringify({
              status: "completed",
              service_id: input.service_id,
              output: agentResult.output,
            });
          } catch (err) {
            result = JSON.stringify({
              status: "error",
              service_id: input.service_id,
              error: String(err),
            });
          }
          break;
        }
        case "check_remaining_budget": {
          const remaining = await checkBudget();
          emitActivity({
            type: "budget_check",
            taskId: task.id,
            message: `Budget check: $${remaining.toFixed(4)} remaining`,
            timestamp: Date.now(),
          });
          result = JSON.stringify({
            daily_limit: 0.5,
            remaining,
            currency: "USDC",
          });
          break;
        }
        case "scrape_and_summarize": {
          const input = toolUse.input as { url: string };
          emitActivity({
            type: "agent_hired",
            taskId: task.id,
            message: `Agent-to-agent: Scraper → Summarizer chain for ${input.url}`,
            timestamp: Date.now(),
          });

          try {
            // Scraper pays x402 to itself, then Scraper pays MPP to Summarizer
            const a2aResult = await scrapeAndSummarize(input.url, task.id);

            await recordSpend(0.003); // scraper $0.001 + summarizer $0.002
            incrementCallCount("scraper");
            incrementCallCount("summarizer");

            result = JSON.stringify({
              status: "completed",
              url: input.url,
              summary: a2aResult.summary,
              a2a_tx: a2aResult.a2aTxHash,
              note: "Scraper autonomously hired Summarizer via MPP — two Stellar payments, zero orchestrator involvement",
            });
          } catch (err) {
            result = JSON.stringify({ status: "error", error: String(err) });
          }
          break;
        }
        default:
          result = JSON.stringify({ error: "Unknown tool" });
      }

      toolResults.push({
        type: "tool_result",
        tool_use_id: toolUse.id,
        content: result,
      });
    }

    messages.push({ role: "assistant", content: response.content });
    messages.push({ role: "user", content: toolResults });
  }

  emitActivity({
    type: "task_completed",
    taskId: task.id,
    message: `Task completed successfully`,
    timestamp: Date.now(),
  });

  return finalResult;
}

import Anthropic from "@anthropic-ai/sdk";
import { queryServiceRegistry } from "../stellar/registry.js";
import { checkBudget, recordSpend } from "../stellar/policy.js";
import { emitActivity } from "../websocket/activity.js";
import {
  callScraperAgent,
  callSummarizerAgent,
  callAnalystAgent,
} from "../payments/x402client.js";

const anthropic = new Anthropic();

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
];

export async function executeTask(task: Task): Promise<string> {
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
- summarizer: Summarizes text ($0.002/summary via MPP)
- analyst: Produces analysis reports ($0.003/report via x402)

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

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      tools: TOOLS,
      messages,
    });

    // Collect text and tool uses
    const toolUseBlocks = response.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
    );
    const textBlocks = response.content.filter(
      (b): b is Anthropic.TextBlock => b.type === "text"
    );

    if (textBlocks.length > 0) {
      finalResult += textBlocks.map((b) => b.text).join("\n");
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

            await recordSpend(agentResult.amountPaid || 0.001);

            emitActivity({
              type: "payment_sent",
              taskId: task.id,
              message: `x402 payment of $${agentResult.amountPaid} settled on Stellar testnet for ${input.service_id}`,
              amount: agentResult.amountPaid,
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

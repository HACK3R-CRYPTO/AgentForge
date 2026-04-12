/**
 * AgentForge MCP Server
 *
 * Exposes AgentForge tools to any MCP client — Claude Desktop, Cursor, etc.
 * Run: npx tsx src/mcp/server.ts
 *
 * Add to Claude Desktop config (~/.config/claude/claude_desktop_config.json):
 * {
 *   "mcpServers": {
 *     "agentforge": {
 *       "command": "npx",
 *       "args": ["tsx", "/path/to/AgentForge/apps/server/src/mcp/server.ts"],
 *       "env": { "AGENTFORGE_URL": "https://agentforgeserver-production.up.railway.app" }
 *     }
 *   }
 * }
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const BASE_URL = process.env.AGENTFORGE_URL || "http://localhost:4021";

const server = new Server(
  { name: "agentforge", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

// ── List available tools ──────────────────────────────────────────────────────

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "submit_task",
      description:
        "Submit a task to AgentForge. Specialist AI agents collaborate and pay each other in USDC on Stellar. Each agent call costs: Scraper $0.001 (x402), Summarizer $0.002 (MPP Charge agent-to-agent), Analyst $0.003 (x402). A typical task costs $0.006 USDC total. Returns the final report plus the full agent payment chain with Stellar transaction links.",
      inputSchema: {
        type: "object",
        properties: {
          prompt: {
            type: "string",
            description: "What you want the agents to research, analyze, or produce",
          },
          budget: {
            type: "number",
            description:
              "Max USDC to spend. Scraper=$0.001, Summarizer=$0.002, Analyst=$0.003. Typical task=$0.006. Min 0.001, max 0.5. Defaults to 0.05 if not specified.",
          },
        },
        required: ["prompt"],
      },
    },
    {
      name: "get_task_result",
      description: "Check the status and result of a previously submitted task by taskId",
      inputSchema: {
        type: "object",
        properties: {
          task_id: {
            type: "string",
            description: "The taskId returned from submit_task",
          },
        },
        required: ["task_id"],
      },
    },
    {
      name: "discover_agents",
      description:
        "List all AI agents registered on the AgentForge ServiceRegistry Soroban contract on Stellar. Shows name, description, price in USDC, payment protocol (x402 or MPP), and total call count.",
      inputSchema: {
        type: "object",
        properties: {},
      },
    },
    {
      name: "get_payment_chain",
      description:
        "Show the full agent payment chain for a task — who hired who, what was paid in USDC, which payment protocol (x402 or MPP), and the Stellar Expert link for each transaction. Shows the agent-to-agent moment where the Scraper pays the Summarizer directly from its own Stellar wallet.",
      inputSchema: {
        type: "object",
        properties: {
          task_id: {
            type: "string",
            description: "The taskId returned from submit_task",
          },
        },
        required: ["task_id"],
      },
    },
    {
      name: "check_budget",
      description:
        "Check how much USDC has been spent today and what remains, reading directly from the Soroban SpendingPolicy contract on Stellar.",
      inputSchema: {
        type: "object",
        properties: {},
      },
    },
    {
      name: "register_agent",
      description:
        "Register a new external agent on the AgentForge ServiceRegistry on Stellar. Once registered, the Orchestrator will discover and hire it automatically whenever a task matches its description. The agent earns USDC per hire — no middleman, no platform cut.",
      inputSchema: {
        type: "object",
        properties: {
          name: { type: "string", description: "Display name for your agent" },
          description: {
            type: "string",
            description:
              "What your agent does and WHEN to use it. The Orchestrator reads this to decide whether to hire you. Be specific.",
          },
          endpoint: {
            type: "string",
            description: "Public HTTPS URL for your agent endpoint",
          },
          price: {
            type: "number",
            description: "Price per call in USDC (e.g. 0.002)",
          },
          category: {
            type: "string",
            description: 'Agent category: "scraper", "summarizer", "analyst", or a new category you define',
          },
          agentWallet: {
            type: "string",
            description: "Stellar public key (G...) where you receive USDC payments",
          },
          paymentType: {
            type: "string",
            description: '"x402" (default) or "mpp"',
          },
        },
        required: ["name", "description", "endpoint", "price", "category", "agentWallet"],
      },
    },
  ],
}));

// ── Handle tool calls ─────────────────────────────────────────────────────────

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params;

  try {
    switch (name) {
      case "submit_task": {
        const { prompt, budget = 0.05 } = args as { prompt: string; budget?: number };

        const res = await fetch(`${BASE_URL}/api/tasks`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt, budget }),
        });
        const data = (await res.json()) as { taskId: string; status: string };
        const taskId = data.taskId;

        // Poll until complete
        let taskDone = false;
        let result = "";
        let attempts = 0;

        while (!taskDone && attempts < 60) {
          await new Promise((r) => setTimeout(r, 3000));
          attempts++;
          try {
            const poll = await fetch(`${BASE_URL}/api/tasks/${taskId}`);
            const t = (await poll.json()) as { status: string; result?: string };
            if (t.status === "completed" || t.status === "failed") {
              taskDone = true;
              result = t.result || "";
            }
          } catch {
            /* keep polling */
          }
        }

        // Fetch payment ledger to build the chain
        const paymentsRes = await fetch(`${BASE_URL}/api/payments/history`);
        const payments = paymentsRes.ok
          ? ((await paymentsRes.json()) as Array<{
              toLabel: string;
              fromLabel: string;
              amount: string;
              txHash: string;
              protocol: string;
            }>)
          : [];

        const chain: string[] = [
          `**Agent Payment Chain**`,
          ``,
          `Orchestrator queried ServiceRegistry on Stellar Testnet and discovered available agents.`,
          ``,
        ];

        for (const p of payments.slice(0, 6)) {
          const isA2A = p.fromLabel.toLowerCase().includes("scraper");
          chain.push(`${p.fromLabel} → ${p.toLabel}`);
          chain.push(`  Paid: $${p.amount} USDC via ${p.protocol.toUpperCase()}${isA2A ? " (agent-to-agent — Scraper's own Stellar wallet)" : ""}`);
          if (p.txHash && !p.txHash.startsWith("pending-")) {
            chain.push(`  Tx: https://stellar.expert/explorer/testnet/tx/${p.txHash}`);
          }
          chain.push(``);
        }

        const output = [
          chain.join("\n"),
          `---`,
          `**Result**`,
          ``,
          result || "No result returned.",
        ].join("\n");

        return { content: [{ type: "text", text: output }] };
      }

      case "get_task_result": {
        const { task_id } = args as { task_id: string };
        const res = await fetch(`${BASE_URL}/api/tasks/${task_id}`);
        if (!res.ok) {
          return { content: [{ type: "text", text: `Task not found: ${task_id}` }] };
        }
        const task = (await res.json()) as {
          status: string;
          result?: string;
          prompt: string;
          budget: number;
        };

        if (task.status === "running" || task.status === "pending") {
          return {
            content: [{ type: "text", text: `Task is still running. Check again in a few seconds.` }],
          };
        }

        return {
          content: [
            {
              type: "text",
              text:
                task.status === "completed"
                  ? `Task completed.\n\n${task.result}`
                  : `Task failed: ${task.result}`,
            },
          ],
        };
      }

      case "discover_agents": {
        const res = await fetch(`${BASE_URL}/api/agents`);
        if (!res.ok) {
          return { content: [{ type: "text", text: "Could not reach AgentForge registry." }] };
        }
        const agents = (await res.json()) as Array<{
          id: string;
          name: string;
          description: string;
          category: string;
          price: number;
          paymentType: string;
          totalCalls: number;
          reputationScore: number;
        }>;
        const list = agents
          .map(
            (a) =>
              `• ${a.name} [${a.category}] — ${a.description}\n  Price: $${a.price} USDC via ${a.paymentType.toUpperCase()} | Calls: ${a.totalCalls} | Reputation: ${a.reputationScore}`
          )
          .join("\n\n");
        return {
          content: [
            {
              type: "text",
              text: `Agents on AgentForge ServiceRegistry (Stellar Testnet):\n\n${list || "No agents registered."}`,
            },
          ],
        };
      }

      case "get_payment_chain": {
        const { task_id } = args as { task_id: string };

        const [paymentsRes, taskRes] = await Promise.all([
          fetch(`${BASE_URL}/api/payments/history`),
          fetch(`${BASE_URL}/api/tasks/${task_id}`),
        ]);

        if (!taskRes.ok) {
          return { content: [{ type: "text", text: `Task not found: ${task_id}` }] };
        }

        const task = (await taskRes.json()) as { status: string; prompt: string };
        const payments = paymentsRes.ok
          ? ((await paymentsRes.json()) as Array<{
              toLabel: string;
              fromLabel: string;
              to: string;
              from: string;
              amount: string;
              txHash: string;
              protocol: string;
            }>)
          : [];

        const lines: string[] = [
          `Task: "${task.prompt}"`,
          `Status: ${task.status}`,
          ``,
          `Agent Communication Chain (Stellar Testnet):`,
          ``,
          `1. User → Orchestrator`,
          `   Task submitted. Orchestrator queries ServiceRegistry Soroban contract to discover agents.`,
          ``,
        ];

        let step = 2;
        for (const p of payments.slice(0, 10)) {
          const isA2A = p.fromLabel.toLowerCase().includes("scraper");
          lines.push(`${step}. ${p.fromLabel} → ${p.toLabel}`);
          lines.push(`   Amount: $${p.amount} USDC`);
          lines.push(`   Protocol: ${p.protocol.toUpperCase()}`);
          lines.push(`   From: ${p.from}`);
          lines.push(`   To:   ${p.to}`);
          if (isA2A) lines.push(`   *** Agent-to-agent payment — Scraper paid Summarizer from its own Stellar wallet ***`);
          if (p.txHash && !p.txHash.startsWith("pending-")) {
            lines.push(`   View on Stellar Expert: https://stellar.expert/explorer/testnet/tx/${p.txHash}`);
          } else {
            lines.push(`   Tx hash pending confirmation`);
          }
          lines.push(``);
          step++;
        }

        if (payments.length === 0) {
          lines.push(`No payments recorded yet — task may still be running.`);
        }

        return { content: [{ type: "text", text: lines.join("\n") }] };
      }

      case "check_budget": {
        const res = await fetch(`${BASE_URL}/api/payments/budget`);
        if (!res.ok) {
          return { content: [{ type: "text", text: "Could not reach AgentForge budget endpoint." }] };
        }
        const b = (await res.json()) as {
          dailySpent: number;
          remaining: number;
          dailyLimit: number;
          perTxLimit: number;
        };
        return {
          content: [
            {
              type: "text",
              text: [
                `Budget (reads from Soroban SpendingPolicy on Stellar Testnet):`,
                `- Spent today: $${b.dailySpent?.toFixed(4) ?? "?"} USDC`,
                `- Remaining:   $${b.remaining?.toFixed(4) ?? "?"} USDC`,
                `- Daily limit: $${b.dailyLimit} USDC`,
                `- Per-tx cap:  $${b.perTxLimit} USDC`,
              ].join("\n"),
            },
          ],
        };
      }

      case "register_agent": {
        const { name: agentName, description, endpoint, price, category, agentWallet, paymentType = "x402" } =
          args as {
            name: string;
            description: string;
            endpoint: string;
            price: number;
            category: string;
            agentWallet: string;
            paymentType?: string;
          };

        const res = await fetch(`${BASE_URL}/api/agents/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: agentName, description, endpoint, price, category, agentWallet, paymentType }),
        });

        if (!res.ok) {
          const err = (await res.json()) as { error: string };
          return { content: [{ type: "text", text: `Registration failed: ${err.error}` }] };
        }

        const data = (await res.json()) as { service: { id: string }; message: string };
        return {
          content: [
            {
              type: "text",
              text: [
                `Agent registered on Stellar Testnet.`,
                ``,
                `Name: ${agentName}`,
                `Category: ${category}`,
                `Price: $${price} USDC per call`,
                `Protocol: ${paymentType.toUpperCase()}`,
                `Wallet: ${agentWallet}`,
                `On-chain ID: ${data.service.id}`,
                ``,
                data.message,
              ].join("\n"),
            },
          ],
        };
      }

      default:
        return { content: [{ type: "text", text: `Unknown tool: ${name}` }] };
    }
  } catch (err) {
    return { content: [{ type: "text", text: `Error: ${String(err)}` }] };
  }
});

// ── Start ─────────────────────────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);

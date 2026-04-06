# AgentForge — Server

Express.js backend that powers the AgentForge multi-agent economy. Runs the Orchestrator (Claude AI), hosts the x402-gated and MPP-gated agent endpoints, manages the x402 Facilitator, and interfaces with Soroban smart contracts on Stellar.

## Ports

| Service | Port | Description |
|---|---|---|
| API Server | `4021` | Main Express.js API + WebSocket activity feed |
| x402 Facilitator | `4022` | Verifies and settles x402 Stellar micropayments |

## Running

```bash
# From repo root
npm install

# Development (hot reload)
cd apps/server
npx tsx src/index.ts

# Or via Turborepo from root
npm run dev
```

On startup you will see contract health check output:

```
✓  Soroban RPC reachable
✓  ServiceRegistry: CDQXE54H...
✓  SpendingPolicy:  CAVKJDIF...
[Registry] Registering agents on Soroban ServiceRegistry…
[Registry] Web Scraper Agent registered on-chain → id=0
[Registry] Text Summarizer Agent registered on-chain → id=1
[Registry] Data Analyst Agent registered on-chain → id=2
AgentForge server  →  http://localhost:4021
x402 Facilitator   →  http://localhost:4022
WebSocket feed     →  ws://localhost:4021
Mock mode: OFF (live)
```

## Source Structure

```
src/
├── agents/
│   ├── orchestrator.ts     # Claude AI — decomposes tasks, discovers agents, hires via tool use
│   ├── scraper.ts          # Fetches + extracts web content using Claude Haiku
│   │                       # Also contains scrapeAndSummarize() for agent-to-agent flow
│   ├── summarizer.ts       # Summarizes text using Claude Haiku
│   └── analyst.ts          # Produces structured analysis reports using Claude Haiku
│
├── payments/
│   ├── x402.ts             # x402 paymentMiddleware config (Scraper: $0.001, Analyst: $0.003)
│   ├── x402client.ts       # x402 HTTP client — does the 402 dance + in-memory payment ledger
│   ├── facilitator.ts      # Self-hosted x402 Facilitator server (port 4022)
│   ├── mpp-server.ts       # MPP Charge server middleware — guards Summarizer (uses mppx/express)
│   ├── mpp-client.ts       # MPP Charge client — Platform wallet pays Summarizer ($0.002)
│   └── agent-to-agent.ts   # Scraper wallet pays Summarizer directly — true A2A payment
│
├── routes/
│   ├── tasks.ts            # POST /api/tasks, GET /api/tasks/:id, GET /api/tasks
│   ├── agents.ts           # Agent endpoints — x402/MPP gated
│   └── payments.ts         # GET /api/payments/history, /budget, /balances
│
├── stellar/
│   ├── client.ts           # Stellar SDK setup — Soroban RPC + network passphrase
│   ├── registry.ts         # ServiceRegistry contract interface + in-memory agent list
│   └── policy.ts           # SpendingPolicy contract interface — check + record spend
│
├── websocket/
│   └── activity.ts         # WebSocket broadcast — emits agent events to the frontend
│
└── index.ts                # Entry point — wires everything, startup health checks, rate limiting
```

## Key Flows

### Submitting a task

```
POST /api/tasks { prompt, budget }
  → validate prompt (max 1000 chars) and budget ($0.001–$0.50)
  → create task record (status: running)
  → call executeTask(task) async
      → Claude API with tools: discover_agents, hire_agent,
                               check_remaining_budget, scrape_and_summarize
      → Claude calls discover_agents(category)
          → queryServiceRegistry(category) → getAllServices() → Soroban query_all
      → Claude calls check_remaining_budget
          → Soroban SpendingPolicy.get_remaining(orchestratorKey)
      → Claude calls hire_agent(service_id, task_description, input_data)
          → scraper:    callScraperAgent(url)    — x402 $0.001
          → summarizer: callSummarizerAgent(text) — MPP Charge $0.002
          → analyst:    callAnalystAgent(data)    — x402 $0.003
          → recordSpend() → Soroban SpendingPolicy.check_and_record()
          → incrementCallCount() → Soroban ServiceRegistry.record_call()
      → Claude calls scrape_and_summarize(url)  [optional — agent-to-agent]
          → scrapeUrl(url) → SSRF-validated fetch → Claude Haiku extraction
          → scraperHiresSummarizer(rawText) → Scraper wallet pays Summarizer via MPP
  → task.status = "completed" | "failed"
```

### x402 payment dance (Scraper & Analyst)

```
callScraperAgent(url)
  → fetch(GET /api/agents/scraper)
      → x402 middleware: no PAYMENT-SIGNATURE header → 402 PAYMENT-REQUIRED
  → getPaymentRequiredResponse(headers, body)   ← parse requirements
  → createPaymentPayload(requirements)          ← sign Stellar USDC transfer
  → encodePaymentSignatureHeader(payload)       ← base64 encode
  → fetch(GET /api/agents/scraper, { PAYMENT-SIGNATURE })
      → x402 middleware: calls Facilitator.verify(payload, requirements)
      → Facilitator submits TX to Stellar testnet
      → 200 OK + content + PAYMENT-RESPONSE header
  → recordPayment(protocol: "x402", txHash from PAYMENT-RESPONSE)
```

### MPP Charge payment dance (Summarizer)

```
callSummarizerAgent(text)
  → callSummarizerViaMpp(text)
      → mppClient.fetch(POST /api/agents/summarizer)
          → mppGuard: no credential → 402 WWW-Authenticate (MPP Charge challenge)
      → MPP client signs Soroban auth entry (0.002 USDC → SUMMARIZER_PUBLIC_KEY)
      → mppClient.fetch(POST /api/agents/summarizer, { credential header })
          → mppGuard: submits Soroban USDC transfer TX to Stellar testnet
          → 200 OK + summary + Payment-Receipt header
  → recordPayment(protocol: "mpp", txHash from Payment-Receipt)
```

### Agent-to-agent payment (Scraper → Summarizer)

```
scrapeAndSummarize(url, taskId)
  → scrapeUrl(url)                          ← fetch + Claude Haiku extract
  → scraperHiresSummarizer(rawText)
      → Mppx.create({ secretKey: SCRAPER_SECRET_KEY })  ← Scraper's own wallet
      → client.fetch(POST /api/agents/summarizer)
          → same MPP Charge flow as above
          → but payer = Scraper wallet, not Platform wallet
          → Scraper wallet → Summarizer wallet direct on Stellar
  → emitActivity({ type: "payment_sent", amount: 0.002 })
```

## Payment Gate Summary

| Endpoint | Gate | Price | Protocol | Payer |
|---|---|---|---|---|
| `GET /api/agents/scraper` | x402 middleware | $0.001 USDC | x402 | Platform wallet |
| `POST /api/agents/summarizer` | mppGuard | $0.002 USDC | MPP Charge | Platform or Scraper wallet |
| `POST /api/agents/analyst` | x402 middleware | $0.003 USDC | x402 | Platform wallet |

## Wallet Setup

The project uses **7 Stellar wallets**:

| Wallet | Env var | Role | Needs USDC |
|---|---|---|---|
| Platform | `PLATFORM_*` | Pays agents via x402 and MPP | Yes — pre-fund with testnet USDC |
| Scraper | `SCRAPER_*` | Receives x402 payments; pays Summarizer in A2A flow | Small amount for A2A |
| Summarizer | `SUMMARIZER_*` | Receives MPP Charge payments | No |
| Analyst | `ANALYST_*` | Receives x402 payments | No |
| Facilitator | `FACILITATOR_*` | Settles x402 transactions on Stellar | Small XLM for fees |
| Orchestrator | `ORCHESTRATOR_*` | Signs Soroban contract calls (registry + policy) | Small XLM for fees |
| MPP server | `MPP_SECRET_KEY` | Signs MPP Charge TX submissions | No (can reuse Summarizer key) |

> **Why a separate Platform wallet?** The x402 Facilitator rejects payments from accounts that look like issuers. The Platform wallet holds pre-issued USDC and emits standard `transfer` events that the Facilitator accepts.

### Funding a testnet wallet with USDC

```bash
# 1. Generate a keypair
stellar keys generate platform --network testnet

# 2. Fund with testnet XLM (Friendbot)
curl "https://friendbot.stellar.org?addr=$(stellar keys address platform)"

# 3. Add USDC trustline and get test USDC
# Use the Stellar testnet USDC faucet or swap XLM → USDC on testnet DEX
```

## Rate Limiting

| Limiter | Routes | Limit |
|---|---|---|
| `taskLimiter` | `POST /api/tasks` | 20 requests / minute |
| `testLimiter` | `/test/*` | 10 requests / minute |

## Debug Endpoints

These bypass payment gates and are useful for verifying agent functionality:

```bash
# Test scraper (fetches and extracts stellar.org)
curl "http://localhost:4021/test/scraper?url=https://stellar.org"

# Test summarizer (summarizes the given text)
curl "http://localhost:4021/test/summarizer?text=Stellar+is+a+blockchain+network"

# Test analyst (analyzes hardcoded DeFi TVL data)
curl "http://localhost:4021/test/analyst"

# Health check (shows contract IDs and mock mode)
curl "http://localhost:4021/health"
```

## Mock Mode

Set `MOCK_MODE=true` in `.env` to run without real Claude API calls or Stellar payments. The Orchestrator replays a fixed sequence of agent hire events with 800ms delays. Useful for frontend development or demos without credentials.

---

## Production Deployment (Railway)

The server is deployed at `https://agentforgeserver-production.up.railway.app`.

**Key env vars for production:**

| Variable | Notes |
|---|---|
| `SERVER_URL` | Set to the public Railway URL so agent endpoints are registered on-chain with the correct address. Railway also injects `RAILWAY_PUBLIC_DOMAIN` automatically — `SERVER_URL` takes priority. |
| `FRONTEND_URL` | Set to the Vercel frontend URL to allow CORS from the dashboard. |
| `MOCK_MODE` | Leave unset (or `false`) for live payments. |

**How endpoint URLs are resolved (registry.ts):**
```
SERVER_URL (explicit) → RAILWAY_PUBLIC_DOMAIN (auto-injected) → http://localhost:PORT (fallback)
```

**Registry deduplication:** `getAllServices()` deduplicates on-chain entries by category (keeps the highest-ID entry per category) to handle any duplicates from pre-idempotency registrations. Payment type badges are overridden from the in-memory source of truth to correct any stale on-chain data.

**MPP guard (`mpp-server.ts`):** Uses `mppx/express` — the `Mppx.create({...}).charge({ amount })` call returns an Express `RequestHandler` directly. This is different from `mppx/server` which requires manual conversion to a Node listener.

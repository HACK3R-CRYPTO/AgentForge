# AgentForge — Server

Express.js backend that powers the AgentForge multi-agent economy. Runs the Orchestrator (Claude AI), hosts the x402-gated agent endpoints, manages the x402 Facilitator, and interfaces with Soroban smart contracts on Stellar.

## Ports

| Service | Port | Description |
|---|---|---|
| API Server | `4021` | Main Express.js API + WebSocket feed |
| x402 Facilitator | `4022` | Verifies and settles Stellar micropayments |

## Running

```bash
# From the repo root
npm install

# Development (with hot reload)
cd apps/server
npx tsx src/index.ts

# Or from root via Turborepo
npm run dev
```

## Source Structure

```
src/
├── agents/
│   ├── orchestrator.ts   # Claude AI — decomposes tasks, hires agents via tool use
│   ├── scraper.ts        # Fetches + extracts content from URLs using Claude Haiku
│   ├── summarizer.ts     # Summarizes text using Claude Haiku
│   └── analyst.ts        # Produces structured analysis reports using Claude Haiku
│
├── payments/
│   ├── x402.ts           # x402 paymentMiddleware config (price, asset, payTo per route)
│   ├── x402client.ts     # x402 HTTP client — does the 402 dance + payment ledger
│   ├── facilitator.ts    # Self-hosted x402 Facilitator server (port 4022)
│   └── mpp.ts            # Machine Payment Protocol session manager
│
├── routes/
│   ├── tasks.ts          # POST /api/tasks, GET /api/tasks/:id
│   ├── agents.ts         # GET /api/agents/scraper, POST /api/agents/summarizer, etc.
│   └── payments.ts       # GET /api/payments/history, /budget, /balances
│
├── stellar/
│   ├── client.ts         # Stellar SDK setup — Horizon + Soroban RPC clients
│   ├── registry.ts       # ServiceRegistry contract interface + in-memory agent list
│   └── policy.ts         # SpendingPolicy contract interface — check + record spend
│
├── websocket/
│   └── activity.ts       # WebSocket broadcast — emits agent events to the frontend
│
└── index.ts              # App entry point — wires everything together
```

## Key Flows

### Submitting a task

```
POST /api/tasks { prompt, budget }
  → creates task record (status: running)
  → calls executeTask(task) async
      → Claude API with tools: discover_agents, hire_agent, check_remaining_budget
      → Claude calls discover_agents → queryServiceRegistry(category)
      → Claude calls check_remaining_budget → getSpendingStatus()
      → Claude calls hire_agent → callScraperAgent / callSummarizerAgent / callAnalystAgent
          → x402Fetch(endpoint) → 402 → sign → retry → 200
          → recordPayment() to in-memory ledger
          → incrementCallCount() in registry
          → recordSpend() to Soroban SpendingPolicy
      → returns final result string
  → task.status = completed | failed
```

### x402 payment dance

```
callScraperAgent(url)
  → fetch(GET /api/agents/scraper) → 402
  → getPaymentRequiredResponse(header, body)  ← parses PAYMENT-REQUIRED header
  → createPaymentPayload(requirements)        ← signs Stellar USDC tx
  → encodePaymentSignatureHeader(payload)     ← encodes as PAYMENT-SIGNATURE
  → fetch(GET /api/agents/scraper, { headers: paymentHeader })
      → paymentMiddleware verifies via Facilitator
          → facilitator.verify(payload, requirements)
          → facilitator.settle() → submit TX to Stellar testnet
      → 200 OK + content
```

## Wallet Setup

The project uses **6 Stellar wallets**:

| Wallet | Role | Holds |
|---|---|---|
| Orchestrator | USDC issuer, mints to agents | — |
| Platform | Pays agents via x402 | 500 USDC |
| Scraper | Receives x402 payments | 100 USDC |
| Summarizer | Receives x402 payments | 100 USDC |
| Analyst | Receives x402 payments | 100 USDC |
| Facilitator | Settles x402 transactions | 100 USDC |

> The Platform wallet (not the Orchestrator) signs x402 payments because the Orchestrator is the USDC issuer — issuer accounts emit `mint` events which the x402 facilitator rejects. The Platform wallet holds pre-issued USDC and emits proper `transfer` events.

## Debug Endpoints

These bypass x402 and are useful for testing agent functionality directly:

```bash
# Test scraper
curl "http://localhost:4021/test/scraper?url=https://stellar.org"

# Test summarizer
curl "http://localhost:4021/test/summarizer?text=Stellar+is+a+blockchain"

# Test analyst
curl "http://localhost:4021/test/analyst"
```

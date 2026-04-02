# AgentForge — Product Requirements Document

## Hackathon: Stellar Hacks: Agents (DoraHacks)
**Deadline:** April 13, 2026
**Prize Pool:** $10,000 in XLM
**Team:** HACK3R-CRYPTO
**Repo:** https://github.com/HACK3R-CRYPTO/AgentForge

---

## 1. Executive Summary

**AgentForge** is a multi-agent service economy on Stellar where autonomous AI agents discover, negotiate, and pay each other for services — all settled on-chain via x402 and MPP (Machine Payment Protocol), with Soroban smart contracts enforcing spending policies and service registration.

### One-Liner
> "AI agents that hire, pay, and trust each other — powered by Stellar."

### Why This Wins
- Uses **ALL** sponsor technologies: x402, MPP, Soroban, Stellar, OpenClaw, MCP
- **Multi-agent economy** (not just a single agent or paywall)
- **Nobody in current submissions** combines x402 + MPP + Soroban policies together
- Strong demo narrative with visible on-chain payment trails

---

## 2. Problem Statement

AI agents are becoming autonomous workers — but they can't transact:

1. **No payment rails**: Agents can't pay each other for services without human intervention
2. **No discovery**: Agents can't find specialized services they need
3. **No trust**: No spending limits, no reputation, no guardrails
4. **No interoperability**: Payment protocols are siloed (x402 OR MPP, never both)

**Result:** Every "autonomous agent" still requires a human with a credit card.

---

## 3. Solution

AgentForge creates a complete economic layer for AI agents on Stellar:

### 3.1 Service Registry (Soroban Smart Contract)
- Agents register their capabilities, pricing, and endpoints on-chain
- Other agents query the registry to discover services
- Skills are categorized and searchable

### 3.2 Dual Payment Rails
- **x402 (Coinbase)**: Per-call HTTP 402 payments for one-off API requests
  - Agent calls endpoint → gets 402 → signs Stellar auth entry → pays → gets response
  - Uses `@x402/stellar` with USDC on Stellar testnet
- **MPP (Stripe/Tempo)**: Session-based streaming payments for ongoing work
  - Agent opens payment channel → streams micropayments as work progresses
  - Uses `@stellar/mpp` charge mode with Soroban SAC transfers

### 3.3 Spending Policies (Soroban Smart Contract)
- Daily spending caps (e.g., $0.50/day per agent)
- Per-transaction limits (e.g., max $0.05 per call)
- Allowlisted service addresses
- Enforced on-chain via `__check_auth` pattern

### 3.4 Agent Orchestration
- **Orchestrator Agent**: Receives user tasks, decomposes into subtasks, hires specialists
- **Specialist Agents**: Purpose-built agents (scraper, summarizer, analyst) that perform work and get paid
- Built with Claude API + tool use
- Stellar MCP server for on-chain interactions

### 3.5 Frontend Dashboard
- Real-time view of agent activity and payment flows
- Stellar testnet explorer integration
- Task submission and monitoring

---

## 4. Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (Next.js)                     │
│  ┌──────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │ Task     │  │ Agent        │  │ Payment           │  │
│  │ Submit   │  │ Activity     │  │ Explorer          │  │
│  │ Panel    │  │ Feed         │  │ (Testnet Txns)    │  │
│  └────┬─────┘  └──────┬───────┘  └────────┬──────────┘  │
└───────┼────────────────┼───────────────────┼─────────────┘
        │                │                   │
        ▼                ▼                   ▼
┌─────────────────────────────────────────────────────────┐
│                 Backend (Express.js)                      │
│                                                          │
│  ┌─────────────────────────────────────────────────┐     │
│  │            Orchestrator Agent (Claude API)        │     │
│  │  - Decomposes tasks into subtasks                │     │
│  │  - Discovers services from Soroban registry      │     │
│  │  - Hires specialist agents                       │     │
│  │  - Enforces budget via spending policies         │     │
│  └────────┬──────────────┬──────────────┬───────────┘     │
│           │              │              │                │
│    ┌──────▼──────┐ ┌─────▼──────┐ ┌─────▼───────┐       │
│    │  Scraper    │ │ Summarizer │ │  Analyst    │       │
│    │  Agent      │ │ Agent      │ │  Agent      │       │
│    │             │ │            │ │             │       │
│    │ x402 server │ │ MPP server │ │ x402 server │       │
│    │ $0.001/call │ │ $0.002/sum │ │ $0.003/rpt  │       │
│    └──────┬──────┘ └─────┬──────┘ └─────┬───────┘       │
│           │              │              │                │
└───────────┼──────────────┼──────────────┼────────────────┘
            │              │              │
     ┌──────▼──────────────▼──────────────▼──────┐
     │           Stellar Testnet                  │
     │                                            │
     │  ┌──────────────┐  ┌────────────────────┐  │
     │  │ USDC Token   │  │ Soroban Contracts  │  │
     │  │ (SEP-41)     │  │                    │  │
     │  │              │  │ - ServiceRegistry  │  │
     │  │ Testnet:     │  │ - SpendingPolicy   │  │
     │  │ CBIELTK...   │  │ - AgentWallet      │  │
     │  └──────────────┘  └────────────────────┘  │
     │                                            │
     │  ┌──────────────────────────────────────┐  │
     │  │ x402 Facilitator (self-hosted)       │  │
     │  │ - Verify + settle Stellar payments   │  │
     │  │ - Channel accounts for parallelism   │  │
     │  └──────────────────────────────────────┘  │
     └────────────────────────────────────────────┘
```

---

## 5. Technical Specifications

### 5.1 Soroban Smart Contracts (Rust)

#### ServiceRegistry Contract
```
Functions:
  - register_service(agent_id, name, description, endpoint, price, payment_type)
  - remove_service(agent_id, service_id)
  - query_services(category) -> Vec<Service>
  - get_service(service_id) -> Service

Storage:
  - services: Map<ServiceId, Service>
  - agent_services: Map<AgentId, Vec<ServiceId>>

Types:
  Service {
    id: u64,
    agent_id: Address,
    name: String,
    description: String,
    endpoint: String,
    price: i128,          // in USDC stroops (7 decimals)
    payment_type: enum { X402, MPP },
    category: String,
    reputation_score: u32,
    total_calls: u64,
    registered_at: u64,
  }
```

#### SpendingPolicy Contract
```
Functions:
  - set_daily_limit(agent_id, limit_amount)
  - set_per_tx_limit(agent_id, limit_amount)
  - add_allowlisted_recipient(agent_id, recipient)
  - check_and_record_spend(agent_id, amount, recipient) -> bool
  - get_remaining_budget(agent_id) -> i128

Storage:
  - daily_limits: Map<AgentId, i128>
  - per_tx_limits: Map<AgentId, i128>
  - daily_spent: Map<(AgentId, DayTimestamp), i128>
  - allowlist: Map<AgentId, Vec<Address>>
```

### 5.2 Payment Layer (TypeScript)

#### x402 Server (per-call payments)
```
Package: @x402/stellar v2.9.0, @x402/express v2.9.0
Network: stellar:testnet
Asset: USDC (CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA)
Facilitator: Self-hosted on port 4022
Flow: HTTP 402 → client signs SorobanAuthorizationEntry → facilitator settles
```

#### MPP Server (session payments)
```
Package: @stellar/mpp
Mode: Charge (on-chain per-transfer)
Flow: 402 challenge → client signs Stellar tx → server/client broadcasts → receipt
```

### 5.3 Agent System (TypeScript)

#### Orchestrator Agent
```
Model: Claude (claude-sonnet-4-20250514)
Tools:
  - query_service_registry(category) → discovers available agents
  - hire_agent(service_id, task) → calls agent API with x402/MPP payment
  - check_budget(agent_id) → reads remaining spend from Soroban policy
  - submit_result(task_id, result) → returns final output to user

Behavior:
  1. Receive user task
  2. Query ServiceRegistry for relevant specialists
  3. Check SpendingPolicy for budget availability
  4. Decompose task into subtasks
  5. Call specialist agents (paying via x402 or MPP)
  6. Aggregate results
  7. Return to user
```

#### Specialist Agents
```
Scraper Agent:
  - Endpoint: GET /api/agents/scraper
  - Price: $0.001 per URL (x402)
  - Capability: Fetches and extracts content from web pages

Summarizer Agent:
  - Endpoint: POST /api/agents/summarizer
  - Price: $0.002 per summary (MPP charge)
  - Capability: Summarizes text content using Claude

Analyst Agent:
  - Endpoint: POST /api/agents/analyst
  - Price: $0.003 per report (x402)
  - Capability: Analyzes data and produces structured reports
```

### 5.4 Frontend (Next.js)

```
Pages:
  /                  → Landing page + task submission
  /dashboard         → Agent activity feed + payment explorer
  /agents            → Browse registered agent services
  /agents/[id]       → Individual agent details + stats

Components:
  - TaskSubmitForm    → Natural language task input
  - AgentActivityFeed → Real-time WebSocket feed of agent actions
  - PaymentExplorer   → Stellar testnet transaction viewer
  - ServiceRegistry   → Browse/search agent services
  - BudgetWidget      → Shows spending policy limits + usage
```

---

## 6. Package Dependencies

### Root (Monorepo)
```json
{
  "devDependencies": {
    "turbo": "^2.x"
  }
}
```

### Backend (`/apps/server`)
```json
{
  "dependencies": {
    "express": "^4.21.x",
    "@x402/stellar": "^2.9.0",
    "@x402/express": "^2.9.0",
    "@x402/core": "^2.9.0",
    "@stellar/mpp": "latest",
    "@stellar/stellar-sdk": "^14.6.1",
    "@anthropic-ai/sdk": "latest",
    "mppx": "latest",
    "cors": "^2.8.x",
    "dotenv": "^16.x",
    "ws": "^8.x"
  }
}
```

### Frontend (`/apps/web`)
```json
{
  "dependencies": {
    "next": "^15.x",
    "react": "^19.x",
    "tailwindcss": "^4.x",
    "@stellar/stellar-sdk": "^14.6.1"
  }
}
```

### Contracts (`/packages/contracts`)
```toml
[dependencies]
soroban-sdk = "22.0.0"
```

---

## 7. Project Structure

```
AgentForge/
├── apps/
│   ├── server/                    # Express.js backend
│   │   ├── src/
│   │   │   ├── index.ts           # Server entry point
│   │   │   ├── agents/
│   │   │   │   ├── orchestrator.ts # Main orchestrator agent
│   │   │   │   ├── scraper.ts     # Scraper specialist
│   │   │   │   ├── summarizer.ts  # Summarizer specialist
│   │   │   │   └── analyst.ts     # Analyst specialist
│   │   │   ├── payments/
│   │   │   │   ├── x402.ts        # x402 Stellar setup
│   │   │   │   ├── mpp.ts         # MPP Stellar setup
│   │   │   │   └── facilitator.ts # Self-hosted facilitator
│   │   │   ├── stellar/
│   │   │   │   ├── client.ts      # Stellar SDK client
│   │   │   │   ├── registry.ts    # ServiceRegistry interactions
│   │   │   │   └── policy.ts      # SpendingPolicy interactions
│   │   │   ├── routes/
│   │   │   │   ├── tasks.ts       # Task submission API
│   │   │   │   ├── agents.ts      # Agent service endpoints
│   │   │   │   └── payments.ts    # Payment status API
│   │   │   └── websocket/
│   │   │       └── activity.ts    # Real-time activity feed
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── web/                       # Next.js frontend
│       ├── app/
│       │   ├── page.tsx           # Landing + task submit
│       │   ├── dashboard/
│       │   │   └── page.tsx       # Activity + payments
│       │   └── agents/
│       │       ├── page.tsx       # Service registry browse
│       │       └── [id]/
│       │           └── page.tsx   # Agent detail
│       ├── components/
│       │   ├── TaskSubmitForm.tsx
│       │   ├── AgentActivityFeed.tsx
│       │   ├── PaymentExplorer.tsx
│       │   ├── ServiceRegistry.tsx
│       │   └── BudgetWidget.tsx
│       ├── package.json
│       └── tsconfig.json
│
├── packages/
│   └── contracts/                 # Soroban smart contracts
│       ├── service-registry/
│       │   ├── src/
│       │   │   └── lib.rs
│       │   └── Cargo.toml
│       ├── spending-policy/
│       │   ├── src/
│       │   │   └── lib.rs
│       │   └── Cargo.toml
│       └── Cargo.toml
│
├── PRD.md                         # This document
├── turbo.json
├── package.json
└── .env.example
```

---

## 8. Environment Variables

```env
# Stellar
STELLAR_NETWORK=testnet
STELLAR_RPC_URL=https://soroban-testnet.stellar.org
STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org
STELLAR_NETWORK_PASSPHRASE=Test SDF Network ; September 2015

# Agent Wallets (Stellar keypairs)
ORCHESTRATOR_SECRET_KEY=S...
SCRAPER_SECRET_KEY=S...
SUMMARIZER_SECRET_KEY=S...
ANALYST_SECRET_KEY=S...

# Facilitator
FACILITATOR_SECRET_KEY=S...
FACILITATOR_PORT=4022

# Contracts (deployed addresses)
SERVICE_REGISTRY_CONTRACT_ID=C...
SPENDING_POLICY_CONTRACT_ID=C...

# USDC on Testnet
USDC_CONTRACT_ID=CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA

# Claude API
ANTHROPIC_API_KEY=sk-ant-...

# App
PORT=4021
FRONTEND_URL=http://localhost:3000
```

---

## 9. Development Timeline

| Days | Milestone | Deliverables |
|------|-----------|-------------|
| **1-3** | Smart Contracts | ServiceRegistry + SpendingPolicy contracts written, tested, deployed to testnet |
| **3-5** | Payment Layer | x402 facilitator running, x402 middleware on agent endpoints, MPP charge mode working |
| **5-8** | Agent System | Orchestrator + 3 specialists functional, end-to-end task flow working |
| **8-9** | Frontend | Dashboard with activity feed, payment explorer, task submission |
| **9-10** | Polish + Demo | Bug fixes, demo video (2:45), README, submission on DoraHacks |

---

## 10. Demo Script (2:45 video)

### Scene 1: Hook (0:00 - 0:10)
> "What if AI agents could hire and pay each other? Meet AgentForge — a multi-agent economy on Stellar."

### Scene 2: Problem (0:10 - 0:30)
> "Today's AI agents hit a wall at payments. They can think, plan, and execute — but they can't transact. No discovery, no budgets, no trust."

### Scene 3: Live Demo (0:30 - 2:00)
1. User types: "Research and analyze the top 5 Stellar ecosystem developments this week"
2. Show orchestrator decomposing the task in real-time
3. Show scraper agent getting hired — x402 payment visible on dashboard
4. Show summarizer agent streaming results — MPP payment channel active
5. Show analyst agent producing final report — x402 payment settles
6. Show Stellar testnet explorer with all payment transactions
7. Show spending policy widget: "$0.042 of $0.50 daily budget used"

### Scene 4: Tech (2:00 - 2:30)
> "Built on x402 for per-call payments, Stripe MPP for streaming sessions, and Soroban smart contracts for spending policies and service registration — all settling on Stellar in under 5 seconds."

### Scene 5: Close (2:30 - 2:45)
> "Agent economies need rails. Stellar has them. AgentForge — by HACK3R-CRYPTO."

---

## 11. Judging Criteria Alignment

| Criteria | How We Score |
|----------|-------------|
| **Code Quality** | TypeScript + Rust, monorepo with Turborepo, typed everything |
| **Technical Complexity** | x402 + MPP + Soroban + multi-agent orchestration |
| **Innovative Use Case** | First project combining all payment protocols in one agent economy |
| **Working Prototype** | End-to-end: task in → agents work → payments settle → result out |
| **Feature Completeness** | Registry, policies, payments, orchestration, dashboard |
| **Documentation** | PRD, README, inline comments, API docs |
| **Interface Design** | Clean Next.js dashboard with real-time feeds |
| **User Flow** | Submit task → watch agents work → see payments → get results |
| **Problem-Solution Fit** | Solves the "agents can't transact" problem directly |
| **Market Viability** | Agent economy infrastructure is a real emerging market |
| **Demo Quality** | Scripted 2:45 video with live on-chain transactions |

---

## 12. Risks and Mitigations

| Risk | Mitigation |
|------|-----------|
| x402 Stellar SDK issues | Fall back to direct Soroban token transfers |
| MPP Stellar SDK not mature | Use MPP charge mode (simpler) or fall back to x402 for all payments |
| Soroban deployment issues | Use Stellar CLI + testnet faucet, contracts are simple |
| Claude API rate limits | Cache agent responses, batch requests |
| Time constraint (10 days) | Prioritize working demo over features; cut frontend polish first |
| Testnet USDC availability | Use Stellar testnet faucet + wrap native XLM as fallback |

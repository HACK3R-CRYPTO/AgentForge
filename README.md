# AgentForge

**Multi-Agent Service Economy on Stellar** — AI agents that discover, negotiate, and pay each other via x402 + MPP + Soroban.

Built for [Stellar Hacks: Agents](https://dorahacks.io/hackathon/stellar-agents-x402-stripe-mpp/detail) hackathon by HACK3R-CRYPTO.

## What is AgentForge?

AgentForge creates an autonomous economic layer where AI agents can:
- **Register** their services on-chain (Soroban ServiceRegistry)
- **Discover** other agents' capabilities
- **Pay** each other per-call (x402) or per-session (MPP) in USDC on Stellar
- **Operate** within programmable spending policies (Soroban SpendingPolicy)

## Architecture

```
User Task → Orchestrator Agent → discovers specialists from Soroban registry
                                → hires Scraper (x402 payment)
                                → hires Summarizer (MPP payment)
                                → hires Analyst (x402 payment)
                                → all within Soroban spending policy
                                → returns aggregated result
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Agents** | Claude API + tool use |
| **Payments** | x402 (`@x402/stellar`) + MPP (`@stellar/mpp`) |
| **Smart Contracts** | Soroban (Rust) |
| **Server** | Express.js + TypeScript |
| **Frontend** | Next.js + Tailwind CSS |
| **Blockchain** | Stellar Testnet |

## Project Structure

```
├── apps/
│   ├── server/          # Express.js backend + agent system
│   └── web/             # Next.js dashboard
├── packages/
│   └── contracts/       # Soroban smart contracts
│       ├── service-registry/
│       └── spending-policy/
├── PRD.md               # Product Requirements Document
└── turbo.json           # Monorepo config
```

## Getting Started

### Prerequisites
- Node.js 20+
- Rust + `wasm32-unknown-unknown` target
- Stellar CLI (`stellar`)

### Setup

```bash
# Install dependencies
npm install

# Copy env
cp .env.example .env
# Fill in your keys

# Build contracts
cd packages/contracts
cargo build --release --target wasm32-unknown-unknown

# Run dev
npm run dev
```

## Smart Contracts

### ServiceRegistry
Agents register capabilities, pricing, and endpoints on-chain. Other agents query the registry to discover services.

### SpendingPolicy
Enforces daily spending caps, per-transaction limits, and recipient allowlists. Prevents runaway agent spending.

## Payment Flows

### x402 (Per-Call)
```
Agent A → HTTP request → Agent B returns 402
Agent A → signs Stellar auth → sends payment header
Facilitator → verifies + settles on Stellar
Agent B → delivers response
```

### MPP (Session)
```
Agent A → opens payment channel
Agent A → streams micropayments as work progresses
Channel → settles on Stellar at close
```

## License

MIT

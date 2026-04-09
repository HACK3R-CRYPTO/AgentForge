# AgentForge — Soroban Smart Contracts

Two Rust smart contracts deployed on Stellar Testnet that power the on-chain layer of AgentForge. They handle agent service discovery and autonomous spending enforcement — no centralized database, no admin control.

## Deployed Addresses (Stellar Testnet)

| Contract | Address | Explorer |
|---|---|---|
| ServiceRegistry | `CDGFQXDBOICCZJUFULRABA5T4G3TRGF3CBRDW5HTJM7MF7CWKVLT6CV2` | [View ↗](https://stellar.expert/explorer/testnet/contract/CDGFQXDBOICCZJUFULRABA5T4G3TRGF3CBRDW5HTJM7MF7CWKVLT6CV2) |
| SpendingPolicy | `CAVKJDIF5CWDRTRGQCVETSRFDSMDNSHPAVI6UE342G76ZK3JST2TKDAE` | [View ↗](https://stellar.expert/explorer/testnet/contract/CAVKJDIF5CWDRTRGQCVETSRFDSMDNSHPAVI6UE342G76ZK3JST2TKDAE) |

---

## Contracts

### ServiceRegistry (`service-registry/`)

An on-chain marketplace for agent services. Any developer can register an agent and immediately start receiving USDC micropayments — no platform approval, no revenue share.

**Storage:** Each service is stored by auto-incrementing numeric ID with fields: agent address, name, description, endpoint, price (in stroops, 7 decimal places), payment type (0=x402, 1=MPP), category, reputation score, total calls.

**How AgentForge uses it:**
- On **server startup**, the Orchestrator calls `register` once per agent — idempotent: queries `query_all` first and skips categories that are already registered
- When Claude calls the `discover_agents` tool, the backend calls `query_all` via Soroban simulation (read-only, no fee)
- After each successful hire, the backend fire-and-forgets `record_call` to increment the on-chain counter
- The backend deduplicates `query_all` results by category (keeping the highest-ID entry) to handle any pre-idempotency duplicates already on-chain

**Interface:**

```rust
// Register a new agent service — returns the assigned service ID
fn register(
    env: Env,
    agent: Address,
    name: String,
    description: String,
    endpoint: String,
    price: i128,          // in stroops (1 USDC = 10_000_000 stroops)
    payment_type: u32,    // 0 = x402, 1 = MPP Charge
    category: String,
) -> u64

// Return all registered services
fn query_all(env: Env) -> Vec<Service>

// Increment the call counter for a service after each hire
fn record_call(env: Env, service_id: u64)
```

**Service struct:**

```rust
pub struct Service {
    pub id: u64,
    pub agent: Address,
    pub name: String,
    pub description: String,
    pub endpoint: String,
    pub price: i128,
    pub payment_type: u32,   // 0 = x402, 1 = MPP
    pub category: String,
    pub reputation: u32,
    pub total_calls: u64,
}
```

---

### SpendingPolicy (`spending-policy/`)

Enforces programmable spending limits for the Orchestrator. Prevents agents from exceeding their daily budget or making oversized individual payments. All limits are enforced on-chain — the contract is the single source of truth.

**Storage:** `DailyLimit`, `PerTxLimit`, daily spend per caller address, last reset timestamp.

**How AgentForge uses it:**
- The backend calls `check_and_record` (fire-and-forget) after every successful agent payment
- When Claude calls the `check_remaining_budget` tool, the backend simulates `get_remaining` with no TX fee
- Daily limits reset automatically based on on-chain timestamp — no cron job needed

**Interface:**

```rust
// Initialize the contract with spending limits
fn initialize(
    env: Env,
    admin: Address,
    daily_limit: i128,    // max USDC per day (in stroops)
    per_tx_limit: i128,   // max USDC per single payment (in stroops)
)

// Record a spend — fails if it would exceed daily_limit or per_tx_limit
fn check_and_record(
    env: Env,
    caller: Address,
    amount: i128,
    recipient: Address,
) -> bool

// Return remaining budget for caller today (in stroops)
fn get_remaining(env: Env, caller: Address) -> i128
```

**Defaults used by AgentForge:**

| Limit | Value |
|---|---|
| Daily limit | $0.50 USDC |
| Per-TX limit | $0.05 USDC |

---

## Building

```bash
cd packages/contracts

# Install Soroban/Rust toolchain (once)
rustup target add wasm32-unknown-unknown
cargo install --locked stellar-cli

# Build ServiceRegistry
cd service-registry
cargo build --release --target wasm32-unknown-unknown

# Build SpendingPolicy
cd ../spending-policy
cargo build --release --target wasm32-unknown-unknown
```

Compiled WASM files output to `target/wasm32-unknown-unknown/release/`.

---

## Deploying to Testnet

```bash
# Deploy ServiceRegistry
stellar contract deploy \
  --wasm service-registry/target/wasm32-unknown-unknown/release/service_registry.wasm \
  --source <your-keypair-alias> \
  --network testnet

# Deploy SpendingPolicy
stellar contract deploy \
  --wasm spending-policy/target/wasm32-unknown-unknown/release/spending_policy.wasm \
  --source <your-keypair-alias> \
  --network testnet
```

After deployment, copy the contract addresses into your `.env`:

```env
SERVICE_REGISTRY_CONTRACT_ID=C...
SPENDING_POLICY_CONTRACT_ID=C...
```

---

## Verifying On-Chain

Both contracts are readable on Stellar Expert without any tooling:

```bash
# Simulate query_all on ServiceRegistry (read-only, no fee)
stellar contract invoke \
  --id CDGFQXDBOICCZJUFULRABA5T4G3TRGF3CBRDW5HTJM7MF7CWKVLT6CV2 \
  --network testnet \
  --source <any-key> \
  -- query_all

# Check remaining budget for orchestrator
stellar contract invoke \
  --id CAVKJDIF5CWDRTRGQCVETSRFDSMDNSHPAVI6UE342G76ZK3JST2TKDAE \
  --network testnet \
  --source <any-key> \
  -- get_remaining \
  --caller <ORCHESTRATOR_PUBLIC_KEY>
```

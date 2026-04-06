# AgentForge — Soroban Smart Contracts

Two Rust smart contracts deployed on Stellar Testnet that power the on-chain layer of AgentForge.

## Deployed Addresses (Stellar Testnet)

| Contract | Address |
|---|---|
| ServiceRegistry | `CDQXE54HXAIB7SPAWR7MMJAJT6JBMKFDDLOITBVRXXTME7UHO43PLRH3` |
| SpendingPolicy | `CAVKJDIF5CWDRTRGQCVETSRFDSMDNSHPAVI6UE342G76ZK3JST2TKDAE` |

## Contracts

### ServiceRegistry (`service-registry/`)

An on-chain marketplace for agent services. Any developer can register an agent and immediately start receiving USDC micropayments — no platform approval, no revenue share.

**Storage:** Each service is stored by numeric ID with fields: name, description, endpoint, price (in stroops), payment type, category, reputation score, total calls.

**Interface:**

```rust
fn register_service(env, name, description, endpoint, price, payment_type, category) -> u32
fn query_services(env, category) -> Vec<Service>
fn get_service(env, service_id) -> Option<Service>
fn update_reputation(env, service_id, score)
fn get_all_services(env) -> Vec<Service>
```

### SpendingPolicy (`spending-policy/`)

Enforces programmable spending limits for the Orchestrator. Prevents agents from exceeding their daily budget or making oversized individual payments.

**Storage:** `DailyLimit`, `PerTxLimit`, `DailySpent`, `LastResetTime`.

**Interface:**

```rust
fn initialize(env, admin, daily_limit, per_tx_limit)
fn check_and_record_spend(env, caller, amount) -> bool
fn get_status(env) -> PolicyStatus
fn reset_daily(env)
fn update_limits(env, admin, daily_limit, per_tx_limit)
```

## Building

```bash
cd packages/contracts

# Install Soroban toolchain
rustup target add wasm32-unknown-unknown

# Build service-registry
cd service-registry
cargo build --release --target wasm32-unknown-unknown

# Build spending-policy
cd ../spending-policy
cargo build --release --target wasm32-unknown-unknown
```

## Deploying to Testnet

```bash
# Deploy ServiceRegistry
stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/service_registry.wasm \
  --source <your-keypair-alias> \
  --network testnet

# Deploy SpendingPolicy
stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/spending_policy.wasm \
  --source <your-keypair-alias> \
  --network testnet
```

After deployment, update `SERVICE_REGISTRY_CONTRACT_ID` and `SPENDING_POLICY_CONTRACT_ID` in your `.env` file.

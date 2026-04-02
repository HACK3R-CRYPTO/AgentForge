#![no_std]

use soroban_sdk::{contract, contractimpl, contracttype, symbol_short, Address, Env, Vec};

#[contracttype]
pub enum PolicyKey {
    DailyLimit(Address),
    PerTxLimit(Address),
    DailySpent(Address, u64), // (agent, day_timestamp)
    Allowlist(Address),
    Admin,
}

#[contract]
pub struct SpendingPolicyContract;

#[contractimpl]
impl SpendingPolicyContract {
    /// Initialize with admin
    pub fn init(env: Env, admin: Address) {
        admin.require_auth();
        env.storage().instance().set(&PolicyKey::Admin, &admin);
    }

    /// Set daily spending limit for an agent (in USDC stroops)
    pub fn set_daily_limit(env: Env, admin: Address, agent: Address, limit: i128) {
        admin.require_auth();
        Self::require_admin(&env, &admin);
        env.storage()
            .persistent()
            .set(&PolicyKey::DailyLimit(agent), &limit);
    }

    /// Set per-transaction limit for an agent
    pub fn set_per_tx_limit(env: Env, admin: Address, agent: Address, limit: i128) {
        admin.require_auth();
        Self::require_admin(&env, &admin);
        env.storage()
            .persistent()
            .set(&PolicyKey::PerTxLimit(agent), &limit);
    }

    /// Add address to agent's allowlist
    pub fn add_allowlisted(env: Env, admin: Address, agent: Address, recipient: Address) {
        admin.require_auth();
        Self::require_admin(&env, &admin);

        let mut allowlist: Vec<Address> = env
            .storage()
            .persistent()
            .get(&PolicyKey::Allowlist(agent.clone()))
            .unwrap_or(Vec::new(&env));

        allowlist.push_back(recipient);
        env.storage()
            .persistent()
            .set(&PolicyKey::Allowlist(agent), &allowlist);
    }

    /// Check if a spend is allowed and record it
    /// Returns true if allowed, panics if not
    pub fn check_and_record(
        env: Env,
        agent: Address,
        amount: i128,
        recipient: Address,
    ) -> bool {
        agent.require_auth();

        let day = Self::current_day(&env);

        // Check per-tx limit
        let per_tx_limit: i128 = env
            .storage()
            .persistent()
            .get(&PolicyKey::PerTxLimit(agent.clone()))
            .unwrap_or(500_000_i128); // Default $0.05

        assert!(amount <= per_tx_limit, "exceeds per-transaction limit");

        // Check daily limit
        let daily_limit: i128 = env
            .storage()
            .persistent()
            .get(&PolicyKey::DailyLimit(agent.clone()))
            .unwrap_or(5_000_000_i128); // Default $0.50

        let daily_spent: i128 = env
            .storage()
            .persistent()
            .get(&PolicyKey::DailySpent(agent.clone(), day))
            .unwrap_or(0);

        assert!(
            daily_spent + amount <= daily_limit,
            "exceeds daily spending limit"
        );

        // Check allowlist (if configured)
        if let Some(allowlist) = env
            .storage()
            .persistent()
            .get::<PolicyKey, Vec<Address>>(&PolicyKey::Allowlist(agent.clone()))
        {
            if allowlist.len() > 0 {
                let mut found = false;
                for addr in allowlist.iter() {
                    if addr == recipient {
                        found = true;
                        break;
                    }
                }
                assert!(found, "recipient not in allowlist");
            }
        }

        // Record spend
        env.storage()
            .persistent()
            .set(&PolicyKey::DailySpent(agent.clone(), day), &(daily_spent + amount));

        env.events()
            .publish((symbol_short!("spend"),), amount);

        true
    }

    /// Get remaining budget for an agent today
    pub fn get_remaining(env: Env, agent: Address) -> i128 {
        let day = Self::current_day(&env);

        let daily_limit: i128 = env
            .storage()
            .persistent()
            .get(&PolicyKey::DailyLimit(agent.clone()))
            .unwrap_or(5_000_000_i128);

        let daily_spent: i128 = env
            .storage()
            .persistent()
            .get(&PolicyKey::DailySpent(agent, day))
            .unwrap_or(0);

        daily_limit - daily_spent
    }

    // --- Internal helpers ---

    fn require_admin(env: &Env, caller: &Address) {
        let admin: Address = env
            .storage()
            .instance()
            .get(&PolicyKey::Admin)
            .expect("not initialized");
        assert!(*caller == admin, "not admin");
    }

    fn current_day(env: &Env) -> u64 {
        // Ledger timestamp in seconds, divide by 86400 for day
        env.ledger().timestamp() / 86400
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::testutils::{Address as _, Ledger};
    use soroban_sdk::Env;

    #[test]
    fn test_spending_policy() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register(SpendingPolicyContract, ());
        let client = SpendingPolicyContractClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let agent = Address::generate(&env);
        let recipient = Address::generate(&env);

        // Initialize
        client.init(&admin);

        // Set limits
        client.set_daily_limit(&admin, &agent, &5_000_000_i128); // $0.50
        client.set_per_tx_limit(&admin, &agent, &500_000_i128); // $0.05

        // Set ledger timestamp
        env.ledger().with_mut(|li| {
            li.timestamp = 1_000_000;
        });

        // Check spend
        let ok = client.check_and_record(&agent, &10_000_i128, &recipient);
        assert!(ok);

        // Check remaining
        let remaining = client.get_remaining(&agent);
        assert_eq!(remaining, 5_000_000_i128 - 10_000_i128);
    }

    #[test]
    #[should_panic(expected = "exceeds per-transaction limit")]
    fn test_per_tx_limit() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register(SpendingPolicyContract, ());
        let client = SpendingPolicyContractClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let agent = Address::generate(&env);
        let recipient = Address::generate(&env);

        client.init(&admin);
        client.set_per_tx_limit(&admin, &agent, &100_i128);

        env.ledger().with_mut(|li| {
            li.timestamp = 1_000_000;
        });

        // This should panic
        client.check_and_record(&agent, &200_i128, &recipient);
    }
}

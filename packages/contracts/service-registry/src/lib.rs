#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, Address, Env, Map, String, Vec,
};

#[contracttype]
#[derive(Clone, Debug)]
pub struct Service {
    pub id: u64,
    pub agent_id: Address,
    pub name: String,
    pub description: String,
    pub endpoint: String,
    pub price: i128,         // in USDC stroops (7 decimals)
    pub payment_type: u32,   // 0 = x402, 1 = MPP
    pub category: String,
    pub reputation: u32,
    pub total_calls: u64,
}

#[contracttype]
pub enum DataKey {
    NextId,
    Service(u64),
    AgentServices(Address),
    AllServiceIds,
}

#[contract]
pub struct ServiceRegistryContract;

#[contractimpl]
impl ServiceRegistryContract {
    /// Register a new service on the marketplace
    pub fn register(
        env: Env,
        agent_id: Address,
        name: String,
        description: String,
        endpoint: String,
        price: i128,
        payment_type: u32,
        category: String,
    ) -> u64 {
        agent_id.require_auth();

        // Get next ID
        let id: u64 = env
            .storage()
            .instance()
            .get(&DataKey::NextId)
            .unwrap_or(0);

        let service = Service {
            id,
            agent_id: agent_id.clone(),
            name,
            description,
            endpoint,
            price,
            payment_type,
            category,
            reputation: 100,
            total_calls: 0,
        };

        // Store service
        env.storage()
            .persistent()
            .set(&DataKey::Service(id), &service);

        // Add to agent's service list
        let mut agent_services: Vec<u64> = env
            .storage()
            .persistent()
            .get(&DataKey::AgentServices(agent_id.clone()))
            .unwrap_or(Vec::new(&env));
        agent_services.push_back(id);
        env.storage()
            .persistent()
            .set(&DataKey::AgentServices(agent_id), &agent_services);

        // Add to all services list
        let mut all_ids: Vec<u64> = env
            .storage()
            .persistent()
            .get(&DataKey::AllServiceIds)
            .unwrap_or(Vec::new(&env));
        all_ids.push_back(id);
        env.storage()
            .persistent()
            .set(&DataKey::AllServiceIds, &all_ids);

        // Increment ID counter
        env.storage()
            .instance()
            .set(&DataKey::NextId, &(id + 1));

        env.events()
            .publish((symbol_short!("register"),), id);

        id
    }

    /// Remove a service
    pub fn remove(env: Env, agent_id: Address, service_id: u64) {
        agent_id.require_auth();

        let service: Service = env
            .storage()
            .persistent()
            .get(&DataKey::Service(service_id))
            .expect("service not found");

        assert!(
            service.agent_id == agent_id,
            "only the agent owner can remove"
        );

        env.storage()
            .persistent()
            .remove(&DataKey::Service(service_id));
    }

    /// Get a specific service
    pub fn get_service(env: Env, service_id: u64) -> Service {
        env.storage()
            .persistent()
            .get(&DataKey::Service(service_id))
            .expect("service not found")
    }

    /// Query all services (returns all registered services)
    pub fn query_all(env: Env) -> Vec<Service> {
        let all_ids: Vec<u64> = env
            .storage()
            .persistent()
            .get(&DataKey::AllServiceIds)
            .unwrap_or(Vec::new(&env));

        let mut result = Vec::new(&env);
        for id in all_ids.iter() {
            if let Some(service) = env
                .storage()
                .persistent()
                .get::<DataKey, Service>(&DataKey::Service(id))
            {
                result.push_back(service);
            }
        }
        result
    }

    /// Record a service call (increments total_calls)
    pub fn record_call(env: Env, service_id: u64) {
        let mut service: Service = env
            .storage()
            .persistent()
            .get(&DataKey::Service(service_id))
            .expect("service not found");

        service.total_calls += 1;

        env.storage()
            .persistent()
            .set(&DataKey::Service(service_id), &service);

        env.events()
            .publish((symbol_short!("call"),), service_id);
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::testutils::Address as _;
    use soroban_sdk::Env;

    #[test]
    fn test_register_and_query() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register(ServiceRegistryContract, ());
        let client = ServiceRegistryContractClient::new(&env, &contract_id);

        let agent = Address::generate(&env);
        let name = String::from_str(&env, "Scraper Agent");
        let desc = String::from_str(&env, "Web scraping service");
        let endpoint = String::from_str(&env, "http://localhost:4021/api/agents/scraper");
        let category = String::from_str(&env, "scraper");

        let id = client.register(
            &agent,
            &name,
            &desc,
            &endpoint,
            &10000_i128, // $0.001 in 7-decimal stroops
            &0_u32,      // x402
            &category,
        );

        assert_eq!(id, 0);

        let service = client.get_service(&0);
        assert_eq!(service.name, name);
        assert_eq!(service.price, 10000_i128);
        assert_eq!(service.total_calls, 0);

        let all = client.query_all();
        assert_eq!(all.len(), 1);
    }
}

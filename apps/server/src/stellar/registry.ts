// ServiceRegistry - Soroban contract interactions
// Reads/writes to the on-chain agent service registry

import * as StellarSdk from "@stellar/stellar-sdk";
import { sorobanRpc, networkPassphrase } from "./client.js";

export interface AgentService {
  id: string;
  agentId: string;
  name: string;
  description: string;
  endpoint: string;
  price: number;
  paymentType: "x402" | "mpp";
  category: string;
  reputationScore: number;
  totalCalls: number;
}

// In-memory registry for MVP (will be replaced with Soroban contract calls)
const services: AgentService[] = [
  {
    id: "scraper-001",
    agentId: "orchestrator",
    name: "Web Scraper Agent",
    description: "Fetches and extracts content from web pages",
    endpoint: "http://localhost:4021/api/agents/scraper",
    price: 0.001,
    paymentType: "x402",
    category: "scraper",
    reputationScore: 100,
    totalCalls: 0,
  },
  {
    id: "summarizer-001",
    agentId: "orchestrator",
    name: "Text Summarizer Agent",
    description: "Summarizes text content using AI",
    endpoint: "http://localhost:4021/api/agents/summarizer",
    price: 0.002,
    paymentType: "mpp",
    category: "summarizer",
    reputationScore: 100,
    totalCalls: 0,
  },
  {
    id: "analyst-001",
    agentId: "orchestrator",
    name: "Data Analyst Agent",
    description: "Analyzes data and produces structured reports",
    endpoint: "http://localhost:4021/api/agents/analyst",
    price: 0.003,
    paymentType: "x402",
    category: "analyst",
    reputationScore: 100,
    totalCalls: 0,
  },
];

export async function queryServiceRegistry(
  category: string
): Promise<AgentService[]> {
  // TODO: Replace with actual Soroban contract call
  // const contract = new StellarSdk.Contract(process.env.SERVICE_REGISTRY_CONTRACT_ID!);
  // const tx = contract.call("query_services", StellarSdk.xdr.ScVal.scvString(category));
  // const result = await sorobanRpc.simulateTransaction(tx);

  return services.filter((s) => s.category === category);
}

export async function registerService(
  service: Omit<AgentService, "id" | "reputationScore" | "totalCalls">
): Promise<AgentService> {
  const newService: AgentService = {
    ...service,
    id: `${service.category}-${Date.now()}`,
    reputationScore: 100,
    totalCalls: 0,
  };
  services.push(newService);
  return newService;
}

export async function getAllServices(): Promise<AgentService[]> {
  return services;
}

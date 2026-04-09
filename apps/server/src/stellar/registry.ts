// ServiceRegistry — Soroban contract interactions
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

// In-memory registry — authoritative source for call counts and initial data.
// On-chain contract is the source of truth for registration and reputation.

// Resolve the public base URL: Railway injects RAILWAY_PUBLIC_DOMAIN; fall back to SERVER_URL or localhost.
function getServerBaseUrl(): string {
  if (process.env.SERVER_URL) return process.env.SERVER_URL.replace(/\/$/, "");
  if (process.env.RAILWAY_PUBLIC_DOMAIN) return `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
  return `http://localhost:${process.env.PORT || 4021}`;
}

const services: AgentService[] = [
  {
    id: "scraper-001",
    agentId: "orchestrator",
    name: "Web Scraper Agent",
    description: "Fetches and extracts content from web pages",
    endpoint: `${getServerBaseUrl()}/api/agents/scraper`,
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
    endpoint: `${getServerBaseUrl()}/api/agents/summarizer`,
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
    endpoint: `${getServerBaseUrl()}/api/agents/analyst`,
    price: 0.003,
    paymentType: "x402",
    category: "analyst",
    reputationScore: 100,
    totalCalls: 0,
  },
];

// On-chain service IDs assigned after registration (contract auto-increments from 0)
const onChainIds: Record<string, bigint> = {};

// ─── Soroban TX queue — serializes all writes to avoid sequence number conflicts ──

let _txQueue: Promise<unknown> = Promise.resolve();

function enqueueContractTx(
  method: string,
  args: StellarSdk.xdr.ScVal[],
  secretKey: string
): Promise<StellarSdk.xdr.ScVal | null> {
  const result = _txQueue.then(() => submitContractTx(method, args, secretKey));
  // Keep queue alive even if this TX fails
  _txQueue = result.catch(() => {});
  return result;
}

// ─── Soroban helpers ──────────────────────────────────────────────────────────

async function submitContractTx(
  method: string,
  args: StellarSdk.xdr.ScVal[],
  secretKey: string
): Promise<StellarSdk.xdr.ScVal | null> {
  const contractId = process.env.SERVICE_REGISTRY_CONTRACT_ID;
  if (!contractId || !secretKey) return null;

  try {
    const keypair = StellarSdk.Keypair.fromSecret(secretKey);
    const account = await sorobanRpc.getAccount(keypair.publicKey());
    const contract = new StellarSdk.Contract(contractId);

    const tx = new StellarSdk.TransactionBuilder(account, {
      fee: "1000000",
      networkPassphrase,
    })
      .addOperation(contract.call(method, ...args))
      .setTimeout(30)
      .build();

    const prepared = await sorobanRpc.prepareTransaction(tx);
    (prepared as StellarSdk.Transaction).sign(keypair);

    const send = await sorobanRpc.sendTransaction(prepared as StellarSdk.Transaction);
    if (send.status === "ERROR") {
      console.warn(`[Registry] ${method} TX rejected`);
      return null;
    }

    // Poll for ledger confirmation
    for (let i = 0; i < 15; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      const result = await sorobanRpc.getTransaction(send.hash);
      if (result.status === "SUCCESS") {
        return (result as unknown as { returnValue?: StellarSdk.xdr.ScVal }).returnValue ?? null;
      }
      if (result.status === "FAILED") {
        console.warn(`[Registry] ${method} TX failed on-chain`);
        return null;
      }
    }
  } catch (err) {
    console.warn(`[Registry] ${method} error:`, String(err).slice(0, 120));
  }
  return null;
}

async function simulateRead(
  method: string,
  args: StellarSdk.xdr.ScVal[] = []
): Promise<StellarSdk.xdr.ScVal | null> {
  const contractId = process.env.SERVICE_REGISTRY_CONTRACT_ID;
  const publicKey = process.env.ORCHESTRATOR_PUBLIC_KEY;
  if (!contractId || !publicKey) return null;

  try {
    const account = new StellarSdk.Account(publicKey, "0");
    const contract = new StellarSdk.Contract(contractId);

    const tx = new StellarSdk.TransactionBuilder(account, {
      fee: "100",
      networkPassphrase,
    })
      .addOperation(contract.call(method, ...args))
      .setTimeout(30)
      .build();

    const sim = await sorobanRpc.simulateTransaction(tx);
    if (!StellarSdk.rpc.Api.isSimulationSuccess(sim)) return null;
    return sim.result?.retval ?? null;
  } catch {
    return null;
  }
}

// Map Soroban native struct → AgentService
function parseContractService(raw: Record<string, unknown>): AgentService {
  const price = typeof raw.price === "bigint" ? raw.price : BigInt(String(raw.price ?? 0));
  return {
    id: String(raw.id ?? "0"),
    agentId: String(raw.agent_id ?? ""),
    name: String(raw.name ?? ""),
    description: String(raw.description ?? ""),
    endpoint: String(raw.endpoint ?? ""),
    price: Number(price) / 10_000_000,
    paymentType: (raw.payment_type === 0 || raw.payment_type === 0n) ? "x402" : "mpp",
    category: String(raw.category ?? ""),
    reputationScore: Number(raw.reputation ?? 100),
    totalCalls: Number(raw.total_calls ?? 0),
  };
}

// ─── Startup: register agents on-chain ───────────────────────────────────────

export async function initRegistry(): Promise<void> {
  const secretKey = process.env.ORCHESTRATOR_SECRET_KEY;
  const contractId = process.env.SERVICE_REGISTRY_CONTRACT_ID;
  if (!secretKey || !contractId) {
    console.log("[Registry] No contract ID or key — skipping on-chain registration");
    return;
  }

  console.log("[Registry] Registering agents on Soroban ServiceRegistry…");

  // Check which categories are already registered ON-CHAIN (numeric ID = real on-chain entry).
  // In-memory fallback services have string IDs like "scraper-001" — don't count those.
  const existing = await getAllServices();
  const onChainServices = existing.filter((s) => /^\d+$/.test(s.id));
  const registeredCategories = new Set(onChainServices.map((s) => s.category));

  // Populate onChainIds so record_call / record_hire work even when registration is skipped.
  for (const s of onChainServices) {
    onChainIds[s.category] = BigInt(s.id);
  }
  console.log("[Registry] Already on-chain:", [...registeredCategories].join(", ") || "none");
  console.log("[Registry] Known on-chain IDs:", JSON.stringify(Object.fromEntries(Object.entries(onChainIds).map(([k, v]) => [k, v.toString()]))));

  const entries: Array<{ svc: AgentService; paymentTypeNum: number }> = [
    { svc: services[0], paymentTypeNum: 0 }, // scraper → x402
    { svc: services[1], paymentTypeNum: 1 }, // summarizer → MPP (1)
    { svc: services[2], paymentTypeNum: 0 }, // analyst → x402
  ].filter(({ svc }) => !registeredCategories.has(svc.category));

  for (let i = 0; i < entries.length; i++) {
    const { svc, paymentTypeNum } = entries[i];
    try {
      const agentAddress = new StellarSdk.Address(
        StellarSdk.Keypair.fromSecret(secretKey).publicKey()
      );
      const retval = await enqueueContractTx(
        "register",
        [
          StellarSdk.nativeToScVal(agentAddress, { type: "address" }),
          StellarSdk.nativeToScVal(svc.name, { type: "string" }),
          StellarSdk.nativeToScVal(svc.description, { type: "string" }),
          StellarSdk.nativeToScVal(svc.endpoint, { type: "string" }),
          StellarSdk.nativeToScVal(BigInt(Math.round(svc.price * 10_000_000)), { type: "i128" }),
          StellarSdk.nativeToScVal(paymentTypeNum, { type: "u32" }),
          StellarSdk.nativeToScVal(svc.category, { type: "string" }),
        ],
        secretKey
      );

      if (retval) {
        const id = StellarSdk.scValToNative(retval) as bigint;
        onChainIds[svc.category] = id;
        console.log(`[Registry] ${svc.name} registered on-chain → id=${id}`);
      }
    } catch (err) {
      console.warn(`[Registry] Could not register ${svc.name}:`, String(err).slice(0, 80));
    }
    // Small gap between registrations to avoid sequence conflicts
    await new Promise((r) => setTimeout(r, 500));
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function queryServiceRegistry(
  category: string
): Promise<AgentService[]> {
  // Use getAllServices so the orchestrator's discover_agents tool sees on-chain data
  const all = await getAllServices();
  return all.filter((s) => s.category === category);
}

export async function getAllServices(): Promise<AgentService[]> {
  // Try to read live data from the Soroban contract
  const retval = await simulateRead("query_all");
  if (retval) {
    try {
      const native = StellarSdk.scValToNative(retval) as Record<string, unknown>[];
      if (Array.isArray(native) && native.length > 0) {
        const onChain = native.map(parseContractService);

        // Deduplicate by category — keep the last registered entry (highest numeric id)
        // This cleans up duplicates caused by re-registration before idempotency fix.
        const seen = new Map<string, AgentService>();
        for (const s of onChain) {
          const prev = seen.get(s.category);
          if (!prev || Number(s.id) > Number(prev.id)) seen.set(s.category, s);
        }
        const deduped = Array.from(seen.values());

        // Correct payment type from in-memory source of truth — on-chain may have
        // stale data if it was registered before the paymentTypeNum fix.
        const inMemoryMap = new Map(services.map((s) => [s.category, s]));

        return deduped.map((s) => ({
          ...s,
          paymentType: inMemoryMap.get(s.category)?.paymentType ?? s.paymentType,
          totalCalls: Math.max(
            s.totalCalls,
            inMemoryMap.get(s.category)?.totalCalls ?? 0
          ),
        }));
      }
    } catch {
      /* fall through to in-memory */
    }
  }
  return services;
}

export function incrementCallCount(category: string): void {
  // Update in-memory counter immediately
  const svc = services.find((s) => s.category === category);
  if (svc) svc.totalCalls++;

  // Fire-and-forget on-chain record_call
  // Delay 5s so it doesn't collide with record_hire (same orchestrator key = sequence conflict)
  const id = onChainIds[category];
  const secretKey = process.env.ORCHESTRATOR_SECRET_KEY;
  if (id !== undefined && secretKey) {
    enqueueContractTx(
      "record_call",
      [StellarSdk.nativeToScVal(id, { type: "u64" })],
      secretKey
    ).catch(() => { /* non-critical */ });
  }
}

/**
 * Emit a permanent on-chain hire event via record_hire().
 * Anchors: service_id, payer address, amount in stroops, protocol ("x402" or "mpp").
 * Fire-and-forget — never blocks the response.
 */
export function recordHireOnChain(
  category: string,
  payerAddress: string,
  amountUsdc: number,
  protocol: "x402" | "mpp"
): void {
  const id = onChainIds[category];
  const secretKey = process.env.ORCHESTRATOR_SECRET_KEY;
  if (id === undefined || !secretKey || !payerAddress) return;

  const amountStroops = BigInt(Math.round(amountUsdc * 1e7));

  enqueueContractTx(
    "record_hire",
    [
      StellarSdk.nativeToScVal(id, { type: "u64" }),
      new StellarSdk.Address(payerAddress).toScVal(),
      StellarSdk.nativeToScVal(amountStroops, { type: "i128" }),
      StellarSdk.nativeToScVal(protocol, { type: "string" }),
    ],
    secretKey
  ).then((r) => {
    if (r !== null) {
      console.log(`[Registry] record_hire confirmed on-chain — category=${category} id=${id} amount=${amountStroops} protocol=${protocol}`);
    } else {
      // null = void return (success) OR timeout — check Stellar Expert to verify
      console.log(`[Registry] record_hire submitted — category=${category} id=${id} (null return = void fn or timeout)`);
    }
  }).catch((err) => {
    console.warn(`[Registry] record_hire FAILED — category=${category}:`, String(err).slice(0, 200));
  });
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

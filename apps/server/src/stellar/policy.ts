// SpendingPolicy — Soroban contract interactions
// Enforces daily limits and per-tx limits on the orchestrator's USDC spending

import * as StellarSdk from "@stellar/stellar-sdk";
import { sorobanRpc, networkPassphrase } from "./client.js";

// In-memory fallback values (matches contract defaults)
const DAILY_LIMIT = 0.5;   // $0.50 USDC / day
const PER_TX_LIMIT = 0.05; // $0.05 USDC / tx

let dailySpent = 0;
let lastResetDay = new Date().toDateString();

function resetIfNewDay() {
  const today = new Date().toDateString();
  if (today !== lastResetDay) {
    dailySpent = 0;
    lastResetDay = today;
  }
}

// ─── Soroban helpers ──────────────────────────────────────────────────────────

async function submitPolicyTx(
  method: string,
  args: StellarSdk.xdr.ScVal[]
): Promise<StellarSdk.xdr.ScVal | null> {
  const contractId = process.env.SPENDING_POLICY_CONTRACT_ID;
  const secretKey = process.env.ORCHESTRATOR_SECRET_KEY;
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
      console.warn(`[Policy] ${method} TX rejected`);
      return null;
    }

    for (let i = 0; i < 15; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      const result = await sorobanRpc.getTransaction(send.hash);
      if (result.status === "SUCCESS") {
        return (result as unknown as { returnValue?: StellarSdk.xdr.ScVal }).returnValue ?? null;
      }
      if (result.status === "FAILED") {
        console.warn(`[Policy] ${method} TX failed on-chain`);
        return null;
      }
    }
  } catch (err) {
    console.warn(`[Policy] ${method} error:`, String(err).slice(0, 120));
  }
  return null;
}

async function simulatePolicyRead(
  method: string,
  args: StellarSdk.xdr.ScVal[] = []
): Promise<StellarSdk.xdr.ScVal | null> {
  const contractId = process.env.SPENDING_POLICY_CONTRACT_ID;
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

// ─── Public API ───────────────────────────────────────────────────────────────

export async function checkBudget(): Promise<number> {
  const publicKey = process.env.ORCHESTRATOR_PUBLIC_KEY;
  if (publicKey) {
    try {
      const retval = await simulatePolicyRead("get_remaining", [
        StellarSdk.nativeToScVal(new StellarSdk.Address(publicKey), { type: "address" }),
      ]);
      if (retval) {
        const remaining = StellarSdk.scValToNative(retval) as bigint;
        return Number(remaining) / 10_000_000;
      }
    } catch { /* fall through */ }
  }

  resetIfNewDay();
  return DAILY_LIMIT - dailySpent;
}

export async function recordSpend(amount: number): Promise<boolean> {
  resetIfNewDay();

  if (amount > PER_TX_LIMIT) {
    throw new Error(`Amount $${amount} exceeds per-tx limit of $${PER_TX_LIMIT}`);
  }
  if (dailySpent + amount > DAILY_LIMIT) {
    throw new Error(
      `Spending $${amount} would exceed daily limit. Remaining: $${(DAILY_LIMIT - dailySpent).toFixed(4)}`
    );
  }

  // Update in-memory immediately so subsequent calls in same task see the change
  dailySpent += amount;

  // Fire-and-forget: record spend on-chain via Soroban SpendingPolicy
  const orchestratorKey = process.env.ORCHESTRATOR_PUBLIC_KEY;
  const platformKey = process.env.PLATFORM_PUBLIC_KEY;
  if (orchestratorKey && platformKey) {
    const amountStroops = BigInt(Math.round(amount * 10_000_000));
    const recipientAddress = new StellarSdk.Address(platformKey);

    submitPolicyTx("check_and_record", [
      StellarSdk.nativeToScVal(new StellarSdk.Address(orchestratorKey), { type: "address" }),
      StellarSdk.nativeToScVal(amountStroops, { type: "i128" }),
      StellarSdk.nativeToScVal(recipientAddress, { type: "address" }),
    ]).catch(() => { /* non-critical */ });
  }

  return true;
}

export async function getSpendingStatus() {
  resetIfNewDay();
  return {
    dailyLimit: DAILY_LIMIT,
    perTxLimit: PER_TX_LIMIT,
    dailySpent,
    remaining: DAILY_LIMIT - dailySpent,
    resetDate: lastResetDay,
  };
}

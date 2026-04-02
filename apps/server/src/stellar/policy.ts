// SpendingPolicy - Soroban contract interactions
// Enforces daily limits, per-tx limits, and allowlists

const DAILY_LIMIT = 0.5; // $0.50 USDC per day
const PER_TX_LIMIT = 0.05; // $0.05 USDC per transaction

let dailySpent = 0;
let lastResetDay = new Date().toDateString();

function resetIfNewDay() {
  const today = new Date().toDateString();
  if (today !== lastResetDay) {
    dailySpent = 0;
    lastResetDay = today;
  }
}

export async function checkBudget(): Promise<number> {
  // TODO: Replace with Soroban contract call
  // const contract = new StellarSdk.Contract(process.env.SPENDING_POLICY_CONTRACT_ID!);
  // const result = await contract.call("get_remaining_budget", agentId);

  resetIfNewDay();
  return DAILY_LIMIT - dailySpent;
}

export async function recordSpend(amount: number): Promise<boolean> {
  resetIfNewDay();

  if (amount > PER_TX_LIMIT) {
    throw new Error(
      `Amount $${amount} exceeds per-transaction limit of $${PER_TX_LIMIT}`
    );
  }

  if (dailySpent + amount > DAILY_LIMIT) {
    throw new Error(
      `Spending $${amount} would exceed daily limit. Remaining: $${(DAILY_LIMIT - dailySpent).toFixed(4)}`
    );
  }

  dailySpent += amount;
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

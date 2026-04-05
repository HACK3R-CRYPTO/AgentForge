import * as StellarSdk from "@stellar/stellar-sdk";

const NETWORK_PASSPHRASE =
  process.env.STELLAR_NETWORK_PASSPHRASE ||
  "Test SDF Network ; September 2015";
const HORIZON_URL =
  process.env.STELLAR_HORIZON_URL || "https://horizon-testnet.stellar.org";
const RPC_URL =
  process.env.STELLAR_RPC_URL || "https://soroban-testnet.stellar.org";

export const horizon = new StellarSdk.Horizon.Server(HORIZON_URL);
export const sorobanRpc = new StellarSdk.rpc.Server(RPC_URL);
export const networkPassphrase = NETWORK_PASSPHRASE;

export function getKeypair(secretKey: string): StellarSdk.Keypair {
  return StellarSdk.Keypair.fromSecret(secretKey);
}

export async function fundTestnetAccount(publicKey: string): Promise<void> {
  const response = await fetch(
    `https://friendbot.stellar.org?addr=${publicKey}`
  );
  if (!response.ok) {
    throw new Error(`Failed to fund account: ${response.status}`);
  }
  console.log(`Funded testnet account: ${publicKey}`);
}

export async function getAccountBalance(
  publicKey: string
): Promise<{ xlm: string; usdc: string }> {
  try {
    const account = await horizon.loadAccount(publicKey);
    const xlmBalance =
      account.balances.find(
        (b) => b.asset_type === "native"
      )?.balance || "0";

    // Look for USDC trustline
    const usdcBalance =
      account.balances.find(
        (b) =>
          b.asset_type === "credit_alphanum4" &&
          (b as StellarSdk.Horizon.HorizonApi.BalanceLineAsset).asset_code === "USDC"
      )?.balance || "0";

    return { xlm: xlmBalance, usdc: usdcBalance };
  } catch {
    return { xlm: "0", usdc: "0" };
  }
}

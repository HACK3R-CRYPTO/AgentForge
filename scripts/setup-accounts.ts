/**
 * Generate Stellar testnet keypairs for all agents and fund them via Friendbot.
 * Run: npx tsx scripts/setup-accounts.ts
 */

import * as StellarSdk from "@stellar/stellar-sdk";

const AGENT_NAMES = [
  "ORCHESTRATOR",
  "SCRAPER",
  "SUMMARIZER",
  "ANALYST",
  "FACILITATOR",
];

async function fundAccount(publicKey: string): Promise<boolean> {
  try {
    const res = await fetch(
      `https://friendbot.stellar.org?addr=${publicKey}`
    );
    return res.ok;
  } catch {
    return false;
  }
}

async function main() {
  console.log("=== AgentForge Stellar Testnet Account Setup ===\n");

  const envLines: string[] = [];

  for (const name of AGENT_NAMES) {
    const keypair = StellarSdk.Keypair.random();
    const publicKey = keypair.publicKey();
    const secret = keypair.secret();

    process.stdout.write(`Funding ${name}... `);
    const funded = await fundAccount(publicKey);
    console.log(funded ? "OK" : "FAILED");

    console.log(`  Public:  ${publicKey}`);
    console.log(`  Secret:  ${secret}\n`);

    envLines.push(`# ${name}`);
    envLines.push(`${name}_PUBLIC_KEY=${publicKey}`);
    envLines.push(`${name}_SECRET_KEY=${secret}`);
    envLines.push("");
  }

  console.log("\n=== Add these to your .env file ===\n");
  console.log(envLines.join("\n"));
}

main().catch(console.error);

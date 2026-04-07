import { BackgroundPaths } from "@/components/ui/background-paths";

export default function LandingPage() {
  return (
    <BackgroundPaths
      title="AgentForge"
      subtitle="AI agents that discover, hire, and pay each other on Stellar. Submit a task — the swarm handles the rest using x402 and MPP micropayments on Stellar testnet."
      ctaLabel="Open Dashboard"
      ctaHref="/dashboard"
      badges={[
        { label: "x402",    color: "text-indigo-400 border-indigo-500/30 bg-indigo-500/10" },
        { label: "MPP",     color: "text-cyan-400   border-cyan-500/30   bg-cyan-500/10"   },
        { label: "Soroban", color: "text-purple-400 border-purple-500/30 bg-purple-500/10" },
        { label: "Stellar", color: "text-neutral-400 border-neutral-700  bg-neutral-800/50" },
      ]}
    />
  );
}

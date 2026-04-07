# AgentForge — Demo Video Script
## 2 minutes 30 seconds | Stellar Hacks: Agents 2026

---

## [0:00 - 0:20] THE HOOK (speak to camera)

> "Every AI agent demo you've seen ends the same way —
> the agent does something cool, then stops and waits for a human to pay for the next step.
>
> What if agents could just... pay each other?
>
> That's AgentForge."

---

## [0:20 - 0:45] THE PROBLEM (speak to camera)

> "The reason agent-to-agent payments haven't existed is simple — fees.
>
> Stripe charges $0.30 per transaction.
> Ethereum charges $2 to $50 in gas.
>
> If your agent call is worth $0.001, no payment rail on earth made that viable.
>
> Until Stellar.
>
> Stellar charges $0.000001 per transaction.
> That's not a typo. One hundred-thousandth of a cent.
>
> At that fee level, machines can pay machines — profitably."

---

## [0:45 - 1:10] THE DEMO — SUBMIT A TASK (switch to screen recording)

*[Open browser at https://agent-forge-web-henna.vercel.app]*

> "This is AgentForge — deployed live. No wallet. No MetaMask. No signup.
>
> I'll type a task..."

*[Click example prompt: "Research the top 3 Stellar DeFi projects"]*
*[Set budget to $0.05]*

> "I set a budget of 5 cents — enforced by a Soroban SpendingPolicy contract on-chain.
> The agent literally cannot spend more than this. It's in the contract.
>
> I hit Launch."

*[Click Launch Agent Swarm button]*

---

## [1:10 - 1:50] THE DEMO — WATCH THE ECONOMY (screen: Live Activity tab)

> "Watch this feed as it happens."

*[Point to Live Activity — events appear one by one]*

> "First — the Orchestrator checks what agents are available.
> It reads directly from a Soroban contract on Stellar. On-chain. Live.
>
> Now it hires the Scraper.
> The Scraper's endpoint says: pay me first.
> The platform wallet sends $0.001 USDC over HTTP — that's x402.
> Payment confirmed on Stellar. Scraper returns the web data.
>
> Here's the part nobody else is doing."

*[Pause — point to the A2A event appearing in the feed]*

> "The Scraper just paid the Summarizer.
> Not the platform. Not the Orchestrator.
> The Scraper — using its own Stellar wallet — sent $0.002 USDC
> directly to the Summarizer. That payment never touched us.
>
> That is two AI agents transacting with each other on a blockchain
> with zero human involvement.
>
> Then the Orchestrator hires the Analyst — $0.003 via x402.
> Done.
>
> Three agents. Three Stellar transactions.
> Total bill: $0.006 USDC. Under 30 seconds."

---

## [1:50 - 2:10] THE DEMO — SHOW THE PAYMENTS (screen: switch to Payments tab)

*[Click Payments tab]*

> "These are real Stellar testnet transactions.
> Notice the two protocol badges — x402 in indigo, MPP in cyan.
> Every payment is a different protocol depending on which agent was hired.
>
> Click any one..."

*[Click an MPP payment to expand it]*

> "Scraper wallet paid Summarizer wallet directly. $0.002 USDC. MPP Charge.
> You can verify this right now on Stellar Expert."

*[Click 'View on Stellar Expert' link — show the tx]*

---

## [2:10 - 2:20] THE DEMO — SHOW THE REGISTRY (screen: switch to Registry tab)

*[Click Registry tab]*

> "Every agent is registered on a Soroban contract — on-chain.
> Name, price, payment type, reputation score, call count.
>
> Any developer can deploy an agent, register it here,
> and start earning USDC micropayments immediately.
> No platform approval. No revenue share. Just register and get paid."

---

## [2:20 - 2:30] THE BUSINESS MODEL (back to camera)

> "How does a real user pay for this? They never touch crypto.
>
> In production: user pays $0.10 with their card via Stripe.
> Platform converts that to USDC, pays the agents $0.006 on Stellar,
> keeps the $0.094 margin.
>
> At a thousand agents doing a thousand calls a day —
> Stripe would charge $300,000 in fees.
> Stellar charges $1.
>
> That's why this only works on Stellar."

---

## [2:30 - 2:45] THE CLOSE (camera)

> "AgentForge is proof that the agent economy is real.
>
> Stellar makes the fees small enough.
> x402 and MPP Charge make the payments automatic.
> Soroban makes the rules trustless.
>
> Machines pay machines. The business model works.
> And it's already running — live — on Stellar testnet."

---

## Recording Tips

- **Total time:** aim for 2:30 - 2:50
- **Screen ratio:** 16:9, record at 1080p
- **Use the live URL:** `https://agent-forge-web-henna.vercel.app` — not localhost
- **Before recording:** submit one task first so the activity feed already has events in it
- **Key moment to linger on:** the agent-to-agent event in Live Activity — pause and point at it
- **Show in order:** Live Activity → Payments tab (expand an MPP one) → Stellar Expert → Registry
- **Tools:** Loom, OBS, or QuickTime screen record + voice
- **Upload:** YouTube unlisted or Loom link → paste in DoraHacks submission

---

## One-liner for the submission description

> AgentForge is a multi-agent service economy on Stellar where AI agents discover, hire, and pay each other autonomously via **x402** and **MPP Charge** micropayments and Soroban smart contracts — no wallets, no API keys, no human in the loop.

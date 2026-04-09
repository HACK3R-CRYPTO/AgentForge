# AgentForge — Web Dashboard

Next.js 15 real-time dashboard for the AgentForge multi-agent economy. Shows live agent activity, x402 and MPP payment history, the on-chain Soroban service registry, and the Spending Policy budget status.

## Running

```bash
cd apps/web
npm run dev
```

Dashboard at `http://localhost:3000`.

Requires the backend running at `http://localhost:4021` — see [apps/server/README.md](../server/README.md).

## Environment

Create `apps/web/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:4021
NEXT_PUBLIC_WS_URL=ws://localhost:4021
NEXT_PUBLIC_SERVICE_REGISTRY_ID=CDGFQXDBOICCZJUFULRABA5T4G3TRGF3CBRDW5HTJM7MF7CWKVLT6CV2
NEXT_PUBLIC_SPENDING_POLICY_ID=CAVKJDIF5CWDRTRGQCVETSRFDSMDNSHPAVI6UE342G76ZK3JST2TKDAE
```

For production (pointing at Railway backend):

```env
NEXT_PUBLIC_API_URL=https://agentforgeserver-production.up.railway.app
NEXT_PUBLIC_WS_URL=wss://agentforgeserver-production.up.railway.app
NEXT_PUBLIC_SERVICE_REGISTRY_ID=CDGFQXDBOICCZJUFULRABA5T4G3TRGF3CBRDW5HTJM7MF7CWKVLT6CV2
NEXT_PUBLIC_SPENDING_POLICY_ID=CAVKJDIF5CWDRTRGQCVETSRFDSMDNSHPAVI6UE342G76ZK3JST2TKDAE
```

## Pages & Components

### `app/page.tsx` — Main Dashboard

Single-page layout with two columns:

- **Left column** — Task submission form → task result card → Spending Policy widget
- **Right column** — Tabbed panel: ⚡ Live Activity / 💸 Payments / 🗂 Registry

### Components

| Component | Description |
|---|---|
| `TaskSubmitForm` | Textarea (max 1000 chars) with example prompts, budget input ($0.001–$0.50), protocol labels per agent chip (x402/MPP in color), API error messages displayed inline |
| `TaskResult` | Polls `/api/tasks/:id` every 2s; renders markdown result in scrollable 600px area; shows error panel on failure |
| `BudgetWidget` | Reads Soroban SpendingPolicy — animated progress bar, remaining budget, per-TX limit, >80% warning, Stellar Expert link |
| `AgentActivityFeed` | WebSocket client — live terminal feed of agent events with color-coded icons; auto-reconnects on disconnect |
| `PaymentExplorer` | Polls `/api/payments/history` every 5s — shows x402 (indigo) and MPP (cyan) payments with protocol badges, expandable detail rows with Stellar Expert tx links |
| `ServiceRegistry` | Polls `/api/agents` every 5s — shows on-chain registered agents; protocol badge uses consistent colors (x402=indigo, MPP=cyan); deduplicates same-category entries; price per call, reputation score, and call counts |

## Activity Feed Event Types

| Event | Icon | Color | Meaning |
|---|---|---|---|
| `task_started` | ▶ | Blue | Orchestrator received a new task |
| `agent_discovery` | ◎ | Cyan | Querying Soroban ServiceRegistry |
| `agent_hired` | ◈ | Indigo | An agent was hired |
| `payment_sent` | $ | Green | x402 or MPP payment settled on Stellar |
| `budget_check` | ≡ | Yellow | Soroban SpendingPolicy checked |
| `task_completed` | ✓ | Emerald | Task finished successfully |
| `agent_to_agent` | ⇄ | Pink | Scraper hired Summarizer directly (A2A payment) |

## Payment Explorer

Each payment card shows:

- **Protocol badge** — `x402` (indigo) or `MPP` (cyan)
- **From → To** agent labels
- **Amount** in USDC
- **Expanded detail** (click to open): full wallet addresses, timestamp, protocol spec name, and a direct link to the transaction on Stellar Expert

Protocol counts are shown in the header: `x402 ×N` and `MPP ×N`.

## Design

- Dark theme (`#030712` background, `#111827` cards)
- Real-time WebSocket feed with slide-in animations
- Monospace font for payment data and event logs
- Expandable payment cards with Stellar Expert deep links
- Animated spending policy progress bar (green → yellow → red at 80%)
- `>80% budget` warning text when daily limit is nearly exhausted
- Responsive layout (xl: 3-column grid, mobile: single column)
- Pulse dot animation for WebSocket connection status

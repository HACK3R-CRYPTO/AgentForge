# AgentForge — Web Dashboard

Next.js 15 real-time dashboard for the AgentForge multi-agent economy. Shows live agent activity, x402 payment history, and the on-chain service registry.

## Running

```bash
cd apps/web
npm run dev
```

Dashboard runs at `http://localhost:3000`.

Requires the backend server running at `http://localhost:4021` — see [apps/server/README.md](../server/README.md).

## Pages & Components

### `app/page.tsx` — Main Dashboard

The single-page dashboard with three sections:

- **Left column** — Task submission form + task result + spending policy widget
- **Right column** — Tabbed panel: Live Activity / Payments / Registry

### Components

| Component | Description |
|---|---|
| `TaskSubmitForm` | Textarea with example prompts, budget input, launch button |
| `TaskResult` | Polls `/api/tasks/:id` every 2s, renders markdown result |
| `BudgetWidget` | Reads Soroban SpendingPolicy — shows daily budget used + remaining |
| `AgentActivityFeed` | WebSocket client — renders live agent events as a terminal feed |
| `PaymentExplorer` | Polls `/api/payments/history` — shows x402 micropayment ledger |
| `ServiceRegistry` | Polls `/api/agents` — shows on-chain registered agents with prices + call counts |

## Environment

Create `apps/web/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:4021
```

## Design

- Dark theme (`#030712` background)
- Real-time WebSocket feed with color-coded event types
- Expandable payment cards with Stellar Expert deep links
- Animated spending policy progress bar
- Responsive layout (desktop-first)

// Stripe Checkout — fiat on-ramp before task submission
// User pays $0.10 USD → platform converts to USDC → agents paid on Stellar
// This is the bridge: traditional payments → Stellar micropayment economy

import { Router } from "express";
import Stripe from "stripe";

export const stripeRoutes = Router();

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY not set");
  return new Stripe(key);
}

const TASK_PRICE_CENTS = 10; // $0.10 per task

// POST /api/stripe/checkout
// Creates a Stripe Checkout session for $0.10, stores prompt+budget in metadata
stripeRoutes.post("/checkout", async (req, res) => {
  const { prompt, budget } = req.body as { prompt: string; budget: number };

  if (!prompt || typeof prompt !== "string") {
    res.status(400).json({ error: "prompt is required" });
    return;
  }

  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";

  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: "AgentForge — AI Agent Task",
              description: `"${prompt.slice(0, 80)}${prompt.length > 80 ? "…" : ""}"`,
            },
            unit_amount: TASK_PRICE_CENTS,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${frontendUrl}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${frontendUrl}?stripe_cancelled=true`,
      metadata: {
        prompt: prompt.slice(0, 500), // Stripe metadata limit
        budget: String(budget ?? 0.05),
      },
    });

    res.json({ url: session.url, sessionId: session.id });
  } catch (err) {
    const message = String(err);
    if (message.includes("STRIPE_SECRET_KEY not set")) {
      res.status(503).json({ error: "Stripe not configured", detail: message });
      return;
    }
    res.status(500).json({ error: "Failed to create checkout session", detail: message });
  }
});

// GET /api/stripe/verify/:sessionId
// Verifies a completed Stripe Checkout session and returns task params
stripeRoutes.get("/verify/:sessionId", async (req, res) => {
  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(req.params.sessionId);

    if (session.payment_status !== "paid") {
      res.status(402).json({ error: "Payment not completed", status: session.payment_status });
      return;
    }

    res.json({
      paid: true,
      amountPaid: (session.amount_total ?? 0) / 100, // cents → dollars
      prompt: session.metadata?.prompt ?? "",
      budget: parseFloat(session.metadata?.budget ?? "0.05"),
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to verify session", detail: String(err) });
  }
});

// GET /api/stripe/config
// Returns the publishable key so frontend knows Stripe is configured
stripeRoutes.get("/config", (_req, res) => {
  const configured = !!process.env.STRIPE_SECRET_KEY;
  res.json({
    configured,
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY ?? null,
    priceUsd: TASK_PRICE_CENTS / 100,
  });
});

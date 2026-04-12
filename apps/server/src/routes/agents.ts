import { Router } from "express";
import { scrapeUrl } from "../agents/scraper.js";
import { summarizeText } from "../agents/summarizer.js";
import { analyzeData } from "../agents/analyst.js";
import { getAllServices, registerService } from "../stellar/registry.js";
import { mppGuard } from "../payments/mpp-server.js";

export const agentRoutes = Router();

// List all registered agent services
agentRoutes.get("/", async (_req, res) => {
  const services = await getAllServices();
  res.json(services);
});

// Register an external agent (any developer can call this)
// Body: { name, description, endpoint, price, category, agentWallet, paymentType? }
agentRoutes.post("/register", async (req, res) => {
  const { name, description, endpoint, price, category, agentWallet, paymentType } = req.body;

  if (!name || !description || !endpoint || !price || !category || !agentWallet) {
    res.status(400).json({
      error: "name, description, endpoint, price, category, and agentWallet are required",
    });
    return;
  }

  if (typeof price !== "number" || price <= 0) {
    res.status(400).json({ error: "price must be a positive number (USDC)" });
    return;
  }

  try {
    new URL(endpoint);
  } catch {
    res.status(400).json({ error: "endpoint must be a valid URL" });
    return;
  }

  const paymentTypeNum = paymentType === "mpp" ? 1 : 0;

  try {
    const service = await registerService(
      {
        agentId: agentWallet,
        name,
        description,
        endpoint,
        price,
        paymentType: paymentType === "mpp" ? "mpp" : "x402",
        category,
      },
      agentWallet,
      paymentTypeNum
    );

    res.json({
      status: "registered",
      service,
      message: `Agent "${name}" registered. It will be discoverable by the Orchestrator on the next task.`,
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Scraper agent endpoint (x402 gated)
agentRoutes.get("/scraper", async (req, res) => {
  const url = req.query.url as string;
  if (!url) {
    res.status(400).json({ error: "url query parameter required" });
    return;
  }

  try {
    const content = await scrapeUrl(url);
    res.json({ status: "ok", url, content });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// Summarizer agent endpoint — MPP Charge gated (distinct from x402)
agentRoutes.post("/summarizer", mppGuard, async (req, res) => {
  const { text, style = "brief" } = req.body;
  if (!text) {
    res.status(400).json({ error: "text field required" });
    return;
  }

  try {
    const summary = await summarizeText(text, style);
    res.json({ status: "ok", summary });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// Analyst agent endpoint (x402 gated)
agentRoutes.post("/analyst", async (req, res) => {
  const { data, question } = req.body;
  if (!data || !question) {
    res.status(400).json({ error: "data and question fields required" });
    return;
  }

  try {
    const report = await analyzeData(data, question);
    res.json({ status: "ok", report });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

import { Router } from "express";
import { scrapeUrl } from "../agents/scraper.js";
import { summarizeText } from "../agents/summarizer.js";
import { analyzeData } from "../agents/analyst.js";
import { getAllServices } from "../stellar/registry.js";
import { mppGuard } from "../payments/mpp-server.js";

export const agentRoutes = Router();

// List all registered agent services
agentRoutes.get("/", async (_req, res) => {
  const services = await getAllServices();
  res.json(services);
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

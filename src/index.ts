import express from "express";
import { config } from "./config";
import { requireGatewayKey } from "./auth";
import { chatRouter } from "./routes/chat";

const app = express();
app.use(express.json());

// Liveness probe for nginx / uptime checks. Stays dependency-free so it answers
// even when LiteLLM is misconfigured or down.
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// The chat surface sits behind the optional shared-secret gate.
app.use(requireGatewayKey, chatRouter);

app.listen(config.port, () => {
  console.log(`llm-api-gateway listening on http://localhost:${config.port}`);
});

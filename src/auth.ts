import type { RequestHandler } from "express";
import { config } from "./config";

// Optional shared-secret gate. When GATEWAY_API_KEY is set, callers (the Next.js
// route) must echo it as X-Gateway-Key; otherwise the check is a no-op so local
// dev works keyless. Uses a length-aware constant-ish compare to avoid leaking
// the key via early-exit timing.
export const requireGatewayKey: RequestHandler = (req, res, next) => {
  const expected = config.gatewayApiKey;
  if (!expected) return next();

  const provided = req.get("x-gateway-key") ?? "";
  if (provided.length === expected.length && provided === expected) {
    return next();
  }
  res.status(401).json({ error: "Unauthorized." });
};

import { Router } from "express";
import OpenAI from "openai";
import { requireLiteLLM } from "../config";
import { openUpstream } from "../litellm";
import type { ChatRequest } from "../types";

export const chatRouter = Router();

// POST /chat — validate { messages, model }, open the LiteLLM stream, and pipe
// content deltas back as text/plain (the contract the Next.js route forwards to
// the browser typewriter). Mirrors the error handling the route used to do
// inline: a pre-stream failure becomes a real non-200, an in-flight client
// disconnect aborts the upstream cleanly.
chatRouter.post("/chat", async (req, res) => {
  const body = req.body as Partial<ChatRequest> | undefined;

  const messages = body?.messages;
  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: "`messages` must be a non-empty array." });
    return;
  }
  const model = body?.model;
  if (typeof model !== "string" || model.length === 0) {
    res.status(400).json({ error: "`model` must be a non-empty string." });
    return;
  }

  let conn: { baseUrl: string; apiKey: string };
  try {
    conn = requireLiteLLM();
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Gateway misconfigured.",
    });
    return;
  }

  // Abort the upstream when the client goes away (e.g. the UI stop button aborts
  // the Next.js fetch, which closes this connection).
  const ac = new AbortController();
  res.on("close", () => ac.abort());

  // Open the completion BEFORE committing a 200, so a bad key (401) or an
  // unreachable LiteLLM (502) is a real HTTP error, not a broken stream.
  let stream;
  try {
    stream = await openUpstream(conn.baseUrl, conn.apiKey, model, messages, ac.signal);
  } catch (error) {
    if (ac.signal.aborted) {
      res.end();
      return;
    }
    const status = error instanceof OpenAI.APIError ? error.status ?? 502 : 502;
    res.status(status).json({ error: "The LiteLLM service could not be reached." });
    return;
  }

  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");

  try {
    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content;
      if (text) res.write(text);
    }
    res.end();
  } catch (error) {
    // Headers are already sent, so we can't change the status. A client abort is
    // expected (not an error); anything else we log and just close the stream.
    if (!ac.signal.aborted) {
      console.error("LiteLLM stream error:", error);
    }
    if (!res.writableEnded) res.end();
  }
});

import { Router } from "express";
import OpenAI from "openai";
import { requireLiteLLM } from "../config";
import { openUpstream } from "../litellm";
import type { ChatRequest } from "../types";

export const chatRouter = Router();

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
    conn = requireLiteLLM(model);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Gateway misconfigured.",
    });
    return;
  }

  const ac = new AbortController();
  res.on("close", () => ac.abort());

  let stream;
  try {
    stream = await openUpstream(conn.baseUrl, conn.apiKey, model, messages, ac.signal);
  } catch (error) {
    if (ac.signal.aborted) {
      res.end();
      return;
    }

    const apiStatus = error instanceof OpenAI.APIError ? error.status : undefined;
    const message = apiStatus
      ? `The LiteLLM service responded ${apiStatus}.`
      : "The LiteLLM service could not be reached.";
    res.status(apiStatus ?? 502).json({ error: message });
    return;
  }

  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Accel-Buffering", "no");

  try {
    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content;
      if (text) res.write(text);
    }
    res.end();
  } catch (error) {
    if (!ac.signal.aborted) {
      console.error("LiteLLM stream error:", error);
    }
    if (!res.writableEnded) res.end();
  }
});

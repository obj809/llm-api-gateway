import OpenAI from "openai";
import type { ChatMessage } from "./types";

// LiteLLM speaks the OpenAI API, so the same SDK drives it by pointing `baseURL`
// at the LiteLLM container. Roles (`user`/`assistant`) pass through unchanged.
// This only OPENS the streaming completion — the caller iterates it — so a
// non-2xx status (thrown here before the first chunk) surfaces as a real HTTP
// error instead of corrupting an already-committed 200 stream. The signal lets
// the caller abort the upstream when the client disconnects.
export function openUpstream(
  baseUrl: string,
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  signal: AbortSignal,
) {
  const client = new OpenAI({ baseURL: baseUrl, apiKey });
  return client.chat.completions.create(
    { model, messages, stream: true },
    { signal },
  );
}

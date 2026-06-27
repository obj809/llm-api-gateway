// Request contract shared with the Next.js chat route. The route resolves the
// model via app/models.ts and forwards the already-resolved upstream model
// name, so the gateway never needs its own model registry.

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type ChatRequest = {
  messages: ChatMessage[];
  // The LiteLLM `model_name` to call (the route sends `upstreamModel ?? id`).
  model: string;
};

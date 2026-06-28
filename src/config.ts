// Centralized environment config, read once at startup. LiteLLM values are read
// here but only asserted when the /chat route needs them (see requireLiteLLM),
// so /health can run without any LiteLLM env set.

// Parses a comma/whitespace-separated model list (e.g. "llama3.2, deepseek-r1")
// into a lookup set, dropping blanks.
function parseModelList(raw: string | undefined): Set<string> {
  return new Set(
    (raw ?? "")
      .split(/[,\s]+/)
      .map((name) => name.trim())
      .filter(Boolean),
  );
}

export const config = {
  port: Number(process.env.PORT) || 8787,
  litellmBaseUrl: process.env.LITELLM_BASE_URL ?? "",
  litellmApiKey: process.env.LITELLM_API_KEY ?? "",
  // Optional second LiteLLM key used ONLY for the models named in OLLAMA_MODELS,
  // so the local Ollama models can carry a separately-scoped key from the paid
  // cloud models. Unset → every model uses litellmApiKey (unchanged behavior).
  litellmOllamaApiKey: process.env.LITELLM_OLLAMA_API_KEY ?? "",
  // Models routed with litellmOllamaApiKey. This is credential routing, not model
  // resolution — the route still forwards the model name to LiteLLM verbatim.
  ollamaModels: parseModelList(process.env.OLLAMA_MODELS),
  // Optional shared secret; when set, callers must send it as X-Gateway-Key.
  gatewayApiKey: process.env.GATEWAY_API_KEY ?? "",
};

// Asserts the LiteLLM connection is configured and picks the key for `model`:
// an Ollama model (per OLLAMA_MODELS) uses litellmOllamaApiKey when it's set,
// everything else — and the fallback when no Ollama key is configured — uses
// litellmApiKey. Returns the non-empty values narrowed; throws otherwise.
export function requireLiteLLM(model: string): { baseUrl: string; apiKey: string } {
  const useOllamaKey =
    config.ollamaModels.has(model) && config.litellmOllamaApiKey.length > 0;
  const apiKey = useOllamaKey ? config.litellmOllamaApiKey : config.litellmApiKey;
  if (!config.litellmBaseUrl || !apiKey) {
    throw new Error(
      "LITELLM_BASE_URL and LITELLM_API_KEY must be set on the gateway.",
    );
  }
  return { baseUrl: config.litellmBaseUrl, apiKey };
}

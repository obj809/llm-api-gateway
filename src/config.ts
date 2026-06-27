// Centralized environment config, read once at startup. LiteLLM values are read
// here but only asserted when the /chat route needs them (see requireLiteLLM),
// so /health can run without any LiteLLM env set.

export const config = {
  port: Number(process.env.PORT) || 8787,
  litellmBaseUrl: process.env.LITELLM_BASE_URL ?? "",
  litellmApiKey: process.env.LITELLM_API_KEY ?? "",
  // Optional shared secret; when set, callers must send it as X-Gateway-Key.
  gatewayApiKey: process.env.GATEWAY_API_KEY ?? "",
};

// Asserts the LiteLLM connection is configured. Returns the non-empty values so
// callers get them narrowed; throws with a clear message otherwise.
export function requireLiteLLM(): { baseUrl: string; apiKey: string } {
  if (!config.litellmBaseUrl || !config.litellmApiKey) {
    throw new Error(
      "LITELLM_BASE_URL and LITELLM_API_KEY must be set on the gateway.",
    );
  }
  return { baseUrl: config.litellmBaseUrl, apiKey: config.litellmApiKey };
}

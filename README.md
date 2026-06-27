# LLM API Gateway

A small TypeScript [Express](https://expressjs.com/) service that sits between the
[llm-user-interface](https://github.com/obj809/llm-user-interface) Next.js app and
a [LiteLLM](https://docs.litellm.ai/) gateway. The Next.js chat route forwards a
conversation here; this service calls LiteLLM (OpenAI-compatible) and streams the
reply back as plaintext.

It exists so the Next.js app never holds the LiteLLM key or talks to LiteLLM
directly: this gateway owns that connection, and on the VPS it reaches the
`litellm` container directly over the internal Docker network — keeping LiteLLM
internal-only.

```
Next.js chat route → llm-api-gateway (this service) → litellm → providers
                       holds the key, owns the OpenAI SDK call
```

## Endpoints

- `GET /health` — liveness probe; returns `{ "status": "ok" }`. No auth; answers
  even when LiteLLM is misconfigured or down.
- `POST /chat` — body `{ messages: { role, content }[], model: string }`. `model`
  is the LiteLLM `model_name` to call. Opens the LiteLLM completion **before**
  committing a `200`, so an auth/connectivity failure surfaces as a real non-200
  (bad key → `401`, unreachable → `502`) instead of corrupting a stream. On
  success, streams content deltas as `text/plain`. Aborts the upstream if the
  client disconnects (e.g. the UI stop button). Behind the optional shared-secret
  gate when `GATEWAY_API_KEY` is set.

## Environment

Copy `.env.example` to `.env`:

| Var | Required | Purpose |
| --- | --- | --- |
| `PORT` | no (default `8787`) | Port to listen on. |
| `LITELLM_BASE_URL` | yes (for `/chat`) | LiteLLM base URL, e.g. `http://litellm:4000/v1`. |
| `LITELLM_API_KEY` | yes (for `/chat`) | LiteLLM key (the master key). |
| `GATEWAY_API_KEY` | no | If set, callers must send it as the `X-Gateway-Key` header. |

## Local development

```bash
npm install
cp .env.example .env      # fill in LITELLM_BASE_URL / LITELLM_API_KEY
npm run dev               # tsx watch on http://localhost:8787
```

Other scripts: `npm run build` (tsc → `dist/`), `npm start` (run the build),
`npm run typecheck`.

```bash
curl localhost:8787/health
curl -X POST localhost:8787/chat -H 'Content-Type: application/json' \
  -d '{"messages":[{"role":"user","content":"hi"}],"model":"claude-haiku-4-5"}'
```

## Docker

Both compose files join the external `webnet` network and reach LiteLLM by name
(`http://litellm:4000`), so a [litellm container](https://github.com/obj809/litellm-docker-container)
must be running on `webnet` (its compose declares `webnet` external too, so the
network already exists; otherwise `docker network create webnet`).

```bash
# Local — publishes 8787 so a host `npm run dev` can reach it at localhost:8787
docker compose up --build

# VPS — no host ports; reached only over webnet (by the nginx proxy)
docker compose -f docker-compose.prod.yml up -d --build
```

The image is a multi-stage build (`node:22-alpine`, non-root). The two files
differ only in host exposure: local maps `8787:8787`; prod just `expose`s it and
adds `restart: unless-stopped`.

## Layout

```
src/
├── index.ts          Express app: JSON, /health, mounts the chat router
├── config.ts         Env read once; requireLiteLLM() asserts the connection
├── types.ts          ChatMessage / ChatRequest contract
├── auth.ts           Optional X-Gateway-Key shared-secret middleware
├── litellm.ts        openUpstream() — OpenAI SDK pointed at LiteLLM
└── routes/chat.ts    POST /chat — validate, stream, map errors, abort
```

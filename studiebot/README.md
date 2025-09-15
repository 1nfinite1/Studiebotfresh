# Studiebot (UI-only)

Production-ready Next.js 14.2.3 app prepared to run without any LLMs and with database optionally disabled.

Key points:
- No Next.js API routes. All backend calls (e.g., /api/materials/*) must be served by your FastAPI service behind the Kubernetes ingress.
- LLMs are removed. A small adapter exists with a noop implementation returning stubbed data.
- Works even if MongoDB is not configured (backend returns empty payloads). UI remains stable.

## Requirements
- Node 20 (see .nvmrc)
- Yarn 1

## Env flags
- NEXT_PUBLIC_LLM_ENABLED (default false)
- NEXT_PUBLIC_BACKEND_URL (optional, only used as fallback by /runtime-config client)

## Runtime config endpoint
- GET /runtime-config — returns `{ backendUrl }` where `backendUrl` is the public backend base URL, derived from NEXT_PUBLIC_BACKEND_URL.
- This is a non-/api route to avoid ingress conflicts.

## LLM Adapter
- Interface: domain/llm/types.js
- Provider factory: infra/llm/index.js
- Noop provider: infra/llm/noopClient.js (returns deterministic stub data and an "LLM not configured" notice.)

To add a real provider later:
1. Create `infra/llm/yourProvider.js` implementing the LLMClient interface.
2. Update the factory to pick it based on an env var, but keep default as noop.
3. Do not import any vendor SDKs directly in UI. Add them only in the provider module if ever needed and ensure ESLint and CI rules remain satisfied.

## MongoDB disabled behavior
If FastAPI is started without MONGO_URL, it should return 200 with empty payload and header `X-Studiebot-DB: disabled`. The UI is defensive and continues to render, showing empty states.

## Scripts
- yarn dev — start Next.js locally
- yarn build — build the app (includes CI scan to ensure no LLM SDKs)
- yarn start — start Next.js in production mode
- yarn test — run unit tests (adapter + UI smoke)

## Tests
- tests/llm.test.js — validates LLMClient response shapes from noop client
- tests/ui.smoke.test.jsx — ensures core navigation renders and LLM-disabled banner shows; mocks materials endpoints with empty results

## ASCII architecture

UI (Next.js pages/components)
  ↕
LLMClient interface (domain/llm)
  ↕
Provider factory (infra/llm/index.js)
  ↕
Noop provider (infra/llm/noopClient.js)

Backend (FastAPI, Kubernetes ingress)
  └─ /api/materials/*  (served by backend only; no Next.js API)
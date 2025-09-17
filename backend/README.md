# Studiebot Backend (FastAPI, UI-only LLM adapter ready)

A minimal, provider-agnostic LLM backend for Studiebot. Disabled by default and safe to run in production with no LLM configured.

## Features
- Endpoints (mounted under /api/llm):
  - POST /api/llm/generate-hints
  - POST /api/llm/grade-quiz
- Disabled-first behavior (returns neutral payloads; header X-Studiebot-LLM: disabled)
- Provider: openai (optional), guarded by env LLM_ENABLED=true and OPENAI_API_KEY
- Guardrails: 10s timeout, retries with backoff, moderation, per-IP 60 req/min, JSON-only outputs, clamped scores
- Secrets and prompts are server-side only (see backend/prompts/*.yaml)

## Project layout
backend/
  app/
    main.py
    models/llm.py
    routers/llm.py
  prompts/
    generate_hints.yaml
    grade_quiz.yaml
  tests/llm/
    test_disabled_mode.py
    test_rate_limit.py
    test_openai_stubbed.py
    test_moderation_block.py
  requirements.txt
  .env.example

## Run locally
```
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

## Env vars (.env.example)
- LLM_ENABLED=false
- LLM_PROVIDER=openai
- OPENAI_API_KEY=
- OPENAI_MODEL_HINTS=gpt-4o-mini
- OPENAI_MODEL_GRADE=gpt-4o-mini
- OPENAI_MODERATION_MODEL=omni-moderation-latest
- CORS_ORIGINS=

## Tests
```
cd backend
pytest -q
```

## Notes
- Frontend lives in /studiebot (Vercel Root Directory = studiebot) and is not modified by this backend.
- Frontend will call these endpoints via its runtime base URL. No changes required in the frontend repo.
- Prompts and secrets never leave the server. The backend always includes header X-Studiebot-LLM to signal enabled/disabled.
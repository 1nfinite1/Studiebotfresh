import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_rate_limit_exceeded(monkeypatch):
    # Enable LLM so the request doesn't return early
    monkeypatch.setenv("LLM_ENABLED", "true")
    monkeypatch.setenv("LLM_PROVIDER", "openai")
    # Don't set OPENAI_API_KEY so it will return "not configured" but still hit the rate limiter
    
    # Try to hit the default 60/minute limit
    # For a faster test, let's try 70 requests to exceed the limit
    hits = 0
    last_status = None
    for i in range(70):
        r = client.post("/api/llm/generate-hints", json={"topicId": "t", "text": "x"})
        last_status = r.status_code
        if r.status_code == 429:
            hits += 1
            break
    assert hits == 1, f"Expected a 429 after many requests, got last status {last_status}"
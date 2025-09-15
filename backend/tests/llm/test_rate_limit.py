import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_rate_limit_exceeded(monkeypatch):
    # reduce limit for test speed by monkeypatching default limiter
    app.state.limiter._default_limits = ["5/minute"]
    hits = 0
    last_status = None
    for i in range(10):
        r = client.post("/api/llm/generate-hints", json={"topicId": "t", "text": "x"})
        last_status = r.status_code
        if r.status_code == 429:
            hits += 1
            break
    assert hits == 1, f"Expected a 429, got last status {last_status}"
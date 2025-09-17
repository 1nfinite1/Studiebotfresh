import os
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_generate_hints_disabled(monkeypatch):
    monkeypatch.delenv("LLM_ENABLED", raising=False)
    r = client.post("/api/llm/generate-hints", json={"topicId": "t1", "text": "hello"})
    assert r.status_code == 200
    assert r.headers.get("X-Studiebot-LLM") == "disabled"
    data = r.json()
    assert data["hints"] == []
    assert data.get("notice") in {"LLM not configured", "not_configured"}


def test_grade_quiz_disabled(monkeypatch):
    monkeypatch.delenv("LLM_ENABLED", raising=False)
    r = client.post("/api/llm/grade-quiz", json={"answers": ["a", "b"]})
    assert r.status_code == 200
    assert r.headers.get("X-Studiebot-LLM") == "disabled"
    data = r.json()
    assert data["score"] == 0
    assert isinstance(data["feedback"], list)
    assert data.get("notice") in {"LLM not configured", "not_configured"}
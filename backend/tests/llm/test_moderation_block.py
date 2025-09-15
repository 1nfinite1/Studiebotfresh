import os
import types
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


class StubModerationsFlagged:
    def create(self, **kwargs):
        return types.SimpleNamespace(results=[{"flagged": True}])


class StubOpenAI:
    def __init__(self, **kwargs): pass
    @property
    def moderations(self):
        return StubModerationsFlagged()


def test_moderation_block(monkeypatch):
    monkeypatch.setenv("LLM_ENABLED", "true")
    monkeypatch.setenv("LLM_PROVIDER", "openai")
    monkeypatch.setenv("OPENAI_API_KEY", "sk-test")

    import sys
    sys.modules['openai'] = types.SimpleNamespace(OpenAI=StubOpenAI)

    r = client.post("/api/llm/generate-hints", json={"topicId": "t1", "text": "bad text"})
    assert r.status_code == 200
    assert r.headers.get("X-Studiebot-LLM") == "enabled"
    data = r.json()
    assert data["hints"] == []
    assert data.get("notice") == "moderation_blocked"
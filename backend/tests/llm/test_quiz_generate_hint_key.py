import json
import types
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


class StubResponses:
    def create(self, **kwargs):
        # Return a JSON with hints for generate_hints path
        return types.SimpleNamespace(content=[types.SimpleNamespace(text=json.dumps({
            "hints": ["Eerste hint", "Tweede hint"]
        }))])


class StubOpenAI:
    def __init__(self, **kwargs): pass
    @property
    def responses(self):
        return StubResponses()


def test_hint_key_disabled(monkeypatch):
    monkeypatch.delenv("LLM_ENABLED", raising=False)
    r = client.post("/api/llm/generate-hints", json={"topicId": "t", "text": "x"})
    assert r.status_code == 200
    d = r.json()
    assert d.get("hint") is None


def test_hint_key_enabled_stub(monkeypatch):
    monkeypatch.setenv("LLM_ENABLED", "true")
    monkeypatch.setenv("LLM_PROVIDER", "openai")
    monkeypatch.setenv("OPENAI_API_KEY", "sk-test")

    import sys
    sys.modules['openai'] = types.SimpleNamespace(OpenAI=StubOpenAI)

    r = client.post("/api/llm/generate-hints", json={"topicId": "t", "text": "x"})
    assert r.status_code == 200
    d = r.json()
    assert d.get("hint") == "Eerste hint"
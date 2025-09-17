import os
import json
import types
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


class StubResponses:
    def create(self, **kwargs):
        # mimic responses API output with .content[0].text
        return types.SimpleNamespace(content=[types.SimpleNamespace(text=json.dumps({
            "hints": ["Hint A", "Hint B"]
        }))])


class StubChatCompletions:
    def create(self, **kwargs):
        class Choice: pass
        class Msg: pass
        m = Msg(); m.content = json.dumps({"score": 88, "feedback": ["Goed", "Netjes"]})
        c = Choice(); c.message = m
        return types.SimpleNamespace(choices=[c])


class StubModerations:
    def create(self, **kwargs):
        return types.SimpleNamespace(results=[{"flagged": False}])


class StubOpenAI:
    def __init__(self, **kwargs): pass
    @property
    def responses(self):
        return StubResponses()
    @property
    def chat(self):
        return types.SimpleNamespace(completions=StubChatCompletions())
    @property
    def moderations(self):
        return StubModerations()


def test_openai_enabled_stubbed(monkeypatch):
    monkeypatch.setenv("LLM_ENABLED", "true")
    monkeypatch.setenv("LLM_PROVIDER", "openai")
    monkeypatch.setenv("OPENAI_API_KEY", "sk-test")

    # monkeypatch OpenAI client
    import builtins
    import sys
    sys.modules['openai'] = types.SimpleNamespace(OpenAI=StubOpenAI)

    # generate-hints
    r = client.post("/api/llm/generate-hints", json={"topicId": "t1", "text": "hello"})
    assert r.status_code == 200
    assert r.headers.get("X-Studiebot-LLM") == "enabled"
    data = r.json()
    assert data["hints"] == ["Hint A", "Hint B"]

    # grade-quiz
    r2 = client.post("/api/llm/grade-quiz", json={"answers": ["a1", "a2"]})
    assert r2.status_code == 200
    assert r2.headers.get("X-Studiebot-LLM") == "enabled"
    d2 = r2.json()
    assert d2["score"] == 88
    assert d2["feedback"] == ["Goed", "Netjes"]
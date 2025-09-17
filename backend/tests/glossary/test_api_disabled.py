from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_glossary_empty_when_unknown():
    r = client.get("/api/glossary", params={"vak": "Geschiedenis", "leerjaar": "2", "hoofdstuk": "1"})
    assert r.status_code == 200
    assert r.json() == {"data": {"terms": []}}
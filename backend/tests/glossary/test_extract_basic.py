from app.routers.glossary import extract_glossary


def test_extract_pairs():
    txt = """
Begrippenlijst
Staatsinrichting — Hoe een staat is georganiseerd.
Democratie: Regeringsvorm waarbij het volk invloed heeft via verkiezingen.
"""
    terms = extract_glossary(txt)
    assert {t['term'] for t in terms} >= {"Staatsinrichting", "Democratie"}


def test_extract_table():
    txt = """
Begrippen
| Begrip | Definitie |
|--------|-----------|
| Monarchie | Land met een koning als staatshoofd |
| Republiek | Land zonder koning |
"""
    terms = extract_glossary(txt)
    assert any(t["term"] == "Monarchie" for t in terms)
    assert any(t["term"] == "Republiek" for t in terms)
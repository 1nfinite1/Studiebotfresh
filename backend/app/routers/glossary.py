import re
from typing import Dict, List, Tuple
from fastapi import APIRouter, Body
from fastapi import Response

router = APIRouter()

# In-memory store (DB disabled by default). Keyed by (vak, leerjaar, hoofdstuk)
_STORE: Dict[Tuple[str, str, str], List[Dict[str, str]]] = {}


def extract_glossary(text: str) -> List[Dict[str, str]]:
    if not text or not isinstance(text, str):
        return []
    lines = text.splitlines()

    # Try to locate glossary section by header keywords
    header_idx = -1
    header_pat = re.compile(r"^(\s*(begrip|begrippen|begrippenlijst|woordenlijst)\s*:?)$", re.I)
    for i, ln in enumerate(lines):
        if header_pat.match(ln.strip()):
            header_idx = i
            break

    search_lines = lines[header_idx + 1 :] if header_idx >= 0 else lines

    terms: List[Dict[str, str]] = []
    # Pattern 1: "Term — definitie" or "Term - definitie"
    dash_pat = re.compile(r"^\s*([^\-—:|]+?)\s*[—-]\s*(.+)$")
    colon_pat = re.compile(r"^\s*([^:|]+?)\s*:\s*(.+)$")

    for ln in search_lines:
        s = ln.strip()
        if not s:
            continue
        m = dash_pat.match(s)
        if m:
            term, definition = m.group(1).strip(), m.group(2).strip()
            if term and definition:
                terms.append({"term": term, "definition": definition})
                continue
        m2 = colon_pat.match(s)
        if m2:
            term, definition = m2.group(1).strip(), m2.group(2).strip()
            if term and definition:
                terms.append({"term": term, "definition": definition})
                continue

    if terms:
        return _dedupe_terms(terms)

    # Pattern 2: Simple Markdown-like 2-col table with headers including Begrip/Definitie
    table_rows = [ln for ln in search_lines if "|" in ln]
    if table_rows:
        # Expect header row
        hdr = table_rows[0].lower()
        if ("begrip" in hdr or "term" in hdr) and ("definitie" in hdr or "betekenis" in hdr):
            for row in table_rows[1:]:
                cols = [c.strip() for c in row.split("|") if c.strip()]
                if len(cols) >= 2:
                    term, definition = cols[0], cols[1]
                    if term and definition:
                        terms.append({"term": term, "definition": definition})
    return _dedupe_terms(terms)


def _dedupe_terms(items: List[Dict[str, str]]) -> List[Dict[str, str]]:
    seen = set()
    out: List[Dict[str, str]] = []
    for it in items:
        key = it["term"].strip().lower()
        if key in seen:
            continue
        seen.add(key)
        out.append({"term": it["term"].strip(), "definition": it["definition"].strip()})
    return out


@router.get("/glossary")
async def get_glossary(vak: str, leerjaar: str, hoofdstuk: str, response: Response):
    # DB disabled by default: serve in-memory if present, else empty
    key = (vak or "", leerjaar or "", hoofdstuk or "")
    terms = _STORE.get(key, [])
    return {"data": {"terms": terms}}


@router.post("/glossary/refresh")
async def refresh_glossary(
    payload: Dict = Body(...),
    response: Response = None,  # type: ignore
):
    vak = str(payload.get("vak", ""))
    leerjaar = str(payload.get("leerjaar", ""))
    hoofdstuk = str(payload.get("hoofdstuk", ""))
    text = str(payload.get("text", ""))
    terms = extract_glossary(text)
    # DB disabled: we do not persist by default; but keep ephemeral for the process lifetime
    if vak and leerjaar and hoofdstuk:
        _STORE[(vak, leerjaar, hoofdstuk)] = terms
    return {"data": {"terms": terms}}
import json
import os
import time
from typing import Dict, List, Optional

import anyio
import yaml
from fastapi import APIRouter, Depends, Header, HTTPException, Request, Response
from pydantic import ValidationError
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.models.llm import (
    GenerateHintsIn,
    GenerateHintsOut,
    GradeQuizIn,
    GradeQuizOut,
)

router = APIRouter()


# Utilities

def _bool_env(name: str, default: bool = False) -> bool:
    val = os.environ.get(name)
    if val is None:
        return default
    return str(val).strip().lower() in {"1", "true", "yes", "on"}


def _load_yaml_prompt(filename: str) -> str:
    # Prompts live in /backend/prompts/
    base = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "prompts"))
    path = os.path.join(base, filename)
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f)
            if isinstance(data, str):
                return data
            return json.dumps(data)
    except Exception:
        # Never crash on prompt file issues; keep private
        return ""


async def _sleep_backoff(sec: float) -> None:
    await anyio.sleep(sec)


def _effective_enabled() -> bool:
    if not _bool_env("LLM_ENABLED", False):
        return False
    prov = os.environ.get("LLM_PROVIDER", "openai").strip().lower()
    if prov == "openai" and not os.environ.get("OPENAI_API_KEY"):
        return False
    return True


# Moderation
async def _moderation_flagged(text: str) -> bool:
    prov = os.environ.get("LLM_PROVIDER", "openai").strip().lower()
    if prov != "openai":
        return False
    # OpenAI moderation
    try:
        from openai import OpenAI  # lazy import

        client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))
        model = os.environ.get("OPENAI_MODERATION_MODEL", "omni-moderation-latest")
        with anyio.fail_after(10):
            res = client.moderations.create(model=model, input=text)
        # Attempt to read flag
        flagged = False
        try:
            # SDK returns res.results[0].flagged
            flagged = bool(getattr(res, "results")[0].get("flagged", False))  # type: ignore
        except Exception:
            flagged = False
        return flagged
    except Exception:
        return False


# Provider calls
async def _openai_generate_hints(topic_id: str, text: str) -> Dict:
    from openai import OpenAI

    client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))
    model = os.environ.get("OPENAI_MODEL_HINTS", "gpt-4o-mini")
    system = _load_yaml_prompt("generate_hints.yaml")
    user = json.dumps({"topicId": topic_id, "text": text}, ensure_ascii=False)

    # Try Responses API with JSON-only; fall back to chat.completions JSON mode
    for attempt, delay in enumerate([0.0, 0.25, 0.8]):
        try:
            if delay:
                await _sleep_backoff(delay)
            with anyio.fail_after(10):
                try:
                    # Prefer Responses API (if available)
                    resp = client.responses.create(
                        model=model,
                        input=[
                            {"role": "system", "content": system},
                            {"role": "user", "content": user},
                        ],
                        response_format={"type": "json_object"},
                    )
                    content = getattr(resp, "output", None) or getattr(resp, "content", None)
                    text_out = None
                    if isinstance(content, list) and content:
                        # v1.51: content[0].text
                        text_out = getattr(content[0], "text", None)
                    if not text_out:
                        text_out = getattr(resp, "text", None)
                except Exception:
                    # Fallback: chat.completions
                    comp = client.chat.completions.create(
                        model=model,
                        messages=[
                            {"role": "system", "content": system},
                            {"role": "user", "content": user},
                        ],
                        response_format={"type": "json_object"},
                    )
                    text_out = comp.choices[0].message.content
            data = json.loads(text_out or "{}")
            return data
        except Exception:
            if attempt == 2:
                raise
            continue


async def _openai_grade_quiz(answers: List[str]) -> Dict:
    from openai import OpenAI

    client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))
    model = os.environ.get("OPENAI_MODEL_GRADE", "gpt-4o-mini")
    system = _load_yaml_prompt("grade_quiz.yaml")
    user = json.dumps({"answers": answers}, ensure_ascii=False)

    for attempt, delay in enumerate([0.0, 0.25, 0.8]):
        try:
            if delay:
                await _sleep_backoff(delay)
            with anyio.fail_after(10):
                try:
                    resp = client.responses.create(
                        model=model,
                        input=[
                            {"role": "system", "content": system},
                            {"role": "user", "content": user},
                        ],
                        response_format={"type": "json_object"},
                    )
                    content = getattr(resp, "output", None) or getattr(resp, "content", None)
                    text_out = None
                    if isinstance(content, list) and content:
                        text_out = getattr(content[0], "text", None)
                    if not text_out:
                        text_out = getattr(resp, "text", None)
                except Exception:
                    comp = client.chat.completions.create(
                        model=model,
                        messages=[
                            {"role": "system", "content": system},
                            {"role": "user", "content": user},
                        ],
                        response_format={"type": "json_object"},
                    )
                    text_out = comp.choices[0].message.content
            data = json.loads(text_out or "{}")
            return data
        except Exception:
            if attempt == 2:
                raise
            continue


# Dependencies

def get_limiter(request: Request) -> Limiter:
    return request.app.state.limiter  # type: ignore


# Endpoints

@router.post("/generate-hints", response_model=GenerateHintsOut)
async def generate_hints(
    payload: GenerateHintsIn,
    request: Request,
    response: Response,
    limiter: Limiter = Depends(get_limiter),
):
    # Apply rate limit per-IP (explicit in addition to default)
    await limiter.hit(request, "60/minute")  # type: ignore

    if not _bool_env("LLM_ENABLED", False):
        response.headers["X-Studiebot-LLM"] = "disabled"
        return GenerateHintsOut(hints=[], notice="LLM not configured")

    provider = os.environ.get("LLM_PROVIDER", "openai").strip().lower()
    if provider == "openai" and not os.environ.get("OPENAI_API_KEY"):
        response.headers["X-Studiebot-LLM"] = "disabled"
        return GenerateHintsOut(hints=[], notice="not_configured")

    # Moderation
    if await _moderation_flagged(f"{payload.topicId}\n\n{payload.text}"):
        response.headers["X-Studiebot-LLM"] = "enabled"
        return GenerateHintsOut(hints=[], notice="moderation_blocked")

    # Provider call
    try:
        if provider == "openai":
            data = await _openai_generate_hints(payload.topicId, payload.text)
        else:
            data = {}
        # Validate and coerce
        hints_raw = data.get("hints") if isinstance(data, dict) else []
        if not isinstance(hints_raw, list):
            hints_raw = []
        hints = [str(x) for x in hints_raw][:5]
        out = GenerateHintsOut(hints=hints)
        response.headers["X-Studiebot-LLM"] = "enabled"
        return out
    except Exception:
        response.headers["X-Studiebot-LLM"] = "enabled"
        return GenerateHintsOut(hints=[], notice="provider_error")


@router.post("/grade-quiz", response_model=GradeQuizOut)
async def grade_quiz(
    payload: GradeQuizIn,
    request: Request,
    response: Response,
    limiter: Limiter = Depends(get_limiter),
):
    await limiter.hit(request, "60/minute")  # type: ignore

    if not _bool_env("LLM_ENABLED", False):
        response.headers["X-Studiebot-LLM"] = "disabled"
        return GradeQuizOut(score=0, feedback=["LLM not configured"], notice="LLM not configured")

    provider = os.environ.get("LLM_PROVIDER", "openai").strip().lower()
    if provider == "openai" and not os.environ.get("OPENAI_API_KEY"):
        response.headers["X-Studiebot-LLM"] = "disabled"
        return GradeQuizOut(score=0, feedback=["LLM not configured"], notice="not_configured")

    # Moderation
    if await _moderation_flagged("\n\n".join([str(a) for a in payload.answers])):
        response.headers["X-Studiebot-LLM"] = "enabled"
        return GradeQuizOut(score=0, feedback=["moderation blocked"], notice="moderation_blocked")

    try:
        if provider == "openai":
            data = await _openai_grade_quiz(payload.answers)
        else:
            data = {}
        score = 0
        feedback: List[str] = []
        if isinstance(data, dict):
            score = int(data.get("score", 0))
            feedback_raw = data.get("feedback", [])
            if not isinstance(feedback_raw, list):
                feedback_raw = []
            feedback = [str(x) for x in feedback_raw][:10]
        # clamp score
        score = max(0, min(100, score))
        out = GradeQuizOut(score=score, feedback=feedback)
        response.headers["X-Studiebot-LLM"] = "enabled"
        return out
    except Exception:
        response.headers["X-Studiebot-LLM"] = "enabled"
        return GradeQuizOut(score=0, feedback=["provider error"], notice="provider_error")
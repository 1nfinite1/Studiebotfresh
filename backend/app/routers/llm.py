import json
import os
import re
import uuid
from typing import Dict, List

import anyio
import yaml
from fastapi import APIRouter, Header, Request, Response

from app.models.llm import (
    GenerateHintsIn,
    GenerateHintsOut,
    FollowUpQuestion,
    Hint,
    GradeQuizIn,
    GradeQuizOut,
)
from app.rate_limiter import limiter

router = APIRouter()


def _bool_env(name: str, default: bool = False) -> bool:
    val = os.environ.get(name)
    if val is None:
        return default
    return str(val).strip().lower() in {"1", "true", "yes", "on"}


def _load_yaml_prompt(filename: str) -> str:
    base = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "prompts"))
    path = os.path.join(base, filename)
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f)
            if isinstance(data, str):
                return data
            return json.dumps(data)
    except Exception:
        return ""


async def _sleep_backoff(sec: float) -> None:
    await anyio.sleep(sec)


async def _moderation_flagged(text: str) -> bool:
    prov = os.environ.get("LLM_PROVIDER", "openai").strip().lower()
    if prov != "openai":
        return False
    try:
        from openai import OpenAI

        client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))
        model = os.environ.get("OPENAI_MODERATION_MODEL", "omni-moderation-latest")
        with anyio.fail_after(10):
            res = client.moderations.create(model=model, input=text)
        flagged = False
        try:
            # Only flag for high-confidence harmful content, not casual language
            result = getattr(res, "results")[0]
            categories = result.get("categories", {})
            category_scores = result.get("category_scores", {})
            
            # Only flag for serious violations with high confidence scores
            serious_violations = [
                "harassment/threatening",
                "hate",
                "self-harm",
                "sexual/minors",
                "violence"
            ]
            
            for violation in serious_violations:
                if categories.get(violation, False) and category_scores.get(violation, 0) > 0.8:
                    flagged = True
                    break
                    
        except Exception:
            flagged = False
        return flagged
    except Exception:
        return False


async def _openai_generate_hints(topic_id: str, text: str, previous_answer: str = None, mode: str = "leren") -> Dict:
    from openai import OpenAI

    client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))
    model = os.environ.get("OPENAI_MODEL_HINTS", "gpt-4o-mini")
    system = _load_yaml_prompt("generate_hints.yaml")
    
    # Build context-aware user prompt
    user_prompt = _build_context_prompt(topic_id, text, previous_answer, mode)

    for attempt, delay in enumerate([0.0, 0.25, 0.8]):
        try:
            if delay:
                await _sleep_backoff(delay)
            with anyio.fail_after(20):  # Increased timeout
                try:
                    resp = client.responses.create(
                        model=model,
                        input=[
                            {"role": "system", "content": system},
                            {"role": "user", "content": user_prompt},
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
                            {"role": "user", "content": user_prompt},
                        ],
                        response_format={"type": "json_object"},
                        max_tokens=1500,  # Increased from 1000
                        temperature=0.7,
                        stop=["\nVraag:", "\nQ:", "\n\nVraag"]  # Stop sequences
                    )
                    text_out = comp.choices[0].message.content
            
            data = json.loads(text_out or "{}")
            
            # Post-process the response
            processed_data = _post_process_llm_response(data, mode)
            return processed_data
            
        except Exception as e:
            if attempt == 2:
                # On final failure, return fallback
                return {
                    "tutor_message": "Laten we doorgaan met het onderwerp.",
                    "follow_up_question": {
                        "id": str(uuid.uuid4())[:8],
                        "text": "Wat vind je interessant aan dit onderwerp?"
                    },
                    "hint": None
                }
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


def _post_process_llm_response(data: Dict, mode: str = "leren") -> Dict:
    """Post-process LLM response to ensure quality and consistency."""
    
    # Extract fields with fallbacks
    tutor_message = str(data.get("tutor_message", "")).strip()
    follow_up_question_raw = data.get("follow_up_question", "")
    hint_raw = data.get("hint", "")
    
    # 1. Remove questions from tutor_message
    tutor_message = re.sub(r'\?[^?]*$', '', tutor_message).strip()
    tutor_message = re.sub(r'Wat [^.!]*\?', '', tutor_message).strip()
    tutor_message = re.sub(r'Hoe [^.!]*\?', '', tutor_message).strip()
    tutor_message = re.sub(r'Waarom [^.!]*\?', '', tutor_message).strip()
    
    # Ensure it's not empty after cleaning
    if not tutor_message or len(tutor_message) < 10:
        if mode == "overhoren":
            tutor_message = "Goed, laten we doorgaan."
        else:
            tutor_message = "Interessant! Laten we verder gaan."
    
    # Limit to ~80 words
    words = tutor_message.split()
    if len(words) > 80:
        tutor_message = ' '.join(words[:80]) + '...'
    
    # 2. Ensure follow_up_question is complete
    follow_up_text = str(follow_up_question_raw).strip()
    if not follow_up_text.endswith('?'):
        follow_up_text += '?'
    
    # Check if truncated (basic heuristic)
    if len(follow_up_text) < 10 or follow_up_text.count(' ') < 3:
        if mode == "overhoren":
            follow_up_text = "Wat is het volgende belangrijke punt in dit onderwerp?"
        else:
            follow_up_text = "Wat denk je hierover?"
    
    # Create question ID
    question_id = str(uuid.uuid4())[:8]
    
    # 3. Process hint
    hint_text = str(hint_raw).strip() if hint_raw else ""
    if hint_text:
        # Limit to one sentence
        first_sentence = re.split(r'[.!?]', hint_text)[0].strip()
        if first_sentence:
            hint_text = first_sentence + ('.' if not first_sentence.endswith(('.', '!', '?')) else '')
    
    return {
        "tutor_message": tutor_message,
        "follow_up_question": {
            "id": question_id,
            "text": follow_up_text
        },
        "hint": {
            "for_question_id": question_id,
            "text": hint_text
        } if hint_text else None
    }


def _build_context_prompt(topic_id: str, text: str, previous_answer: str = None, mode: str = "leren") -> str:
    """Build context-aware prompt based on conversation history."""
    
    context = f'Onderwerp: "{topic_id}"\n'
    
    if previous_answer:
        context += f'Student antwoordde eerder: "{previous_answer}"\n'
        if mode == "leren":
            context += f'Huidige student input: "{text}"\n\n'
            context += 'Geef feedback op het student antwoord en stel een verdiepende vraag.'
        else:  # overhoren
            context += f'Nieuwe student antwoord: "{text}"\n\n'
            context += 'Geef feedback (correct/incorrect) en stel de volgende overhoring vraag.'
    else:
        context += f'Student input: "{text}"\n\n'
        if mode == "leren":
            context += 'Start de leer-interactie met een eerste verdiepende vraag.'
        else:  # overhoren
            context += 'Start de overhoring met de eerste vraag.'
    
    return context


def _echo_emoji_mode(resp: Response, emoji_mode: str | None):
    if emoji_mode:
        resp.headers["X-Studiebot-Emoji-Mode"] = emoji_mode


@router.post("/generate-hints", response_model=GenerateHintsOut)
@limiter.limit("60/minute")
async def generate_hints(
    payload: GenerateHintsIn,
    request: Request,
    response: Response,
    x_emoji_mode: str | None = Header(default=None, alias="X-Emoji-Mode"),
):
    if not _bool_env("LLM_ENABLED", False):
        response.headers["X-Studiebot-LLM"] = "disabled"
        _echo_emoji_mode(response, x_emoji_mode)
        return GenerateHintsOut(
            tutor_message="LLM niet geconfigureerd",
            follow_up_question=FollowUpQuestion(id="fallback", text="Wat wil je leren?"),
            notice="LLM not configured"
        )

    provider = os.environ.get("LLM_PROVIDER", "openai").strip().lower()
    if provider == "openai" and not os.environ.get("OPENAI_API_KEY"):
        response.headers["X-Studiebot-LLM"] = "disabled"
        _echo_emoji_mode(response, x_emoji_mode)
        return GenerateHintsOut(
            tutor_message="LLM niet geconfigureerd",
            follow_up_question=FollowUpQuestion(id="fallback", text="Wat wil je leren?"),
            notice="not_configured"
        )

    moderation_text = f"{payload.topicId}\n\n{payload.text}"
    if payload.previous_answer:
        moderation_text += f"\n\n{payload.previous_answer}"
        
    if await _moderation_flagged(moderation_text):
        response.headers["X-Studiebot-LLM"] = "enabled"
        _echo_emoji_mode(response, x_emoji_mode)
        return GenerateHintsOut(
            tutor_message="Dit onderwerp kunnen we hier niet bespreken.",
            follow_up_question=FollowUpQuestion(id="blocked", text="Heb je een ander onderwerp?"),
            notice="moderation_blocked"
        )

    try:
        if provider == "openai":
            data = await _openai_generate_hints(
                payload.topicId, 
                payload.text, 
                payload.previous_answer,
                payload.mode or "leren"
            )
        else:
            data = {}
        
        # Extract from processed data
        tutor_message = data.get("tutor_message", "Laten we verder gaan.")
        follow_up_data = data.get("follow_up_question", {})
        hint_data = data.get("hint")
        
        # Create response objects
        follow_up_question = FollowUpQuestion(
            id=follow_up_data.get("id", str(uuid.uuid4())[:8]),
            text=follow_up_data.get("text", "Wat denk je hierover?")
        )
        
        hint = None
        if hint_data and hint_data.get("text"):
            hint = Hint(
                for_question_id=hint_data.get("for_question_id", follow_up_question.id),
                text=hint_data["text"]
            )
        
        # Legacy hints field for backward compatibility
        legacy_hints = [hint.text] if hint else []
        
        out = GenerateHintsOut(
            tutor_message=tutor_message,
            follow_up_question=follow_up_question,
            hint=hint,
            hints=legacy_hints
        )
        
        response.headers["X-Studiebot-LLM"] = "enabled"
        _echo_emoji_mode(response, x_emoji_mode)
        return out
        
    except Exception as e:
        response.headers["X-Studiebot-LLM"] = "enabled"
        _echo_emoji_mode(response, x_emoji_mode)
        return GenerateHintsOut(
            tutor_message="Er ging iets mis. Laten we opnieuw beginnen.",
            follow_up_question=FollowUpQuestion(id="error", text="Wat wil je weten?"),
            notice="provider_error"
        )


@router.post("/grade-quiz", response_model=GradeQuizOut)
@limiter.limit("60/minute")
async def grade_quiz(
    payload: GradeQuizIn,
    request: Request,
    response: Response,
    x_emoji_mode: str | None = Header(default=None, alias="X-Emoji-Mode"),
):
    if not _bool_env("LLM_ENABLED", False):
        response.headers["X-Studiebot-LLM"] = "disabled"
        _echo_emoji_mode(response, x_emoji_mode)
        return GradeQuizOut(score=0, feedback=["LLM not configured"], notice="LLM not configured")

    provider = os.environ.get("LLM_PROVIDER", "openai").strip().lower()
    if provider == "openai" and not os.environ.get("OPENAI_API_KEY"):
        response.headers["X-Studiebot-LLM"] = "disabled"
        _echo_emoji_mode(response, x_emoji_mode)
        return GradeQuizOut(score=0, feedback=["LLM not configured"], notice="not_configured")

    if await _moderation_flagged("\n\n".join([str(a) for a in payload.answers])):
        response.headers["X-Studiebot-LLM"] = "enabled"
        _echo_emoji_mode(response, x_emoji_mode)
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
        score = max(0, min(100, score))
        out = GradeQuizOut(score=score, feedback=feedback)
        response.headers["X-Studiebot-LLM"] = "enabled"
        _echo_emoji_mode(response, x_emoji_mode)
        return out
    except Exception:
        response.headers["X-Studiebot-LLM"] = "enabled"
        _echo_emoji_mode(response, x_emoji_mode)
        return GradeQuizOut(score=0, feedback=["provider error"], notice="provider_error")
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


def _load_yaml_prompt(filename: str, context: str = "") -> str:
    base = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "prompts"))
    path = os.path.join(base, filename)
    try:
        with open(path, "r", encoding="utf-8") as f:
            content = f.read()
            # Simple template substitution
            content = content.replace("{{context}}", context)
            data = yaml.safe_load(content)
            if isinstance(data, dict) and "system" in data:
                return data["system"]
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
    
    # Build context-aware user prompt
    context = _build_context_prompt(topic_id, text, previous_answer, mode)
    system = _load_yaml_prompt("generate_hints.yaml", context)

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
                            {"role": "user", "content": "Genereer de response volgens het JSON formaat."},
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
                            {"role": "user", "content": "Genereer de response volgens het JSON formaat."},
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


def _echo_emoji_mode(resp: Response, emoji_mode: str | None):
    if emoji_mode:
        resp.headers["X-Studiebot-Emoji-Mode"] = emoji_mode


def _calculate_hint_relevance(hint_text: str, question_text: str) -> float:
    """Calculate relevance score between hint and question (0.0-1.0)."""
    if not hint_text or not question_text:
        return 0.0
    
    hint_words = set(hint_text.lower().split())
    question_words = set(question_text.lower().split())
    
    # Remove common Dutch words
    common_words = {'de', 'het', 'een', 'en', 'van', 'is', 'was', 'zijn', 'wat', 'hoe', 'waar', 'waarom', 'wie'}
    hint_words -= common_words
    question_words -= common_words
    
    if not hint_words or not question_words:
        return 0.2  # Default low score
    
    # Calculate overlap
    overlap = len(hint_words & question_words)
    return min(1.0, overlap / len(question_words))


def _post_process_llm_response(data: Dict, mode: str = "leren") -> Dict:
    """Enhanced post-processor with debugging and quality checks."""
    
    print(f"[DEBUG] Raw LLM response: {data}")
    print(f"[DEBUG] Mode: {mode}")
    
    # Extract fields with fallbacks
    tutor_message = str(data.get("tutor_message", "")).strip()
    follow_up_question_raw = data.get("follow_up_question", "")
    hint_raw = data.get("hint", "")
    
    print(f"[DEBUG] Original tutor_message: '{tutor_message}'")
    print(f"[DEBUG] Original follow_up_question: '{follow_up_question_raw}'")
    print(f"[DEBUG] Original hint: '{hint_raw}'")
    
    # 1. Less aggressive question removal from tutor_message
    original_tutor = tutor_message
    if tutor_message:
        # Only remove obvious questions at the end
        tutor_message = re.sub(r'\s*\?[^.!?]*$', '', tutor_message)
        # Remove only complete question sentences
        tutor_message = re.sub(r'\s*[A-Z][^.!?]*\?\s*$', '', tutor_message)
        tutor_message = tutor_message.strip()
    
    print(f"[DEBUG] Cleaned tutor_message: '{tutor_message}'")
    
    # Ensure it's not empty after cleaning, but be less strict
    if not tutor_message or len(tutor_message) < 3:
        if mode == "overhoren":
            if "correct" in original_tutor.lower() or "goed" in original_tutor.lower():
                tutor_message = "Correct! 👍"
            else:
                tutor_message = "Goed geprobeerd."
        else:
            tutor_message = "Interessant! 👍"
    
    # More generous word limit
    words = tutor_message.split()
    if len(words) > 60:  # Increased from 50
        tutor_message = ' '.join(words[:60])
    
    # 2. Less strict follow_up_question processing
    follow_up_text = str(follow_up_question_raw).strip()
    
    print(f"[DEBUG] Processing follow_up_question: '{follow_up_text}'")
    
    # Only auto-complete if really needed
    if follow_up_text and not follow_up_text.endswith('?'):
        follow_up_text += '?'
    
    # Less strict quality checks
    if not follow_up_text or len(follow_up_text) < 5:
        # Generate better fallback based on context
        if mode == "overhoren":
            follow_up_text = "Wat is de volgende belangrijke gebeurtenis?"
        else:
            follow_up_text = "Wat vind je hiervan het interessantst?"
    
    # Create question ID
    question_id = str(uuid.uuid4())[:8]
    
    # 3. Much more lenient hint processing
    hint_text = str(hint_raw).strip() if hint_raw else ""
    hint_obj = None
    
    print(f"[DEBUG] Processing hint: '{hint_text}'")
    
    if hint_text and len(hint_text) > 2:
        # Less strict sentence processing
        sentences = re.split(r'[.!?]', hint_text)
        first_sentence = sentences[0].strip() if sentences else hint_text.strip()
        
        if first_sentence and len(first_sentence) > 2:
            # Ensure proper ending
            if not first_sentence.endswith(('.', '!', '?')):
                first_sentence += '.'
            
            # Much lower relevance threshold
            relevance = _calculate_hint_relevance(first_sentence, follow_up_text)
            print(f"[DEBUG] Hint relevance score: {relevance}")
            
            # Lower threshold for inclusion
            if relevance >= 0.1 or len(first_sentence) > 10:  # Much more lenient
                hint_obj = {
                    "for_question_id": question_id,
                    "text": first_sentence
                }
                print(f"[DEBUG] Hint accepted: '{first_sentence}'")
            else:
                print(f"[DEBUG] Hint rejected due to low relevance: {relevance}")
    
    result = {
        "tutor_message": tutor_message,
        "follow_up_question": {
            "id": question_id,
            "text": follow_up_text
        },
        "hint": hint_obj
    }
    
    print(f"[DEBUG] Final processed result: {result}")
    return result


def _build_context_prompt(topic_id: str, text: str, previous_answer: str = None, mode: str = "leren") -> str:
    """Build enhanced context-aware prompt with better structure."""
    
    context_parts = []
    context_parts.append(f'ONDERWERP: "{topic_id}"')
    
    if mode == "overhoren":
        context_parts.append('MODUS: Overhoren (toets de kennis)')
        if previous_answer:
            context_parts.append(f'VORIGE STUDENT ANTWOORD: "{previous_answer}"')
            context_parts.append(f'NIEUWE STUDENT ANTWOORD: "{text}"')
            context_parts.append('\nGeef kort feedback (correct/incorrect) en stel daarna één nieuwe overhoring vraag.')
        else:
            context_parts.append(f'STUDENT INPUT: "{text}"')
            context_parts.append('\nStart de overhoring met één duidelijke toetsvraag.')
    else:  # leren mode
        context_parts.append('MODUS: Leren (verdiep de kennis)')
        if previous_answer:
            context_parts.append(f'VORIGE STUDENT ANTWOORD: "{previous_answer}"')
            context_parts.append(f'NIEUWE STUDENT INPUT: "{text}"')
            context_parts.append('\nGeef vriendelijke feedback op het antwoord en stel daarna één verdiepende vraag.')
        else:
            context_parts.append(f'STUDENT INPUT: "{text}"')
            context_parts.append('\nStart met een vriendelijke reactie en stel één verdiepende vraag.')
    
    context_parts.append('\nONTHOUD: tutor_message NOOIT een vraag, follow_up_question ALTIJD één vraag, hint ALLEEN voor de nieuwe vraag.')
    
    return '\n'.join(context_parts)


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
        
        # Extract from processed data with validation
        tutor_message = data.get("tutor_message", "Laten we verder gaan.")
        follow_up_data = data.get("follow_up_question", {})
        hint_data = data.get("hint")
        
        # Create response objects with enhanced validation
        try:
            follow_up_question = FollowUpQuestion(
                id=follow_up_data.get("id", str(uuid.uuid4())[:8]),
                text=follow_up_data.get("text", "Wat denk je hierover?")
            )
        except Exception as e:
            # Fallback for invalid questions
            print(f"Question validation failed: {e}, using fallback")
            follow_up_question = FollowUpQuestion(
                id=str(uuid.uuid4())[:8],
                text="Wat vind je interessant aan dit onderwerp?"
            )
        
        hint = None
        if hint_data and hint_data.get("text"):
            try:
                hint = Hint(
                    for_question_id=hint_data.get("for_question_id", follow_up_question.id),
                    text=hint_data["text"]
                )
            except Exception as e:
                # Drop invalid hints rather than failing
                print(f"Hint validation failed: {e}, dropping hint")
                hint = None
        
        # Legacy hints field for backward compatibility
        legacy_hints = [hint.text] if hint else []
        
        try:
            out = GenerateHintsOut(
                tutor_message=tutor_message,
                follow_up_question=follow_up_question,
                hint=hint,
                hints=legacy_hints
            )
        except Exception as e:
            # Ultimate fallback
            print(f"Response validation failed: {e}, using minimal fallback")
            out = GenerateHintsOut(
                tutor_message="Laten we verder gaan.",
                follow_up_question=FollowUpQuestion(
                    id=str(uuid.uuid4())[:8],
                    text="Wat wil je graag weten?"
                ),
                hints=[]
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
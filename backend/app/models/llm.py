from typing import List, Optional
from pydantic import BaseModel, Field, validator
import re


class FollowUpQuestion(BaseModel):
    id: str
    text: str
    
    @validator('text')
    def text_must_be_complete_question(cls, v):
        v = v.strip()
        if not v.endswith('?'):
            v += '?'  # Auto-fix instead of raising error
        if len(v.split()) > 25:  # More lenient limit
            # Truncate instead of failing
            words = v.split()[:20]
            v = ' '.join(words) + '?'
        if len(v) < 5:
            v = "Wat denk je hierover?"  # Fallback instead of error
        return v


class Hint(BaseModel):
    for_question_id: str
    text: str
    
    @validator('text')
    def text_must_be_single_sentence(cls, v):
        v = v.strip()
        if not v:
            return ""  # Allow empty hints instead of failing
        if len(v.split()) > 30:  # More lenient word limit
            # Truncate instead of failing
            words = v.split()[:25]
            v = ' '.join(words)
        # Auto-complete sentence instead of strict validation
        if not any(v.endswith(ending) for ending in ['.', '!', '?']):
            v += '.'
        return v


class GenerateHintsIn(BaseModel):
    topicId: str
    text: str
    # Context from previous interaction
    previous_answer: Optional[str] = None
    mode: Optional[str] = "leren"  # "leren" or "overhoren"


class GenerateHintsOut(BaseModel):
    tutor_message: str = Field(..., max_length=200)  # ~50 words max
    follow_up_question: FollowUpQuestion
    hint: Optional[Hint] = None
    notice: Optional[str] = None
    
    # Legacy fields for backward compatibility
    hints: List[str] = []
    
    @validator('tutor_message')
    def tutor_message_no_questions(cls, v):
        v = v.strip()
        if '?' in v:
            # Remove question parts more aggressively
            v = re.sub(r'\s*[A-Z][^.!?]*\?[^.!?]*', '', v)
            v = re.sub(r'\?[^.!?]*', '', v)
            v = v.strip()
        if not v or len(v) < 5:
            v = "Goed, laten we doorgaan."
        return v


class GradeQuizIn(BaseModel):
    answers: List[str]


class GradeQuizOut(BaseModel):
    score: int = Field(ge=0, le=100)
    feedback: List[str]
    notice: Optional[str] = None
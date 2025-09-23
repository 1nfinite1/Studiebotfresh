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
            raise ValueError('Follow-up question must end with ?')
        if len(v.split()) > 20:  # Stricter limit
            raise ValueError('Follow-up question too long (max ~15 words)')
        if len(v) < 10:
            raise ValueError('Follow-up question too short')
        # Check for incomplete sentences
        if v.count(' ') < 2:
            raise ValueError('Follow-up question seems incomplete')
        return v


class Hint(BaseModel):
    for_question_id: str
    text: str
    
    @validator('text')
    def text_must_be_single_sentence(cls, v):
        v = v.strip()
        if not v:
            raise ValueError('Hint cannot be empty')
        if len(v.split()) > 25:  # Stricter word limit
            raise ValueError('Hint too long (max ~20 words)')
        # Check for multiple sentences
        sentence_endings = len(re.findall(r'[.!?]', v))
        if sentence_endings > 1:
            raise ValueError('Hint must be exactly one sentence')
        if not any(v.endswith(ending) for ending in ['.', '!', '?']):
            v += '.'  # Auto-complete sentence
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
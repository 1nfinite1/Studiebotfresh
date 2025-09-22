from typing import List, Optional
from pydantic import BaseModel, Field, validator


class FollowUpQuestion(BaseModel):
    id: str
    text: str
    
    @validator('text')
    def text_must_be_question(cls, v):
        if not v.strip().endswith('?'):
            raise ValueError('Follow-up question must end with ?')
        if len(v.split()) > 20:  # ~15 words limit with some buffer
            raise ValueError('Follow-up question too long (max ~15 words)')
        return v.strip()


class Hint(BaseModel):
    for_question_id: str
    text: str
    
    @validator('text')
    def text_must_be_single_sentence(cls, v):
        # Count sentences by looking for sentence endings
        sentence_count = len([s for s in v.split('.') if s.strip()]) + \
                        len([s for s in v.split('!') if s.strip()]) + \
                        len([s for s in v.split('?') if s.strip()])
        if sentence_count > 2:  # Allow some flexibility
            raise ValueError('Hint must be one sentence maximum')
        return v.strip()


class GenerateHintsIn(BaseModel):
    topicId: str
    text: str
    # Context from previous interaction
    previous_answer: Optional[str] = None
    mode: Optional[str] = "leren"  # "leren" or "overhoren"


class GenerateHintsOut(BaseModel):
    tutor_message: str = Field(..., max_length=400)  # ~80 words max
    follow_up_question: FollowUpQuestion
    hint: Optional[Hint] = None
    notice: Optional[str] = None
    
    # Legacy fields for backward compatibility
    hints: List[str] = []
    
    @validator('tutor_message')
    def tutor_message_no_questions(cls, v):
        if '?' in v:
            raise ValueError('tutor_message must not contain questions')
        return v.strip()


class GradeQuizIn(BaseModel):
    answers: List[str]


class GradeQuizOut(BaseModel):
    score: int = Field(ge=0, le=100)
    feedback: List[str]
    notice: Optional[str] = None
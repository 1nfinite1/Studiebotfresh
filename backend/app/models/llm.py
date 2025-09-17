from typing import List, Optional
from pydantic import BaseModel, Field


class GenerateHintsIn(BaseModel):
    topicId: str
    text: str


class GenerateHintsOut(BaseModel):
    hints: List[str]
    notice: Optional[str] = None
    # Extended to optionally carry a single hint for quiz generation flows
    hint: Optional[str] = None


class GradeQuizIn(BaseModel):
    answers: List[str]


class GradeQuizOut(BaseModel):
    score: int = Field(ge=0, le=100)
    feedback: List[str]
    notice: Optional[str] = None
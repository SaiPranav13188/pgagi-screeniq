"""Request/response contracts of the public API."""
from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


class AnswerIn(BaseModel):
    answer: str = Field(min_length=1, max_length=6000)
    time_taken_seconds: int | None = Field(default=None, ge=0, le=7200)


class SkipIn(BaseModel):
    time_taken_seconds: int | None = Field(default=None, ge=0, le=7200)


class SearchIn(BaseModel):
    query: str = Field(min_length=3, max_length=400)
    role_id: str | None = None
    book_ids: list[str] | None = None
    top_k: int = Field(default=5, ge=1, le=10)


class TraceOut(BaseModel):
    queries: list[str]
    books: list[str]
    chunks: list[dict[str, Any]]
    grounding_chunk_ids: list[str]
    prompt_version: str
    retrieval_ms: int
    generation_ms: int


class QuestionOut(BaseModel):
    id: str
    seq: int
    topic_index: int
    topic: str
    kind: Literal["primary", "follow_up"]
    parent_id: str | None
    text: str
    question_type: str
    difficulty: int
    resume_link: str | None
    rationale: str | None
    generator: str
    status: str
    created_at: datetime
    trace: TraceOut | None = None
    answer: dict[str, Any] | None = None
    expected_points: list[str] | None = None  # only revealed once answered / in reports


class EventOut(BaseModel):
    id: int
    stage: str
    message: str
    data: dict[str, Any] | None
    duration_ms: int | None
    created_at: datetime


class SessionOut(BaseModel):
    id: str
    role_id: str
    role_title: str
    status: str
    mode: str
    target_questions: int
    candidate_name: str | None
    resume_filename: str | None
    profile: dict[str, Any] | None
    plan: dict[str, Any] | None
    llm_mode: str
    follow_ups_used: int
    difficulty_offset: int
    difficulty_level: str = "auto"
    created_at: datetime
    completed_at: datetime | None
    questions: list[QuestionOut] = []
    current_question_id: str | None = None
    progress: dict[str, Any] = {}


class SessionSummaryOut(BaseModel):
    id: str
    role_id: str
    role_title: str
    candidate_name: str | None
    status: str
    created_at: datetime
    questions: int
    overall_score: float | None
    difficulty_level: str = "auto"


class AnswerResultOut(BaseModel):
    question: QuestionOut
    evaluation: dict[str, Any] | None  # hidden in "interview" mode until the report
    decision: dict[str, Any]
    progress: dict[str, Any]

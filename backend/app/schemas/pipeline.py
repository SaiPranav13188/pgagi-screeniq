"""Typed artefacts flowing through the pipeline.

    ResumeProfile ─► InterviewPlan ─► GeneratedQuestion (+ RetrievalTrace) ─► Evaluation ─► SessionReport

These are validated whenever an LLM produces them, so a malformed model response is
caught at the boundary instead of corrupting the session.
"""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, field_validator

Seniority = Literal["student", "junior", "mid", "senior", "lead"]
QuestionType = Literal["conceptual", "applied", "scenario", "comparison", "debugging", "design"]
Verdict = Literal["excellent", "strong", "adequate", "partial", "weak", "no_answer"]


class Skill(BaseModel):
    name: str
    category: str = "other"
    evidence: str | None = None


class Project(BaseModel):
    title: str
    summary: str = ""
    technologies: list[str] = Field(default_factory=list)


class ResumeProfile(BaseModel):
    name: str | None = None
    email: str | None = None
    headline: str | None = None
    seniority: Seniority = "junior"
    years_experience: float | None = None
    summary: str = ""
    skills: list[Skill] = Field(default_factory=list)
    domains: list[str] = Field(default_factory=list)
    ml_concepts: list[str] = Field(default_factory=list)
    projects: list[Project] = Field(default_factory=list)
    education: list[str] = Field(default_factory=list)
    strength: Literal["emerging", "solid", "strong"] = "solid"
    extraction_method: str = "heuristic"
    word_count: int = 0

    @field_validator("skills", mode="before")
    @classmethod
    def _coerce_skills(cls, v):
        return [{"name": s} if isinstance(s, str) else s for s in (v or [])]

    def skill_names(self) -> list[str]:
        return [s.name for s in self.skills]


class CompetencyAlignment(BaseModel):
    competency_id: str
    name: str
    score: float  # 0..1 overlap between resume and competency
    matched: list[str] = Field(default_factory=list)


class PlannedTopic(BaseModel):
    index: int
    competency_id: str
    title: str
    focus: str
    rationale: str
    resume_anchor: str | None = None  # resume evidence this topic probes (None = role-core coverage)
    difficulty: int = Field(ge=1, le=5)
    question_style: QuestionType = "conceptual"
    queries: list[str] = Field(min_length=1)


DifficultyLevel = Literal["auto", "easy", "medium", "hard"]


class Calibration(BaseModel):
    seniority: Seniority
    base_difficulty: int
    advanced_unlocked: bool
    rationale: str
    # Interviewer-selected level; "auto" lets the resume decide. Every question stays inside `band`.
    level: DifficultyLevel = "auto"
    band: tuple[int, int] = (1, 5)


class InterviewPlan(BaseModel):
    role_id: str
    books: list[str]
    calibration: Calibration
    alignment: list[CompetencyAlignment]
    topics: list[PlannedTopic]
    generator: str


class GeneratedQuestion(BaseModel):
    question: str = Field(min_length=15)
    question_type: QuestionType = "conceptual"
    difficulty: int = Field(ge=1, le=5)
    expected_points: list[str] = Field(default_factory=list)
    grounding_chunk_ids: list[str] = Field(default_factory=list)
    resume_link: str | None = None
    rationale: str = ""


class Evaluation(BaseModel):
    score: float = Field(ge=0, le=10)
    verdict: Verdict
    covered_points: list[str] = Field(default_factory=list)
    missed_points: list[str] = Field(default_factory=list)
    strengths: list[str] = Field(default_factory=list)
    improvements: list[str] = Field(default_factory=list)
    misconceptions: list[str] = Field(default_factory=list)
    feedback: str = ""
    evaluator: str = "offline"


def verdict_for(score: float) -> Verdict:
    if score >= 9:
        return "excellent"
    if score >= 7.5:
        return "strong"
    if score >= 6:
        return "adequate"
    if score >= 4:
        return "partial"
    if score > 0.5:
        return "weak"
    return "no_answer"

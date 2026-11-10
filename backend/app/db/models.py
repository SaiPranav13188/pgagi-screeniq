"""Persistence model.

    InterviewSession 1─* Question 1─1 RetrievalTrace   (how the question was produced)
                              └─1 Answer               (what the candidate said + evaluation)
    InterviewSession 1─1 Report
    InterviewSession 1─* PipelineEvent                 (audit log of every pipeline stage)

JSON columns hold structured artefacts (resume profile, interview plan, evaluation)
whose shape is owned by the Pydantic schemas in `app.schemas`.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import JSON, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base


def _uuid() -> str:
    return uuid.uuid4().hex


def _now() -> datetime:
    return datetime.now(timezone.utc)


class InterviewSession(Base):
    __tablename__ = "interview_sessions"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    role_id: Mapped[str] = mapped_column(String(64), index=True)
    status: Mapped[str] = mapped_column(String(24), default="created", index=True)
    # created -> planned -> in_progress -> completed
    mode: Mapped[str] = mapped_column(String(16), default="interview")  # interview | practice
    target_questions: Mapped[int] = mapped_column(Integer, default=6)
    candidate_name: Mapped[str | None] = mapped_column(String(200))
    resume_filename: Mapped[str | None] = mapped_column(String(255))
    resume_text: Mapped[str] = mapped_column(Text, default="")
    profile: Mapped[dict | None] = mapped_column(JSON)
    plan: Mapped[dict | None] = mapped_column(JSON)
    current_topic_index: Mapped[int] = mapped_column(Integer, default=0)
    follow_ups_used: Mapped[int] = mapped_column(Integer, default=0)
    difficulty_offset: Mapped[int] = mapped_column(Integer, default=0)  # adaptive drift
    difficulty_level: Mapped[str] = mapped_column(String(16), default="auto")  # auto | easy | medium | hard
    llm_mode: Mapped[str] = mapped_column(String(64), default="offline")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    questions: Mapped[list[Question]] = relationship(
        back_populates="session", cascade="all, delete-orphan", order_by="Question.seq"
    )
    report: Mapped[Report | None] = relationship(back_populates="session", cascade="all, delete-orphan")
    events: Mapped[list[PipelineEvent]] = relationship(
        back_populates="session", cascade="all, delete-orphan", order_by="PipelineEvent.id"
    )


class Question(Base):
    __tablename__ = "questions"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    session_id: Mapped[str] = mapped_column(ForeignKey("interview_sessions.id", ondelete="CASCADE"), index=True)
    seq: Mapped[int] = mapped_column(Integer)
    topic_index: Mapped[int] = mapped_column(Integer)
    topic: Mapped[str] = mapped_column(String(255))
    kind: Mapped[str] = mapped_column(String(16), default="primary")  # primary | follow_up
    parent_id: Mapped[str | None] = mapped_column(String(32))
    text: Mapped[str] = mapped_column(Text)
    question_type: Mapped[str] = mapped_column(String(32))  # conceptual | applied | scenario | ...
    difficulty: Mapped[int] = mapped_column(Integer)
    expected_points: Mapped[list | None] = mapped_column(JSON)
    resume_link: Mapped[str | None] = mapped_column(Text)
    rationale: Mapped[str | None] = mapped_column(Text)
    generator: Mapped[str] = mapped_column(String(64))
    status: Mapped[str] = mapped_column(String(16), default="asked")  # asked | answered | skipped
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    session: Mapped[InterviewSession] = relationship(back_populates="questions")
    trace: Mapped[RetrievalTrace | None] = relationship(back_populates="question", cascade="all, delete-orphan")
    answer: Mapped[Answer | None] = relationship(back_populates="question", cascade="all, delete-orphan")


class RetrievalTrace(Base):
    __tablename__ = "retrieval_traces"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    question_id: Mapped[str] = mapped_column(ForeignKey("questions.id", ondelete="CASCADE"), unique=True)
    queries: Mapped[list] = mapped_column(JSON)
    books: Mapped[list] = mapped_column(JSON)
    chunks: Mapped[list] = mapped_column(JSON)  # retrieved chunks + scores + whether cited
    grounding_chunk_ids: Mapped[list] = mapped_column(JSON, default=list)
    prompt_version: Mapped[str] = mapped_column(String(32))
    retrieval_ms: Mapped[int] = mapped_column(Integer, default=0)
    generation_ms: Mapped[int] = mapped_column(Integer, default=0)

    question: Mapped[Question] = relationship(back_populates="trace")


class Answer(Base):
    __tablename__ = "answers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    question_id: Mapped[str] = mapped_column(ForeignKey("questions.id", ondelete="CASCADE"), unique=True)
    text: Mapped[str] = mapped_column(Text)
    time_taken_seconds: Mapped[int | None] = mapped_column(Integer)
    score: Mapped[float | None] = mapped_column(Float)
    evaluation: Mapped[dict | None] = mapped_column(JSON)
    evaluator: Mapped[str] = mapped_column(String(64), default="offline")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    question: Mapped[Question] = relationship(back_populates="answer")


class Report(Base):
    __tablename__ = "reports"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[str] = mapped_column(ForeignKey("interview_sessions.id", ondelete="CASCADE"), unique=True)
    data: Mapped[dict] = mapped_column(JSON)
    generator: Mapped[str] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    session: Mapped[InterviewSession] = relationship(back_populates="report")


class PipelineEvent(Base):
    __tablename__ = "pipeline_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[str] = mapped_column(ForeignKey("interview_sessions.id", ondelete="CASCADE"), index=True)
    stage: Mapped[str] = mapped_column(String(48))
    message: Mapped[str] = mapped_column(Text)
    data: Mapped[dict | None] = mapped_column(JSON)
    duration_ms: Mapped[int | None] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    session: Mapped[InterviewSession] = relationship(back_populates="events")

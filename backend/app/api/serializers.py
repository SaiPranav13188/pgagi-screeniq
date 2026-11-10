"""ORM -> API DTO mapping (kept out of routes and services)."""
from __future__ import annotations

from app.db.models import InterviewSession, Question
from app.rag.catalog import get_role
from app.schemas.api import EventOut, QuestionOut, SessionOut, SessionSummaryOut, TraceOut


def question_out(q: Question, *, reveal: bool = False, mode: str = "interview") -> QuestionOut:
    answered = q.answer is not None
    show_eval = answered and (reveal or mode == "practice")
    answer = None
    if answered:
        answer = {
            "text": q.answer.text,
            "time_taken_seconds": q.answer.time_taken_seconds,
            "created_at": q.answer.created_at,
            # The adaptive decision is not a grade, so it is always visible (drives the UI flow).
            "decision": (q.answer.evaluation or {}).get("decision"),
        }
        if show_eval:
            answer.update({"score": q.answer.score, "evaluation": q.answer.evaluation, "evaluator": q.answer.evaluator})
    return QuestionOut(
        id=q.id, seq=q.seq, topic_index=q.topic_index, topic=q.topic, kind=q.kind, parent_id=q.parent_id,  # type: ignore[arg-type]
        text=q.text, question_type=q.question_type, difficulty=q.difficulty, resume_link=q.resume_link,
        rationale=q.rationale, generator=q.generator, status=q.status, created_at=q.created_at,
        trace=TraceOut(
            queries=q.trace.queries, books=q.trace.books, chunks=q.trace.chunks,
            grounding_chunk_ids=q.trace.grounding_chunk_ids, prompt_version=q.trace.prompt_version,
            retrieval_ms=q.trace.retrieval_ms, generation_ms=q.trace.generation_ms,
        ) if q.trace else None,
        answer=answer,
        expected_points=q.expected_points if show_eval else None,
    )


def progress(s: InterviewSession) -> dict:
    topics = len((s.plan or {}).get("topics", [])) or s.target_questions
    primary_done = len([q for q in s.questions if q.kind == "primary" and q.status != "asked"])
    return {
        "topics_total": topics,
        "topics_done": primary_done,
        "questions_asked": len(s.questions),
        "answered": len([q for q in s.questions if q.status == "answered"]),
        "skipped": len([q for q in s.questions if q.status == "skipped"]),
        "follow_ups": len([q for q in s.questions if q.kind == "follow_up"]),
        "percent": round(100 * primary_done / max(1, topics)),
    }


def session_out(s: InterviewSession) -> SessionOut:
    role = get_role(s.role_id)
    reveal = s.status == "completed"
    current = next((q for q in s.questions if q.status == "asked"), None)
    return SessionOut(
        id=s.id, role_id=s.role_id, role_title=role.title if role else s.role_id, status=s.status, mode=s.mode,
        target_questions=s.target_questions, candidate_name=s.candidate_name, resume_filename=s.resume_filename,
        profile=s.profile, plan=s.plan, llm_mode=s.llm_mode, follow_ups_used=s.follow_ups_used,
        difficulty_offset=s.difficulty_offset, difficulty_level=s.difficulty_level or "auto",
        created_at=s.created_at, completed_at=s.completed_at,
        questions=[question_out(q, reveal=reveal, mode=s.mode) for q in s.questions],
        current_question_id=current.id if current else None,
        progress=progress(s),
    )


def session_summary(s: InterviewSession) -> SessionSummaryOut:
    role = get_role(s.role_id)
    return SessionSummaryOut(
        id=s.id, role_id=s.role_id, role_title=role.title if role else s.role_id, candidate_name=s.candidate_name,
        status=s.status, created_at=s.created_at, questions=len(s.questions),
        overall_score=(s.report.data or {}).get("overall_score") if s.report else None,
        difficulty_level=s.difficulty_level or "auto",
    )


def events_out(s: InterviewSession) -> list[EventOut]:
    return [
        EventOut(id=e.id, stage=e.stage, message=e.message, data=e.data, duration_ms=e.duration_ms, created_at=e.created_at)
        for e in s.events
    ]

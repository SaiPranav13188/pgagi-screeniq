"""Interview orchestration - the session state machine.

    created ──plan──► planned ──next_question──► in_progress ──(answer / skip)*──► completed
                                                     ▲            │
                                                     └─ adaptive ─┘  (follow-up probe or next topic)

Each transition is persisted and logged as a PipelineEvent, so a session can be
resumed after a page refresh and audited afterwards.

Adaptive policy (after every answer):
  * score <  FOLLOW_UP_THRESHOLD on a primary question -> scaffolded follow-up on the same
    topic, grounded in fresh retrieval aimed at the points the candidate missed
    (bounded by MAX_FOLLOW_UPS per session);
  * score >= ESCALATE_THRESHOLD -> difficulty offset +1 for the remaining topics;
  * weak answers                -> difficulty offset -1 (offset is clamped to [-2, +2]).
"""
from __future__ import annotations

import logging
import time
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.errors import ConflictError, NotFoundError, ValidationFailed
from app.db.models import Answer, InterviewSession, PipelineEvent, Question, RetrievalTrace
from app.llm.client import get_llm
from app.prompts.templates import PROMPT_VERSION
from app.rag.catalog import get_role
from app.rag.retriever import get_retriever
from app.schemas.pipeline import Evaluation, InterviewPlan, ResumeProfile
from app.services import evaluator, planner, question_generator, report as report_service, resume_parser

log = logging.getLogger(__name__)


def _event(db: Session, sid: str, stage: str, message: str, data: dict | None = None, ms: int | None = None) -> None:
    db.add(PipelineEvent(session_id=sid, stage=stage, message=message, data=data or {}, duration_ms=ms))


def get_session(db: Session, sid: str) -> InterviewSession:
    s = db.get(InterviewSession, sid)
    if not s:
        raise NotFoundError(f"Interview session '{sid}' not found")
    return s


# --------------------------------------------------------------------------- stage 1-2
def create_session(
    db: Session,
    *,
    filename: str,
    data: bytes,
    role_id: str,
    candidate_name: str | None,
    mode: str,
    num_questions: int | None,
    difficulty: str = "auto",
) -> InterviewSession:
    cfg = get_settings()
    role = get_role(role_id)
    if not role:
        raise ValidationFailed(f"Unknown role '{role_id}'", details={"field": "role_id"})
    if len(data) > cfg.max_upload_mb * 1024 * 1024:
        raise ValidationFailed(f"Resume exceeds {cfg.max_upload_mb} MB")
    n = num_questions or cfg.default_question_count
    if not cfg.min_question_count <= n <= cfg.max_question_count:
        raise ValidationFailed(f"num_questions must be between {cfg.min_question_count} and {cfg.max_question_count}")

    t0 = time.perf_counter()
    text = resume_parser.extract_text(filename, data)
    profile = resume_parser.parse_resume(text)
    ms = int((time.perf_counter() - t0) * 1000)

    s = InterviewSession(
        role_id=role_id,
        mode=mode,
        difficulty_level=difficulty,
        target_questions=n,
        candidate_name=(candidate_name or profile.name or "Candidate").strip()[:200],
        resume_filename=filename[:255],
        resume_text=text,
        profile=profile.model_dump(),
        llm_mode=get_llm().name if get_llm() else "offline",
    )
    db.add(s)
    db.flush()
    _event(db, s.id, "resume_parsed",
           f"Parsed resume: {len(profile.skills)} skills, seniority '{profile.seniority}' ({profile.extraction_method})",
           {"skills": len(profile.skills), "method": profile.extraction_method}, ms)
    db.commit()
    return s


# --------------------------------------------------------------------------- stage 3
def plan_session(db: Session, sid: str) -> InterviewSession:
    s = get_session(db, sid)
    if s.plan and s.status != "created":
        return s  # idempotent
    role = get_role(s.role_id)
    assert role
    t0 = time.perf_counter()
    plan = planner.build_plan(ResumeProfile.model_validate(s.profile), role, s.target_questions, s.difficulty_level or "auto")
    if not plan.books:
        raise ConflictError("Knowledge base is empty. Run ingestion first (python -m scripts.ingest).", code="kb_not_ready")
    s.plan = plan.model_dump()
    s.status = "planned"
    _event(db, s.id, "plan_built",
           f"Built {len(plan.topics)}-topic blueprint over {len(plan.books)} books ({plan.generator})",
           {"books": plan.books, "base_difficulty": plan.calibration.base_difficulty, "level": plan.calibration.level,
            "band": list(plan.calibration.band)}, int((time.perf_counter() - t0) * 1000))
    db.commit()
    return s


# --------------------------------------------------------------------------- stage 4-5
def current_question(s: InterviewSession) -> Question | None:
    return next((q for q in s.questions if q.status == "asked"), None)


def _last_decision(s: InterviewSession) -> dict | None:
    answered = [q for q in s.questions if q.answer is not None]
    if not answered:
        return None
    return (answered[-1].answer.evaluation or {}).get("decision")


def next_question(db: Session, sid: str) -> Question | None:
    s = get_session(db, sid)
    if s.status == "completed":
        raise ConflictError("Interview already completed")
    if s.status == "created":
        plan_session(db, sid)
        s = get_session(db, sid)
    if (q := current_question(s)) is not None:
        return q  # idempotent: unanswered question is re-served (refresh-safe)

    plan = InterviewPlan.model_validate(s.plan)
    band = plan.calibration.band  # the selected Easy/Medium/Hard level bounds every question
    role = get_role(s.role_id)
    assert role
    profile = ResumeProfile.model_validate(s.profile)
    decision = _last_decision(s)
    follow_up_ctx = None
    parent: Question | None = None

    if decision and decision.get("action") == "follow_up":
        parent = next(q for q in reversed(s.questions) if q.answer is not None)
        topic = plan.topics[parent.topic_index]
        missed = (parent.answer.evaluation or {}).get("missed_points", [])[:2]
        queries = [*missed, topic.focus][:3]
        difficulty = planner.clamp_to_band(parent.difficulty - 1, band)
        follow_up_ctx = {"question": parent.text, "answer": parent.answer.text, "missed_points": missed}
        kind = "follow_up"
    else:
        primary_done = len([q for q in s.questions if q.kind == "primary"])
        if primary_done >= len(plan.topics):
            return None
        topic = plan.topics[primary_done]
        queries = topic.queries
        difficulty = planner.clamp_to_band(topic.difficulty + s.difficulty_offset, band)
        kind = "primary"

    # Stage 4: retrieval (avoid recycling passages already used for other topics)
    used_ids = [c["id"] for q in s.questions if q.trace and q.topic_index != topic.index for c in q.trace.chunks]
    result = get_retriever().retrieve(queries, plan.books, exclude_ids=used_ids)
    _event(db, s.id, "retrieval",
           f"Retrieved {len(result.chunks)} chunks for '{topic.title}' from {result.candidates_considered} candidates",
           {"queries": result.queries, "chunk_ids": [c.id for c in result.chunks]}, result.elapsed_ms)

    # Stage 5: generation
    t0 = time.perf_counter()
    gen, generator = question_generator.generate_question(
        role_title=role.title,
        profile=profile,
        topic=topic,
        difficulty=difficulty,
        chunks=result.chunks,
        previous_questions=[q.text for q in s.questions],
        adaptive_note=_adaptive_note(s, decision),
        follow_up=follow_up_ctx,
    )
    gen_ms = int((time.perf_counter() - t0) * 1000)

    q = Question(
        session_id=s.id,
        seq=len(s.questions) + 1,
        topic_index=topic.index,
        topic=topic.title,
        kind=kind,
        parent_id=parent.id if parent else None,
        text=gen.question.strip(),
        question_type=gen.question_type,
        difficulty=gen.difficulty,
        expected_points=gen.expected_points,
        resume_link=gen.resume_link,
        rationale=gen.rationale,
        generator=generator,
    )
    cited = set(gen.grounding_chunk_ids)
    q.trace = RetrievalTrace(
        queries=result.queries,
        books=result.books,
        chunks=[c.to_trace(cited=c.id in cited) for c in result.chunks],
        grounding_chunk_ids=list(cited),
        prompt_version=PROMPT_VERSION if generator != "offline-extractive" else "extractive/v1",
        retrieval_ms=result.elapsed_ms,
        generation_ms=gen_ms,
    )
    db.add(q)
    if s.status == "planned":
        s.status = "in_progress"
    _event(db, s.id, "question_generated",
           f"Q{q.seq} ({kind}, difficulty {q.difficulty}/5) on '{topic.title}' via {generator}",
           {"question_id": q.id, "cited": list(cited)}, gen_ms)
    db.commit()
    db.refresh(q)
    return q


def _adaptive_note(s: InterviewSession, decision: dict | None) -> str:
    answered = [q for q in s.questions if q.answer is not None and q.answer.score is not None]
    if not answered:
        return "First question: open at the calibrated level to build rapport."
    recent = answered[-2:]
    perf = ", ".join(f"Q{q.seq} {q.topic}: {q.answer.score:.1f}/10" for q in recent)
    trend = "performing strongly - raise the bar" if s.difficulty_offset > 0 else (
        "struggling - keep it concrete and scaffolded" if s.difficulty_offset < 0 else "performing at the expected level")
    return f"Recent performance: {perf}. Candidate is {trend}."


# --------------------------------------------------------------------------- stage 6-7
def _get_question(s: InterviewSession, qid: str) -> Question:
    q = next((q for q in s.questions if q.id == qid), None)
    if not q:
        raise NotFoundError(f"Question '{qid}' not found in this session")
    if q.status != "asked":
        raise ConflictError("This question has already been answered or skipped")
    return q


def submit_answer(db: Session, sid: str, qid: str, text: str, time_taken: int | None, skipped: bool = False) -> tuple[Question, Evaluation, dict]:
    cfg = get_settings()
    s = get_session(db, sid)
    if s.status == "completed":
        raise ConflictError("Interview already completed")
    q = _get_question(s, qid)
    text = (text or "").strip()
    if not skipped and not text:
        raise ValidationFailed("Answer cannot be empty - use skip instead", details={"field": "answer"})
    if len(text) > cfg.max_answer_chars:
        raise ValidationFailed(f"Answer exceeds {cfg.max_answer_chars} characters", details={"field": "answer"})

    t0 = time.perf_counter()
    chunks = [c for c in (q.trace.chunks if q.trace else []) if c.get("cited")] or (q.trace.chunks[:3] if q.trace else [])
    if skipped:
        ev = Evaluation(score=0, verdict="no_answer", feedback="Question skipped.", evaluator="rule",
                        missed_points=q.expected_points or [])
    else:
        ev = evaluator.evaluate_answer(q.text, q.difficulty, q.expected_points or [], chunks, text)
    ms = int((time.perf_counter() - t0) * 1000)

    decision = _decide(s, q, ev, skipped)
    q.status = "skipped" if skipped else "answered"
    q.answer = Answer(
        text=text,
        time_taken_seconds=time_taken,
        score=ev.score,
        evaluation={**ev.model_dump(), "decision": decision},
        evaluator=ev.evaluator,
    )
    _event(db, s.id, "answer_evaluated",
           f"Q{q.seq} {'skipped' if skipped else f'scored {ev.score:.1f}/10 ({ev.verdict})'} -> {decision['label']}",
           {"question_id": q.id, "score": ev.score, "decision": decision}, ms)
    db.commit()
    return q, ev, decision


def _decide(s: InterviewSession, q: Question, ev: Evaluation, skipped: bool) -> dict:
    cfg = get_settings()
    plan = InterviewPlan.model_validate(s.plan)
    primary_done = len([x for x in s.questions if x.kind == "primary"])
    if not skipped:
        if ev.score >= cfg.escalate_threshold:
            s.difficulty_offset = min(2, s.difficulty_offset + 1)
        elif ev.score < cfg.follow_up_threshold:
            s.difficulty_offset = max(-2, s.difficulty_offset - 1)
    can_follow = q.kind == "primary" and not skipped and ev.score < cfg.follow_up_threshold and ev.verdict != "no_answer"
    if can_follow and s.follow_ups_used < cfg.max_follow_ups:
        s.follow_ups_used += 1
        return {"action": "follow_up", "label": "follow-up probe on the same topic",
                "reason": f"Score {ev.score:.1f} below {cfg.follow_up_threshold}: probing the gap before moving on.",
                "difficulty_offset": s.difficulty_offset}
    if primary_done >= len(plan.topics):
        return {"action": "complete", "label": "interview complete", "reason": "All planned topics covered.",
                "difficulty_offset": s.difficulty_offset}
    reason = (
        "Strong answer: raising difficulty for the next topic." if ev.score >= cfg.escalate_threshold and not skipped
        else "Lowering difficulty to keep the next question answerable." if ev.score < cfg.follow_up_threshold and not skipped
        else "Moving to the next planned topic."
    )
    return {"action": "next_topic", "label": "next topic", "reason": reason, "difficulty_offset": s.difficulty_offset}


# --------------------------------------------------------------------------- stage 8
def complete_session(db: Session, sid: str) -> InterviewSession:
    s = get_session(db, sid)
    if s.status == "completed" and s.report:
        return s
    if not any(q.answer is not None for q in s.questions):
        raise ConflictError("Answer at least one question before finishing the interview")
    # Discard a dangling unanswered question (candidate chose to finish early)
    for q in list(s.questions):
        if q.status == "asked":
            s.questions.remove(q)
    t0 = time.perf_counter()
    report = report_service.build_report(s)
    s.report = report
    s.status = "completed"
    s.completed_at = datetime.now(timezone.utc)
    _event(db, s.id, "report_generated", f"Generated session report ({report.generator})",
           {"overall": report.data.get("overall_score")}, int((time.perf_counter() - t0) * 1000))
    db.commit()
    db.refresh(s)
    return s


def list_sessions(db: Session, limit: int = 20) -> list[InterviewSession]:
    return list(db.scalars(select(InterviewSession).order_by(InterviewSession.created_at.desc()).limit(limit)))

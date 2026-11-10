"""Interview lifecycle endpoints.

    POST   /sessions                              stage 1-2  upload resume + role -> parsed profile
    POST   /sessions/{id}/plan                    stage 3    resume x role -> interview blueprint
    POST   /sessions/{id}/questions/next          stage 4-5  retrieve + generate (idempotent)
    POST   /sessions/{id}/questions/{qid}/answer  stage 6-7  store + evaluate + adapt
    POST   /sessions/{id}/questions/{qid}/skip
    POST   /sessions/{id}/complete                stage 8    build report
    GET    /sessions/{id}                         full state (resume after refresh)
    GET    /sessions/{id}/report | /events | /questions/{qid}/trace
"""
from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends, File, Form, Query, UploadFile
from sqlalchemy.orm import Session

from app.api import serializers as ser
from app.core.errors import ConflictError, NotFoundError
from app.db.database import get_db
from app.schemas.api import AnswerIn, AnswerResultOut, EventOut, QuestionOut, SessionOut, SessionSummaryOut, SkipIn, TraceOut
from app.services import interview

router = APIRouter(prefix="/sessions", tags=["interview sessions"])


@router.post("", response_model=SessionOut, status_code=201, summary="Upload a resume and open a session")
async def create_session(
    resume: UploadFile = File(..., description="PDF, .txt or .md resume"),
    role_id: str = Form(...),
    candidate_name: str | None = Form(None, max_length=200),
    mode: Literal["interview", "practice"] = Form("interview"),
    num_questions: int | None = Form(None),
    db: Session = Depends(get_db),
):
    data = await resume.read()
    s = interview.create_session(
        db, filename=resume.filename or "resume", data=data, role_id=role_id,
        candidate_name=candidate_name, mode=mode, num_questions=num_questions,
    )
    return ser.session_out(s)


@router.get("", response_model=list[SessionSummaryOut], summary="Recent sessions")
def list_sessions(limit: int = Query(20, ge=1, le=100), db: Session = Depends(get_db)):
    return [ser.session_summary(s) for s in interview.list_sessions(db, limit)]


@router.get("/{session_id}", response_model=SessionOut)
def get_session(session_id: str, db: Session = Depends(get_db)):
    return ser.session_out(interview.get_session(db, session_id))


@router.delete("/{session_id}", status_code=204)
def delete_session(session_id: str, db: Session = Depends(get_db)):
    db.delete(interview.get_session(db, session_id))
    db.commit()


@router.post("/{session_id}/plan", response_model=SessionOut, summary="Build the interview blueprint")
def plan(session_id: str, db: Session = Depends(get_db)):
    return ser.session_out(interview.plan_session(db, session_id))


@router.post("/{session_id}/questions/next", response_model=QuestionOut | None,
             summary="Retrieve context and generate the next question")
def next_question(session_id: str, db: Session = Depends(get_db)):
    q = interview.next_question(db, session_id)
    if q is None:
        return None
    return ser.question_out(q, mode=interview.get_session(db, session_id).mode)


def _answer_result(db: Session, session_id: str, q, ev, decision) -> AnswerResultOut:
    s = interview.get_session(db, session_id)
    practice = s.mode == "practice"
    return AnswerResultOut(
        question=ser.question_out(q, mode=s.mode),
        evaluation=ev.model_dump() if practice else None,
        decision=decision,
        progress=ser.progress(s),
    )


@router.post("/{session_id}/questions/{question_id}/answer", response_model=AnswerResultOut)
def answer(session_id: str, question_id: str, body: AnswerIn, db: Session = Depends(get_db)):
    q, ev, decision = interview.submit_answer(db, session_id, question_id, body.answer, body.time_taken_seconds)
    return _answer_result(db, session_id, q, ev, decision)


@router.post("/{session_id}/questions/{question_id}/skip", response_model=AnswerResultOut)
def skip(session_id: str, question_id: str, body: SkipIn | None = None, db: Session = Depends(get_db)):
    q, ev, decision = interview.submit_answer(
        db, session_id, question_id, "", body.time_taken_seconds if body else None, skipped=True
    )
    return _answer_result(db, session_id, q, ev, decision)


@router.get("/{session_id}/questions/{question_id}/trace", response_model=TraceOut,
            summary="How a question was generated: queries, retrieved chunks, scores, citations")
def trace(session_id: str, question_id: str, db: Session = Depends(get_db)):
    s = interview.get_session(db, session_id)
    q = next((q for q in s.questions if q.id == question_id), None)
    if not q or not q.trace:
        raise NotFoundError("Trace not found")
    return ser.question_out(q).trace


@router.post("/{session_id}/complete", response_model=SessionOut, summary="Finish and generate the report")
def complete(session_id: str, db: Session = Depends(get_db)):
    return ser.session_out(interview.complete_session(db, session_id))


@router.get("/{session_id}/report")
def report(session_id: str, db: Session = Depends(get_db)):
    s = interview.get_session(db, session_id)
    if not s.report:
        raise ConflictError("Report not generated yet - complete the interview first", code="report_not_ready")
    return {"session_id": s.id, "generator": s.report.generator, "created_at": s.report.created_at, **s.report.data}


@router.get("/{session_id}/events", response_model=list[EventOut], summary="Pipeline audit log")
def events(session_id: str, db: Session = Depends(get_db)):
    return ser.events_out(interview.get_session(db, session_id))

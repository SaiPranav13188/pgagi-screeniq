"""Stage 8 - Session report: deterministic analytics + (optional) LLM narrative.

All numbers (scores, competency breakdown, claim verification, reading list) are
computed in code from stored records, so they are reproducible and auditable; the LLM
only writes the narrative around them.
"""
from __future__ import annotations

import logging
from collections import defaultdict
from statistics import mean

from app.core.errors import LLMError
from app.db.models import InterviewSession, Report
from app.llm.client import get_llm
from app.prompts import templates as T
from app.rag.catalog import BOOKS, get_role
from app.schemas.pipeline import InterviewPlan, ResumeProfile

log = logging.getLogger(__name__)


def _signal(score: float) -> dict:
    if score >= 80:
        return {"label": "Strong hire signal", "tone": "excellent"}
    if score >= 65:
        return {"label": "Hire signal", "tone": "good"}
    if score >= 50:
        return {"label": "Borderline - needs a second round", "tone": "mixed"}
    return {"label": "Not ready yet", "tone": "weak"}


def build_report(s: InterviewSession) -> Report:
    plan = InterviewPlan.model_validate(s.plan)
    profile = ResumeProfile.model_validate(s.profile)
    role = get_role(s.role_id)
    answered = [q for q in s.questions if q.answer is not None]

    # Difficulty-weighted score: a 7/10 on a level-5 question counts more than on a level-1.
    weights = [0.7 + 0.15 * q.difficulty for q in answered]
    overall = round(10 * sum((q.answer.score or 0) * w for q, w in zip(answered, weights)) / max(1e-9, sum(weights)), 1)

    by_topic: dict[int, list] = defaultdict(list)
    for q in answered:
        by_topic[q.topic_index].append(q)
    comp_name = {c.id: c.name for c in role.competencies} if role else {}
    topics = []
    for t in plan.topics:
        qs = by_topic.get(t.index, [])
        if not qs:
            continue
        sc = round(mean(q.answer.score or 0 for q in qs), 1)
        claim = None
        if t.resume_anchor:
            claim = "verified" if sc >= 7 else "partially verified" if sc >= 5 else "not demonstrated"
        topics.append({
            "index": t.index, "title": t.title, "competency": comp_name.get(t.competency_id, t.competency_id),
            "score": sc, "questions": len(qs), "difficulty": t.difficulty, "resume_anchor": t.resume_anchor,
            "claim_status": claim,
        })

    type_scores: dict[str, list[float]] = defaultdict(list)
    for q in answered:
        type_scores[q.question_type].append(q.answer.score or 0)

    reading, seen = [], set()
    for q in answered:
        if (q.answer.score or 0) >= 6 or not q.trace:
            continue
        for c in q.trace.chunks:
            key = (c["book_id"], c["section"])
            if c.get("cited") and key not in seen:
                seen.add(key)
                reading.append({
                    "topic": q.topic, "book_id": c["book_id"], "book_title": c["book_title"],
                    "author": BOOKS[c["book_id"]].author if c["book_id"] in BOOKS else "",
                    "section": c["section"], "pages": f"{c['page_start']}" + (f"-{c['page_end']}" if c["page_end"] != c["page_start"] else ""),
                })

    times = [q.answer.time_taken_seconds for q in answered if q.answer.time_taken_seconds]
    timeline = [{
        "seq": q.seq, "topic": q.topic, "kind": q.kind, "difficulty": q.difficulty,
        "score": q.answer.score, "verdict": (q.answer.evaluation or {}).get("verdict"),
        "decision": ((q.answer.evaluation or {}).get("decision") or {}).get("label"),
    } for q in answered]

    all_strengths = [x for q in answered for x in (q.answer.evaluation or {}).get("strengths", [])]
    all_gaps = [x for q in answered for x in (q.answer.evaluation or {}).get("missed_points", [])]
    strong = sorted([t for t in topics if t["score"] >= 7], key=lambda t: -t["score"])
    weak = sorted([t for t in topics if t["score"] < 6], key=lambda t: t["score"])

    data = {
        "overall_score": overall,
        "signal": _signal(overall),
        "answered": len([q for q in answered if q.status == "answered"]),
        "skipped": len([q for q in answered if q.status == "skipped"]),
        "follow_ups": len([q for q in answered if q.kind == "follow_up"]),
        "avg_difficulty": round(mean(q.difficulty for q in answered), 1) if answered else 0,
        "total_time_seconds": sum(times),
        "avg_time_seconds": round(mean(times)) if times else None,
        "topics": topics,
        "question_types": {k: round(mean(v), 1) for k, v in type_scores.items()},
        "timeline": timeline,
        "claims": [t for t in topics if t["claim_status"]],
        "reading_list": reading[:6],
        "calibration": plan.calibration.model_dump(),
        "books_used": [{"id": b, "title": BOOKS[b].title} for b in plan.books if b in BOOKS],
    }
    narrative, generator = _narrative(data, profile, role.title if role else s.role_id, answered)
    data["narrative"] = narrative
    data["narrative"].setdefault("strengths", [f"{t['title']} ({t['score']}/10)" for t in strong[:3]] or all_strengths[:3])
    data["narrative"].setdefault("growth_areas", [f"{t['title']} ({t['score']}/10)" for t in weak[:3]] or all_gaps[:3])
    return Report(session_id=s.id, data=data, generator=generator)


def _narrative(data: dict, profile: ResumeProfile, role_title: str, answered) -> tuple[dict, str]:
    llm = get_llm()
    if llm:
        payload = {
            "role": role_title,
            "candidate": {"seniority": profile.seniority, "headline": profile.headline, "skills": profile.skill_names()[:15]},
            "overall_score_0_100": data["overall_score"],
            "topics": data["topics"],
            "answers": [
                {
                    "topic": q.topic, "difficulty": q.difficulty, "question": q.text, "score": q.answer.score,
                    "covered": (q.answer.evaluation or {}).get("covered_points", []),
                    "missed": (q.answer.evaluation or {}).get("missed_points", []),
                }
                for q in answered
            ],
        }
        try:
            raw = llm.generate_json(T.REPORT_SYSTEM, T.report_prompt(payload), temperature=0.3)
            out: dict = {}
            for k in ("headline", "summary"):
                if raw.get(k):
                    out[k] = str(raw[k])
            for k in ("strengths", "growth_areas", "next_steps"):
                items = raw.get(k)
                if isinstance(items, list) and items:
                    out[k] = [i if isinstance(i, str) else " - ".join(str(v) for v in i.values()) if isinstance(i, dict) else str(i) for i in items][:4]
            if out.get("summary"):
                return out, llm.name
        except (LLMError, ValueError) as e:
            log.warning("LLM narrative failed, using template: %s", e)
    strong = [t["title"] for t in data["topics"] if t["score"] >= 7]
    weak = [t["title"] for t in data["topics"] if t["score"] < 6]
    summary = (
        f"Across {len(answered)} questions at an average difficulty of {data['avg_difficulty']}/5, the candidate scored "
        f"{data['overall_score']}/100 for the {role_title} role. "
        + (f"Strongest areas: {', '.join(strong[:3])}. " if strong else "")
        + (f"Areas needing work: {', '.join(weak[:3])}. " if weak else "")
        + f"{sum(1 for c in data['claims'] if c['claim_status'] == 'verified')} of {len(data['claims'])} resume claims were verified."
    )
    return {
        "headline": data["signal"]["label"],
        "summary": summary,
        "next_steps": [f"Revisit {r['section'] or r['topic']} in {r['book_title']} (p.{r['pages']})" for r in data["reading_list"][:3]],
    }, "template"

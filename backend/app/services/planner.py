"""Stage 3 - Context construction: resume + role -> interview blueprint.

How the resume steers the interview (assignment §7.4):
  * Topic selection - competencies are scored for resume alignment; ~60% of topics
    verify claimed skills, ~40% cover role-critical gaps the resume is silent on.
  * Difficulty      - a base level comes from seniority/ML depth; claimed areas are
    probed one level harder, unfamiliar areas one level easier.
  * Direction       - strong profiles unlock the advanced knowledge base (Bishop /
    AI-ML-DL); search queries blend textbook vocabulary with the candidate's own
    technologies so retrieved passages relate to what they have actually built.
"""
from __future__ import annotations

import logging
import re

from app.core.errors import LLMError
from app.llm.client import get_llm
from app.prompts import templates as T
from app.rag.catalog import Role
from app.rag.ingest import load_manifest
from app.schemas.pipeline import Calibration, CompetencyAlignment, InterviewPlan, PlannedTopic, ResumeProfile

log = logging.getLogger(__name__)
BASE_DIFFICULTY = {"student": 2, "junior": 2, "mid": 3, "senior": 4, "lead": 4}
STYLES = ["applied", "conceptual", "scenario", "comparison", "debugging", "design"]


def _profile_corpus(p: ResumeProfile) -> str:
    parts = [p.summary or "", p.headline or "", " ".join(p.domains), " ".join(p.ml_concepts)]
    parts += [f"{s.name} {s.evidence or ''}" for s in p.skills]
    parts += [f"{pr.title} {pr.summary} {' '.join(pr.technologies)}" for pr in p.projects]
    return " ".join(parts).lower()


def compute_alignment(profile: ResumeProfile, role: Role) -> list[CompetencyAlignment]:
    corpus = _profile_corpus(profile)
    out = []
    for c in role.competencies:
        matched = [k for k in c.keywords if re.search(rf"(?<![\w-]){re.escape(k)}(?![\w-])", corpus)]
        score = min(1.0, len(matched) / max(2.0, len(c.keywords) * 0.4))
        out.append(CompetencyAlignment(competency_id=c.id, name=c.name, score=round(score, 2), matched=matched))
    return out


def calibrate(profile: ResumeProfile) -> Calibration:
    base = BASE_DIFFICULTY.get(profile.seniority, 2)
    if profile.strength == "strong" and base < 3:
        base += 1
    elif profile.strength == "emerging" and base > 2:
        base -= 1
    unlocked = profile.strength == "strong" or profile.seniority in ("senior", "lead")
    rationale = (
        f"{profile.seniority.title()} profile"
        + (f" (~{profile.years_experience:g} yrs)" if profile.years_experience else "")
        + f" with {profile.strength} ML depth -> base difficulty {base}/5."
        + (" Advanced knowledge base unlocked." if unlocked else "")
    )
    return Calibration(seniority=profile.seniority, base_difficulty=base, advanced_unlocked=unlocked, rationale=rationale)


def select_books(role: Role, calibration: Calibration) -> list[str]:
    ingested = set(load_manifest().get("books", {}))
    books = [b for b in role.primary_books if b in ingested]
    if calibration.advanced_unlocked:
        books += [b for b in role.advanced_books if b in ingested and b not in books]
    if not books:  # e.g. primary book missing: fall back to anything relevant that is ingested
        books = [b for b in (*role.primary_books, *role.advanced_books) if b in ingested]
    return books


def _clamp(d: int) -> int:
    return max(1, min(5, int(d)))


def heuristic_topics(role: Role, profile: ResumeProfile, alignment: list[CompetencyAlignment], base: int, n: int) -> list[PlannedTopic]:
    comp_by_id = {c.id: c for c in role.competencies}
    ranked = sorted(alignment, key=lambda a: a.score, reverse=True)
    n_anchor = max(1, round(n * 0.6))
    anchored = [a for a in ranked if a.score > 0][:n_anchor]
    anchored_ids = {a.competency_id for a in anchored}
    core = [a for a in alignment if a.competency_id not in anchored_ids]  # role order = importance
    picks: list[tuple[CompetencyAlignment, bool]] = [(a, True) for a in anchored] + [(a, False) for a in core]
    while len(picks) < n:  # more topics than competencies: second pass with alternate focus
        picks += [(a, a.competency_id in anchored_ids) for a in alignment]
    picks = picks[:n]
    # warm-up first, then interleave anchored / core for a natural flow
    a_list = [p for p in picks if p[1]]
    c_list = [p for p in picks if not p[1]]
    ordered = []
    while a_list or c_list:
        if a_list:
            ordered.append(a_list.pop(0))
        if c_list:
            ordered.append(c_list.pop(0))

    techs = [s.name for s in profile.skills if s.category in ("ml_framework", "ml_concept")]
    topics, seen = [], {}
    for i, (al, is_anchor) in enumerate(ordered):
        comp = comp_by_id[al.competency_id]
        repeat = seen.get(comp.id, 0)
        seen[comp.id] = repeat + 1
        queries = list(comp.seed_queries[repeat % len(comp.seed_queries) :]) + list(comp.seed_queries[: repeat % len(comp.seed_queries)])
        if is_anchor and al.matched:
            queries.append(f"{al.matched[0]} {comp.name.lower()}")
        elif techs:
            queries.append(f"{comp.keywords[0]} {techs[i % len(techs)].lower()}")
        diff = _clamp(base + (1 if is_anchor and al.score >= 0.5 else 0 if is_anchor else -1) + (1 if i >= n - 2 else 0))
        anchor = None
        if is_anchor:
            ev = next((s.evidence for s in profile.skills if s.name.lower() in [m.lower() for m in al.matched] and s.evidence), None)
            anchor = f"Resume mentions {', '.join(al.matched[:3])}" + (f': "{ev[:90]}"' if ev else "")
        topics.append(
            PlannedTopic(
                index=i,
                competency_id=comp.id,
                title=comp.name,
                focus=comp.seed_queries[repeat % len(comp.seed_queries)],
                rationale=(
                    f"Resume claims experience with {', '.join(al.matched[:3])}; probing depth beyond usage."
                    if is_anchor
                    else f"Core {role.title} competency not evidenced on the resume; checking fundamentals."
                ),
                resume_anchor=anchor,
                difficulty=diff,
                question_style=STYLES[i % len(STYLES)],  # type: ignore[arg-type]
                queries=queries[:3],
            )
        )
    return topics


def _llm_topics(role: Role, profile: ResumeProfile, alignment, base: int, n: int) -> list[PlannedTopic]:
    llm = get_llm()
    if not llm:
        raise LLMError("offline")
    role_payload = {
        "title": role.title,
        "description": role.description,
        "competencies": [{"id": c.id, "name": c.name, "example_queries": list(c.seed_queries)} for c in role.competencies],
    }
    prof = profile.model_dump(include={"headline", "seniority", "years_experience", "summary", "domains", "ml_concepts", "strength"})
    prof["skills"] = [s.name for s in profile.skills][:40]
    prof["projects"] = [p.model_dump() for p in profile.projects[:5]]
    raw = llm.generate_json(
        T.PLAN_SYSTEM,
        T.plan_prompt(role_payload, prof, [a.model_dump() for a in alignment], base, n),
        temperature=0.5,
    )
    valid_ids = {c.id for c in role.competencies}
    topics: list[PlannedTopic] = []
    for t in raw.get("topics") or raw.get("items") or []:
        try:
            if t.get("competency_id") not in valid_ids or not t.get("queries"):
                continue
            t["difficulty"] = _clamp(t.get("difficulty", base))
            if t.get("question_style") not in STYLES:
                t["question_style"] = STYLES[len(topics) % len(STYLES)]
            t["queries"] = [q for q in t["queries"] if isinstance(q, str) and q.strip()][:3]
            topics.append(PlannedTopic.model_validate({**t, "index": len(topics)}))
        except Exception as e:  # skip one malformed topic, keep the rest
            log.debug("Dropping malformed topic %s: %s", t, e)
    if len(topics) < max(2, n // 2):
        raise LLMError(f"LLM plan had only {len(topics)} valid topics")
    return topics[:n]


def build_plan(profile: ResumeProfile, role: Role, n_topics: int) -> InterviewPlan:
    alignment = compute_alignment(profile, role)
    calibration = calibrate(profile)
    books = select_books(role, calibration)
    generator = "heuristic"
    try:
        topics = _llm_topics(role, profile, alignment, calibration.base_difficulty, n_topics)
        generator = get_llm().name  # type: ignore[union-attr]
        if len(topics) < n_topics:  # top up deterministically
            extra = heuristic_topics(role, profile, alignment, calibration.base_difficulty, n_topics)
            used = {t.competency_id for t in topics}
            for t in extra:
                if len(topics) >= n_topics:
                    break
                if t.competency_id not in used:
                    topics.append(t.model_copy(update={"index": len(topics)}))
    except LLMError as e:
        if str(e) != "offline":
            log.warning("LLM planning failed, using heuristic planner: %s", e)
        topics = heuristic_topics(role, profile, alignment, calibration.base_difficulty, n_topics)
    return InterviewPlan(
        role_id=role.id, books=books, calibration=calibration, alignment=alignment, topics=topics, generator=generator
    )

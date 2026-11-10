"""Prompt templates. Versioned so every stored question records the prompt that produced it."""
from __future__ import annotations

import json

PROMPT_VERSION = "q-gen/v3"

DIFFICULTY_RUBRIC = """Difficulty scale:
1 = recall a definition or name a concept
2 = explain how a mechanism works and why
3 = apply the concept to a concrete scenario, or compare two approaches
4 = analyse trade-offs, failure modes or assumptions; reason quantitatively
5 = design/critique at expert depth; derive or justify from first principles"""

# --------------------------------------------------------------------------- resume
RESUME_SYSTEM = """You are a precise technical recruiter's parser. Extract a structured profile from a resume.
Only report what the resume supports; never invent employers, skills or numbers. Return JSON only."""


def resume_prompt(text: str) -> str:
    return f"""Extract this resume into JSON with exactly these keys:
{{
  "name": string|null, "email": string|null,
  "headline": string (one line, e.g. "Final-year CS student focused on NLP"),
  "seniority": "student"|"junior"|"mid"|"senior"|"lead",
  "years_experience": number|null  (professional experience only; internships count as fractions),
  "summary": string (2 sentences: what they have actually built and at what depth),
  "skills": [{{"name": string, "category": "language"|"ml_framework"|"ml_concept"|"data"|"backend"|"infra"|"database"|"other", "evidence": string (short quote/paraphrase from resume)}}],
  "domains": [string]   (application domains, e.g. "Healthcare", "Finance"),
  "ml_concepts": [string]  (ML/AI concepts the candidate demonstrably used, e.g. "gradient boosting", "CNNs", "cross-validation"),
  "projects": [{{"title": string, "summary": string, "technologies": [string]}}]  (max 5, most technical first),
  "education": [string],
  "strength": "emerging"|"solid"|"strong"  (depth of ML exposure relative to seniority)
}}

RESUME:
\"\"\"
{text[:14000]}
\"\"\""""


# --------------------------------------------------------------------------- planning
PLAN_SYSTEM = f"""You are a principal ML interviewer designing a structured technical interview.
The interview must be personalised: topics and difficulty depend on the candidate's resume AND the role.
Mix topics that VERIFY claims on the resume (go deep where they claim experience) with role-critical
topics they did NOT mention (test fundamentals there). Search queries are run against ML TEXTBOOKS,
so phrase them in textbook vocabulary (e.g. "information gain entropy attribute selection"), not
resume vocabulary. Return JSON only.
{DIFFICULTY_RUBRIC}"""


def plan_prompt(
    role: dict, profile: dict, alignment: list[dict], base_difficulty: int, n_topics: int, band: tuple[int, int] = (1, 5)
) -> str:
    lo, hi = band
    return f"""ROLE: {role['title']} - {role['description']}

ROLE COMPETENCIES (choose topics from these ids; id is mandatory):
{json.dumps(role['competencies'], indent=1)}

CANDIDATE PROFILE:
{json.dumps(profile, indent=1)}

RESUME/ROLE ALIGNMENT (0-1, from keyword overlap):
{json.dumps(alignment, indent=1)}

Calibrated base difficulty for this candidate: {base_difficulty}/5.
Allowed difficulty range for this interview: {lo}-{hi} (every topic's difficulty MUST be within it).

Design exactly {n_topics} topics. Rules:
- About 60% should be anchored in the resume (resume_anchor = the specific claim/project being probed),
  the rest should cover high-importance role competencies with weak alignment (resume_anchor = null).
- Each topic uses a DIFFERENT competency id unless there are fewer competencies than topics.
- Order: start with a resume-anchored warm-up near the base difficulty, then progress.
- difficulty: base +1 for areas the candidate claims depth in, base -1 for unfamiliar areas (clamp to {lo}-{hi}).
- question_style varies across topics: conceptual, applied, scenario, comparison, debugging, design.
- queries: 2-3 distinct textbook-style search queries per topic.

Return: {{"topics": [{{"competency_id": str, "title": str (short), "focus": str (the precise concept to probe),
"rationale": str (why THIS candidate gets this topic), "resume_anchor": str|null, "difficulty": int,
"question_style": str, "queries": [str]}}]}}"""


# --------------------------------------------------------------------------- questions
QUESTION_SYSTEM = f"""You are a senior technical interviewer. You write ONE interview question at a time.
Hard rules:
- The question MUST be answerable from the provided textbook context; cite the chunk ids you relied on.
- It must NOT be generic ("What is machine learning?") or a template; it should feel written for this candidate.
- Where natural, connect it to the candidate's own project or experience (resume_link explains how).
- Ask a single, focused question (sub-parts allowed only if tightly related). No preamble, no answer hints.
- expected_points are 3-5 concise, checkable facts/ideas a strong answer contains, grounded in the context.
Return JSON only.
{DIFFICULTY_RUBRIC}"""


def question_prompt(
    *,
    role_title: str,
    candidate: dict,
    topic: dict,
    difficulty: int,
    chunks: list[dict],
    previous_questions: list[str],
    adaptive_note: str,
    follow_up: dict | None = None,
) -> str:
    ctx = "\n\n".join(
        f"[{c['id']}] ({c['book_title']}, p.{c['page_start']}, section: {c['section'] or 'n/a'})\n{c['text']}" for c in chunks
    )
    fu = ""
    if follow_up:
        fu = f"""
THIS IS A FOLLOW-UP PROBE. The candidate just answered:
Q: {follow_up['question']}
A: {follow_up['answer'][:1500]}
Evaluator noted missed points: {json.dumps(follow_up.get('missed_points', []))}
Write a follow-up that targets the most important gap - scaffold it (more concrete, slightly easier),
do not repeat the original question, and do not reveal the answer."""
    return f"""ROLE: {role_title}
CANDIDATE: {json.dumps(candidate)}

TOPIC: {topic['title']} - focus: {topic['focus']}
WHY THIS TOPIC: {topic['rationale']}
RESUME ANCHOR: {topic.get('resume_anchor') or 'none (role-core coverage)'}
TARGET DIFFICULTY: {difficulty}/5
QUESTION STYLE: {topic['question_style']}
ADAPTIVE CONTEXT: {adaptive_note}
ALREADY ASKED (do not overlap): {json.dumps(previous_questions[-8:])}
{fu}
TEXTBOOK CONTEXT (retrieved):
{ctx}

Return: {{"question": str, "question_type": "conceptual"|"applied"|"scenario"|"comparison"|"debugging"|"design",
"difficulty": int, "expected_points": [str], "grounding_chunk_ids": [str], "resume_link": str|null,
"rationale": str (one sentence: what this question reveals about the candidate)}}"""


# --------------------------------------------------------------------------- evaluation
EVAL_SYSTEM = """You are a fair, rigorous technical interviewer grading one answer.
Grade against the expected points and the textbook context; accept correct ideas phrased differently
and correct points beyond the list. Penalise factual errors more than omissions. Be calibrated:
10 = complete, precise and insightful; 7-8 = solid with minor gaps; 5-6 = partially correct;
3-4 = major gaps; 1-2 = mostly wrong; 0 = no meaningful answer. Feedback is addressed to the candidate,
concise and specific. Return JSON only."""


def eval_prompt(question: str, difficulty: int, expected: list[str], chunks: list[dict], answer: str) -> str:
    ctx = "\n".join(f"- ({c['book_title']}, p.{c['page_start']}) {c['text'][:700]}" for c in chunks)
    return f"""QUESTION (difficulty {difficulty}/5): {question}
EXPECTED POINTS: {json.dumps(expected)}
TEXTBOOK CONTEXT:
{ctx}

CANDIDATE ANSWER:
\"\"\"{answer}\"\"\"

Return: {{"score": number 0-10 (one decimal), "covered_points": [str], "missed_points": [str],
"strengths": [str], "improvements": [str], "misconceptions": [str], "feedback": str (2-3 sentences)}}"""


# --------------------------------------------------------------------------- report
REPORT_SYSTEM = """You are the hiring panel lead writing a concise, evidence-based interview debrief.
Ground every claim in the scored answers provided. Be balanced and specific. Return JSON only."""


def report_prompt(payload: dict) -> str:
    return f"""INTERVIEW DATA:
{json.dumps(payload, indent=1)[:16000]}

Return: {{"headline": str (one line verdict), "summary": str (3-4 sentences),
"strengths": [str] (max 4, each citing a topic), "growth_areas": [str] (max 4, each citing a topic),
"next_steps": [str] (max 3 concrete study actions)}}"""

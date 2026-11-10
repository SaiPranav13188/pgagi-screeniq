"""Unit tests for the deterministic parts of the pipeline (no network, no KB needed)."""
from __future__ import annotations

import pytest

from app.core.errors import ValidationFailed
from app.llm.client import parse_json
from app.rag.catalog import ROLES
from app.rag.chunking import _quality_ok
from app.rag.lexical import tokenize
from app.schemas.pipeline import verdict_for
from app.services import planner, resume_parser

RESUME = """Priya Sharma
priya.sharma@example.com | github.com/priya
Machine Learning Engineer with 3 years of experience building NLP and recommendation systems.

EXPERIENCE
ML Engineer, ShopKart (2022 - Present)
- Built a gradient boosting (XGBoost) ranking model for product recommendations; tuned with grid search and cross-validation.
- Deployed PyTorch BERT text classification service with FastAPI and Docker on AWS.

PROJECTS
Fraud Radar | Anomaly detection on credit card transactions with random forests and PCA in scikit-learn.

EDUCATION
B.Tech Computer Science, IIT Hyderabad
SKILLS: Python, SQL, PyTorch, scikit-learn, Pandas, NumPy, XGBoost, NLP, Transformers, Docker
"""


def test_extract_text_rejects_bad_types():
    with pytest.raises(ValidationFailed):
        resume_parser.extract_text("resume.exe", b"MZ....")
    with pytest.raises(ValidationFailed):
        resume_parser.extract_text("resume.pdf", b"not a pdf at all")
    with pytest.raises(ValidationFailed):
        resume_parser.extract_text("resume.txt", b"too short")


def test_heuristic_profile_extracts_skills_and_seniority():
    p = resume_parser.heuristic_profile(RESUME)
    names = set(p.skill_names())
    assert {"Python", "PyTorch", "scikit-learn", "XGBoost", "Docker", "Cross-validation"} <= names
    assert p.years_experience == 3
    assert p.seniority == "mid"
    assert p.email == "priya.sharma@example.com"
    assert "Finance" in p.domains or "E-commerce" in p.domains


def test_alignment_and_plan_are_resume_driven():
    role = ROLES["data_scientist"]
    p = resume_parser.heuristic_profile(RESUME)
    alignment = {a.competency_id: a for a in planner.compute_alignment(p, role)}
    assert alignment["ensembles"].score > 0  # XGBoost / random forests / gradient boosting
    assert alignment["model_evaluation"].score > 0  # cross-validation / grid search
    cal = planner.calibrate(p)
    assert cal.base_difficulty == 3
    topics = planner.heuristic_topics(role, p, list(alignment.values()), cal.base_difficulty, 6)
    assert len(topics) == 6
    assert topics[0].resume_anchor is not None  # warm-up on a claimed skill
    assert any(t.resume_anchor is None for t in topics)  # and role-core coverage
    assert all(1 <= t.difficulty <= 5 and t.queries for t in topics)
    assert len({t.question_style for t in topics}) > 2


def test_quality_gate_rejects_code_and_index_pages():
    prose = "Decision trees classify instances by sorting them down the tree from the root to some leaf node. " * 5
    assert _quality_ok(prose)
    code = "clf = DecisionTreeClassifier(max_depth=3); clf.fit(X_train, y_train); print(clf.score(X_test, y_test)) " * 6
    assert not _quality_ok(code)
    index = "Bayes theorem, 156, 157, 158, Bayesian belief networks, 184, 185, 190, boosting, 220, 221 " * 6
    assert not _quality_ok(index)


def test_tokenize_and_json_repair():
    assert "entropy" in tokenize("The ENTROPY of a collection is used...")
    assert parse_json('```json\n{"a": 1}\n```') == {"a": 1}
    assert parse_json('Here you go: {"b": [1,2]} thanks') == {"b": [1, 2]}
    assert parse_json('[{"question": "q"}]') == {"question": "q"}  # single object wrapped in an array
    assert parse_json('[1, 2]') == {"items": [1, 2]}


def test_verdicts():
    assert verdict_for(9.5) == "excellent"
    assert verdict_for(6.2) == "adequate"
    assert verdict_for(0) == "no_answer"

"""Stage 2 - Resume processing.

Two complementary extractors are merged:
  1. Deterministic: taxonomy matching + regexes for experience, seniority, education.
     Always runs, cannot hallucinate, works offline.
  2. LLM: understands context (projects, depth of exposure, implied concepts) and
     returns a structured profile. Validated against `ResumeProfile`.
The union keeps the precision of (1) and the recall of (2).
"""
from __future__ import annotations

import logging
import re
from datetime import date

import fitz

from app.core.errors import ValidationFailed, LLMError
from app.llm.client import get_llm
from app.prompts import templates as T
from app.schemas.pipeline import Project, ResumeProfile, Skill
from app.services.skills_taxonomy import DOMAINS, SENIOR_TITLES, STUDENT_MARKERS, TAXONOMY

log = logging.getLogger(__name__)
ALLOWED_EXT = {".pdf", ".txt", ".md"}


def extract_text(filename: str, data: bytes) -> str:
    ext = "." + filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext not in ALLOWED_EXT:
        raise ValidationFailed(f"Unsupported file type '{ext or 'unknown'}'. Upload a PDF, .txt or .md resume.")
    if ext == ".pdf":
        if not data.startswith(b"%PDF"):
            raise ValidationFailed("The file is not a valid PDF.")
        try:
            with fitz.open(stream=data, filetype="pdf") as doc:
                if doc.page_count > 15:
                    raise ValidationFailed("Resume is too long (max 15 pages).")
                text = "\n".join(page.get_text() for page in doc)
        except ValidationFailed:
            raise
        except Exception as e:  # corrupt / encrypted PDFs
            raise ValidationFailed(f"Could not read the PDF: {e.__class__.__name__}")
    else:
        text = data.decode("utf-8", errors="ignore")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text).strip()
    if len(text) < 150:
        raise ValidationFailed(
            "Couldn't extract enough text from this resume. If it is a scanned image, upload a text-based PDF or a .txt file."
        )
    return text[:30000]


def _match_skills(text: str) -> list[Skill]:
    found: list[Skill] = []
    for canonical, (category, aliases) in TAXONOMY.items():
        for alias in aliases:
            pattern = alias if alias.startswith(r"\b") else rf"(?<![\w-]){alias}(?![\w-])"
            flags = 0 if canonical == "R" else re.I
            m = re.search(pattern, text, flags)
            if m:
                start = max(0, m.start() - 60)
                snippet = text[start : m.end() + 60].replace("\n", " ").strip()
                found.append(Skill(name=canonical, category=category, evidence=snippet))
                break
    return found


def _years_experience(text: str) -> float | None:
    explicit = [float(x) for x in re.findall(r"(\d{1,2}(?:\.\d)?)\+?\s*(?:years|yrs)\s+(?:of\s+)?(?:professional\s+|industry\s+|work\s+)?experience", text, re.I)]
    if explicit:
        return max(explicit)
    # Sum date ranges like "Jan 2021 - Present" / "2019 – 2022" in the experience section.
    exp_section = re.split(r"\n\s*(education|projects|skills|certifications)\b", text, flags=re.I)[0]
    total = 0.0
    this_year = date.today().year
    for a, b in re.findall(r"((?:19|20)\d{2})\s*(?:-|–|to)\s*((?:19|20)\d{2}|present|current|now)", exp_section, re.I):
        end = this_year if not b[0].isdigit() else int(b)
        if 0 <= end - int(a) <= 40:
            total += end - int(a)
    return round(total, 1) if total else None


def _seniority(text: str, years: float | None) -> str:
    head = text[:1500]
    if re.search(SENIOR_TITLES, head, re.I) and (years or 0) >= 4:
        return "lead" if re.search(r"\b(lead|principal|staff|head of)\b", head, re.I) and (years or 0) >= 7 else "senior"
    if years is None:
        return "student" if re.search(STUDENT_MARKERS, text, re.I) else "junior"
    if years < 1:
        return "student" if re.search(STUDENT_MARKERS, text, re.I) else "junior"
    if years < 3:
        return "junior"
    if years < 6:
        return "mid"
    return "senior"


def heuristic_profile(text: str) -> ResumeProfile:
    skills = _match_skills(text)
    years = _years_experience(text)
    seniority = _seniority(text, years)
    domains = [d for d, kws in DOMAINS.items() if any(re.search(rf"\b{k}\b", text, re.I) for k in kws)]
    email = re.search(r"[\w.+-]+@[\w-]+\.[\w.]+", text)
    first_line = next((l.strip() for l in text.splitlines() if l.strip()), "")
    name = first_line if 2 <= len(first_line.split()) <= 4 and not re.search(r"[@\d|:]", first_line) else None
    education = [
        l.strip()[:140]
        for l in text.splitlines()
        if re.search(r"\b(b\.?tech|m\.?tech|bachelor|master|ph\.?d|b\.?sc|m\.?sc|b\.?e\b|degree|university|institute)\b", l, re.I)
    ][:3]
    projects = []
    # "Title | description" or "Title: description" or "Title – description" (spaced dash only,
    # so hyphenated bullet text like "Fine-tuned ..." is not mistaken for a project title)
    for m in re.finditer(r"(?im)^\s*(?:[-•*]\s*)?([A-Z][\w &/+]{2,50}?)\s*(?:\||:|\s[–-]\s)\s*(.{20,200})$", text):
        title, desc = m.group(1).strip(), m.group(2).strip()
        if len(title.split()) > 6 or title.lower() in ("skills", "summary", "objective", "education", "experience"):
            continue
        tech = [s.name for s in _match_skills(desc)]
        if tech:
            projects.append(Project(title=title, summary=desc, technologies=tech))
    ml_concepts = [s.name for s in skills if s.category == "ml_concept"]
    return ResumeProfile(
        name=name,
        email=email.group(0) if email else None,
        seniority=seniority,  # type: ignore[arg-type]
        years_experience=years,
        skills=skills,
        domains=domains,
        ml_concepts=ml_concepts,
        projects=projects[:5],
        education=education,
        strength=_strength(seniority, skills),
        extraction_method="heuristic",
        word_count=len(text.split()),
        summary=f"{seniority.title()}-level profile with {len(skills)} recognised skills"
        + (f" across {', '.join(domains[:2])}" if domains else "")
        + ".",
    )


def _strength(seniority: str, skills: list[Skill]) -> str:
    ml_depth = sum(1 for s in skills if s.category in ("ml_concept", "ml_framework"))
    if seniority in ("senior", "lead") or ml_depth >= 14:
        return "strong"
    if seniority == "mid" or ml_depth >= 7:
        return "solid"
    return "emerging"


def parse_resume(text: str) -> ResumeProfile:
    base = heuristic_profile(text)
    llm = get_llm()
    if not llm:
        return base
    try:
        raw = _coerce(llm.generate_json(T.RESUME_SYSTEM, T.resume_prompt(text), temperature=0.1), base)
        enriched = ResumeProfile.model_validate({**raw, "extraction_method": f"llm+heuristic ({llm.name})"})
    except (LLMError, ValueError) as e:
        log.warning("LLM resume extraction failed, using heuristic profile: %s", e)
        return base
    return _merge(base, enriched)


def _coerce(raw: dict, base: ResumeProfile) -> dict:
    """Repair common LLM deviations instead of discarding the whole extraction."""
    seniority = str(raw.get("seniority") or "").lower().strip()
    raw["seniority"] = seniority if seniority in ("student", "junior", "mid", "senior", "lead") else base.seniority
    strength = str(raw.get("strength") or "").lower().strip()
    raw["strength"] = strength if strength in ("emerging", "solid", "strong") else base.strength
    try:
        raw["years_experience"] = float(raw["years_experience"]) if raw.get("years_experience") not in (None, "") else None
    except (TypeError, ValueError):
        raw["years_experience"] = None
    for key in ("domains", "ml_concepts", "education"):
        raw[key] = [str(x) for x in (raw.get(key) or []) if x][:20]
    raw["skills"] = [s for s in (raw.get("skills") or []) if isinstance(s, (str, dict)) and (s if isinstance(s, str) else s.get("name"))]
    raw["projects"] = [
        {"title": str(p.get("title") or "Project"), "summary": str(p.get("summary") or ""),
         "technologies": [str(t) for t in (p.get("technologies") or [])]}
        for p in (raw.get("projects") or []) if isinstance(p, dict)
    ][:5]
    for key in ("name", "email", "headline", "summary"):
        if raw.get(key) is not None and not isinstance(raw[key], str):
            raw[key] = str(raw[key])
    raw["summary"] = raw.get("summary") or base.summary
    return raw


def _merge(base: ResumeProfile, llm: ResumeProfile) -> ResumeProfile:
    names = {s.name.lower() for s in llm.skills}
    skills = list(llm.skills) + [s for s in base.skills if s.name.lower() not in names]
    merged = llm.model_copy(
        update={
            "skills": skills,
            "email": llm.email or base.email,
            "name": llm.name or base.name,
            "years_experience": llm.years_experience if llm.years_experience is not None else base.years_experience,
            "domains": sorted(set(llm.domains) | set(base.domains)),
            "ml_concepts": list(dict.fromkeys(llm.ml_concepts + base.ml_concepts)),
            "projects": llm.projects or base.projects,
            "education": llm.education or base.education,
            "word_count": base.word_count,
        }
    )
    merged.strength = _strength(merged.seniority, merged.skills) if merged.strength == "solid" else merged.strength
    return merged

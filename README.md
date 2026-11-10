# ScreenIQ — RAG-powered, role-based candidate screening

> Upload a resume, choose a role, and get a **structured technical interview whose questions are generated
> on the fly** from the passages of the role's reference textbooks that matter for *that* candidate —
> adaptive, fully persisted, and traceable down to the page each question came from.

Built for the **PGAGI AI/ML & Backend Engineering Intern** assignment.

| | |
|---|---|
| **Frontend** | Next.js 15 (App Router) · TypeScript · Tailwind v4 · Framer Motion |
| **Backend** | FastAPI · Pydantic v2 · SQLAlchemy 2 |
| **RAG** | PyMuPDF layout-aware parsing · structure-aware chunking · `bge-small-en-v1.5` (local, ONNX) · **Qdrant** vector DB · BM25 · RRF · MMR |
| **LLM** | Google Gemini (JSON mode, model fallback chain) — with a fully **offline fallback** for every stage |
| **Database** | SQLite by default (any SQLAlchemy URL, e.g. PostgreSQL, via `DATABASE_URL`) |

---

## Contents
1. [Quick start](#1-quick-start)
2. [What it does — the 8-stage flow](#2-what-it-does--the-8-stage-flow)
3. [System architecture](#3-system-architecture)
4. [The RAG pipeline](#4-the-rag-pipeline)
5. [How the resume steers the interview](#5-how-the-resume-steers-the-interview)
6. [Adaptive interview engine](#6-adaptive-interview-engine)
7. [Traceability](#7-traceability-context--question--answer--storage)
8. [API reference](#8-api-reference)
9. [Data model](#9-data-model)
10. [Key design decisions & trade-offs](#10-key-design-decisions--trade-offs)
11. [Project structure](#11-project-structure)
12. [Testing](#12-testing)
13. [Limitations & next steps](#13-limitations--next-steps)

---

## 1. Quick start

**Prerequisites:** Python 3.11+ (3.12 recommended), Node 18.18+ (20+ recommended), ~1 GB disk.

### 1.1 Books
Place the provided PDFs in `data/books/` (they are git-ignored — copyrighted and large). Expected file names are listed in
[`backend/app/rag/catalog.py`](backend/app/rag/catalog.py):

```
data/books/
├── MachineLearningTomMitchell.pdf
├── Machine Learning For Absolute Beginners.pdf
├── Introduction to Machine Learning with Python ( PDFDrive.com )-min.pdf
├── Master Machine Learning Algorithms - Discover how they work and Implement Them From Scratch by Jason Brownlee (z-lib.org).pdf
├── Bishop-Pattern-Recognition-and-Machine-Learning-2006.pdf
└── Artificial Intelligence, Machine Learning, and Deep Learning.pdf
```

### 1.2 Configure
```bash
cp .env.example .env
# optional but recommended: paste a free Gemini key from https://aistudio.google.com/apikey
#   GEMINI_API_KEY=...
```
Without a key the whole system still runs end-to-end in **offline mode** (extractive question generation + semantic grading).

### 1.3 Backend
```bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate      macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt

python -m scripts.ingest              # one-off: build the knowledge base (~5–10 min on CPU)
uvicorn app.main:app --reload --port 8000
```
API docs: <http://localhost:8000/docs> · health: <http://localhost:8000/api/v1/health>

> Embedded Qdrant holds a file lock, so run `scripts.ingest` while the API is stopped — or call
> `POST /api/v1/knowledge-base/ingest` on the running API.

### 1.4 Frontend
```bash
cd frontend
cp .env.example .env.local            # NEXT_PUBLIC_API_URL=http://localhost:8000
npm install
npm run dev                           # http://localhost:3000
```

### 1.5 Tests
```bash
cd backend
python -m pytest -q                    # unit tests (no network / KB needed)
python -m scripts.e2e_smoke            # full interview lifecycle against the running API
```
Sample resumes for trying it out live in [`docs/sample_resumes/`](docs/sample_resumes/); a recording plan for the demo video is in [`docs/DEMO_SCRIPT.md`](docs/DEMO_SCRIPT.md).

### 1.6 Deployment (Render + Vercel)
| Part | Platform | Notes |
|---|---|---|
| API | **Render** web service ([`render.yaml`](render.yaml)) | Build runs `scripts/fetch_kb.py`, which downloads the prebuilt index from a **private** repo's release (the index contains extracted book text, so it is never in this public repo) and caches the embedding model. |
| Database | **Render Postgres** | `DATABASE_URL` is injected by Render; `postgres://` URLs are normalised to the psycopg 3 driver automatically. |
| Frontend | **Vercel** | Root directory `frontend`, env `NEXT_PUBLIC_API_URL=https://<render-service>.onrender.com`. |

**Secrets** (`GEMINI_API_KEY`, `KB_REPO_TOKEN`) are set only as encrypted environment variables on the platforms and in the git-ignored local `.env`; nothing secret is committed.

---

## 2. What it does — the 8-stage flow

| # | Stage | Implementation |
|---|---|---|
| 1 | **Candidate entry** | 3-step wizard: drag-and-drop resume (PDF/TXT/MD, validated type/size/magic bytes), role cards, mode & length. |
| 2 | **Resume processing** | Deterministic taxonomy/regex extractor (skills, seniority, years, domains, education) **merged with** an LLM structured extractor. → `ResumeProfile` |
| 3 | **Context construction** | Resume × role competency alignment, difficulty calibration, advanced-corpus unlock, and a topic plan with **2–3 textbook-vocabulary search queries per topic**. → `InterviewPlan` |
| 4 | **Knowledge retrieval** | Multi-query hybrid retrieval: Qdrant dense + BM25 → Reciprocal Rank Fusion → grounding floor → MMR, restricted to the role's books, excluding passages already used. |
| 5 | **Question generation** | LLM writes one question from the retrieved chunks and **must cite chunk ids**; uncited questions are rejected and regenerated. Expected answer points are produced from the same context. |
| 6 | **Interactive interview** | Focused interview room; refresh-safe (server is the source of truth), draft autosave, timer, keyboard shortcuts, adaptive follow-ups. |
| 7 | **Response handling** | Answers stored with timing; graded against expected points *and* source passages; adaptive decision recorded. |
| 8 | **Final output** | Difficulty-weighted score, competency radar, score-vs-difficulty timeline, **resume-claim verification**, strengths/gaps, a **reading list of exact book pages**, full transcript with traces, and the pipeline audit log. |

Two modes: **Interview** (scores hidden until the report — realistic screening) and **Practice** (instant grounded feedback after each answer).

---

## 3. System architecture

```
┌──────────────────────────── Next.js frontend ────────────────────────────┐
│  /  landing   /interview/new  wizard + blueprint   /interview/[id]  room │
│  /report/[id] analytics   /knowledge  RAG playground   /sessions history │
└──────────────────────────────────┬───────────────────────────────────────┘
                                   │ REST / JSON  (typed client, error envelope)
┌──────────────────────────────────▼───────────────────────────────────────┐
│ FastAPI  ─ api/routes  (HTTP only: validation, status codes, DTOs)        │
│          ─ api/serializers  (ORM → DTO, hides grades in interview mode)   │
├──────────────────────────────────────────────────────────────────────────┤
│ services/  (business logic — no HTTP, no SQL strings)                     │
│   interview.py   session state machine + adaptive policy (orchestrator)   │
│   resume_parser  planner  question_generator  evaluator  report           │
├────────────────────────┬───────────────────────┬─────────────────────────┤
│ rag/                   │ llm/                  │ db/                      │
│  chunking  ingest      │  LLMClient protocol   │  SQLAlchemy models       │
│  embeddings (bge)      │  GeminiClient (REST,  │  sessions · questions ·  │
│  vector_store (Qdrant) │  JSON mode, fallback  │  traces · answers ·      │
│  lexical (BM25)        │  chain, retries)      │  reports · events        │
│  retriever (RRF+MMR)   │  prompts/ (versioned) │                          │
└────────────────────────┴───────────────────────┴─────────────────────────┘
        │ Qdrant (embedded on-disk or server)          │ SQLite / Postgres
```

**Request flow for one question** (`POST /sessions/{id}/questions/next`):

```
route ─► interview.next_question
          ├─ decide: follow-up probe on last topic?  or next planned topic
          ├─ retriever.retrieve(topic.queries | missed points, role books, exclude used chunks)
          │     embed queries ─► Qdrant top-30  ┐
          │     BM25 top-30                     ┴► RRF ─► cosine floor ─► MMR ─► top-4
          ├─ question_generator.generate(profile digest, topic, difficulty, adaptive note, chunks)
          │     Gemini JSON ─► validate (Pydantic) ─► citations ⊆ retrieved ids? else retry
          │     (offline: extractive generator grounded in the top chunk)
          ├─ persist Question + RetrievalTrace (queries, all chunks + scores, cited ids, prompt version, timings)
          └─ persist PipelineEvent(s)
```

---

## 4. The RAG pipeline

### 4.1 Ingestion (`backend/app/rag/`)
| Step | Choice | Why |
|---|---|---|
| Parsing | PyMuPDF `get_text("dict")` | Gives text **blocks with font sizes and flags** → we can detect headings instead of splitting blindly. |
| Cleaning | Remove running headers/footers (lines repeating on >4% of pages), page numbers, ligatures (`ﬁ`), hyphenated line breaks | These would otherwise pollute every embedding of a book. |
| Heading detection | Spans ≥1.18× the modal body font size (or short all-bold lines), rejecting equation-like text | Section titles become chunk labels and **hard chunk boundaries**. |
| Chunking | Pack paragraphs to ~230 words (max 320), **never across a section boundary**, carry the last 2 sentences into the next chunk | One idea per chunk keeps retrieval precise; the sentence overlap preserves definitions that straddle a boundary; 230 words ≈ 300 tokens sits well inside bge-small's 512-token window. |
| Quality gate | Drop TOC/index/bibliography, code dumps, equation-only and digit-heavy fragments; front-matter skipping expires after 4 pages | These match queries lexically but are useless for question generation. |
| Embeddings | `BAAI/bge-small-en-v1.5` via fastembed (ONNX, CPU) — 384-d, query instruction prefix | Strong retrieval quality for its size, free, no API dependency, fast enough to embed ~2,200 pages on a laptop. Section title is prepended to the chunk text before embedding. |
| Vector DB | **Qdrant**, one collection, `book_id` payload filter | Roles select books by filter, so ingestion is independent of the role catalogue. Embedded mode = zero infra; `QDRANT_URL` switches to a server with no code change. |
| Lexical index | BM25 over the same chunks (JSONL on disk) | Exact technical terms ("ID3", "VC dimension") are where dense retrieval is weakest. |
| Idempotency | Manifest with per-book fingerprint (size, mtime, model, chunk params) | Re-running only re-processes changed books. |

**Resulting knowledge base** (2,201 pages → **2,847 chunks**):

| Book | Pages | Chunks | Avg words | Sections | Role tier |
|---|---:|---:|---:|---:|---|
| Machine Learning — Mitchell | 421 | 798 | 223 | 198 | AI/ML primary |
| ML for Absolute Beginners — Theobald | 128 | 107 | 252 | 5 | AI/ML primary |
| Intro to ML with Python — Müller & Guido | 392 | 303 | 189 | 157 | Data Science primary |
| Master ML Algorithms — Brownlee | 163 | 259 | 151 | 162 | Data Science primary |
| Pattern Recognition & ML — Bishop | 758 | 1,135 | 211 | 179 | Research primary · advanced tier |
| AI, ML & Deep Learning — Campesato | 339 | 245 | 195 | 112 | Research primary · advanced tier |

Full ingestion is a one-off CPU job (≈45 min on a modest laptop CPU, a few minutes on a modern one); queries are then embedded in milliseconds and a hybrid retrieval takes ~0.4 s end to end. `scripts/repair_text.py` shows how text-cleaning fixes can be applied to an existing index in place without re-embedding.

### 4.2 Retrieval (`retriever.py`)
1. **Multi-query** — each topic carries 2–3 phrasings written in *textbook vocabulary* (the planner is told to translate resume language into book language).
2. **Hybrid** — per query, Qdrant top-30 (cosine) and BM25 top-30.
3. **Reciprocal Rank Fusion** (k=60) across retrievers *and* queries — rank-based, so BM25 scores and cosines never need calibration.
4. **Grounding floor** — candidates whose best cosine to any query is < 0.52 are dropped, even if they matched lexically.
5. **MMR** (λ=0.72) — balances relevance against redundancy so the generator sees 4 *different* passages, not 4 paragraphs of the same page.
6. **Exclusion** — passages already used for other topics are excluded, so topics don't recycle context.

Try it live at **`/knowledge`** (retrieval playground) or `POST /api/v1/knowledge-base/search`.

### 4.3 Question generation (`question_generator.py`, `prompts/templates.py`)
* Inputs: role, candidate digest (seniority, top skills, projects), topic focus + rationale + resume anchor, **target difficulty with an explicit 1–5 rubric**, question style, adaptive note (recent scores/trend), previously asked questions, and the chunks with ids.
* Output (JSON, Pydantic-validated): `question`, `question_type`, `difficulty`, `expected_points` (3–5, grounded), `grounding_chunk_ids`, `resume_link`, `rationale`.
* **Grounding check:** cited ids must be a subset of retrieved ids; zero valid citations → rejected and regenerated at a lower temperature; still failing → offline extractive generator.
* Six question styles (conceptual, applied, scenario, comparison, debugging, design) are rotated by the planner to avoid monotony.

### 4.4 Evaluation (`evaluator.py`)
* LLM grades against expected points **and** the same source passages (so the grade is grounded in what the question came from), with a calibrated 0–10 rubric; returns covered/missed points, strengths, improvements, misconceptions.
* Non-answers ("I don't know", < 4 words) are scored by rule without an LLM call.
* Offline: semantic coverage — an expected point is "covered" if some answer sentence has cosine ≥ 0.74 to it; blended with relevance to the source passage and answer completeness.

---

## 5. How the resume steers the interview

| Lever | Mechanism |
|---|---|
| **Topic selection** | Each role competency is scored for resume evidence (keyword overlap over skills, evidence snippets, projects). ≈60% of topics are **resume-anchored** (verify claimed depth), ≈40% cover **role-critical gaps** the resume is silent on. |
| **Difficulty** | Base level from seniority & ML depth (student/junior 2, mid 3, senior/lead 4; ±1 for strength). Anchored topics +1 (probe depth beyond usage), unfamiliar topics −1 (test fundamentals). Then answers move it live (§6). |
| **Direction** | Strong profiles **unlock the advanced corpus** (Bishop PRML, AI·ML·DL) for AI/ML and Data Science roles. Queries blend textbook terms with the candidate's own technologies, and questions are asked to connect to the candidate's projects (`resume_link`). |

The blueprint (alignment bars, calibration rationale, every topic's rationale and queries) is shown to the user before the interview starts.

---

## 6. Adaptive interview engine

After every answer (`services/interview.py::_decide`):

* **score < 4.5 on a primary question** → a **follow-up probe** on the same topic. It is *re-retrieved* using the candidate's **missed points** as queries, generated one level easier and scaffolded toward the gap (max 2 per session).
* **score ≥ 8** → difficulty offset +1 for remaining topics; weak answers → −1 (clamped to ±2).
* The decision and its reason are stored with the answer and surfaced in the UI and the report timeline.

All thresholds are environment-configurable.

---

## 7. Traceability (Context → Question → Answer → Storage)

Every question persists a `RetrievalTrace`: the exact queries, the books searched, **all** retrieved chunks with dense score, dense rank, BM25 rank, RRF score, which queries matched, which chunks were **cited**, the prompt version, the generator/model, and retrieval/generation latency. Every pipeline stage also writes a `PipelineEvent`.

In the UI: **"How was this generated?"** on every question, the **Retrieval trace** tab per transcript item, and the **Pipeline audit log** in the report. Via API: `GET /sessions/{id}/questions/{qid}/trace` and `GET /sessions/{id}/events`.

---

## 8. API reference

Base path `/api/v1` — interactive docs at `/docs`.

| Method | Path | Stage | Purpose |
|---|---|---|---|
| GET | `/health` | – | DB, KB size, LLM provider/model status |
| GET | `/roles` | 1 | Role catalogue with books & competencies |
| GET | `/knowledge-base` | 4 | Per-book ingestion stats, chunking/retrieval config |
| POST | `/knowledge-base/search` | 4 | Retrieval playground |
| POST | `/knowledge-base/ingest?force=` | 4 | (Re)build KB in background |
| POST | `/sessions` (multipart) | 1–2 | Upload resume + role → parsed profile |
| GET | `/sessions` · `/sessions/{id}` · DELETE `/sessions/{id}` | – | List / full state (resume after refresh) / delete |
| POST | `/sessions/{id}/plan` | 3 | Build the blueprint (idempotent) |
| POST | `/sessions/{id}/questions/next` | 4–5 | Retrieve + generate (idempotent: re-serves an open question) |
| POST | `/sessions/{id}/questions/{qid}/answer` | 6–7 | Store, evaluate, adapt |
| POST | `/sessions/{id}/questions/{qid}/skip` | 6–7 | Skip |
| GET | `/sessions/{id}/questions/{qid}/trace` | 7 | How the question was produced |
| POST | `/sessions/{id}/complete` | 8 | Build the report |
| GET | `/sessions/{id}/report` · `/sessions/{id}/events` | 8 | Report · audit log |

**Errors** always use one envelope: `{"error": {"code", "message", "details", "request_id"}}` with proper status codes (404 unknown session, 409 lifecycle conflicts such as answering twice or a missing KB, 422 validation such as a non-PDF upload or empty answer, 503 dependencies). Every response carries `x-request-id` and `server-timing`.

---

## 9. Data model

```
interview_sessions ─┬─< questions ─┬─ retrieval_traces   (1:1, how it was generated)
 id, role_id,       │   seq, topic, │
 status, mode,      │   kind,       └─ answers            (1:1, text, time, score, evaluation JSON + decision)
 profile JSON,      │   difficulty,
 plan JSON,         │   expected_points, generator
 difficulty_offset, ├── reports           (1:1, analytics JSON + narrative)
 follow_ups_used    └─< pipeline_events   (audit log: stage, message, data, duration)
```
Structured artefacts (profile, plan, evaluation, report) are JSON columns whose shape is owned by Pydantic schemas in `app/schemas/pipeline.py`.

---

## 10. Key design decisions & trade-offs

1. **Server-side session state machine** (`created → planned → in_progress → completed`). The frontend holds no interview logic; refreshing the page re-serves the open question. `questions/next` is idempotent, which also makes double-clicks harmless.
2. **Hybrid retrieval instead of pure vector search.** ML textbooks are full of exact terms that dense models blur; BM25 + RRF fixes that cheaply and without score calibration.
3. **Section-bounded chunking over fixed windows.** More engineering up front, but each chunk is about one idea, carries a meaningful section label, and makes citations human-readable.
4. **Local embeddings, remote LLM.** Embeddings run on every query and every ingestion, so they are local (free, private, deterministic); generation quality benefits most from a strong hosted model.
5. **Graceful degradation everywhere.** Each stage has an LLM path and a deterministic path; Gemini calls use a model fallback chain (404/quota → next model) and bounded retries. Every artefact records which generator produced it, so degraded output is never silently presented as LLM output.
6. **LLM output is untrusted input.** All LLM JSON is validated with Pydantic; plan topics with unknown competency ids are dropped and topped up deterministically; questions without valid citations are rejected.
7. **Numbers in code, words from the LLM.** Scores, competency breakdowns, claim verification and the reading list are computed deterministically from stored records; the LLM only writes the narrative.
8. **Hide grades in interview mode** at the serializer level (not just in the UI) to keep the screening realistic.
9. **SQLite + embedded Qdrant by default** so a reviewer can run everything with two commands; both are swappable via `DATABASE_URL` / `QDRANT_URL`.
10. **Roles map to the provided books.** The assignment's book list is ML-only, so the three role tracks are *AI/ML Engineer*, *Data Scientist / Applied ML* and *ML Research (advanced)*. *The Hundred-Page ML Book* was not among the supplied files; dropping its PDF into `data/books/` and adding one `Book` entry to the catalogue is all it takes to include it.

---

## 11. Project structure

```
pgagi/
├── backend/
│   ├── app/
│   │   ├── api/routes/        sessions.py · system.py
│   │   ├── api/serializers.py
│   │   ├── core/              config (env) · errors (envelope) · logging
│   │   ├── db/                database · models
│   │   ├── llm/client.py      provider protocol + Gemini client
│   │   ├── prompts/           versioned prompt templates
│   │   ├── rag/               catalog · chunking · embeddings · vector_store · lexical · retriever · ingest
│   │   ├── schemas/           pipeline artefacts · API DTOs
│   │   ├── services/          interview · resume_parser · planner · question_generator · evaluator · report
│   │   └── main.py            app factory, middleware, lifespan warm-up
│   ├── scripts/               ingest · e2e_smoke · repair_text
│   └── tests/
├── frontend/src/
│   ├── app/                   pages (landing, wizard, room, report, knowledge, sessions)
│   ├── components/            motion primitives, blueprint, trace drawer, charts, evaluation card, RAG loader
│   └── lib/                   typed API client, types, utils
├── data/books/                the provided PDFs (git-ignored)
└── .env.example
```

---

## 12. Testing

`backend/scripts/e2e_smoke.py` drives a complete interview through the HTTP API (upload → plan → questions with good, weak and skipped answers → follow-ups → report → audit log) and asserts lifecycle guarantees: `questions/next` idempotency, 409 on answering twice, 422 envelope on a bad upload, 404 on unknown sessions.

`backend/tests/test_pipeline.py` covers the deterministic core (no network, no KB required): upload validation, heuristic resume extraction (skills, years, seniority, email, domains), resume-driven alignment/calibration/topic planning, the chunk quality gate (prose vs. code vs. index pages), tokenisation, LLM-JSON repair and verdict mapping.

---

## 13. Limitations & next steps

* Grading by an LLM is a strong signal, not ground truth — reports present a *signal*, and every grade is inspectable alongside its sources.
* Scanned (image-only) resumes are rejected with a clear message; OCR would be the next addition.
* Single-process deployment: embedded Qdrant has a file lock. For multi-worker deployment, point `QDRANT_URL` at a Qdrant server and `DATABASE_URL` at Postgres.
* Natural extensions: a cross-encoder re-ranker after MMR, voice answers (speech-to-text), recruiter accounts/auth, and offline evaluation of question quality with a held-out rubric.

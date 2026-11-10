# Demo video script (≈ 6–8 minutes)

Goal: show the **complete flow end to end**, the **key features**, and **how the components interact**.
Record at 1080p, browser zoom 90%, with the backend terminal visible in a corner for the "interaction" shots.

**Before recording**
- `GEMINI_API_KEY` set in `.env` (the navbar dot shows "Gemini · live").
- Knowledge base ingested (`python -m scripts.ingest`), backend on :8000, frontend on :3000.
- Have `docs/sample_resumes/aarav_mehta_ml_engineer.txt` and `riya_kapoor_student.txt` ready.
- Delete old sessions on `/sessions` for a clean list.

---

### 0:00 – 0:45 · Intro & architecture (landing page)
- Open `/`. Let the hero animation play. One sentence: *"ScreenIQ generates a technical interview from three inputs: the resume, the role, and the role's textbooks."*
- Scroll to **The pipeline**; hover the 8 stages while naming them.
- Briefly show the README architecture diagram (or `/docs` Swagger) — *"Next.js frontend, FastAPI service layer, Qdrant vector DB, SQLite for persistence, Gemini for generation."*

### 0:45 – 1:45 · The knowledge base (RAG ingestion & retrieval)
- Open `/knowledge`. Point at the stats: 6 books, pages, chunks, embedding model, chunking & retrieval config.
- Explain chunking in one breath: *"Layout-aware parsing, section-bounded ~230-word chunks with sentence overlap, junk like indexes and code filtered out."*
- In the playground, click the example *"Why does information gain favour attributes with many values?"*.
  Show: candidates fused, ms, the top chunk from Mitchell, dense cosine + BM25 rank. *"Hybrid search fused with RRF, then MMR for diversity."*

### 1:45 – 3:00 · Candidate entry → resume processing → context construction
- `/interview/new`: drop **aarav_mehta_ml_engineer.txt** (scan animation), choose **AI / ML Engineer**, choose **Practice** mode, 5 topics.
- Click **Analyse & build interview**; narrate the processing steps.
- On the blueprint:
  - **Profile card** — skills grouped by category, seniority, *"strong ML depth"*.
  - **Alignment bars** — *"which competencies the resume gives evidence for."*
  - **Calibration** — base difficulty 3 and *"advanced knowledge base unlocked"* (Bishop / AI·ML·DL added).
  - **Topic plan** — point out *resume-anchored* vs *role core* topics, per-topic difficulty and the textbook-style search queries.
- (Optional, 20 s) Repeat setup with **riya_kapoor_student.txt** to show a lower base difficulty, different topics and no advanced books — *"same role, different interview."*

### 3:00 – 5:15 · Interactive interview (adaptive)
- **Begin interview**. Show the RAG loader (*"retrieving and generating live"*).
- **Start the interview** on the "Meet Nova" screen (wear headphones). Nova greets you and reads Q1 aloud with live captions; the mic opens by itself. Answer out loud, pause ~4 s → the countdown ring sends it, Nova reacts ("let me dig a little deeper…") and asks the next question on its own. *"It's a real spoken interview — the AI asks, I answer, it adapts."*
- (For the parts below you can switch to **Type** mode with the toggle above the stage.)
- On Q1 click **How was this generated?** → trace drawer: queries, 4 retrieved chunks with scores, which were **cited**, prompt version, latencies. *"Every question is traceable to the page it came from."*
- Answer Q1 well (2–3 solid sentences) → feedback: score ring, covered/missed points, *"raising difficulty"* decision.
- Answer Q2 weakly (one vague sentence) → score < 4.5 → **follow-up probe** badge; show it targets the missed point, and the sidebar shows the follow-up.
- Answer one more, **skip** one, then show the **refresh-safety**: press F5 mid-question — the same question returns (session continuity).
- Optionally show the backend terminal logs: `POST /questions/next … 200`, `answer … 200`.

### 5:15 – 6:45 · Final output
- Finish → report page:
  - Overall score ring + hire signal + LLM narrative.
  - **Competency radar** and **performance vs difficulty** chart (hover points; follow-up bars in amber).
  - **Resume claim verification** (verified / partially / not demonstrated).
  - **Reading list** — exact book sections and pages for weak topics.
  - **Transcript** — expand a question → Evaluation tab → Retrieval trace tab.
  - **Pipeline audit log** — *"every stage persisted with timings: resume_parsed → plan_built → retrieval → question_generated → answer_evaluated → report_generated."*
- Click **Export JSON** to show the stored structured record.

### 6:45 – 7:30 · Engineering wrap-up
- `/sessions` — sessions persisted in the database.
- `/docs` — the API grouped by lifecycle stage; mention the consistent error envelope (e.g. upload a `.png` → 422 toast).
- Close: *"Modular services, env-driven config, graceful offline fallback, and every number in the report computed from stored records."*

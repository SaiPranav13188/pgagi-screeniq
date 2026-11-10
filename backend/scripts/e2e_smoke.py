"""End-to-end smoke test against a running API: full interview lifecycle.

    python -m scripts.e2e_smoke [--resume ../docs/sample_resumes/aarav_mehta_ml_engineer.txt] [--role ai_ml_engineer]
"""
from __future__ import annotations

import argparse
import sys
import time

import httpx

API = "http://localhost:8000/api/v1"
WEAK = "I think it is something related to the data, not sure."
GOOD = (
    "{topic}: the core idea is to choose the model or split that best reduces uncertainty about the target while "
    "generalising beyond the training data. Concretely, we measure it on held-out data, watch for overfitting when the "
    "hypothesis space is too expressive, and use regularisation, pruning or cross-validation to control variance. "
    "In my own projects I validated this by comparing training and validation error and tuning hyperparameters."
)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--resume", default="../docs/sample_resumes/aarav_mehta_ml_engineer.txt")
    ap.add_argument("--role", default="ai_ml_engineer")
    ap.add_argument("--mode", default="practice")
    ap.add_argument("--n", type=int, default=4)
    a = ap.parse_args()
    c = httpx.Client(base_url=API, timeout=300)

    t0 = time.time()
    with open(a.resume, "rb") as f:
        r = c.post("/sessions", files={"resume": (a.resume.split("/")[-1], f, "text/plain")},
                   data={"role_id": a.role, "mode": a.mode, "num_questions": str(a.n)})
    r.raise_for_status()
    s = r.json()
    sid = s["id"]
    print(f"[1-2] session {sid[:8]}  {s['candidate_name']}  seniority={s['profile']['seniority']}  skills={len(s['profile']['skills'])}")

    s = c.post(f"/sessions/{sid}/plan").json()
    p = s["plan"]
    print(f"[3]   plan by {p['generator']}: base={p['calibration']['base_difficulty']} books={p['books']}")
    for t in p["topics"]:
        print(f"      - L{t['difficulty']} {t['question_style']:<10} {t['title']}  {'(anchor)' if t['resume_anchor'] else ''}")

    i = 0
    while True:
        q = c.post(f"/sessions/{sid}/questions/next").json()
        if not q:
            break
        tr = q["trace"]
        print(f"\n[4-5] Q{q['seq']} {q['kind']} L{q['difficulty']} [{q['topic']}] via {q['generator']} "
              f"(retrieval {tr['retrieval_ms']}ms, cited {len(tr['grounding_chunk_ids'])}/{len(tr['chunks'])})")
        print("      " + q["text"].encode("ascii", "ignore").decode()[:300])
        # Idempotency: asking again must return the same open question
        assert c.post(f"/sessions/{sid}/questions/next").json()["id"] == q["id"], "next is not idempotent"
        if i == 2:
            res = c.post(f"/sessions/{sid}/questions/{q['id']}/skip", json={"time_taken_seconds": 5}).json()
        else:
            ans = WEAK if i == 1 else GOOD.format(topic=q["topic"])
            res = c.post(f"/sessions/{sid}/questions/{q['id']}/answer", json={"answer": ans, "time_taken_seconds": 40 + i}).json()
        ev = res.get("evaluation") or {}
        print(f"[6-7] score={ev.get('score')} verdict={ev.get('verdict')} -> {res['decision']['label']}: {res['decision']['reason']}")
        # Answering twice must be rejected with 409
        assert c.post(f"/sessions/{sid}/questions/{q['id']}/answer", json={"answer": "again"}).status_code == 409
        i += 1
        if i > 12:
            sys.exit("too many questions")

    s = c.post(f"/sessions/{sid}/complete").json()
    rep = c.get(f"/sessions/{sid}/report").json()
    print(f"\n[8]   overall={rep['overall_score']}  signal={rep['signal']['label']}  answered={rep['answered']} "
          f"skipped={rep['skipped']} follow_ups={rep['follow_ups']}  narrative={rep['generator']}")
    print(f"      claims={[(x['title'], x['claim_status']) for x in rep['claims']]}")
    print(f"      reading={[(x['book_id'], x['pages']) for x in rep['reading_list']]}")
    ev = c.get(f"/sessions/{sid}/events").json()
    print(f"      events={[e['stage'] for e in ev]}")
    # validation & error envelope
    bad = c.post("/sessions", files={"resume": ("x.png", b"\x89PNG", "image/png")}, data={"role_id": a.role})
    assert bad.status_code == 422 and "error" in bad.json(), bad.text
    assert c.get("/sessions/doesnotexist").status_code == 404
    print(f"\nOK - full lifecycle in {time.time() - t0:.0f}s, report at http://localhost:3000/report/{sid}")


if __name__ == "__main__":
    main()

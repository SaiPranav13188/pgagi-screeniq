"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  CircleDashed,
  Clock,
  Download,
  FileSearch,
  GitBranch,
  Layers,
  Plus,
  Printer,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { RadarChart, ScoreTimeline } from "@/components/charts";
import { EvaluationCard } from "@/components/evaluation-card";
import { AnimatedNumber, Aurora, EASE, Reveal, ScoreRing } from "@/components/motion";
import { ChunkCard } from "@/components/trace-drawer";
import { Badge, Button, DifficultyPips, LevelBadge, SectionLabel, Skeleton } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import type { EventLog, Question, Report, Session } from "@/lib/types";
import { BOOK_COLORS, cn, formatDuration, QTYPE_LABEL, scoreColor } from "@/lib/utils";

const TONE: Record<string, string> = { excellent: "#34d399", good: "#22d3ee", mixed: "#fbbf24", weak: "#fb7185" };
const CLAIM: Record<string, { c: string; i: typeof CheckCircle2 }> = {
  verified: { c: "#34d399", i: CheckCircle2 },
  "partially verified": { c: "#fbbf24", i: CircleDashed },
  "not demonstrated": { c: "#fb7185", i: CircleAlert },
};

export default function ReportPage() {
  const { id } = useParams<{ id: string }>();
  const [report, setReport] = useState<Report | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [events, setEvents] = useState<EventLog[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.report(id), api.session(id), api.events(id)])
      .then(([r, s, e]) => {
        setReport(r);
        setSession(s);
        setEvents(e);
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : "Failed to load report"));
  }, [id]);

  function download() {
    const blob = new Blob([JSON.stringify({ report, session, events }, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `screeniq-report-${id.slice(0, 8)}.json`;
    a.click();
    toast.success("Report exported");
  }

  if (error)
    return (
      <main className="grid min-h-screen place-items-center px-6 text-center">
        <div>
          <p className="text-ink-200">{error}</p>
          <Link href={`/interview/${id}`} className="mt-4 inline-block text-sm text-violet-300 underline">
            Return to the interview
          </Link>
        </div>
      </main>
    );
  if (!report || !session)
    return (
      <main className="mx-auto max-w-6xl space-y-5 px-6 pt-32">
        <Skeleton className="h-64" />
        <div className="grid gap-5 md:grid-cols-2">
          <Skeleton className="h-80" />
          <Skeleton className="h-80" />
        </div>
      </main>
    );

  const tone = TONE[report.signal.tone] || "#8b5cf6";
  const radar = report.topics.map((t) => ({ label: t.title, value: t.score }));
  const n = report.narrative;

  return (
    <main className="relative min-h-screen pb-24">
      <section className="relative overflow-hidden pt-32 pb-12">
        <Aurora intensity={0.6} />
        <div className="relative mx-auto max-w-6xl px-6">
          <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
            <SectionLabel>Stage 8 · Session report</SectionLabel>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" icon={<Printer className="h-3.5 w-3.5" />} onClick={() => window.print()}>
                Print / PDF
              </Button>
              <Button variant="secondary" size="sm" icon={<Download className="h-3.5 w-3.5" />} onClick={download}>
                Export JSON
              </Button>
              <Link href="/interview/new">
                <Button size="sm" icon={<Plus className="h-3.5 w-3.5" />}>
                  New interview
                </Button>
              </Link>
            </div>
          </div>

          <div className="mt-8 grid items-center gap-10 md:grid-cols-[auto_1fr]">
            <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8, ease: EASE }} className="relative mx-auto">
              <div className="absolute inset-0 rounded-full blur-3xl" style={{ background: `${tone}40` }} />
              <ScoreRing value={report.overall_score} max={100} size={200} stroke={14} color={tone} label="overall / 100" decimals={0} />
            </motion.div>
            <div>
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                <Badge color={tone} dot className="text-xs">
                  {report.signal.label}
                </Badge>
                <LevelBadge level={session.difficulty_level} className="ml-2 text-xs" />
              </motion.div>
              <motion.h1
                initial={{ opacity: 0, y: 20, filter: "blur(8px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                transition={{ delay: 0.3, duration: 0.7, ease: EASE }}
                className="mt-4 text-3xl font-semibold tracking-tight text-white md:text-4xl"
              >
                {session.candidate_name} <span className="font-display italic font-normal text-ink-300">for</span>{" "}
                <span className="text-gradient">{session.role_title}</span>
              </motion.h1>
              {n.headline && (
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="mt-3 text-lg text-ink-100">
                  {n.headline}
                </motion.p>
              )}
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} className="mt-3 max-w-3xl leading-relaxed text-ink-300">
                {n.summary}
              </motion.p>
              <div className="mt-2 font-mono text-[10px] text-ink-500">narrative: {report.generator}</div>
            </div>
          </div>

          <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {[
              { i: CheckCircle2, l: "Answered", v: report.answered },
              { i: CircleDashed, l: "Skipped", v: report.skipped },
              { i: GitBranch, l: "Follow-ups", v: report.follow_ups },
              { i: TrendingUp, l: "Avg difficulty", v: report.avg_difficulty, d: 1 },
              { i: Clock, l: "Total time", t: formatDuration(report.total_time_seconds) },
              { i: Activity, l: "Avg / question", t: formatDuration(report.avg_time_seconds) },
            ].map((s, k) => (
              <motion.div
                key={s.l}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 + k * 0.06 }}
                className="glass rounded-2xl p-4"
              >
                <s.i className="h-4 w-4 text-ink-400" />
                <div className="mt-3 text-2xl font-semibold text-white">{s.t ?? <AnimatedNumber value={s.v as number} decimals={s.d || 0} />}</div>
                <div className="mt-0.5 text-xs text-ink-400">{s.l}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl space-y-6 px-6">
        <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
          <Reveal className="glass flex flex-col items-center rounded-3xl p-6">
            <div className="flex w-full items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-medium text-white">
                <Target className="h-4 w-4 text-violet-300" /> Competency profile
              </h3>
              <span className="text-[11px] text-ink-400">score /10 per topic</span>
            </div>
            <div className="mt-4 flex w-full justify-center">
              <RadarChart data={radar} />
            </div>
          </Reveal>
          <Reveal delay={0.1} className="glass rounded-3xl p-6">
            <h3 className="flex items-center gap-2 text-sm font-medium text-white">
              <Activity className="h-4 w-4 text-cyan-300" /> Performance vs. difficulty
            </h3>
            <p className="mt-1 text-xs text-ink-400">How the adaptive engine moved the bar as the interview progressed.</p>
            <div className="mt-5">
              <ScoreTimeline points={report.timeline} />
            </div>
            {Object.keys(report.question_types).length > 0 && (
              <div className="mt-5 flex flex-wrap gap-2">
                {Object.entries(report.question_types).map(([k, v]) => (
                  <span key={k} className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-1 text-xs text-ink-300">
                    {QTYPE_LABEL[k] || k}: <span style={{ color: scoreColor(v) }}>{v.toFixed(1)}</span>
                  </span>
                ))}
              </div>
            )}
          </Reveal>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {[
            { t: "Strengths", items: n.strengths, c: "#34d399", i: Sparkles },
            { t: "Growth areas", items: n.growth_areas, c: "#fbbf24", i: TrendingUp },
            { t: "Next steps", items: n.next_steps, c: "#a78bfa", i: Layers },
          ].map((b, k) => (
            <Reveal key={b.t} delay={k * 0.08} className="glass rounded-3xl p-6">
              <h3 className="flex items-center gap-2 text-sm font-medium text-white">
                <b.i className="h-4 w-4" style={{ color: b.c }} /> {b.t}
              </h3>
              <ul className="mt-4 space-y-2.5">
                {(b.items || []).length ? (
                  b.items!.map((s) => (
                    <li key={s} className="flex gap-2.5 text-[13.5px] leading-relaxed text-ink-200">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: b.c }} />
                      {s}
                    </li>
                  ))
                ) : (
                  <li className="text-sm text-ink-500">—</li>
                )}
              </ul>
            </Reveal>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Reveal className="glass rounded-3xl p-6">
            <h3 className="flex items-center gap-2 text-sm font-medium text-white">
              <CheckCircle2 className="h-4 w-4 text-emerald-300" /> Resume claim verification
            </h3>
            <p className="mt-1 text-xs text-ink-400">Topics anchored in resume claims, judged by the answers they produced.</p>
            <div className="mt-5 space-y-3">
              {report.claims.length === 0 && <p className="text-sm text-ink-500">No resume-anchored topics were answered.</p>}
              {report.claims.map((c, k) => {
                const meta = CLAIM[c.claim_status || "not demonstrated"];
                return (
                  <motion.div
                    key={c.index}
                    initial={{ opacity: 0, x: -10 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: k * 0.07 }}
                    className="flex items-start gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5"
                  >
                    <meta.i className="mt-0.5 h-4 w-4 shrink-0" style={{ color: meta.c }} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-white">{c.title}</span>
                        <span className="ml-auto font-mono text-xs" style={{ color: scoreColor(c.score) }}>
                          {c.score.toFixed(1)}
                        </span>
                      </div>
                      <div className="mt-0.5 truncate text-xs text-ink-400">{c.resume_anchor}</div>
                      <div className="mt-1 text-[11px] font-medium uppercase tracking-wider" style={{ color: meta.c }}>
                        {c.claim_status}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </Reveal>
          <Reveal delay={0.1} className="glass rounded-3xl p-6">
            <h3 className="flex items-center gap-2 text-sm font-medium text-white">
              <BookOpen className="h-4 w-4 text-pink-300" /> Personalised reading list
            </h3>
            <p className="mt-1 text-xs text-ink-400">The exact textbook passages behind questions that scored below 6.</p>
            <div className="mt-5 space-y-3">
              {report.reading_list.length === 0 && <p className="text-sm text-ink-500">Nothing to revisit — every topic scored 6 or above.</p>}
              {report.reading_list.map((r, k) => (
                <motion.div
                  key={k}
                  initial={{ opacity: 0, y: 8 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: k * 0.07 }}
                  className="group flex gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5 transition-colors hover:border-white/[0.12]"
                >
                  <div className="h-14 w-10 shrink-0 rounded-md shadow-lg transition-transform group-hover:-rotate-6" style={{ background: `linear-gradient(160deg, ${BOOK_COLORS[r.book_id]}, ${BOOK_COLORS[r.book_id]}55)` }} />
                  <div className="min-w-0">
                    <div className="truncate text-sm text-white">{r.section || r.topic}</div>
                    <div className="truncate text-xs text-ink-300">
                      {r.book_title} · {r.author}
                    </div>
                    <div className="mt-1 font-mono text-[11px] text-ink-400">
                      p. {r.pages} · for “{r.topic}”
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </Reveal>
        </div>

        <Reveal className="glass rounded-3xl p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-medium text-white">Full transcript · Context → Question → Answer → Evaluation</h3>
            <span className="text-xs text-ink-400">{session.questions.length} questions · click to expand</span>
          </div>
          <div className="mt-5 space-y-3">
            {session.questions.map((q) => (
              <TranscriptItem key={q.id} q={q} />
            ))}
          </div>
        </Reveal>

        <Reveal className="glass rounded-3xl p-6">
          <h3 className="flex items-center gap-2 text-sm font-medium text-white">
            <Activity className="h-4 w-4 text-violet-300" /> Pipeline audit log
          </h3>
          <p className="mt-1 text-xs text-ink-400">Every stage of the system, as persisted by the backend.</p>
          <div className="relative mt-5">
            <div className="absolute bottom-0 left-[5px] top-0 w-px bg-white/[0.07]" />
            <div className="space-y-3">
              {events.map((e, k) => (
                <motion.div
                  key={e.id}
                  initial={{ opacity: 0, x: -6 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: Math.min(k * 0.03, 0.6) }}
                  className="relative flex gap-4 pl-6 text-xs"
                >
                  <span className="absolute left-0 top-1 h-[11px] w-[11px] rounded-full border-2 border-ink-900" style={{ background: STAGE_COLOR[e.stage] || "#6b7190" }} />
                  <span className="w-36 shrink-0 font-mono text-ink-400">{e.stage}</span>
                  <span className="flex-1 text-ink-200">{e.message}</span>
                  {e.duration_ms != null && <span className="shrink-0 font-mono text-ink-500">{e.duration_ms} ms</span>}
                </motion.div>
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </main>
  );
}

const STAGE_COLOR: Record<string, string> = {
  resume_parsed: "#a78bfa",
  plan_built: "#60a5fa",
  retrieval: "#22d3ee",
  question_generated: "#34d399",
  answer_evaluated: "#fbbf24",
  report_generated: "#f472b6",
};

function TranscriptItem({ q }: { q: Question }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"eval" | "sources">("eval");
  const s = q.answer?.score;
  return (
    <div className={cn("overflow-hidden rounded-2xl border transition-colors", open ? "border-white/[0.12] bg-white/[0.025]" : "border-white/[0.06] bg-white/[0.015]")}>
      <button onClick={() => setOpen(!open)} className="flex w-full items-center gap-4 p-4 text-left">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl font-mono text-sm" style={{ background: `${scoreColor(s)}18`, color: scoreColor(s) }}>
          {s != null ? s.toFixed(1) : "–"}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-mono text-ink-400">Q{q.seq}</span>
            <span className="text-ink-200">{q.topic}</span>
            {q.kind === "follow_up" && <Badge color="#fbbf24">follow-up</Badge>}
            {q.status === "skipped" && <Badge>skipped</Badge>}
            <DifficultyPips level={q.difficulty} showLabel={false} animate={false} />
          </div>
          <div className={cn("mt-1 text-sm text-white", !open && "truncate")}>{q.text}</div>
        </div>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-ink-400 transition-transform", open && "rotate-180")} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.35, ease: EASE }}>
            <div className="space-y-4 border-t border-white/[0.06] p-5">
              <div>
                <div className="mb-1.5 text-[11px] uppercase tracking-[0.14em] text-ink-400">Candidate answer</div>
                <p className="whitespace-pre-wrap rounded-xl bg-black/20 p-4 text-[13.5px] leading-relaxed text-ink-200">{q.answer?.text || <em className="text-ink-500">No answer (skipped)</em>}</p>
              </div>
              <div className="flex gap-1 rounded-xl bg-white/[0.03] p-1 text-xs">
                {(["eval", "sources"] as const).map((t) => (
                  <button key={t} onClick={() => setTab(t)} className="relative flex-1 rounded-lg px-3 py-1.5">
                    {tab === t && <motion.span layoutId={`tab-${q.id}`} className="absolute inset-0 rounded-lg bg-white/[0.08]" />}
                    <span className={cn("relative", tab === t ? "text-white" : "text-ink-400")}>
                      {t === "eval" ? "Evaluation" : (
                        <span className="inline-flex items-center gap-1">
                          <FileSearch className="h-3 w-3" /> Retrieval trace
                        </span>
                      )}
                    </span>
                  </button>
                ))}
              </div>
              {tab === "eval" && q.answer?.evaluation && (
                <div className="space-y-4">
                  <EvaluationCard evaluation={q.answer.evaluation} compact />
                  {q.expected_points && q.expected_points.length > 0 && (
                    <div className="rounded-xl border border-white/[0.06] p-3.5">
                      <div className="mb-2 text-[11px] uppercase tracking-[0.14em] text-ink-400">Reference points (from the textbook)</div>
                      <ul className="space-y-1 text-[13px] text-ink-300">
                        {q.expected_points.map((p) => (
                          <li key={p}>• {p}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {q.answer.evaluation.decision && (
                    <div className="text-xs text-ink-400">
                      <span className="text-ink-200">Adaptive decision:</span> {q.answer.evaluation.decision.label} — {q.answer.evaluation.decision.reason}
                    </div>
                  )}
                </div>
              )}
              {tab === "sources" && q.trace && (
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-1.5">
                    {q.trace.queries.map((x) => (
                      <span key={x} className="rounded-md bg-white/[0.04] px-2 py-0.5 font-mono text-[10.5px] text-ink-300">
                        {x}
                      </span>
                    ))}
                  </div>
                  {q.trace.chunks.map((c, i) => (
                    <ChunkCard key={c.id} chunk={c} index={i} />
                  ))}
                  <div className="font-mono text-[10.5px] text-ink-500">
                    {q.generator} · {q.trace.prompt_version} · retrieval {q.trace.retrieval_ms} ms · generation {q.trace.generation_ms} ms
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

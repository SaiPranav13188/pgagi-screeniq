"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Anchor, ArrowRight, BrainCircuit, Check, CornerDownRight, FileSearch, Flag, GitBranch, Keyboard, SkipForward, Timer } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { DecisionBanner, EvaluationCard } from "@/components/evaluation-card";
import { Aurora, EASE, Typewriter } from "@/components/motion";
import { RagLoader } from "@/components/rag-loader";
import { TraceDrawer } from "@/components/trace-drawer";
import { Badge, Button, DifficultyPips, ProgressBar } from "@/components/ui";
import { AnswerModeToggle, ListenButton, VoicePanel, type AnswerMode } from "@/components/voice";
import { api, ApiError } from "@/lib/api";
import { useSpeechToText, useTextToSpeech } from "@/lib/speech";
import type { AnswerResult, Question, Session } from "@/lib/types";
import { cn, formatDuration, QTYPE_LABEL, scoreColor } from "@/lib/utils";

type Phase = "loading" | "generating" | "answering" | "evaluating" | "feedback" | "transition" | "finishing";

export default function InterviewRoom() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [question, setQuestion] = useState<Question | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [answer, setAnswer] = useState("");
  const [result, setResult] = useState<AnswerResult | null>(null);
  const [traceOpen, setTraceOpen] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [typed, setTyped] = useState(false);
  const startRef = useRef<number>(Date.now());
  const textRef = useRef<HTMLTextAreaElement>(null);
  const busy = useRef(false);
  const [mode, setMode] = useState<AnswerMode>("write");

  // Voice: dictated phrases are appended to the (still editable) answer.
  const stt = useSpeechToText((phrase) => {
    if (!phrase) return;
    setAnswer((prev) => {
      const sep = prev && !/\s$/.test(prev) ? " " : "";
      const cap = !prev.trim() || /[.!?]\s*$/.test(prev) ? phrase[0].toUpperCase() + phrase.slice(1) : phrase;
      return prev + sep + cap;
    });
  });
  const tts = useTextToSpeech();

  useEffect(() => {
    try {
      const saved = localStorage.getItem("answer-mode");
      if (saved === "speak" || saved === "write") setMode(saved);
    } catch {}
  }, []);
  const changeMode = (m: AnswerMode) => {
    setMode(m);
    if (m === "write" && stt.listening) stt.stop();
    try {
      localStorage.setItem("answer-mode", m);
    } catch {}
  };

  // Stop the mic / speech when leaving the answering phase or changing question.
  useEffect(() => {
    if (phase !== "answering") {
      if (stt.listening) stt.stop();
      tts.cancel();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, question?.id]);

  const refresh = useCallback(async () => {
    const s = await api.session(id);
    setSession(s);
    return s;
  }, [id]);

  const showQuestion = useCallback((q: Question) => {
    setQuestion(q);
    setTyped(false);
    let draft = "";
    try {
      draft = localStorage.getItem(`draft:${q.id}`) || "";
    } catch {}
    setAnswer(draft);
    startRef.current = Date.now();
    setElapsed(0);
    setPhase("answering");
  }, []);

  const finish = useCallback(async () => {
    setPhase("finishing");
    try {
      await api.complete(id);
      router.push(`/report/${id}`);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not finish the interview");
      setPhase(question ? "answering" : "loading");
    }
  }, [id, router, question]);

  const fetchNext = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setPhase("generating");
    setResult(null);
    try {
      const q = await api.nextQuestion(id);
      await refresh();
      if (!q) {
        busy.current = false;
        return finish();
      }
      showQuestion(q);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Failed to generate the next question");
    } finally {
      busy.current = false;
    }
  }, [id, refresh, showQuestion, finish]);

  // initial load (refresh-safe: resumes the open question)
  useEffect(() => {
    (async () => {
      try {
        const s = await refresh();
        if (s.status === "completed") return router.replace(`/report/${id}`);
        const open = s.questions.find((q) => q.id === s.current_question_id);
        if (open) showQuestion(open);
        else fetchNext();
      } catch (e) {
        toast.error(e instanceof ApiError ? e.message : "Session not found");
        router.replace("/interview/new");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // per-question timer
  useEffect(() => {
    if (phase !== "answering") return;
    const t = setInterval(() => setElapsed(Math.round((Date.now() - startRef.current) / 1000)), 1000);
    return () => clearInterval(t);
  }, [phase]);

  // draft autosave
  useEffect(() => {
    if (!question || phase !== "answering") return;
    try {
      localStorage.setItem(`draft:${question.id}`, answer);
    } catch {}
  }, [answer, question, phase]);

  async function submit(skip = false) {
    if (!question || phase !== "answering") return;
    if (stt.listening) stt.stop();
    if (!skip && answer.trim().length < 2) {
      toast.message(mode === "speak" ? "Record an answer first — or skip this question." : "Write an answer first — or skip this question.");
      return;
    }
    setPhase("evaluating");
    const secs = Math.round((Date.now() - startRef.current) / 1000);
    try {
      const r = skip ? await api.skip(id, question.id, secs) : await api.answer(id, question.id, answer.trim(), secs);
      try {
        localStorage.removeItem(`draft:${question.id}`);
      } catch {}
      setResult(r);
      await refresh();
      if (session?.mode === "practice" && !skip) {
        setPhase("feedback");
      } else {
        setPhase("transition");
        setTimeout(() => (r.decision.action === "complete" ? finish() : fetchNext()), 2200);
      }
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Failed to submit answer");
      setPhase("answering");
    }
  }

  // Ctrl/Cmd + Enter to submit
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey && e.key.toLowerCase() === "m" && phase === "answering" && stt.supported) {
        e.preventDefault();
        if (mode !== "speak") changeMode("speak");
        stt.toggle();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        if (phase === "answering") submit();
        else if (phase === "feedback") {
          if (result?.decision.action === "complete") finish();
          else fetchNext();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const plan = session?.plan;
  const progress = session?.progress;
  const words = answer.trim() ? answer.trim().split(/\s+/).length : 0;
  const currentTopic = plan?.topics[question?.topic_index ?? 0];

  return (
    <main className="relative min-h-screen">
      <Aurora intensity={0.35} className="fixed" />

      {/* top bar */}
      <header className="glass-strong sticky top-0 z-40 border-b border-white/[0.06]">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-5 py-3">
          <Link href="/" className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-violet-500 to-cyan-400">
            <BrainCircuit className="h-4 w-4 text-white" />
          </Link>
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-white">{session?.candidate_name || "…"}</div>
            <div className="truncate text-xs text-ink-400">
              {session?.role_title} · {session?.mode} mode
            </div>
          </div>
          <div className="mx-auto hidden w-full max-w-sm items-center gap-3 md:flex">
            <ProgressBar value={progress?.percent ?? 0} />
            <span className="shrink-0 font-mono text-xs text-ink-300">
              {progress?.topics_done ?? 0}/{progress?.topics_total ?? "–"}
            </span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className={cn("hidden items-center gap-1.5 rounded-lg px-2.5 py-1 font-mono text-xs sm:flex", elapsed > 300 ? "text-amber-300" : "text-ink-300")}>
              <Timer className="h-3.5 w-3.5" /> {formatDuration(elapsed) === "–" ? "0s" : formatDuration(elapsed)}
            </span>
            <Button
              variant="secondary"
              size="sm"
              icon={<Flag className="h-3.5 w-3.5" />}
              disabled={!session?.progress.answered && !session?.progress.skipped}
              onClick={() => {
                if (confirm("Finish now and generate the report? Remaining topics will be skipped.")) finish();
              }}
            >
              Finish
            </Button>
          </div>
        </div>
      </header>

      <div className="relative mx-auto grid max-w-7xl gap-8 px-5 py-8 lg:grid-cols-[270px_1fr]">
        {/* sidebar: topic progress */}
        <aside className="hidden lg:block">
          <div className="sticky top-24">
            <div className="text-[11px] uppercase tracking-[0.18em] text-ink-400">Interview plan</div>
            <div className="relative mt-4">
              <div className="absolute bottom-2 left-[11px] top-2 w-px bg-white/[0.07]" />
              <ol className="space-y-1">
                {plan?.topics.map((t) => {
                  const qs = session!.questions.filter((q) => q.topic_index === t.index);
                  const primary = qs.find((q) => q.kind === "primary");
                  const isCurrent = question?.topic_index === t.index && phase !== "finishing";
                  const done = primary && primary.status !== "asked";
                  const score = primary?.answer?.score;
                  return (
                    <li key={t.index}>
                      <div className={cn("relative flex items-start gap-3 rounded-xl px-0 py-2 transition-colors")}>
                        <span className="relative z-10 mt-0.5 grid h-[23px] w-[23px] shrink-0 place-items-center">
                          {isCurrent ? (
                            <>
                              <span className="absolute inset-0 rounded-full bg-violet-500/40 animate-pulse-ring" />
                              <span className="h-3 w-3 rounded-full bg-violet-400 shadow-[0_0_12px_#a78bfa]" />
                            </>
                          ) : done ? (
                            <motion.span
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              className="grid h-[18px] w-[18px] place-items-center rounded-full"
                              style={{ background: score != null ? scoreColor(score) : primary?.status === "skipped" ? "#3d4258" : "#8b5cf6" }}
                            >
                              <Check className="h-3 w-3 text-ink-950" />
                            </motion.span>
                          ) : (
                            <span className="h-2 w-2 rounded-full border border-ink-500 bg-ink-900" />
                          )}
                        </span>
                        <div className="min-w-0">
                          <div className={cn("text-[13px] leading-snug", isCurrent ? "text-white" : done ? "text-ink-200" : "text-ink-400")}>{t.title}</div>
                          <div className="mt-1 flex items-center gap-2">
                            <DifficultyPips level={t.difficulty} showLabel={false} animate={false} />
                            {t.resume_anchor && <Anchor className="h-3 w-3 text-violet-300/70" />}
                            {score != null && (
                              <span className="font-mono text-[10px]" style={{ color: scoreColor(score) }}>
                                {score.toFixed(1)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      {qs
                        .filter((q) => q.kind === "follow_up")
                        .map((f) => (
                          <motion.div
                            key={f.id}
                            initial={{ opacity: 0, x: -8 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="ml-9 flex items-center gap-1.5 pb-1 text-[11.5px] text-amber-300/90"
                          >
                            <CornerDownRight className="h-3 w-3" /> follow-up probe
                          </motion.div>
                        ))}
                    </li>
                  );
                })}
              </ol>
            </div>
            {session && (
              <div className="mt-6 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-[11.5px] text-ink-400">
                <div className="flex justify-between">
                  <span>Adaptive offset</span>
                  <span className={cn("font-mono", session.difficulty_offset > 0 ? "text-emerald-300" : session.difficulty_offset < 0 ? "text-cyan-300" : "text-ink-200")}>
                    {session.difficulty_offset > 0 ? "+" : ""}
                    {session.difficulty_offset}
                  </span>
                </div>
                <div className="mt-1 flex justify-between">
                  <span>Follow-ups used</span>
                  <span className="font-mono text-ink-200">{session.follow_ups_used}/2</span>
                </div>
                <div className="mt-1 flex justify-between">
                  <span>Engine</span>
                  <span className="truncate pl-2 font-mono text-ink-200">{session.llm_mode}</span>
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* stage */}
        <section className="min-w-0">
          <AnimatePresence mode="wait">
            {(phase === "loading" || phase === "generating") && (
              <motion.div key="gen" exit={{ opacity: 0 }}>
                <RagLoader topic={phase === "generating" ? nextTopicTitle(session) : undefined} books={plan?.books} />
              </motion.div>
            )}

            {(phase === "answering" || phase === "evaluating") && question && (
              <motion.div
                key={`q-${question.id}`}
                initial={{ opacity: 0, y: 24, filter: "blur(8px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, y: -16, filter: "blur(8px)" }}
                transition={{ duration: 0.55, ease: EASE }}
                className="space-y-5"
              >
                <div className="border-gradient glass relative overflow-hidden rounded-3xl p-6 md:p-8">
                  {question.kind === "follow_up" && (
                    <motion.div
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mb-4 inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs text-amber-200"
                    >
                      <GitBranch className="h-3.5 w-3.5" /> Follow-up probe — digging into a gap from your last answer
                    </motion.div>
                  )}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs text-ink-400">Q{question.seq}</span>
                    <Badge color="#a78bfa" dot>
                      {question.topic}
                    </Badge>
                    <Badge>{QTYPE_LABEL[question.question_type] || question.question_type}</Badge>
                    <DifficultyPips level={question.difficulty} />
                    <span className="ml-auto" />
                    <ListenButton
                      supported={tts.supported}
                      speaking={tts.speaking}
                      onClick={() => (tts.speaking ? tts.cancel() : tts.speak(question.text, stt.lang))}
                    />
                    <button
                      onClick={() => setTraceOpen(true)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1 text-xs text-ink-200 transition hover:border-violet-400/40 hover:text-white"
                    >
                      <FileSearch className="h-3.5 w-3.5 text-cyan-300" /> How was this generated?
                    </button>
                  </div>
                  <h2 className="mt-5 text-xl leading-relaxed text-white md:text-[22px] md:leading-[1.55]">
                    {typed ? question.text : <Typewriter text={question.text} speed={9} onDone={() => setTyped(true)} />}
                  </h2>
                  {question.resume_link && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.6 }}
                      className="mt-5 flex items-start gap-2 text-xs text-violet-300/90"
                    >
                      <Anchor className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span>{question.resume_link}</span>
                    </motion.div>
                  )}
                  <div className="mt-5 flex flex-wrap gap-1.5">
                    {question.trace?.chunks
                      .filter((c) => c.cited)
                      .map((c) => (
                        <span key={c.id} className="rounded-md bg-white/[0.04] px-2 py-0.5 text-[10.5px] text-ink-400">
                          📖 {c.book_title} · p.{c.page_start}
                        </span>
                      ))}
                  </div>
                </div>

                <div
                  className={cn(
                    "glass relative overflow-hidden rounded-3xl transition-shadow duration-500 focus-within:shadow-[0_0_0_1px_rgba(139,92,246,0.5),0_0_50px_-15px_rgba(139,92,246,0.7)]",
                    stt.listening && "shadow-[0_0_0_1px_rgba(244,63,94,0.45),0_0_60px_-15px_rgba(244,63,94,0.6)]",
                  )}
                >
                  <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-5 py-3">
                    <AnswerModeToggle mode={mode} onChange={changeMode} voiceSupported={stt.supported} />
                    <span className="hidden text-[11px] text-ink-500 sm:block">
                      {mode === "speak" ? "Voice is transcribed in your browser — edit before submitting" : "Type your answer"}
                    </span>
                  </div>
                  <AnimatePresence initial={false}>
                    {mode === "speak" && (
                      <motion.div
                        key="voice"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.45, ease: EASE }}
                        className="overflow-hidden border-b border-white/[0.06] bg-gradient-to-b from-violet-500/[0.05] to-transparent"
                      >
                        <VoicePanel
                          listening={stt.listening}
                          interim={stt.interim}
                          levels={stt.levels}
                          error={stt.error}
                          lang={stt.lang}
                          onLang={stt.setLang}
                          onToggle={stt.toggle}
                          disabled={phase !== "answering"}
                          hasText={!!answer.trim()}
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                  <textarea
                    ref={textRef}
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    disabled={phase !== "answering"}
                    autoFocus={mode === "write"}
                    rows={mode === "speak" ? 5 : 9}
                    maxLength={6000}
                    placeholder={
                      mode === "speak"
                        ? "Your spoken answer will appear here as you talk…"
                        : "Explain your reasoning as you would to an interviewer — mechanisms, trade-offs, examples from your own work…"
                    }
                    className="w-full resize-none bg-transparent p-6 text-[15px] leading-relaxed text-ink-100 outline-none transition-[height] placeholder:text-ink-500 disabled:opacity-60"
                  />
                  {stt.listening && stt.interim && (
                    <div className="-mt-4 px-6 pb-4 text-[15px] italic leading-relaxed text-violet-300/70">{stt.interim}…</div>
                  )}
                  <div className="flex flex-wrap items-center gap-3 border-t border-white/[0.06] px-5 py-3">
                    <span className="font-mono text-xs text-ink-400">{words} words</span>
                    <span className="hidden items-center gap-1 text-xs text-ink-500 sm:flex">
                      <Keyboard className="h-3 w-3" /> Ctrl + Enter to submit{stt.supported ? " · Alt + M mic" : ""}
                    </span>
                    {answer && mode === "speak" && !stt.listening && (
                      <button type="button" onClick={() => setAnswer("")} className="text-xs text-ink-500 transition hover:text-rose-300">
                        Clear
                      </button>
                    )}
                    <div className="ml-auto flex gap-2">
                      <Button variant="ghost" size="sm" onClick={() => submit(true)} disabled={phase !== "answering"} icon={<SkipForward className="h-3.5 w-3.5" />}>
                        Skip
                      </Button>
                      <Button size="sm" onClick={() => submit()} loading={phase === "evaluating"} icon={<ArrowRight className="h-3.5 w-3.5" />} className="flex-row-reverse">
                        Submit answer
                      </Button>
                    </div>
                  </div>
                  {phase === "evaluating" && <motion.div className="absolute inset-x-0 bottom-0 h-0.5 bg-gradient-to-r from-violet-500 via-cyan-400 to-pink-400" initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 3 }} style={{ originX: 0 }} />}
                </div>
              </motion.div>
            )}

            {phase === "feedback" && result?.evaluation && (
              <motion.div
                key="feedback"
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16, filter: "blur(8px)" }}
                transition={{ duration: 0.5, ease: EASE }}
                className="space-y-5"
              >
                <div className="glass rounded-3xl p-6 md:p-8">
                  <div className="mb-5 text-[11px] uppercase tracking-[0.18em] text-ink-400">
                    Feedback · Q{result.question.seq} · {result.question.topic}
                  </div>
                  <EvaluationCard evaluation={result.evaluation} />
                </div>
                <DecisionBanner decision={result.decision} />
                <div className="flex justify-end gap-2">
                  <Button variant="secondary" onClick={() => setTraceOpen(true)} icon={<FileSearch className="h-4 w-4" />}>
                    View sources
                  </Button>
                  <Button
                    onClick={() => (result.decision.action === "complete" ? finish() : fetchNext())}
                    icon={<ArrowRight className="h-4 w-4" />}
                    className="flex-row-reverse"
                  >
                    {result.decision.action === "complete" ? "See my report" : result.decision.action === "follow_up" ? "Take the follow-up" : "Next question"}
                  </Button>
                </div>
              </motion.div>
            )}

            {phase === "transition" && result && (
              <motion.div
                key="transition"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.02, filter: "blur(8px)" }}
                className="flex flex-col items-center py-16 text-center"
              >
                <motion.div
                  initial={{ scale: 0, rotate: -90 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", stiffness: 260, damping: 16 }}
                  className="grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br from-emerald-400 to-cyan-400 shadow-[0_0_50px_rgba(52,211,153,0.6)]"
                >
                  <Check className="h-8 w-8 text-ink-950" />
                </motion.div>
                <h3 className="mt-6 text-2xl font-semibold text-white">{result.question.status === "skipped" ? "Skipped" : "Answer recorded"}</h3>
                <p className="mt-2 max-w-md text-sm text-ink-300">
                  {result.decision.action === "follow_up"
                    ? "The interviewer wants to dig a little deeper on this topic."
                    : result.decision.action === "complete"
                      ? "That was the last topic. Compiling your report…"
                      : "Moving on to the next topic in your blueprint."}
                </p>
                <div className="mt-6 h-1 w-48 overflow-hidden rounded-full bg-white/[0.06]">
                  <motion.div className="h-full bg-gradient-to-r from-violet-500 to-cyan-400" initial={{ width: 0 }} animate={{ width: "100%" }} transition={{ duration: 2.1, ease: "linear" }} />
                </div>
              </motion.div>
            )}

            {phase === "finishing" && (
              <motion.div key="finishing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center py-24 text-center">
                <div className="relative h-24 w-24">
                  <div className="absolute inset-0 rounded-full border-2 border-violet-500/20 animate-spin-slow" style={{ borderTopColor: "#a78bfa", animationDuration: "1.4s" }} />
                  <div className="absolute inset-3 rounded-full border-2 border-cyan-400/20 animate-spin-slow [animation-direction:reverse]" style={{ borderTopColor: "#22d3ee", animationDuration: "2s" }} />
                </div>
                <h3 className="mt-8 text-2xl font-semibold text-white">Compiling your report</h3>
                <p className="mt-2 text-sm text-ink-300">Scoring competencies, verifying resume claims, building a reading list…</p>
              </motion.div>
            )}
          </AnimatePresence>

          {currentTopic && phase === "answering" && (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }} className="mt-6 text-center text-xs text-ink-500">
              Topic focus: {currentTopic.focus}
            </motion.p>
          )}
        </section>
      </div>

      <TraceDrawer question={phase === "feedback" ? result?.question ?? null : question} open={traceOpen} onClose={() => setTraceOpen(false)} />
    </main>
  );
}

function nextTopicTitle(s: Session | null) {
  if (!s?.plan) return undefined;
  const last = [...s.questions].reverse().find((q) => q.answer);
  const decision = last?.answer?.decision ?? last?.answer?.evaluation?.decision;
  if (decision?.action === "follow_up" && last) return `Follow-up · ${last.topic}`;
  const done = s.questions.filter((q) => q.kind === "primary").length;
  return s.plan.topics[done]?.title;
}

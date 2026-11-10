"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Bot, FileSearch, GitBranch, Headphones, Languages, Mic, MicOff, Pause, Play, RotateCcw, Send, SkipForward, Sparkles, User, Volume2 } from "lucide-react";
import { useEffect, useRef } from "react";
import { DifficultyPips } from "@/components/ui";
import { EASE } from "@/components/motion";
import { LANGUAGES } from "@/lib/speech";
import { cn } from "@/lib/utils";

export type LiveState = "speaking" | "listening" | "thinking" | "paused";
export type Turn = { id: string; who: "ai" | "me"; text: string; meta?: string };

export const INTERVIEWER_NAME = "Nova";

/* ------------------------------------------------------------------ avatar orb */
export function InterviewerOrb({ state, level = 0, size = 176 }: { state: LiveState; level?: number; size?: number }) {
  const speaking = state === "speaking";
  const listening = state === "listening";
  const thinking = state === "thinking";
  const hue = listening ? ["#fb7185", "#22d3ee"] : thinking ? ["#38bdf8", "#a78bfa"] : ["#a78bfa", "#22d3ee"];

  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      {/* emission rings */}
      <AnimatePresence>
        {(speaking || listening) &&
          [0, 1, 2].map((i) => (
            <motion.span
              key={`${state}-${i}`}
              className="absolute inset-0 rounded-full border"
              style={{ borderColor: listening ? "rgba(251,113,133,0.35)" : "rgba(167,139,250,0.4)" }}
              initial={{ scale: 0.62, opacity: 0.7 }}
              animate={{ scale: 1.25 + (listening ? level * 0.5 : 0), opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ repeat: Infinity, duration: speaking ? 1.8 : 2.4, delay: i * 0.6, ease: "easeOut" }}
            />
          ))}
      </AnimatePresence>

      {/* thinking spinner */}
      {thinking && (
        <motion.span
          className="absolute rounded-full"
          style={{
            inset: size * 0.08,
            background: "conic-gradient(from 0deg, transparent 0deg, #38bdf8 90deg, #a78bfa 180deg, transparent 260deg)",
            WebkitMask: "radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 2px))",
            mask: "radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 2px))",
          }}
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1.4, ease: "linear" }}
        />
      )}

      {/* glow */}
      <motion.div
        className="absolute rounded-full blur-3xl"
        style={{ inset: size * 0.12, background: `radial-gradient(circle, ${hue[0]}, ${hue[1]} 75%)` }}
        animate={{
          opacity: state === "paused" ? 0.18 : speaking ? [0.45, 0.75, 0.5, 0.7, 0.45] : listening ? 0.35 + level * 1.4 : 0.4,
          scale: speaking ? [1, 1.08, 1.02, 1.1, 1] : listening ? 1 + level * 0.5 : 1,
        }}
        transition={speaking ? { repeat: Infinity, duration: 1.6 } : { type: "spring", stiffness: 180, damping: 16 }}
      />

      {/* core */}
      <motion.div
        className="relative grid place-items-center overflow-hidden rounded-full border border-white/15 shadow-[inset_0_2px_20px_rgba(255,255,255,0.15)]"
        style={{ width: size * 0.56, height: size * 0.56 }}
        animate={{ scale: listening ? 1 + level * 0.18 : state === "paused" ? 0.94 : [1, 1.02, 1] }}
        transition={listening ? { type: "spring", stiffness: 300, damping: 18 } : { repeat: Infinity, duration: 3.2, ease: "easeInOut" }}
      >
        <motion.div
          className="absolute inset-[-30%]"
          style={{ background: `conic-gradient(from 0deg, ${hue[0]}, #6366f1, ${hue[1]}, #f472b6, ${hue[0]})` }}
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: thinking ? 2.5 : 9, ease: "linear" }}
        />
        <div className="absolute inset-[3px] rounded-full bg-ink-950/55 backdrop-blur-md" />
        {/* voice bars */}
        <div className="relative flex h-10 items-center gap-[4px]">
          {[0, 1, 2, 3, 4].map((i) => {
            const mid = 1 - Math.abs(i - 2) / 3;
            return (
              <motion.span
                key={i}
                className="w-[4px] rounded-full bg-gradient-to-b from-white to-violet-200"
                animate={{
                  height: speaking
                    ? [6, 14 + mid * 22, 8, 10 + mid * 26, 6]
                    : listening
                      ? Math.max(5, 5 + level * 60 * (0.5 + mid * 0.5))
                      : thinking
                        ? [5, 9, 5]
                        : 5,
                  opacity: state === "paused" ? 0.4 : 1,
                }}
                transition={
                  speaking
                    ? { repeat: Infinity, duration: 0.75 + i * 0.07, ease: "easeInOut" }
                    : thinking
                      ? { repeat: Infinity, duration: 0.9, delay: i * 0.12 }
                      : { type: "spring", stiffness: 500, damping: 26 }
                }
              />
            );
          })}
        </div>
      </motion.div>
    </div>
  );
}

const STATUS: Record<LiveState, { label: string; dot: string; text: string }> = {
  speaking: { label: "Speaking", dot: "bg-violet-400", text: "text-violet-200" },
  listening: { label: "Listening", dot: "bg-rose-400", text: "text-rose-200" },
  thinking: { label: "Thinking", dot: "bg-sky-400", text: "text-sky-200" },
  paused: { label: "Your turn", dot: "bg-ink-400", text: "text-ink-200" },
};

/* ------------------------------------------------------------------ captions */
function Caption({ text, progress, speaking }: { text: string; progress: number; speaking: boolean }) {
  // Engines without word-boundary events report no progress: show the whole line.
  const cut = speaking && progress > 0 ? Math.min(text.length, progress) : text.length;
  return (
    <p className="text-[19px] leading-[1.6] md:text-[21px]">
      <span className="text-white">{text.slice(0, cut)}</span>
      <span className="text-ink-500">{text.slice(cut)}</span>
    </p>
  );
}

/* ------------------------------------------------------------------ auto-send ring */
function CountdownRing({ armed, armKey, ms }: { armed: boolean; armKey: string | number; ms: number }) {
  const r = 9;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 -rotate-90">
      <circle cx="12" cy="12" r={r} fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="2.5" />
      {armed && (
        <motion.circle
          key={armKey}
          cx="12"
          cy="12"
          r={r}
          fill="none"
          stroke="#fff"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: 0 }}
          transition={{ duration: ms / 1000, ease: "linear" }}
        />
      )}
    </svg>
  );
}

/* ------------------------------------------------------------------ start gate */
export function LiveStartGate({ name, role, onStart, onType }: { name: string; role?: string; onStart: () => void; onType: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24, filter: "blur(8px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      exit={{ opacity: 0, scale: 0.97, filter: "blur(8px)" }}
      transition={{ duration: 0.6, ease: EASE }}
      className="border-gradient glass relative flex flex-col items-center overflow-hidden rounded-3xl px-6 py-12 text-center"
    >
      <InterviewerOrb state="paused" size={190} />
      <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-violet-400/30 bg-violet-500/10 px-3 py-1 text-xs text-violet-200">
        <Sparkles className="h-3.5 w-3.5" /> Live AI interview
      </div>
      <h2 className="mt-4 text-2xl font-semibold text-white md:text-3xl">
        {name ? `Hi ${name}, ` : ""}meet {INTERVIEWER_NAME}, your interviewer
      </h2>
      <p className="mt-3 max-w-lg text-sm leading-relaxed text-ink-300">
        {INTERVIEWER_NAME} will ask each question out loud{role ? ` for the ${role} role` : ""}. When it finishes, your microphone opens
        automatically — just answer naturally and pause when you&apos;re done. It will react, follow up, and move on, like a real interview.
      </p>
      <div className="mt-6 grid gap-2 text-left text-xs text-ink-300 sm:grid-cols-3">
        {[
          { icon: Headphones, t: "Use headphones", d: "so the mic doesn't hear the interviewer" },
          { icon: Mic, t: "Allow the microphone", d: "when the browser asks" },
          { icon: Pause, t: "Pause ~4 seconds", d: "to send your answer" },
        ].map((x) => (
          <div key={x.t} className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
            <x.icon className="h-4 w-4 text-violet-300" />
            <div className="mt-2 font-medium text-white">{x.t}</div>
            <div className="mt-0.5 text-ink-400">{x.d}</div>
          </div>
        ))}
      </div>
      <motion.button
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.97 }}
        onClick={onStart}
        className="mt-8 inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-violet-500 to-cyan-500 px-7 py-3.5 text-sm font-semibold text-white shadow-[0_10px_40px_-10px_rgba(139,92,246,0.9)]"
      >
        <Play className="h-4 w-4 fill-white" /> Start the interview
      </motion.button>
      <button onClick={onType} className="mt-4 text-xs text-ink-400 underline-offset-4 transition hover:text-white hover:underline">
        Prefer to type your answers instead?
      </button>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ main stage */
export function LiveStage(props: {
  state: LiveState;
  aiText: string;
  aiProgress: number;
  aiSpeaking: boolean;
  thinkingLabel?: string;
  answer: string;
  interim: string;
  levels: number[];
  micError: string | null;
  lang: string;
  onLang: (c: string) => void;
  armed: boolean;
  armKey: string | number;
  silenceMs: number;
  canAnswer: boolean;
  question?: { seq: number; topic: string; difficulty: number; kind: "primary" | "follow_up" } | null;
  chips?: { id: string; label: string }[];
  history: Turn[];
  onSend: () => void;
  onRepeat: () => void;
  onSkip: () => void;
  onToggleMic: () => void;
  onAnswerNow: () => void;
  onTrace: () => void;
  onClear: () => void;
}) {
  const { state, question } = props;
  const level = props.levels.reduce((a, b) => a + b, 0) / Math.max(1, props.levels.length);
  const s = STATUS[state];
  const transcriptRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    transcriptRef.current?.scrollTo({ top: transcriptRef.current.scrollHeight, behavior: "smooth" });
  }, [props.answer, props.interim]);

  return (
    <div className="space-y-5">
      <div className="border-gradient glass relative overflow-hidden rounded-3xl">
        {/* header */}
        <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.06] px-5 py-3">
          {question ? (
            <>
              <span className="font-mono text-xs text-ink-400">Q{question.seq}</span>
              <span className="max-w-[16rem] truncate rounded-full bg-violet-500/10 px-2.5 py-0.5 text-xs text-violet-200">{question.topic}</span>
              <DifficultyPips level={question.difficulty} />
              {question.kind === "follow_up" && (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[11px] text-amber-200">
                  <GitBranch className="h-3 w-3" /> follow-up
                </span>
              )}
            </>
          ) : (
            <span className="text-xs text-ink-400">Preparing…</span>
          )}
          <span className="ml-auto" />
          {question && (
            <button
              onClick={props.onTrace}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1 text-xs text-ink-200 transition hover:border-violet-400/40 hover:text-white"
            >
              <FileSearch className="h-3.5 w-3.5 text-cyan-300" /> How was this generated?
            </button>
          )}
        </div>

        <div className="grid gap-6 p-6 md:grid-cols-[220px_1fr] md:p-8">
          {/* interviewer */}
          <div className="flex flex-col items-center">
            <InterviewerOrb state={state} level={level} />
            <div className="mt-2 text-sm font-medium text-white">{INTERVIEWER_NAME}</div>
            <div className="text-[11px] text-ink-400">AI interviewer</div>
            <motion.div layout className={cn("mt-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs", s.text)}>
              <span className={cn("h-2 w-2 rounded-full", s.dot, state !== "paused" && "animate-pulse")} />
              {s.label}
              {state === "thinking" && <span className="inline-flex w-4">…</span>}
            </motion.div>
          </div>

          {/* conversation focus */}
          <div className="flex min-w-0 flex-col">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-ink-400">
              <Volume2 className="h-3.5 w-3.5 text-violet-300" /> {INTERVIEWER_NAME}
            </div>
            <div className="mt-2 min-h-[96px]">
              <AnimatePresence mode="wait">
                {state === "thinking" && !props.aiSpeaking ? (
                  <motion.p key="think" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-base text-sky-200/80">
                    {props.thinkingLabel || "Thinking…"}
                  </motion.p>
                ) : (
                  <motion.div key={props.aiText} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }}>
                    <Caption text={props.aiText} progress={props.aiProgress} speaking={props.aiSpeaking} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            {props.chips && props.chips.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {props.chips.map((c) => (
                  <span key={c.id} className="rounded-md bg-white/[0.04] px-2 py-0.5 text-[10.5px] text-ink-400">
                    📖 {c.label}
                  </span>
                ))}
              </div>
            )}

            {/* candidate */}
            <div
              className={cn(
                "mt-6 rounded-2xl border bg-black/20 transition-all duration-500",
                state === "listening" ? "border-rose-400/40 shadow-[0_0_50px_-20px_rgba(244,63,94,0.7)]" : "border-white/[0.07]",
              )}
            >
              <div className="flex items-center gap-2 px-4 pt-3 text-[11px] uppercase tracking-[0.16em] text-ink-400">
                <User className="h-3.5 w-3.5" /> You
                {state === "listening" && (
                  <span className="ml-1 inline-flex items-center gap-1 normal-case tracking-normal text-rose-200">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-400" /> mic on
                  </span>
                )}
                <label className="ml-auto flex items-center gap-1 normal-case tracking-normal">
                  <Languages className="h-3 w-3" />
                  <select
                    value={props.lang}
                    onChange={(e) => props.onLang(e.target.value)}
                    className="rounded-md border border-white/10 bg-ink-850 px-1.5 py-0.5 text-[11px] text-ink-200 outline-none"
                  >
                    {LANGUAGES.map((l) => (
                      <option key={l.code} value={l.code}>
                        {l.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div ref={transcriptRef} className="max-h-48 min-h-[84px] overflow-y-auto px-4 pb-4 pt-2 text-[15px] leading-relaxed">
                {props.micError ? (
                  <p className="flex items-center gap-2 text-sm text-rose-300">
                    <MicOff className="h-4 w-4" /> {props.micError}
                  </p>
                ) : props.answer || props.interim ? (
                  <p className="text-ink-100">
                    {props.answer}
                    {props.interim && <span className="italic text-violet-300/70"> {props.interim}…</span>}
                  </p>
                ) : (
                  <p className="text-ink-500">
                    {state === "listening"
                      ? "Go ahead — I'm listening. Take a moment to think if you need to."
                      : state === "speaking"
                        ? "Your microphone will open when the question finishes."
                        : state === "thinking"
                          ? "…"
                          : "Tap the mic to answer."}
                  </p>
                )}
              </div>
              <AnimatePresence>
                {props.armed && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden border-t border-white/[0.06] px-4 py-2 text-xs text-ink-300"
                  >
                    Sounds like you&apos;re done — sending soon. Keep talking to continue.
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* controls */}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {state === "speaking" ? (
                <button
                  onClick={props.onAnswerNow}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-ink-100 transition hover:border-violet-400/40"
                >
                  <Mic className="h-3.5 w-3.5" /> Answer now
                </button>
              ) : (
                <button
                  onClick={props.onToggleMic}
                  disabled={!props.canAnswer}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs transition disabled:opacity-40",
                    state === "listening" ? "border-rose-400/40 bg-rose-500/10 text-rose-100" : "border-white/10 bg-white/[0.04] text-ink-100 hover:border-violet-400/40",
                  )}
                >
                  {state === "listening" ? <Pause className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
                  {state === "listening" ? "Pause mic" : "Resume mic"}
                </button>
              )}
              <button
                onClick={props.onRepeat}
                disabled={!props.canAnswer}
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-ink-100 transition hover:border-violet-400/40 disabled:opacity-40"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Repeat question
              </button>
              {props.answer && state !== "listening" && props.canAnswer && (
                <button onClick={props.onClear} className="px-2 text-xs text-ink-500 transition hover:text-rose-300">
                  Clear
                </button>
              )}
              <span className="ml-auto" />
              <button
                onClick={props.onSkip}
                disabled={!props.canAnswer}
                className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs text-ink-400 transition hover:text-white disabled:opacity-40"
              >
                <SkipForward className="h-3.5 w-3.5" /> Skip
              </button>
              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={props.onSend}
                disabled={!props.canAnswer || props.answer.trim().length < 2}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-indigo-500 px-4 py-2 text-xs font-semibold text-white shadow-[0_8px_30px_-10px_rgba(139,92,246,0.9)] transition disabled:opacity-40"
              >
                {props.armed ? <CountdownRing armed armKey={props.armKey} ms={props.silenceMs} /> : <Send className="h-3.5 w-3.5" />}
                I&apos;m done — send
              </motion.button>
            </div>
          </div>
        </div>
      </div>

      {/* conversation history */}
      {props.history.length > 0 && (
        <div className="glass rounded-3xl p-5">
          <div className="text-[11px] uppercase tracking-[0.16em] text-ink-400">Conversation so far</div>
          <div className="mt-4 space-y-3">
            {props.history.map((t) => (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn("flex gap-2.5", t.who === "me" && "flex-row-reverse")}
              >
                <span
                  className={cn(
                    "grid h-7 w-7 shrink-0 place-items-center rounded-full",
                    t.who === "ai" ? "bg-gradient-to-br from-violet-500 to-cyan-500" : "bg-white/10",
                  )}
                >
                  {t.who === "ai" ? <Bot className="h-3.5 w-3.5 text-white" /> : <User className="h-3.5 w-3.5 text-ink-200" />}
                </span>
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-3.5 py-2 text-[13px] leading-relaxed",
                    t.who === "ai" ? "rounded-tl-sm bg-white/[0.04] text-ink-200" : "rounded-tr-sm bg-violet-500/15 text-ink-100",
                  )}
                >
                  {t.text}
                  {t.meta && <div className="mt-1 text-[10.5px] text-ink-500">{t.meta}</div>}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

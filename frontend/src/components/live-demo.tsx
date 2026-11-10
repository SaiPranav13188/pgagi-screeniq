"use client";

import { AnimatePresence, motion, useInView } from "framer-motion";
import { Bot, User } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { INTERVIEWER_NAME, InterviewerOrb, type LiveState } from "@/components/live-interviewer";
import { cn } from "@/lib/utils";

/** A scripted, looping preview of the live voice interview for the landing page. */
const SCRIPT: { state: LiveState; who: "ai" | "me" | null; text: string; ms: number }[] = [
  {
    state: "speaking",
    who: "ai",
    text: "Your fraud-detection project used random forests. Why does information gain favour attributes with many distinct values?",
    ms: 5200,
  },
  {
    state: "listening",
    who: "me",
    text: "Because splitting on something like a transaction ID creates tiny, pure subsets — so entropy drops to zero even though the split won't generalise…",
    ms: 5600,
  },
  { state: "thinking", who: null, text: "Evaluating against the cited passages…", ms: 1900 },
  {
    state: "speaking",
    who: "ai",
    text: "Good. Let me dig a little deeper — how does the gain ratio correct for that bias?",
    ms: 4200,
  },
];

function useTyped(text: string, ms: number, active: boolean) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!active) return;
    setN(0);
    const step = Math.max(12, (ms * 0.8) / text.length);
    const t = setInterval(() => setN((v) => (v >= text.length ? v : v + 1)), step);
    return () => clearInterval(t);
  }, [text, ms, active]);
  return n;
}

export function LiveInterviewDemo() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-80px" });
  const [i, setI] = useState(0);
  const [level, setLevel] = useState(0);
  const step = SCRIPT[i];

  useEffect(() => {
    if (!inView) return;
    const t = setTimeout(() => setI((v) => (v + 1) % SCRIPT.length), step.ms);
    return () => clearTimeout(t);
  }, [i, inView, step.ms]);

  // fake microphone level while "listening"
  useEffect(() => {
    if (step.state !== "listening") return setLevel(0);
    const t = setInterval(() => setLevel(0.08 + Math.random() * 0.22), 140);
    return () => clearInterval(t);
  }, [step.state]);

  const typed = useTyped(step.text, step.ms, inView);
  const label = { speaking: "Speaking", listening: "Listening", thinking: "Thinking", paused: "Your turn" }[step.state];

  return (
    <div ref={ref} className="border-gradient glass relative overflow-hidden rounded-3xl p-6 md:p-8">
      <div className="flex items-center justify-between text-[11px] text-ink-400">
        <span className="font-mono">live interview · Q3</span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-400" /> REC
        </span>
      </div>

      <div className="mt-4 flex flex-col items-center">
        <InterviewerOrb state={step.state} level={level} size={150} />
        <div className="mt-1 text-sm font-medium text-white">{INTERVIEWER_NAME}</div>
        <motion.div
          key={label}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            "mt-2 rounded-full border border-white/10 bg-black/20 px-3 py-0.5 text-[11px]",
            step.state === "listening" ? "text-rose-200" : step.state === "thinking" ? "text-sky-200" : "text-violet-200",
          )}
        >
          {label}
        </motion.div>
      </div>

      <div className="mt-6 min-h-[132px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3 }}
            className={cn("flex gap-3", step.who === "me" && "flex-row-reverse")}
          >
            {step.who && (
              <span
                className={cn(
                  "grid h-8 w-8 shrink-0 place-items-center rounded-full",
                  step.who === "ai" ? "bg-gradient-to-br from-violet-500 to-cyan-500" : "bg-white/10",
                )}
              >
                {step.who === "ai" ? <Bot className="h-4 w-4 text-white" /> : <User className="h-4 w-4 text-ink-200" />}
              </span>
            )}
            <p
              className={cn(
                "rounded-2xl px-4 py-3 text-[14.5px] leading-relaxed",
                step.who === "ai" && "rounded-tl-sm bg-white/[0.05] text-white",
                step.who === "me" && "rounded-tr-sm bg-violet-500/15 text-ink-100",
                !step.who && "w-full text-center text-sm text-sky-200/80",
              )}
            >
              {step.text.slice(0, typed)}
              {typed < step.text.length && <span className="ml-0.5 inline-block h-4 w-[2px] translate-y-0.5 animate-pulse bg-violet-300" />}
            </p>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="mt-4 flex gap-1.5">
        {SCRIPT.map((_, k) => (
          <span key={k} className="h-1 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
            {k === i && inView && (
              <motion.span
                key={`${i}-bar`}
                className="block h-full bg-gradient-to-r from-violet-500 to-cyan-400"
                initial={{ width: 0 }}
                animate={{ width: "100%" }}
                transition={{ duration: step.ms / 1000, ease: "linear" }}
              />
            )}
            {k < i && <span className="block h-full w-full bg-violet-500/50" />}
          </span>
        ))}
      </div>
    </div>
  );
}

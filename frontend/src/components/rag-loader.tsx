"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { BOOK_COLORS } from "@/lib/utils";

const GEN_STEPS = [
  "Composing search queries from the topic plan",
  "Hybrid search · dense vectors + BM25",
  "Fusing ranks (RRF) · grounding floor · MMR diversity",
  "Generating a grounded question with citations",
];
const EVAL_STEPS = ["Storing your answer", "Comparing against expected points", "Grounding the grade in the source passages", "Deciding the next move"];

export function RagLoader({ variant = "generate", topic, books = [] }: { variant?: "generate" | "evaluate"; topic?: string; books?: string[] }) {
  const steps = variant === "generate" ? GEN_STEPS : EVAL_STEPS;
  const [i, setI] = useState(0);
  useEffect(() => {
    setI(0);
    const id = setInterval(() => setI((x) => Math.min(x + 1, steps.length - 1)), variant === "generate" ? 1100 : 900);
    return () => clearInterval(id);
  }, [variant, steps.length]);
  const dots = books.length ? books : ["mitchell", "intro_ml_python", "bishop_prml"];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97, filter: "blur(8px)" }}
      animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
      exit={{ opacity: 0, scale: 0.98, filter: "blur(8px)" }}
      className="glass relative overflow-hidden rounded-3xl p-8 md:p-10"
    >
      <div className="absolute inset-0 bg-dots opacity-40" />
      <div className="relative flex flex-col items-center gap-8 md:flex-row md:items-center">
        {/* orbit */}
        <div className="relative h-36 w-36 shrink-0">
          <div className="absolute inset-0 rounded-full border border-white/[0.06]" />
          <div className="absolute inset-5 rounded-full border border-white/[0.05]" />
          <motion.div className="absolute inset-0" animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 6, ease: "linear" }}>
            {dots.map((b, k) => {
              const a = (k / dots.length) * Math.PI * 2;
              return (
                <span
                  key={b + k}
                  className="absolute h-3 w-3 rounded-full"
                  style={{
                    left: `${50 + 50 * Math.cos(a)}%`,
                    top: `${50 + 50 * Math.sin(a)}%`,
                    transform: "translate(-50%,-50%)",
                    background: BOOK_COLORS[b] || "#8b5cf6",
                    boxShadow: `0 0 14px ${BOOK_COLORS[b] || "#8b5cf6"}`,
                  }}
                />
              );
            })}
          </motion.div>
          <div className="absolute inset-0 grid place-items-center">
            <motion.div
              animate={{ scale: [1, 1.15, 1], opacity: [0.8, 1, 0.8] }}
              transition={{ repeat: Infinity, duration: 1.6 }}
              className="h-12 w-12 rounded-2xl bg-gradient-to-br from-violet-500 to-cyan-400 shadow-[0_0_40px_rgba(139,92,246,0.8)]"
            />
          </div>
          {/* beam */}
          <svg className="absolute inset-0" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="38" fill="none" stroke="url(#beam)" strokeWidth="0.8" strokeDasharray="4 8" className="animate-dash" />
            <defs>
              <linearGradient id="beam">
                <stop offset="0%" stopColor="#8b5cf6" />
                <stop offset="100%" stopColor="#22d3ee" />
              </linearGradient>
            </defs>
          </svg>
        </div>

        <div className="w-full flex-1">
          <div className="text-[11px] uppercase tracking-[0.18em] text-violet-300">{variant === "generate" ? "RAG pipeline running" : "Evaluating"}</div>
          {topic && <div className="mt-1.5 text-lg font-medium text-white">{topic}</div>}
          <div className="mt-5 space-y-2.5">
            {steps.map((s, k) => (
              <div key={s} className="flex items-center gap-3 text-sm">
                <span className="grid h-5 w-5 place-items-center">
                  <AnimatePresence mode="wait">
                    {k < i ? (
                      <motion.span key="d" initial={{ scale: 0 }} animate={{ scale: 1 }} className="grid h-4 w-4 place-items-center rounded-full bg-emerald-400">
                        <Check className="h-2.5 w-2.5 text-ink-950" />
                      </motion.span>
                    ) : k === i ? (
                      <Loader2 key="l" className="h-4 w-4 animate-spin text-violet-300" />
                    ) : (
                      <span key="p" className="h-1.5 w-1.5 rounded-full bg-ink-500" />
                    )}
                  </AnimatePresence>
                </span>
                <span className={k <= i ? "text-ink-100" : "text-ink-500"}>{s}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

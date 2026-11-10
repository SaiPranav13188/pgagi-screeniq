"use client";

import { AnimatePresence, motion } from "framer-motion";
import { BarChart3, Compass, Database, FileSearch, MessagesSquare, Save, Sparkles, Upload } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export const STAGES = [
  { icon: Upload, title: "Candidate entry", desc: "Resume upload (PDF/text) and target role selection.", color: "#a78bfa" },
  { icon: FileSearch, title: "Resume processing", desc: "Taxonomy + LLM extraction of skills, technologies, domains and seniority.", color: "#818cf8" },
  { icon: Compass, title: "Context construction", desc: "Resume × role alignment, difficulty calibration and textbook-style search queries.", color: "#60a5fa" },
  { icon: Database, title: "Knowledge retrieval", desc: "Hybrid dense + BM25 search, RRF fusion, grounding floor and MMR diversity.", color: "#22d3ee" },
  { icon: Sparkles, title: "Question generation", desc: "Grounded in retrieved chunks with mandatory citations; non-template.", color: "#34d399" },
  { icon: MessagesSquare, title: "Interactive interview", desc: "Session continuity, adaptive difficulty and follow-up probes.", color: "#fbbf24" },
  { icon: Save, title: "Response handling", desc: "Every question, answer, trace and evaluation persisted.", color: "#fb923c" },
  { icon: BarChart3, title: "Final output", desc: "Scored report: competencies, verified claims and a reading list.", color: "#f472b6" },
];

export function PipelineFlow() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => setActive((a) => (a + 1) % STAGES.length), 1800);
    return () => clearInterval(id);
  }, [paused]);
  const stage = STAGES[active];

  return (
    <div onMouseLeave={() => setPaused(false)}>
      <div className="relative">
        {/* connecting rail */}
        <div className="absolute left-[6%] right-[6%] top-7 hidden h-px bg-white/10 md:block" />
        <motion.div
          className="absolute top-7 left-[6%] hidden h-px md:block"
          style={{ background: "linear-gradient(90deg,#8b5cf6,#22d3ee,#f472b6)", boxShadow: "0 0 12px #8b5cf6" }}
          animate={{ width: `${(active / (STAGES.length - 1)) * 88}%` }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        />
        <div className="grid grid-cols-4 gap-y-6 md:grid-cols-8">
          {STAGES.map((s, i) => {
            const Icon = s.icon;
            const on = i === active;
            const done = i < active;
            return (
              <button
                key={s.title}
                onMouseEnter={() => {
                  setPaused(true);
                  setActive(i);
                }}
                onClick={() => setActive(i)}
                className="group relative flex cursor-pointer flex-col items-center gap-3"
              >
                <motion.div
                  animate={{ scale: on ? 1.12 : 1, y: on ? -2 : 0 }}
                  transition={{ type: "spring", stiffness: 300, damping: 18 }}
                  className={cn(
                    "relative grid h-14 w-14 place-items-center rounded-2xl border transition-colors duration-500",
                    on ? "border-white/25 bg-ink-800" : done ? "border-white/10 bg-ink-850" : "border-white/[0.06] bg-ink-900",
                  )}
                  style={on ? { boxShadow: `0 0 0 1px ${s.color}55, 0 0 36px -4px ${s.color}` } : undefined}
                >
                  {on && <span className="absolute inset-0 rounded-2xl animate-pulse-ring" style={{ border: `1px solid ${s.color}` }} />}
                  <Icon className="h-5 w-5 transition-colors duration-500" style={{ color: on || done ? s.color : "#6b7190" }} />
                  <span className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full border border-white/10 bg-ink-900 font-mono text-[10px] text-ink-300">
                    {i + 1}
                  </span>
                </motion.div>
                <span className={cn("max-w-[90px] text-center text-[11px] leading-tight transition-colors", on ? "text-white" : "text-ink-400")}>{s.title}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="mt-8 flex justify-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={active}
            initial={{ opacity: 0, y: 8, filter: "blur(6px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -8, filter: "blur(6px)" }}
            transition={{ duration: 0.35 }}
            className="glass flex max-w-xl items-center gap-3 rounded-xl px-4 py-3 text-sm"
          >
            <span className="font-mono text-xs" style={{ color: stage.color }}>
              0{active + 1}
            </span>
            <span className="font-medium text-white">{stage.title}</span>
            <span className="text-ink-300">— {stage.desc}</span>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

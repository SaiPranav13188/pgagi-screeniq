"use client";

import { motion } from "framer-motion";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, CheckCircle2, CircleDashed, GitBranch } from "lucide-react";
import { ScoreRing, itemUp, stagger } from "@/components/motion";
import type { Decision, Evaluation } from "@/lib/types";
import { scoreColor } from "@/lib/utils";

const VERDICT: Record<string, string> = {
  excellent: "Excellent",
  strong: "Strong answer",
  adequate: "Adequate",
  partial: "Partially correct",
  weak: "Needs work",
  no_answer: "No answer",
};

export function DecisionBanner({ decision }: { decision: Decision }) {
  const icon =
    decision.action === "follow_up" ? (
      <GitBranch className="h-4 w-4 text-amber-300" />
    ) : decision.difficulty_offset > 0 ? (
      <ArrowUpRight className="h-4 w-4 text-emerald-300" />
    ) : decision.difficulty_offset < 0 ? (
      <ArrowDownRight className="h-4 w-4 text-cyan-300" />
    ) : (
      <ArrowUpRight className="h-4 w-4 text-violet-300" />
    );
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-start gap-3 rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 py-3"
    >
      <span className="mt-0.5">{icon}</span>
      <div className="text-sm">
        <span className="font-medium text-white">Adaptive engine: {decision.label}.</span> <span className="text-ink-300">{decision.reason}</span>
      </div>
    </motion.div>
  );
}

export function EvaluationCard({ evaluation: e, compact = false }: { evaluation: Evaluation; compact?: boolean }) {
  const color = scoreColor(e.score);
  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-4">
      <motion.div variants={itemUp} className="flex items-center gap-5">
        <ScoreRing value={e.score} size={compact ? 72 : 96} stroke={compact ? 7 : 9} color={color} label="/ 10" />
        <div className="min-w-0 flex-1">
          <div className="text-lg font-medium" style={{ color }}>
            {VERDICT[e.verdict] || e.verdict}
          </div>
          <p className="mt-1 text-sm leading-relaxed text-ink-300">{e.feedback}</p>
          <div className="mt-1.5 font-mono text-[10px] text-ink-500">graded by {e.evaluator}</div>
        </div>
      </motion.div>
      <div className="grid gap-3 md:grid-cols-2">
        {e.covered_points.length > 0 && (
          <motion.div variants={itemUp} className="rounded-xl border border-emerald-400/15 bg-emerald-400/[0.04] p-3.5">
            <div className="mb-2 text-[11px] uppercase tracking-[0.14em] text-emerald-300">Covered</div>
            <ul className="space-y-1.5">
              {e.covered_points.map((p) => (
                <li key={p} className="flex gap-2 text-[13px] text-ink-200">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" /> {p}
                </li>
              ))}
            </ul>
          </motion.div>
        )}
        {e.missed_points.length > 0 && (
          <motion.div variants={itemUp} className="rounded-xl border border-amber-400/15 bg-amber-400/[0.04] p-3.5">
            <div className="mb-2 text-[11px] uppercase tracking-[0.14em] text-amber-300">Missed</div>
            <ul className="space-y-1.5">
              {e.missed_points.map((p) => (
                <li key={p} className="flex gap-2 text-[13px] text-ink-200">
                  <CircleDashed className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" /> {p}
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </div>
      {e.misconceptions.length > 0 && (
        <motion.div variants={itemUp} className="rounded-xl border border-rose-400/15 bg-rose-400/[0.04] p-3.5">
          <div className="mb-2 flex items-center gap-1.5 text-[11px] uppercase tracking-[0.14em] text-rose-300">
            <AlertTriangle className="h-3 w-3" /> Misconceptions
          </div>
          <ul className="space-y-1 text-[13px] text-ink-200">
            {e.misconceptions.map((m) => (
              <li key={m}>• {m}</li>
            ))}
          </ul>
        </motion.div>
      )}
    </motion.div>
  );
}

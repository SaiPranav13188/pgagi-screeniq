"use client";

import { AnimatePresence, motion } from "framer-motion";
import { BookMarked, ChevronDown, Clock, Cpu, FileCode2, Quote, Search, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui";
import type { Question, TraceChunk } from "@/lib/types";
import { BOOK_COLORS, cn } from "@/lib/utils";

export function TraceDrawer({ question, open, onClose }: { question: Question | null; open: boolean; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const t = question?.trace;

  return (
    <AnimatePresence>
      {open && question && t && (
        <>
          <motion.div
            className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 260, damping: 32 }}
            className="glass-strong fixed inset-y-0 right-0 z-[70] flex w-full max-w-xl flex-col border-l border-white/10"
          >
            <div className="flex items-start justify-between gap-4 border-b border-white/[0.06] p-6">
              <div>
                <div className="text-[11px] uppercase tracking-[0.18em] text-violet-300">Generation trace · Q{question.seq}</div>
                <h3 className="mt-2 text-lg font-medium text-white">How this question was produced</h3>
              </div>
              <button onClick={onClose} className="rounded-lg p-2 text-ink-400 hover:bg-white/10 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 space-y-6 overflow-y-auto p-6">
              <div className="grid grid-cols-2 gap-2.5 text-xs">
                {[
                  { i: Cpu, l: "Generator", v: question.generator },
                  { i: FileCode2, l: "Prompt", v: t.prompt_version },
                  { i: Clock, l: "Retrieval", v: `${t.retrieval_ms} ms` },
                  { i: Clock, l: "Generation", v: `${(t.generation_ms / 1000).toFixed(1)} s` },
                ].map((x, i) => (
                  <motion.div
                    key={x.l}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 + i * 0.05 }}
                    className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3"
                  >
                    <div className="flex items-center gap-1.5 text-ink-400">
                      <x.i className="h-3 w-3" /> {x.l}
                    </div>
                    <div className="mt-1 truncate font-mono text-ink-100">{x.v}</div>
                  </motion.div>
                ))}
              </div>

              {question.rationale && (
                <div className="rounded-xl border border-violet-400/20 bg-violet-500/[0.06] p-3.5 text-sm text-ink-200">
                  <span className="text-violet-300">Why this question: </span>
                  {question.rationale}
                </div>
              )}

              <div>
                <div className="mb-2.5 text-xs font-medium text-white">1 · Search queries</div>
                <div className="flex flex-wrap gap-1.5">
                  {t.queries.map((q, i) => (
                    <motion.span
                      key={q}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.2 + i * 0.06 }}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.07] bg-white/[0.03] px-2.5 py-1 font-mono text-[11px] text-ink-200"
                    >
                      <Search className="h-3 w-3 text-cyan-300" /> {q}
                    </motion.span>
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-2.5 flex items-center justify-between text-xs">
                  <span className="font-medium text-white">2 · Retrieved context (hybrid → RRF → MMR)</span>
                  <span className="text-ink-400">
                    {t.chunks.filter((c) => c.cited).length}/{t.chunks.length} cited
                  </span>
                </div>
                <div className="space-y-3">
                  {t.chunks.map((c, i) => (
                    <ChunkCard key={c.id} chunk={c} index={i} />
                  ))}
                </div>
              </div>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

export function ChunkCard({ chunk: c, index = 0, defaultOpen = false }: { chunk: TraceChunk; index?: number; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const color = BOOK_COLORS[c.book_id] || "#8b5cf6";
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.25 + index * 0.08 }}
      className={cn("rounded-xl border bg-white/[0.02] p-3.5 transition-colors", c.cited ? "border-emerald-400/30" : "border-white/[0.06]")}
    >
      <div className="flex items-center gap-2 text-[11px]">
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: color, boxShadow: `0 0 8px ${color}` }} />
        <span className="truncate text-ink-300">{c.book_title}</span>
        <span className="ml-auto shrink-0 font-mono text-ink-400">
          p.{c.page_start}
          {c.page_end !== c.page_start ? `–${c.page_end}` : ""}
        </span>
        {c.cited && (
          <Badge color="#34d399" className="shrink-0">
            <Quote className="h-2.5 w-2.5" /> cited
          </Badge>
        )}
      </div>
      {c.section && (
        <div className="mt-1.5 flex items-center gap-1.5 text-sm text-white">
          <BookMarked className="h-3.5 w-3.5 shrink-0 text-ink-400" />
          <span className="truncate">{c.section}</span>
        </div>
      )}
      <div className="mt-3 grid grid-cols-[1fr_auto_auto] items-center gap-3 text-[10.5px]">
        <div className="h-1 overflow-hidden rounded-full bg-white/[0.06]">
          <motion.div
            className="h-full rounded-full"
            style={{ background: `linear-gradient(90deg, ${color}, #22d3ee)` }}
            initial={{ width: 0 }}
            animate={{ width: `${Math.max(0, Math.min(1, (c.dense_score - 0.4) / 0.5)) * 100}%` }}
            transition={{ delay: 0.4 + index * 0.08, duration: 0.9 }}
          />
        </div>
        <span className="font-mono text-ink-400">cos {c.dense_score.toFixed(2)}</span>
        <span className="font-mono text-ink-400">
          dense #{c.dense_rank ?? "–"} · bm25 #{c.bm25_rank ?? "–"}
        </span>
      </div>
      <button onClick={() => setOpen(!open)} className="mt-2.5 flex items-center gap-1 text-[11px] text-ink-400 hover:text-white">
        <ChevronDown className={cn("h-3 w-3 transition-transform", open && "rotate-180")} /> {open ? "Hide" : "Show"} passage
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.p
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden text-[12.5px] leading-relaxed text-ink-300"
          >
            <span className="block pt-2">{c.text}</span>
          </motion.p>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

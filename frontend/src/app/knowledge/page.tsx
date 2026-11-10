"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Database, Layers, Search, Sparkles, Zap } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AnimatedNumber, Aurora, itemUp, Reveal, SpotlightCard, stagger } from "@/components/motion";
import { ChunkCard } from "@/components/trace-drawer";
import { Badge, Button, SectionLabel, Skeleton } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import type { KnowledgeBase, Role, SearchResult } from "@/lib/types";
import { cn } from "@/lib/utils";

const EXAMPLES = [
  "Why does information gain favour attributes with many values?",
  "bias variance trade-off and regularization",
  "How does backpropagation compute gradients for hidden units?",
  "When should I use cross-validation instead of a single train/test split?",
  "kernel trick for support vector machines",
];

export default function KnowledgePage() {
  const [kb, setKb] = useState<KnowledgeBase | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [role, setRole] = useState<string>("");
  const [q, setQ] = useState("");
  const [res, setRes] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.knowledgeBase().then(setKb).catch((e) => toast.error(e.message));
    api.roles().then(setRoles).catch(() => {});
  }, []);

  async function search(query = q) {
    if (query.trim().length < 3) return;
    setQ(query);
    setLoading(true);
    try {
      setRes(await api.search(query, role || undefined, 5));
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Search failed");
    } finally {
      setLoading(false);
    }
  }

  const maxChunks = Math.max(1, ...(kb?.books.map((b) => b.chunks || 0) ?? [1]));

  return (
    <main className="relative min-h-screen overflow-hidden pt-32 pb-24">
      <Aurora intensity={0.5} />
      <div className="relative mx-auto max-w-6xl px-6">
        <SectionLabel>Stage 4 · Knowledge base</SectionLabel>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white md:text-5xl">
          The <span className="font-display italic font-normal text-gradient-animated">library</span> behind every question
        </h1>
        <p className="mt-4 max-w-2xl text-ink-300">
          Six reference books, parsed with layout awareness, chunked by section, embedded locally and indexed for hybrid search. Try the retriever
          yourself.
        </p>

        {/* config strip */}
        <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { i: Database, l: "Indexed chunks", v: kb?.total_chunks ?? 0, n: true },
            { i: Sparkles, l: "Embedding model", v: kb?.embedding_model.split("/").pop() ?? "…" },
            { i: Layers, l: "Chunking", v: kb ? `~${kb.chunking.target_words} words · ${kb.chunking.overlap_sentences}-sentence overlap` : "…" },
            { i: Zap, l: "Retrieval", v: kb ? `top-${kb.retrieval.top_k} · RRF k=${kb.retrieval.rrf_k} · MMR λ=${kb.retrieval.mmr_lambda}` : "…" },
          ].map((s, k) => (
            <motion.div key={s.l} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: k * 0.07 }} className="glass rounded-2xl p-4">
              <s.i className="h-4 w-4 text-violet-300" />
              <div className="mt-3 truncate text-lg font-semibold text-white">{s.n ? <AnimatedNumber value={s.v as number} /> : s.v}</div>
              <div className="text-xs text-ink-400">{s.l}</div>
            </motion.div>
          ))}
        </div>

        {/* books */}
        <motion.div variants={stagger} initial="hidden" animate="show" className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {(kb?.books ?? []).map((b) => (
            <motion.div variants={itemUp} key={b.id}>
              <SpotlightCard tilt color={hexToRgb(b.color)} className="h-full p-5">
                <div className="flex gap-4">
                  <div
                    className="relative h-20 w-14 shrink-0 rounded-md shadow-xl"
                    style={{ background: `linear-gradient(160deg, ${b.color}, ${b.color}40)`, boxShadow: `0 10px 30px -10px ${b.color}` }}
                  >
                    <div className="absolute inset-y-0 left-1 w-px bg-black/25" />
                  </div>
                  <div className="min-w-0">
                    <div className="line-clamp-2 text-sm font-medium text-white">{b.title}</div>
                    <div className="mt-0.5 truncate text-xs text-ink-400">{b.author}</div>
                    <Badge className="mt-2" color={b.level === "advanced" ? "#f472b6" : b.level === "applied" ? "#34d399" : "#a78bfa"}>
                      {b.level}
                    </Badge>
                  </div>
                </div>
                <div className="mt-5 grid grid-cols-3 gap-2 text-center">
                  {[
                    ["pages", b.pages],
                    ["chunks", b.chunks],
                    ["sections", b.sections],
                  ].map(([l, v]) => (
                    <div key={l as string} className="rounded-lg bg-white/[0.03] py-2">
                      <div className="font-mono text-sm text-white">{v ?? "–"}</div>
                      <div className="text-[10px] text-ink-400">{l}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/[0.06]">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: b.color }}
                    initial={{ width: 0 }}
                    animate={{ width: `${((b.chunks || 0) / maxChunks) * 100}%` }}
                    transition={{ duration: 1.2, delay: 0.4 }}
                  />
                </div>
                {!b.chunks && <div className="mt-2 text-[11px] text-amber-300">{b.available ? "Not ingested yet" : "PDF missing in data/books"}</div>}
              </SpotlightCard>
            </motion.div>
          ))}
          {!kb && [0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-48" />)}
        </motion.div>

        {/* playground */}
        <Reveal className="mt-16">
          <div className="border-gradient glass-strong rounded-3xl p-6 md:p-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-white">Retrieval playground</h2>
                <p className="mt-1 text-sm text-ink-400">Exactly the retriever the interview engine uses: dense + BM25 → RRF → grounding floor → MMR.</p>
              </div>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="h-9 rounded-lg border border-white/10 bg-ink-850 px-3 text-sm text-ink-100 outline-none focus:border-violet-400/50"
              >
                <option value="">All books</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.title}
                  </option>
                ))}
              </select>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                search();
              }}
              className="mt-5 flex gap-2"
            >
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Ask anything the books might cover…"
                  className="h-12 w-full rounded-xl border border-white/10 bg-white/[0.03] pl-11 pr-4 text-sm text-white outline-none transition focus:border-violet-400/60 focus:ring-4 focus:ring-violet-500/10"
                />
              </div>
              <Button type="submit" size="lg" loading={loading}>
                Retrieve
              </Button>
            </form>
            <div className="mt-3 flex flex-wrap gap-2">
              {EXAMPLES.map((e) => (
                <button
                  key={e}
                  onClick={() => search(e)}
                  className="rounded-full border border-white/[0.07] bg-white/[0.02] px-3 py-1 text-xs text-ink-300 transition hover:border-violet-400/40 hover:text-white"
                >
                  {e}
                </button>
              ))}
            </div>

            <AnimatePresence mode="wait">
              {loading && (
                <motion.div key="l" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-6 space-y-3">
                  {[0, 1, 2].map((i) => (
                    <Skeleton key={i} className="h-28" />
                  ))}
                </motion.div>
              )}
              {!loading && res && (
                <motion.div key={res.query + res.elapsed_ms} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-6">
                  <div className="mb-3 flex flex-wrap gap-4 font-mono text-[11px] text-ink-400">
                    <span>{res.candidates_considered} candidates fused</span>
                    <span>{res.chunks.length} returned</span>
                    <span>{res.elapsed_ms} ms</span>
                    <span className={cn("truncate")}>books: {res.books.join(", ")}</span>
                  </div>
                  <div className="space-y-3">
                    {res.chunks.map((c, i) => (
                      <ChunkCard key={c.id} chunk={c} index={i} defaultOpen={i === 0} />
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </Reveal>
      </div>
    </main>
  );
}

function hexToRgb(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
}

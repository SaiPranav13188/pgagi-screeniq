"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight, CheckCircle2, Clock3, Gauge, Layers, Play, Plus, Sparkles, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AnimatedNumber, Aurora, EASE, itemUp, stagger } from "@/components/motion";
import { Button, SectionLabel, Skeleton } from "@/components/ui";
import { api } from "@/lib/api";
import type { SessionSummary } from "@/lib/types";
import { cn, scoreColor } from "@/lib/utils";

const STATUS: Record<string, { label: string; color: string }> = {
  created: { label: "Created", color: "#9399b3" },
  planned: { label: "Planned", color: "#60a5fa" },
  in_progress: { label: "In progress", color: "#fbbf24" },
  completed: { label: "Completed", color: "#34d399" },
};

const AVATAR_GRADIENTS = [
  "from-violet-500 to-indigo-500",
  "from-cyan-400 to-blue-500",
  "from-pink-500 to-rose-500",
  "from-emerald-400 to-teal-500",
  "from-amber-400 to-orange-500",
  "from-fuchsia-500 to-purple-600",
];

function hash(s: string) {
  let h = 0;
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return Math.abs(h);
}

function initials(name: string | null) {
  const parts = (name || "?").trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "?") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

function timeAgo(iso: string) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)} d ago`;
  return new Date(iso).toLocaleDateString();
}

function MiniRing({ value }: { value: number }) {
  const size = 52;
  const r = 21;
  const c = 2 * Math.PI * r;
  const color = scoreColor(value, 100);
  return (
    <div className="relative grid h-[52px] w-[52px] place-items-center">
      <svg width={size} height={size} className="absolute inset-0 -rotate-90">
        <circle cx={26} cy={26} r={r} stroke="rgba(255,255,255,0.07)" strokeWidth={4} fill="none" />
        <motion.circle
          cx={26}
          cy={26}
          r={r}
          stroke={color}
          strokeWidth={4}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - Math.min(1, value / 100)) }}
          transition={{ duration: 1.2, ease: EASE, delay: 0.3 }}
          style={{ filter: `drop-shadow(0 0 6px ${color}88)` }}
        />
      </svg>
      <span className="font-mono text-sm font-semibold" style={{ color }}>
        {Math.round(value)}
      </span>
    </div>
  );
}

type Filter = "all" | "completed" | "open";

export default function SessionsPage() {
  const [items, setItems] = useState<SessionSummary[] | null>(null);
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    api
      .sessions()
      .then(setItems)
      .catch((e) => {
        toast.error(e.message);
        setItems([]);
      });
  }, []);

  async function remove(id: string) {
    if (!confirm("Delete this session and all its records?")) return;
    await api.deleteSession(id);
    setItems((x) => x?.filter((s) => s.id !== id) ?? null);
    toast.success("Session deleted");
  }

  const stats = useMemo(() => {
    const all = items ?? [];
    const done = all.filter((s) => s.status === "completed");
    const scored = done.filter((s) => s.overall_score != null);
    return {
      total: all.length,
      completed: done.length,
      open: all.length - done.length,
      avg: scored.length ? scored.reduce((a, s) => a + (s.overall_score ?? 0), 0) / scored.length : 0,
      questions: all.reduce((a, s) => a + s.questions, 0),
    };
  }, [items]);

  const shown = (items ?? []).filter((s) => (filter === "all" ? true : filter === "completed" ? s.status === "completed" : s.status !== "completed"));

  return (
    <main className="relative min-h-screen overflow-hidden pt-32 pb-24">
      <Aurora intensity={0.55} />
      <div className="relative mx-auto max-w-5xl px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <SectionLabel>History</SectionLabel>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white md:text-5xl">
              Your <span className="font-display font-normal italic text-gradient">sessions</span>
            </h1>
            <p className="mt-3 text-sm text-ink-300">Every interview is persisted — pick up an open one or revisit its report.</p>
          </div>
          <Link href="/interview/new">
            <Button icon={<Plus className="h-4 w-4" />}>New interview</Button>
          </Link>
        </div>

        {/* stats */}
        <motion.div variants={stagger} initial="hidden" animate="show" className="mt-10 grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            { icon: Layers, label: "Interviews", value: stats.total, c: "#a78bfa" },
            { icon: CheckCircle2, label: "Completed", value: stats.completed, c: "#34d399" },
            { icon: Gauge, label: "Avg. score / 100", value: stats.avg, c: "#22d3ee", d: 0, empty: stats.completed === 0 },
            { icon: Sparkles, label: "Questions asked", value: stats.questions, c: "#f472b6" },
          ].map((s) => (
            <motion.div key={s.label} variants={itemUp} className="glass relative overflow-hidden rounded-2xl p-4">
              <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full blur-2xl" style={{ background: `${s.c}33` }} />
              <s.icon className="h-4 w-4" style={{ color: s.c }} />
              <div className="mt-3 text-2xl font-semibold text-white">{items && !s.empty ? <AnimatedNumber value={s.value} decimals={s.d ?? 0} /> : "–"}</div>
              <div className="mt-0.5 text-xs text-ink-400">{s.label}</div>
            </motion.div>
          ))}
        </motion.div>

        {/* filters */}
        <div className="mt-8 inline-flex rounded-xl border border-white/[0.07] bg-black/20 p-1">
          {(
            [
              { id: "all", label: `All · ${stats.total}` },
              { id: "completed", label: `Reports · ${stats.completed}` },
              { id: "open", label: `Open · ${stats.open}` },
            ] as { id: Filter; label: string }[]
          ).map((f) => (
            <button key={f.id} onClick={() => setFilter(f.id)} className="relative rounded-lg px-3.5 py-1.5 text-xs font-medium">
              {filter === f.id && (
                <motion.span layoutId="session-filter" className="absolute inset-0 rounded-lg bg-white/[0.08] ring-1 ring-white/10" transition={{ type: "spring", stiffness: 420, damping: 32 }} />
              )}
              <span className={cn("relative", filter === f.id ? "text-white" : "text-ink-400")}>{f.label}</span>
            </button>
          ))}
        </div>

        <div className="mt-5">
          {!items && (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-[88px]" />
              ))}
            </div>
          )}

          {items && shown.length === 0 && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="border-gradient glass flex flex-col items-center rounded-3xl px-6 py-16 text-center">
              <div className="relative grid h-20 w-20 place-items-center">
                <span className="absolute inset-0 animate-pulse rounded-full bg-violet-500/20 blur-xl" />
                <div className="relative grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-violet-500 to-cyan-500 shadow-[0_10px_40px_-10px_rgba(139,92,246,0.9)]">
                  <Play className="h-7 w-7 fill-white text-white" />
                </div>
              </div>
              <p className="mt-6 text-lg font-medium text-white">{filter === "all" ? "No interviews yet" : "Nothing here yet"}</p>
              <p className="mt-1 max-w-sm text-sm text-ink-400">Upload a resume and Nova will run a grounded, spoken technical interview in under a minute.</p>
              <Link href="/interview/new" className="mt-6">
                <Button icon={<Plus className="h-4 w-4" />}>Start an interview</Button>
              </Link>
            </motion.div>
          )}

          <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-3">
            <AnimatePresence>
              {shown.map((s) => {
                const done = s.status === "completed";
                const href = done ? `/report/${s.id}` : `/interview/${s.id}`;
                const st = STATUS[s.status] ?? STATUS.created;
                const grad = AVATAR_GRADIENTS[hash(s.id) % AVATAR_GRADIENTS.length];
                return (
                  <motion.div key={s.id} variants={itemUp} exit={{ opacity: 0, x: -30, height: 0, marginTop: 0 }} layout>
                    <div className="glass group relative flex items-center gap-4 overflow-hidden rounded-2xl p-4 transition-all duration-300 hover:-translate-y-0.5 hover:bg-white/[0.045] hover:shadow-[0_20px_50px_-25px_rgba(139,92,246,0.7)]">
                      <span className="absolute inset-y-3 left-0 w-[3px] rounded-r-full" style={{ background: st.color }} />
                      <div className={cn("grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br text-sm font-semibold text-white shadow-lg", grad)}>
                        {initials(s.candidate_name)}
                      </div>
                      <Link href={href} className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate font-medium capitalize text-white">{s.candidate_name || "Unnamed candidate"}</span>
                          <span
                            className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium"
                            style={{ background: `${st.color}1a`, color: st.color, boxShadow: `inset 0 0 0 1px ${st.color}40` }}
                          >
                            <span className={cn("h-1.5 w-1.5 rounded-full", !done && "animate-pulse")} style={{ background: st.color }} />
                            {st.label}
                          </span>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-400">
                          <span className="text-ink-300">{s.role_title}</span>
                          <span className="inline-flex items-center gap-1">
                            <Sparkles className="h-3 w-3" /> {s.questions} question{s.questions === 1 ? "" : "s"}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Clock3 className="h-3 w-3" /> {timeAgo(s.created_at)}
                          </span>
                        </div>
                      </Link>
                      {done && s.overall_score != null ? (
                        <MiniRing value={s.overall_score} />
                      ) : (
                        <Link
                          href={href}
                          className="hidden items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-ink-100 transition hover:border-violet-400/40 sm:inline-flex"
                        >
                          <Play className="h-3 w-3 fill-current" /> Resume
                        </Link>
                      )}
                      <button
                        onClick={() => remove(s.id)}
                        aria-label="Delete session"
                        className="rounded-lg p-2 text-ink-500 opacity-0 transition hover:bg-rose-500/10 hover:text-rose-300 group-hover:opacity-100"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                      <Link href={href} aria-label="Open" className="rounded-lg p-2 text-ink-400 transition group-hover:translate-x-0.5 group-hover:text-white">
                        <ArrowUpRight className="h-4 w-4" />
                      </Link>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </motion.div>
        </div>
      </div>
    </main>
  );
}

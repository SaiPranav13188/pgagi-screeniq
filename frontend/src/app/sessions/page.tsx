"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight, Inbox, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Aurora, itemUp, stagger } from "@/components/motion";
import { Badge, Button, SectionLabel, Skeleton } from "@/components/ui";
import { api } from "@/lib/api";
import type { SessionSummary } from "@/lib/types";
import { scoreColor } from "@/lib/utils";

const STATUS: Record<string, string> = { created: "#9399b3", planned: "#60a5fa", in_progress: "#fbbf24", completed: "#34d399" };

export default function SessionsPage() {
  const [items, setItems] = useState<SessionSummary[] | null>(null);
  useEffect(() => {
    api.sessions().then(setItems).catch((e) => {
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

  return (
    <main className="relative min-h-screen overflow-hidden pt-32 pb-24">
      <Aurora intensity={0.4} />
      <div className="relative mx-auto max-w-5xl px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <SectionLabel>History</SectionLabel>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white">Sessions</h1>
            <p className="mt-2 text-sm text-ink-400">Every interview is persisted — resume an open one or revisit a report.</p>
          </div>
          <Link href="/interview/new">
            <Button icon={<Plus className="h-4 w-4" />}>New interview</Button>
          </Link>
        </div>

        <div className="mt-10">
          {!items && (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-20" />
              ))}
            </div>
          )}
          {items?.length === 0 && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass flex flex-col items-center rounded-3xl py-16 text-center">
              <Inbox className="h-10 w-10 text-ink-500" />
              <p className="mt-4 text-ink-200">No interviews yet</p>
              <p className="mt-1 text-sm text-ink-400">Upload a resume to run your first grounded interview.</p>
            </motion.div>
          )}
          <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-3">
            <AnimatePresence>
              {items?.map((s) => {
                const href = s.status === "completed" ? `/report/${s.id}` : `/interview/${s.id}`;
                return (
                  <motion.div key={s.id} variants={itemUp} exit={{ opacity: 0, x: -30, height: 0 }} layout>
                    <div className="glass group flex items-center gap-4 rounded-2xl p-4 transition-colors hover:bg-white/[0.05]">
                      <div
                        className="grid h-12 w-12 shrink-0 place-items-center rounded-xl font-mono text-sm"
                        style={{ background: `${scoreColor(s.overall_score, 100)}18`, color: scoreColor(s.overall_score, 100) }}
                      >
                        {s.overall_score != null ? Math.round(s.overall_score) : "–"}
                      </div>
                      <Link href={href} className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate font-medium text-white">{s.candidate_name}</span>
                          <Badge color={STATUS[s.status]} dot>
                            {s.status.replace("_", " ")}
                          </Badge>
                        </div>
                        <div className="mt-0.5 text-xs text-ink-400">
                          {s.role_title} · {s.questions} questions · {new Date(s.created_at).toLocaleString()}
                        </div>
                      </Link>
                      <button onClick={() => remove(s.id)} className="rounded-lg p-2 text-ink-500 opacity-0 transition hover:bg-rose-500/10 hover:text-rose-300 group-hover:opacity-100">
                        <Trash2 className="h-4 w-4" />
                      </button>
                      <Link href={href} className="rounded-lg p-2 text-ink-400 transition group-hover:translate-x-0.5 group-hover:text-white">
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

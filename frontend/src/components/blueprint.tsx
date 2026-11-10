"use client";

import { motion } from "framer-motion";
import { Anchor, Briefcase, GraduationCap, Layers, Search, Sparkles, Unlock } from "lucide-react";
import { itemPop, itemUp, stagger } from "@/components/motion";
import { Badge, DifficultyPips, LevelBadge } from "@/components/ui";
import type { Plan, Profile } from "@/lib/types";
import { BOOK_COLORS, BOOK_SHORT, QTYPE_LABEL } from "@/lib/utils";

const CAT_COLORS: Record<string, string> = {
  language: "#60a5fa",
  ml_framework: "#a78bfa",
  ml_concept: "#f472b6",
  data: "#34d399",
  backend: "#fbbf24",
  infra: "#fb923c",
  database: "#22d3ee",
  other: "#9399b3",
};
const CAT_LABEL: Record<string, string> = {
  language: "Languages",
  ml_framework: "ML frameworks",
  ml_concept: "ML concepts",
  data: "Data",
  backend: "Backend",
  infra: "Infra / Cloud",
  database: "Databases",
  other: "Other",
};

export function ProfileCard({ profile, name }: { profile: Profile; name?: string | null }) {
  const groups = profile.skills.reduce<Record<string, string[]>>((acc, s) => {
    const k = CAT_LABEL[s.category] ? s.category : "other";
    (acc[k] ||= []).push(s.name);
    return acc;
  }, {});
  const initials = (name || profile.name || "C")
    .split(" ")
    .map((x) => x[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="glass rounded-2xl p-6">
      <motion.div variants={itemUp} className="flex items-start gap-4">
        <div className="relative">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-violet-500 to-cyan-400 text-lg font-semibold text-white">
            {initials}
          </div>
          <span className="absolute -bottom-1 -right-1 grid h-5 w-5 place-items-center rounded-full border-2 border-ink-900 bg-emerald-400">
            <Sparkles className="h-2.5 w-2.5 text-ink-950" />
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-lg font-medium text-white">{name || profile.name || "Candidate"}</h3>
          <p className="mt-0.5 text-sm text-ink-300">{profile.headline || profile.summary}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge color="#a78bfa">
              <Briefcase className="h-3 w-3" /> {profile.seniority}
              {profile.years_experience ? ` · ${profile.years_experience} yrs` : ""}
            </Badge>
            <Badge color={profile.strength === "strong" ? "#34d399" : profile.strength === "solid" ? "#22d3ee" : "#fbbf24"}>
              {profile.strength} ML depth
            </Badge>
            {profile.domains.slice(0, 3).map((d) => (
              <Badge key={d}>{d}</Badge>
            ))}
          </div>
        </div>
      </motion.div>

      <div className="mt-6 space-y-4">
        {Object.entries(groups).map(([cat, skills]) => (
          <motion.div variants={itemUp} key={cat}>
            <div className="mb-2 text-[11px] uppercase tracking-[0.16em] text-ink-400">{CAT_LABEL[cat]}</div>
            <motion.div variants={stagger} className="flex flex-wrap gap-1.5">
              {skills.map((s) => (
                <motion.span
                  variants={itemPop}
                  key={s}
                  className="rounded-lg border px-2 py-1 text-xs"
                  style={{ borderColor: `${CAT_COLORS[cat]}33`, background: `${CAT_COLORS[cat]}10`, color: CAT_COLORS[cat] }}
                >
                  {s}
                </motion.span>
              ))}
            </motion.div>
          </motion.div>
        ))}
      </div>

      {profile.projects.length > 0 && (
        <motion.div variants={itemUp} className="mt-6">
          <div className="mb-2 text-[11px] uppercase tracking-[0.16em] text-ink-400">Projects</div>
          <div className="space-y-2">
            {profile.projects.slice(0, 3).map((p) => (
              <div key={p.title} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                <div className="text-sm text-white">{p.title}</div>
                <div className="mt-0.5 line-clamp-2 text-xs text-ink-300">{p.summary}</div>
              </div>
            ))}
          </div>
        </motion.div>
      )}
      {profile.education.length > 0 && (
        <motion.div variants={itemUp} className="mt-5 flex items-start gap-2 text-xs text-ink-300">
          <GraduationCap className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-400" />
          {profile.education[0]}
        </motion.div>
      )}
      <motion.div variants={itemUp} className="mt-5 font-mono text-[10px] text-ink-400">
        extracted via {profile.extraction_method}
      </motion.div>
    </motion.div>
  );
}

export function AlignmentCard({ plan }: { plan: Plan }) {
  const sorted = [...plan.alignment].sort((a, b) => b.score - a.score);
  return (
    <div className="glass rounded-2xl p-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-white">Resume × role alignment</h3>
        <span className="text-[11px] text-ink-400">keyword evidence</span>
      </div>
      <div className="mt-5 space-y-3.5">
        {sorted.map((a, i) => (
          <div key={a.competency_id}>
            <div className="flex items-center justify-between text-xs">
              <span className="text-ink-200">{a.name}</span>
              <span className="font-mono text-ink-400">{Math.round(a.score * 100)}%</span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
              <motion.div
                className="h-full rounded-full"
                style={{ background: a.score > 0.5 ? "linear-gradient(90deg,#8b5cf6,#22d3ee)" : a.score > 0 ? "#8b5cf6" : "#3d4258" }}
                initial={{ width: 0 }}
                animate={{ width: `${Math.max(3, a.score * 100)}%` }}
                transition={{ delay: 0.3 + i * 0.07, duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
            {a.matched.length > 0 && <div className="mt-1 truncate text-[10.5px] text-ink-400">{a.matched.join(" · ")}</div>}
          </div>
        ))}
      </div>
      <div className="mt-6 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5">
        <div className="flex items-center gap-2 text-xs text-white">
          <DifficultyPips level={plan.calibration.base_difficulty} />
          <span className="text-ink-400">base level</span>
          <span className="ml-auto" />
          <LevelBadge level={plan.calibration.level} />
        </div>
        <p className="mt-2 text-xs leading-relaxed text-ink-300">{plan.calibration.rationale}</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {plan.books.map((b) => (
            <Badge key={b} color={BOOK_COLORS[b]} dot>
              {BOOK_SHORT[b] || b}
            </Badge>
          ))}
          {plan.calibration.advanced_unlocked && (
            <Badge color="#34d399">
              <Unlock className="h-3 w-3" /> advanced unlocked
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}

export function TopicPlan({ plan }: { plan: Plan }) {
  return (
    <div className="glass rounded-2xl p-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-white">Interview blueprint</h3>
        <span className="font-mono text-[11px] text-ink-400">planned by {plan.generator}</span>
      </div>
      <div className="relative mt-6">
        <motion.div
          className="absolute bottom-3 left-[15px] top-3 w-px origin-top bg-gradient-to-b from-violet-500 via-cyan-400 to-pink-400"
          initial={{ scaleY: 0 }}
          animate={{ scaleY: 1 }}
          transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1] }}
        />
        <motion.ol variants={stagger} initial="hidden" animate="show" className="space-y-4">
          {plan.topics.map((t) => (
            <motion.li variants={itemUp} key={t.index} className="relative flex gap-4">
              <span className="relative z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full border border-white/15 bg-ink-850 font-mono text-xs text-white">
                {t.index + 1}
              </span>
              <div className="min-w-0 flex-1 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 transition-colors hover:border-white/[0.12] hover:bg-white/[0.035]">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-white">{t.title}</span>
                  <Badge>{QTYPE_LABEL[t.question_style] || t.question_style}</Badge>
                  {t.resume_anchor ? (
                    <Badge color="#a78bfa">
                      <Anchor className="h-3 w-3" /> resume-anchored
                    </Badge>
                  ) : (
                    <Badge color="#22d3ee">
                      <Layers className="h-3 w-3" /> role core
                    </Badge>
                  )}
                  <span className="ml-auto">
                    <DifficultyPips level={t.difficulty} />
                  </span>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-ink-300">{t.rationale}</p>
                {t.resume_anchor && <p className="mt-1.5 text-xs italic text-violet-300/80">“{t.resume_anchor}”</p>}
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {t.queries.map((q) => (
                    <span key={q} className="inline-flex items-center gap-1 rounded-md bg-white/[0.04] px-2 py-0.5 font-mono text-[10.5px] text-ink-300">
                      <Search className="h-2.5 w-2.5" />
                      {q}
                    </span>
                  ))}
                </div>
              </div>
            </motion.li>
          ))}
        </motion.ol>
      </div>
    </div>
  );
}

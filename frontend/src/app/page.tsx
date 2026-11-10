"use client";

import { motion } from "framer-motion";
import { ArrowRight, BookOpen, Crosshair, Gauge, GitBranch, Layers, MessagesSquare, Mic, Quote, Route, ShieldCheck, Volume2 } from "lucide-react";
import { LiveInterviewDemo } from "@/components/live-demo";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AnimatedNumber, Aurora, EASE, Magnetic, Reveal, SpotlightCard, Typewriter } from "@/components/motion";
import { PipelineFlow } from "@/components/pipeline-flow";
import { Badge, Button, DifficultyPips, SectionLabel } from "@/components/ui";
import { api } from "@/lib/api";
import type { KnowledgeBase, Role } from "@/lib/types";
import { BOOK_COLORS } from "@/lib/utils";

const DEMO_Q =
  "Your fraud-detection project used random forests. Mitchell describes how ID3 picks attributes by information gain — why does that criterion favour attributes with many values, and how would it bias the trees in your forest?";

export default function Home() {
  const [kb, setKb] = useState<KnowledgeBase | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  useEffect(() => {
    api.knowledgeBase().then(setKb).catch(() => {});
    api.roles().then(setRoles).catch(() => {});
  }, []);
  const pages = kb?.books.reduce((a, b) => a + (b.pages || 0), 0) ?? 0;

  return (
    <main className="relative">
      {/* ------------------------------------------------------------ HERO */}
      <section className="relative overflow-hidden pt-36 pb-24">
        <Aurora />
        <div className="relative mx-auto max-w-6xl px-6 text-center">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="flex justify-center">
            <span className="glass inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs text-ink-200">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute h-full w-full rounded-full bg-violet-400 animate-pulse-ring" />
                <span className="h-1.5 w-1.5 rounded-full bg-violet-400" />
              </span>
              Voice AI interviewer · Retrieval-augmented · Adaptive
            </span>
          </motion.div>

          <h1 className="mx-auto mt-7 max-w-4xl text-[44px] font-semibold leading-[1.02] tracking-[-0.04em] text-white sm:text-6xl md:text-7xl">
            {["Interviews", "that", "read", "the"].map((w, i) => (
              <motion.span
                key={w}
                className="mr-[0.25em] inline-block"
                initial={{ opacity: 0, y: 40, filter: "blur(12px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                transition={{ duration: 0.8, delay: 0.1 + i * 0.08, ease: EASE }}
              >
                {w}
              </motion.span>
            ))}
            <motion.span
              className="inline-block font-display font-normal italic text-gradient-animated pr-2"
              initial={{ opacity: 0, y: 40, filter: "blur(12px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{ duration: 0.8, delay: 0.45, ease: EASE }}
            >
              resume
            </motion.span>
            <br className="hidden sm:block" />
            {["and", "the"].map((w, i) => (
              <motion.span
                key={w + i}
                className="mr-[0.25em] inline-block"
                initial={{ opacity: 0, y: 40, filter: "blur(12px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                transition={{ duration: 0.8, delay: 0.55 + i * 0.08, ease: EASE }}
              >
                {w}
              </motion.span>
            ))}
            <motion.span
              className="inline-block font-display font-normal italic text-gradient-animated pr-2"
              initial={{ opacity: 0, y: 40, filter: "blur(12px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{ duration: 0.8, delay: 0.72, ease: EASE }}
            >
              textbook.
            </motion.span>
          </h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.9, ease: EASE }}
            className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-ink-300 sm:text-lg"
          >
            ScreenIQ parses a candidate&apos;s resume, retrieves the passages of the role&apos;s reference textbooks that matter for <em>them</em>,
            and generates a grounded, adaptive technical interview — with every question traceable to the page it came from.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 1.05, ease: EASE }}
            className="mt-9 flex flex-wrap items-center justify-center gap-3"
          >
            <Magnetic>
              <Link href="/interview/new">
                <Button size="lg" icon={<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />} className="flex-row-reverse">
                  Start an interview
                </Button>
              </Link>
            </Magnetic>
            <Link href="/knowledge">
              <Button size="lg" variant="secondary" icon={<BookOpen className="h-4 w-4" />}>
                Explore the knowledge base
              </Button>
            </Link>
          </motion.div>

          {/* live stats */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.3, duration: 0.8 }}
            className="mx-auto mt-14 grid max-w-3xl grid-cols-2 gap-px overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.06] sm:grid-cols-4"
          >
            {[
              { v: kb?.books.filter((b) => b.chunks).length ?? 6, l: "reference books" },
              { v: pages || 2201, l: "pages ingested" },
              { v: kb?.total_chunks || 0, l: "searchable chunks" },
              { v: 3, l: "role tracks" },
            ].map((s) => (
              <div key={s.l} className="bg-ink-950/80 px-4 py-5 backdrop-blur">
                <div className="text-2xl font-semibold text-white">
                  <AnimatedNumber value={s.v} />
                </div>
                <div className="mt-1 text-xs text-ink-400">{s.l}</div>
              </div>
            ))}
          </motion.div>
        </div>

        {/* floating demo card */}
        <motion.div
          initial={{ opacity: 0, y: 60, rotateX: 18 }}
          animate={{ opacity: 1, y: 0, rotateX: 0 }}
          transition={{ duration: 1.2, delay: 1.2, ease: EASE }}
          style={{ transformPerspective: 1200 }}
          className="relative mx-auto mt-16 max-w-4xl px-6"
        >
          <div className="border-gradient glass-strong relative rounded-3xl p-6 shadow-[0_40px_120px_-30px_rgba(139,92,246,0.45)] md:p-8">
            <div className="flex flex-wrap items-center gap-2">
              <Badge color="#a78bfa" dot>
                Q3 · Decision trees
              </Badge>
              <Badge>Applied</Badge>
              <DifficultyPips level={4} />
              <span className="ml-auto font-mono text-[11px] text-ink-400">illustrative example · 2 cited chunks</span>
            </div>
            <p className="mt-5 min-h-[84px] text-left text-lg leading-relaxed text-ink-100 md:text-xl">
              <Typewriter text={DEMO_Q} speed={10} />
            </p>
            <div className="mt-6 grid gap-3 md:grid-cols-2">
              {[
                { b: "mitchell", t: "Machine Learning · Mitchell", s: "3.4 Which attribute is the best classifier?", p: "p. 55", d: 0.81, r: 1 },
                { b: "mitchell", t: "Machine Learning · Mitchell", s: "3.7.3 Alternative measures for selecting attributes", p: "p. 73", d: 0.77, r: 3 },
              ].map((c, i) => (
                <motion.div
                  key={c.s}
                  initial={{ opacity: 0, x: i ? 20 : -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 2.4 + i * 0.2, duration: 0.6, ease: EASE }}
                  className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3 text-left"
                >
                  <div className="flex items-center gap-2 text-[11px]">
                    <span className="h-2 w-2 rounded-full" style={{ background: BOOK_COLORS[c.b] }} />
                    <span className="text-ink-300">{c.t}</span>
                    <span className="ml-auto font-mono text-ink-400">{c.p}</span>
                  </div>
                  <div className="mt-1.5 text-sm text-ink-100">{c.s}</div>
                  <div className="mt-2.5 flex items-center gap-2">
                    <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                      <motion.div
                        className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-400"
                        initial={{ width: 0 }}
                        animate={{ width: `${c.d * 100}%` }}
                        transition={{ delay: 2.8 + i * 0.2, duration: 1, ease: EASE }}
                      />
                    </div>
                    <span className="font-mono text-[10px] text-ink-400">cos {c.d}</span>
                    <span className="font-mono text-[10px] text-ink-400">bm25 #{c.r}</span>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>
      </section>

      {/* ------------------------------------------------------------ LIVE VOICE INTERVIEW */}
      <section className="relative mx-auto max-w-6xl px-6 py-24">
        <div className="grid items-center gap-12 md:grid-cols-2">
          <Reveal>
            <SectionLabel>Live AI interviewer</SectionLabel>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white md:text-4xl">
              Not a form. A <span className="font-display italic font-normal text-gradient">conversation</span>.
            </h2>
            <p className="mt-4 text-ink-300">
              Nova, the AI interviewer, asks every question out loud, listens to the spoken answer, and reacts like a real interviewer —
              probing deeper when an answer reveals a gap, raising the bar when it&apos;s strong.
            </p>
            <ul className="mt-8 space-y-4">
              {[
                { icon: Volume2, c: "#a78bfa", t: "Speaks every question", d: "Natural voice with live, word-by-word captions." },
                { icon: Mic, c: "#fb7185", t: "Hands-free answers", d: "The mic opens automatically; a short pause sends the answer." },
                { icon: MessagesSquare, c: "#22d3ee", t: "Reacts and follows up", d: "Spoken feedback, follow-up probes and difficulty that adapts live." },
              ].map((f, i) => (
                <motion.li
                  key={f.t}
                  initial={{ opacity: 0, x: -12 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.2 + i * 0.1, ease: EASE }}
                  className="flex gap-3"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.03]">
                    <f.icon className="h-4 w-4" style={{ color: f.c }} />
                  </span>
                  <div>
                    <div className="text-sm font-medium text-white">{f.t}</div>
                    <div className="text-sm text-ink-400">{f.d}</div>
                  </div>
                </motion.li>
              ))}
            </ul>
            <div className="mt-8">
              <Link href="/interview/new">
                <Button icon={<Mic className="h-4 w-4" />}>Try a voice interview</Button>
              </Link>
            </div>
          </Reveal>
          <Reveal delay={0.15}>
            <LiveInterviewDemo />
          </Reveal>
        </div>
      </section>

      {/* ------------------------------------------------------------ PIPELINE */}
      <section className="relative mx-auto max-w-6xl px-6 py-24">
        <Reveal>
          <SectionLabel>The pipeline</SectionLabel>
          <h2 className="mt-4 max-w-2xl text-3xl font-semibold tracking-tight text-white md:text-4xl">
            Eight stages, from a PDF to a <span className="font-display italic font-normal text-gradient">defensible</span> hiring signal.
          </h2>
        </Reveal>
        <Reveal delay={0.15} className="mt-14">
          <PipelineFlow />
        </Reveal>
      </section>

      {/* ------------------------------------------------------------ RESUME STEERS */}
      <section className="relative mx-auto max-w-6xl px-6 py-24">
        <Reveal>
          <SectionLabel>Personalisation</SectionLabel>
          <h2 className="mt-4 max-w-2xl text-3xl font-semibold tracking-tight text-white md:text-4xl">
            The resume steers <span className="font-display italic font-normal text-gradient">everything</span>.
          </h2>
          <p className="mt-4 max-w-2xl text-ink-300">No question bank. Two candidates applying for the same role get two different interviews.</p>
        </Reveal>
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {[
            { icon: Crosshair, c: "139,92,246", t: "Topic selection", d: "~60% of topics verify what the resume claims; the rest probe role-critical competencies it is silent on." },
            { icon: Gauge, c: "34,211,238", t: "Difficulty", d: "Seniority and ML depth set a base level. Claimed areas go one level deeper; unfamiliar ones start gentler — then answers move it live." },
            { icon: Route, c: "244,114,182", t: "Direction", d: "Strong profiles unlock the advanced corpus (Bishop, AI·ML·DL). Weak answers trigger a scaffolded follow-up aimed at the exact gap." },
          ].map((f, i) => (
            <Reveal key={f.t} delay={i * 0.1}>
              <SpotlightCard color={f.c} tilt className="h-full p-6">
                <div className="grid h-11 w-11 place-items-center rounded-xl border border-white/10 bg-white/[0.03]">
                  <f.icon className="h-5 w-5" style={{ color: `rgb(${f.c})` }} />
                </div>
                <h3 className="mt-5 text-lg font-medium text-white">{f.t}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-300">{f.d}</p>
              </SpotlightCard>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------------ RAG */}
      <section className="relative mx-auto max-w-6xl px-6 py-24">
        <div className="grid items-center gap-12 md:grid-cols-2">
          <Reveal>
            <SectionLabel>Retrieval you can audit</SectionLabel>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white md:text-4xl">
              Every question shows its <span className="font-display italic font-normal text-gradient">receipts</span>.
            </h2>
            <p className="mt-4 text-ink-300">
              Context → Question → Answer → Storage is persisted end to end. Open any question to see the queries that were run, every chunk that
              was retrieved with its dense and lexical rank, and which ones the generator actually cited.
            </p>
            <ul className="mt-6 space-y-3 text-sm">
              {[
                { i: Layers, t: "Structure-aware chunking", d: "Section-bounded, ~230 words, sentence overlap, junk filtered." },
                { i: GitBranch, t: "Hybrid retrieval", d: "bge-small embeddings in Qdrant + BM25, fused with RRF." },
                { i: ShieldCheck, t: "Grounding guard", d: "Similarity floor + MMR; uncited questions are rejected." },
              ].map((x) => (
                <li key={x.t} className="flex gap-3">
                  <x.i className="mt-0.5 h-4 w-4 shrink-0 text-violet-400" />
                  <span>
                    <span className="text-white">{x.t}.</span> <span className="text-ink-300">{x.d}</span>
                  </span>
                </li>
              ))}
            </ul>
          </Reveal>
          <Reveal delay={0.15}>
            <div className="glass relative rounded-2xl p-5 font-mono text-[12px]">
              <div className="mb-3 flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-400/70" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
                <span className="ml-2 text-ink-400">example trace · Q3</span>
              </div>
              {[
                ["queries", '["information gain entropy attribute selection", "random forest decision trees"]'],
                ["books", '["mitchell", "ml_beginners"]'],
                ["candidates", "47 → grounding floor 0.52 → MMR λ=0.72"],
                ["cited", "2 of 4 chunks"],
                ["prompt", "q-gen/v3 · 412 ms retrieval · 1.9 s generation"],
              ].map(([k, v], i) => (
                <motion.div
                  key={k}
                  initial={{ opacity: 0, x: -10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.2 + i * 0.12 }}
                  className="flex gap-3 border-t border-white/[0.05] py-2"
                >
                  <span className="w-24 shrink-0 text-violet-300">{k}</span>
                  <span className="text-ink-200">{v}</span>
                </motion.div>
              ))}
              <motion.div
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 1 }}
                className="mt-3 rounded-lg border border-emerald-400/20 bg-emerald-400/[0.05] p-3 font-sans text-[12.5px] leading-relaxed text-ink-200"
              >
                <Quote className="mb-1 h-3.5 w-3.5 text-emerald-300" />
                “…information gain, is simply the expected reduction in entropy caused by partitioning the examples according to this attribute…”
                <div className="mt-1.5 font-mono text-[10px] text-ink-400">Mitchell · p.57 · cited</div>
              </motion.div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ------------------------------------------------------------ ROLES */}
      <section className="relative mx-auto max-w-6xl px-6 py-24">
        <Reveal>
          <SectionLabel>Role tracks</SectionLabel>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white md:text-4xl">Each role owns its own library.</h2>
        </Reveal>
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {(roles.length ? roles : []).map((r, i) => (
            <Reveal key={r.id} delay={i * 0.1}>
              <SpotlightCard tilt className="flex h-full flex-col p-6">
                <h3 className="text-lg font-medium text-white">{r.title}</h3>
                <p className="mt-1 text-sm text-violet-300">{r.tagline}</p>
                <p className="mt-3 text-sm leading-relaxed text-ink-300">{r.description}</p>
                <div className="mt-5 space-y-2">
                  {r.books.map((b) => (
                    <div key={b.id} className="flex items-center gap-2 text-xs">
                      <span className="h-2 w-2 rounded-full" style={{ background: b.color }} />
                      <span className="truncate text-ink-200">{b.title}</span>
                      {b.tier === "advanced" && <span className="ml-auto shrink-0 text-[10px] uppercase tracking-wider text-ink-400">advanced</span>}
                    </div>
                  ))}
                </div>
              </SpotlightCard>
            </Reveal>
          ))}
          {!roles.length &&
            [0, 1, 2].map((i) => <div key={i} className="shimmer h-64 rounded-2xl" />)}
        </div>
      </section>

      {/* ------------------------------------------------------------ CTA */}
      <section className="relative mx-auto max-w-6xl px-6 pb-28 pt-10">
        <Reveal>
          <div className="border-gradient relative overflow-hidden rounded-3xl p-10 text-center md:p-16">
            <Aurora intensity={0.7} />
            <div className="relative">
              <h2 className="text-3xl font-semibold tracking-tight text-white md:text-5xl">
                Ready when <span className="font-display italic font-normal text-gradient-animated">you</span> are.
              </h2>
              <p className="mx-auto mt-4 max-w-lg text-ink-300">Upload a resume, pick a role, and get a fully grounded interview in under a minute.</p>
              <div className="mt-8 flex justify-center">
                <Magnetic>
                  <Link href="/interview/new">
                    <Button size="lg" icon={<ArrowRight className="h-4 w-4" />} className="flex-row-reverse">
                      Start an interview
                    </Button>
                  </Link>
                </Magnetic>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

    </main>
  );
}

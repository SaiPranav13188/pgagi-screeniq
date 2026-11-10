"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  BookOpen,
  Bot,
  BrainCircuit,
  Check,
  FileText,
  FlaskConical,
  GraduationCap,
  Sparkles,
  Loader2,
  MessageSquareQuote,
  Play,
  ScanSearch,
  Upload,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";
import { AlignmentCard, ProfileCard, TopicPlan } from "@/components/blueprint";
import { Aurora, EASE, SpotlightCard } from "@/components/motion";
import { Badge, Button, SectionLabel } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import type { Role, Session } from "@/lib/types";
import { cn } from "@/lib/utils";

const STEPS = ["Resume", "Role", "Settings"];

const SAMPLES = [
  { file: "aarav_mehta_ml_engineer.txt", name: "Aarav Mehta", d: "ML engineer · 4 yrs", grad: "from-violet-500 to-indigo-500" },
  { file: "riya_kapoor_student.txt", name: "Riya Kapoor", d: "CS student · internships", grad: "from-pink-500 to-rose-500" },
];

const ROLE_STYLE: Record<string, { icon: typeof BrainCircuit; grad: string }> = {
  ai_ml_engineer: { icon: BrainCircuit, grad: "from-violet-500 to-indigo-500" },
  data_scientist: { icon: BarChart3, grad: "from-cyan-400 to-blue-500" },
  ml_research: { icon: FlaskConical, grad: "from-pink-500 to-fuchsia-600" },
};
const PROCESS = [
  { t: "Uploading resume", d: "Validating file type and size" },
  { t: "Extracting text", d: "Layout-aware PDF parsing" },
  { t: "Identifying skills & seniority", d: "Taxonomy matching + LLM structuring" },
  { t: "Aligning with the role", d: "Scoring resume evidence per competency" },
  { t: "Calibrating difficulty", d: "Seniority, ML depth, advanced corpus unlock" },
  { t: "Planning topics & search queries", d: "Resume-anchored vs role-core coverage" },
];

export default function NewInterview() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [roles, setRoles] = useState<Role[]>([]);
  const [roleId, setRoleId] = useState<string | null>(null);
  const [mode, setMode] = useState<"interview" | "practice">("interview");
  const [count, setCount] = useState(6);
  const [phase, setPhase] = useState<"form" | "processing" | "blueprint">("form");
  const [procStep, setProcStep] = useState(0);
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    api.roles().then(setRoles).catch((e) => toast.error(e.message));
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { "application/pdf": [".pdf"], "text/plain": [".txt"], "text/markdown": [".md"] },
    maxFiles: 1,
    maxSize: 5 * 1024 * 1024,
    onDropAccepted: (f) => setFile(f[0]),
    onDropRejected: (r) => toast.error(r[0]?.errors[0]?.message || "File rejected"),
  });

  async function loadSample(s: (typeof SAMPLES)[number]) {
    try {
      const res = await fetch(`/samples/${s.file}`);
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      setFile(new File([blob], s.file, { type: "text/plain" }));
      toast.success(`Loaded ${s.name}'s sample resume`);
    } catch {
      toast.error("Could not load the sample resume");
    }
  }

  const go = (n: number) => {
    setDir(n > step ? 1 : -1);
    setStep(n);
  };
  const canNext = step === 0 ? !!file : step === 1 ? !!roleId : true;

  async function start() {
    if (!file || !roleId) return;
    setPhase("processing");
    setProcStep(0);
    const ticker = setInterval(() => setProcStep((s) => (s < 2 ? s + 1 : s)), 900);
    try {
      const form = new FormData();
      form.append("resume", file);
      form.append("role_id", roleId);
      form.append("mode", mode);
      form.append("num_questions", String(count));
      if (name.trim()) form.append("candidate_name", name.trim());
      const created = await api.createSession(form);
      clearInterval(ticker);
      setProcStep(3);
      const t2 = setInterval(() => setProcStep((s) => (s < 5 ? s + 1 : s)), 800);
      const planned = await api.plan(created.id);
      clearInterval(t2);
      setProcStep(6);
      await new Promise((r) => setTimeout(r, 650));
      setSession(planned);
      setPhase("blueprint");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      clearInterval(ticker);
      toast.error(e instanceof ApiError ? e.message : "Something went wrong");
      setPhase("form");
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden pt-28 pb-24">
      <Aurora intensity={0.55} />
      <div className="relative mx-auto max-w-6xl px-6">
        <AnimatePresence mode="wait">
          {phase === "form" && (
            <motion.div key="form" exit={{ opacity: 0, y: -20, filter: "blur(8px)" }} transition={{ duration: 0.4 }}>
              <div className="mx-auto max-w-3xl">
                <SectionLabel>New interview</SectionLabel>
                <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white md:text-5xl">
                  Set up a <span className="font-display italic font-normal text-gradient-animated">screening</span>
                </h1>

                {/* stepper */}
                <div className="mt-10 flex items-center gap-3">
                  {STEPS.map((s, i) => (
                    <div key={s} className="flex flex-1 items-center gap-3">
                      <button onClick={() => i < step && go(i)} className="flex items-center gap-2.5">
                        <motion.span
                          animate={{
                            background: i < step ? "#8b5cf6" : i === step ? "rgba(139,92,246,0.18)" : "rgba(255,255,255,0.04)",
                            borderColor: i <= step ? "rgba(139,92,246,0.8)" : "rgba(255,255,255,0.1)",
                          }}
                          className="grid h-8 w-8 place-items-center rounded-full border text-xs font-medium text-white"
                        >
                          {i < step ? <Check className="h-4 w-4" /> : i + 1}
                        </motion.span>
                        <span className={cn("text-sm transition-colors", i <= step ? "text-white" : "text-ink-400")}>{s}</span>
                      </button>
                      {i < STEPS.length - 1 && (
                        <div className="h-px flex-1 overflow-hidden bg-white/10">
                          <motion.div className="h-full bg-violet-500" animate={{ width: i < step ? "100%" : "0%" }} transition={{ duration: 0.5 }} />
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div className="relative mt-8 min-h-[420px]">
                  <AnimatePresence mode="wait" custom={dir}>
                    <motion.div
                      key={step}
                      custom={dir}
                      initial={{ opacity: 0, x: dir * 50, filter: "blur(6px)" }}
                      animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
                      exit={{ opacity: 0, x: dir * -50, filter: "blur(6px)" }}
                      transition={{ duration: 0.4, ease: EASE }}
                    >
                      {step === 0 && (
                        <div className="space-y-5">
                          <div
                            {...getRootProps()}
                            className={cn(
                              "group relative cursor-pointer overflow-hidden rounded-3xl border-2 border-dashed p-10 text-center transition-all duration-300",
                              isDragActive ? "border-violet-400 bg-violet-500/10 scale-[1.01]" : file ? "border-emerald-400/40 bg-emerald-400/[0.04]" : "border-white/10 bg-white/[0.02] hover:border-violet-400/50 hover:bg-white/[0.04]",
                            )}
                          >
                            <input {...getInputProps()} />
                            <AnimatePresence mode="wait">
                              {file ? (
                                <motion.div key="file" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center">
                                  <div className="relative h-36 w-28 overflow-hidden rounded-xl border border-white/10 bg-gradient-to-b from-ink-700 to-ink-850 shadow-2xl">
                                    {[...Array(9)].map((_, i) => (
                                      <motion.div
                                        key={i}
                                        className="mx-3 mt-2.5 h-1.5 rounded bg-white/10"
                                        style={{ width: `${55 + ((i * 37) % 40)}%` }}
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        transition={{ delay: i * 0.05 }}
                                      />
                                    ))}
                                    <div className="absolute inset-x-0 h-8 animate-scan bg-gradient-to-b from-transparent via-violet-400/40 to-transparent" />
                                    <div className="absolute inset-x-0 h-px animate-scan bg-violet-300 shadow-[0_0_12px_#a78bfa]" />
                                  </div>
                                  <div className="mt-5 flex items-center gap-2 text-sm text-white">
                                    <FileText className="h-4 w-4 text-emerald-300" /> {file.name}
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setFile(null);
                                      }}
                                      className="ml-1 rounded-md p-1 text-ink-400 hover:bg-white/10 hover:text-white"
                                    >
                                      <X className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                  <div className="mt-1 text-xs text-ink-400">{(file.size / 1024).toFixed(0)} KB · ready to analyse</div>
                                </motion.div>
                              ) : (
                                <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center py-6">
                                  <motion.div animate={{ y: isDragActive ? -8 : [0, -6, 0] }} transition={{ repeat: isDragActive ? 0 : Infinity, duration: 3 }} className="relative">
                                    <div className="absolute inset-0 rounded-2xl bg-violet-500/30 blur-xl" />
                                    <div className="relative grid h-16 w-16 place-items-center rounded-2xl border border-white/10 bg-ink-800">
                                      <Upload className="h-7 w-7 text-violet-300" />
                                    </div>
                                  </motion.div>
                                  <p className="mt-6 text-lg text-white">{isDragActive ? "Drop it right here" : "Drop the candidate's resume"}</p>
                                  <p className="mt-1 text-sm text-ink-400">PDF, TXT or Markdown · up to 5 MB · or click to browse</p>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                          {!file && (
                            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                              <div className="flex items-center gap-3 text-xs text-ink-400">
                                <span className="h-px flex-1 bg-white/[0.07]" />
                                <Sparkles className="h-3.5 w-3.5 text-violet-300" /> No resume handy? Try a sample
                                <span className="h-px flex-1 bg-white/[0.07]" />
                              </div>
                              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                                {SAMPLES.map((s) => (
                                  <motion.button
                                    key={s.file}
                                    type="button"
                                    whileHover={{ y: -2 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => loadSample(s)}
                                    className="group flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-3 text-left transition hover:border-violet-400/40 hover:bg-white/[0.04]"
                                  >
                                    <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br text-sm font-semibold text-white", s.grad)}>
                                      {s.name
                                        .split(" ")
                                        .map((w) => w[0])
                                        .join("")}
                                    </span>
                                    <span className="min-w-0 flex-1">
                                      <span className="block text-sm font-medium text-white">{s.name}</span>
                                      <span className="block text-xs text-ink-400">{s.d}</span>
                                    </span>
                                    <ArrowRight className="h-4 w-4 text-ink-500 transition group-hover:translate-x-0.5 group-hover:text-violet-300" />
                                  </motion.button>
                                ))}
                              </div>
                            </motion.div>
                          )}
                          <label className="block">
                            <span className="text-xs text-ink-400">Candidate name (optional — detected from the resume otherwise)</span>
                            <input
                              value={name}
                              onChange={(e) => setName(e.target.value)}
                              placeholder="e.g. Priya Sharma"
                              className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 text-sm text-white outline-none transition focus:border-violet-400/60 focus:bg-white/[0.05] focus:ring-4 focus:ring-violet-500/10"
                            />
                          </label>
                        </div>
                      )}

                      {step === 1 && (
                        <div className="grid gap-4">
                          {roles.map((r) => {
                            const sel = roleId === r.id;
                            const rs = ROLE_STYLE[r.id] ?? ROLE_STYLE.ai_ml_engineer;
                            return (
                              <SpotlightCard
                                key={r.id}
                                onClick={() => setRoleId(r.id)}
                                whileTap={{ scale: 0.99 }}
                                className={cn("cursor-pointer p-5 transition-all duration-300", sel && "ring-2 ring-violet-400/70 shadow-[0_0_40px_-10px_rgba(139,92,246,0.8)]")}
                              >
                                <div className="flex items-start gap-4">
                                  <div className="relative shrink-0">
                                    <div className={cn("grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br shadow-lg transition-transform duration-300", rs.grad, sel && "scale-105")}>
                                      <rs.icon className="h-6 w-6 text-white" />
                                    </div>
                                    <div
                                      className={cn(
                                        "absolute -bottom-1 -right-1 grid h-5 w-5 place-items-center rounded-full border-2 border-ink-900 transition-colors",
                                        sel ? "bg-violet-500" : "bg-ink-700",
                                      )}
                                    >
                                      <AnimatePresence>
                                        {sel && (
                                          <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                                            <Check className="h-3 w-3 text-white" />
                                          </motion.span>
                                        )}
                                      </AnimatePresence>
                                    </div>
                                  </div>
                                  <div className="flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className="font-medium text-white">{r.title}</span>
                                      <span className="text-xs text-violet-300">{r.tagline}</span>
                                    </div>
                                    <p className="mt-1.5 text-sm text-ink-300">{r.description}</p>
                                    <div className="mt-3 flex flex-wrap gap-1.5">
                                      {r.books.map((b) => (
                                        <Badge key={b.id} color={b.tier === "primary" ? b.color : undefined} dot={b.tier === "primary"}>
                                          {b.tier === "advanced" && <GraduationCap className="h-3 w-3" />}
                                          {b.title}
                                          {!b.ingested && " (not ingested)"}
                                        </Badge>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              </SpotlightCard>
                            );
                          })}
                          {!roles.length && [0, 1, 2].map((i) => <div key={i} className="shimmer h-32 rounded-2xl" />)}
                        </div>
                      )}

                      {step === 2 && (
                        <div className="space-y-6">
                          <div>
                            <div className="text-sm text-white">Mode</div>
                            <div className="mt-3 grid gap-3 sm:grid-cols-2">
                              {[
                                { id: "interview", icon: MessageSquareQuote, t: "Interview", d: "Realistic screening. Scores and feedback are revealed only in the final report." },
                                { id: "practice", icon: BookOpen, t: "Practice", d: "Instant, grounded feedback after every answer — ideal for preparation." },
                              ].map((m) => (
                                <button
                                  key={m.id}
                                  onClick={() => setMode(m.id as "interview" | "practice")}
                                  className={cn(
                                    "relative rounded-2xl border p-4 text-left transition-all",
                                    mode === m.id ? "border-violet-400/60 bg-violet-500/[0.08]" : "border-white/10 bg-white/[0.02] hover:bg-white/[0.04]",
                                  )}
                                >
                                  {mode === m.id && <motion.span layoutId="mode-glow" className="absolute inset-0 rounded-2xl shadow-[0_0_30px_-8px_rgba(139,92,246,0.8)]" />}
                                  <m.icon className={cn("h-5 w-5", mode === m.id ? "text-violet-300" : "text-ink-400")} />
                                  <div className="mt-3 font-medium text-white">{m.t}</div>
                                  <div className="mt-1 text-xs leading-relaxed text-ink-300">{m.d}</div>
                                </button>
                              ))}
                            </div>
                          </div>
                          <div>
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-white">Planned topics</span>
                              <motion.span key={count} initial={{ scale: 1.4, color: "#c4b5fd" }} animate={{ scale: 1, color: "#fff" }} className="font-mono text-lg">
                                {count}
                              </motion.span>
                            </div>
                            <input
                              type="range"
                              min={3}
                              max={10}
                              value={count}
                              onChange={(e) => setCount(+e.target.value)}
                              className="mt-4 w-full accent-violet-500"
                            />
                            <p className="mt-2 text-xs text-ink-400">
                              Up to 2 adaptive follow-up probes may be added when an answer reveals a gap. ≈ {count * 3}–{count * 4} minutes.
                            </p>
                          </div>
                          <div className="flex items-start gap-3 rounded-2xl border border-violet-400/20 bg-violet-500/[0.06] p-4">
                            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-violet-500 to-cyan-500">
                              <Bot className="h-4 w-4 text-white" />
                            </span>
                            <div className="text-sm">
                              <div className="font-medium text-white">Spoken interview with Nova</div>
                              <div className="mt-0.5 text-xs leading-relaxed text-ink-300">
                                Nova asks every question out loud and listens to your answers (Chrome or Edge). You can switch to typing at any time.
                              </div>
                            </div>
                          </div>
                          <div className="glass rounded-2xl p-4 text-sm">
                            <div className="text-xs uppercase tracking-[0.16em] text-ink-400">Summary</div>
                            <div className="mt-2 text-ink-200">
                              <span className="text-white">{file?.name}</span> → <span className="text-white">{roles.find((r) => r.id === roleId)?.title}</span> ·{" "}
                              {mode} mode · {count} topics
                            </div>
                          </div>
                        </div>
                      )}
                    </motion.div>
                  </AnimatePresence>
                </div>

                <div className="mt-6 flex items-center justify-between">
                  <Button variant="ghost" onClick={() => go(step - 1)} disabled={step === 0} icon={<ArrowLeft className="h-4 w-4" />}>
                    Back
                  </Button>
                  {step < 2 ? (
                    <Button onClick={() => go(step + 1)} disabled={!canNext} icon={<ArrowRight className="h-4 w-4" />} className="flex-row-reverse">
                      Continue
                    </Button>
                  ) : (
                    <Button size="lg" onClick={start} icon={<ScanSearch className="h-4 w-4" />}>
                      Analyse &amp; build interview
                    </Button>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {phase === "processing" && (
            <motion.div
              key="processing"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.02, filter: "blur(8px)" }}
              className="mx-auto flex max-w-xl flex-col items-center pt-8"
            >
              <div className="relative h-40 w-40">
                <div className="absolute inset-0 rounded-full border border-violet-500/20 animate-spin-slow" style={{ borderTopColor: "#a78bfa" }} />
                <div className="absolute inset-4 rounded-full border border-cyan-400/20 animate-spin-slow [animation-direction:reverse]" style={{ borderTopColor: "#22d3ee" }} />
                <div className="absolute inset-8 rounded-full border border-pink-400/20 animate-spin-slow" style={{ borderBottomColor: "#f472b6", animationDuration: "6s" }} />
                <div className="absolute inset-0 grid place-items-center">
                  <motion.div animate={{ scale: [1, 1.12, 1] }} transition={{ repeat: Infinity, duration: 2 }} className="h-10 w-10 rounded-full bg-gradient-to-br from-violet-500 to-cyan-400 blur-[2px] shadow-[0_0_50px_#8b5cf6]" />
                </div>
              </div>
              <h2 className="mt-10 text-2xl font-semibold text-white">Building a personalised interview</h2>
              <p className="mt-2 text-sm text-ink-400">This usually takes 5–20 seconds.</p>
              <div className="mt-8 w-full space-y-2.5">
                {PROCESS.map((p, i) => {
                  const done = i < procStep;
                  const on = i === procStep;
                  return (
                    <motion.div
                      key={p.t}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: i <= procStep ? 1 : 0.35, x: 0 }}
                      transition={{ delay: i * 0.06 }}
                      className={cn("flex items-center gap-3 rounded-xl px-4 py-3 transition-colors", on ? "glass" : "")}
                    >
                      <span className="grid h-6 w-6 place-items-center">
                        {done ? (
                          <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="grid h-5 w-5 place-items-center rounded-full bg-emerald-400">
                            <Check className="h-3 w-3 text-ink-950" />
                          </motion.span>
                        ) : on ? (
                          <Loader2 className="h-4 w-4 animate-spin text-violet-300" />
                        ) : (
                          <span className="h-1.5 w-1.5 rounded-full bg-ink-500" />
                        )}
                      </span>
                      <div className="flex-1">
                        <div className={cn("text-sm", done || on ? "text-white" : "text-ink-400")}>{p.t}</div>
                        {on && <div className="text-xs text-ink-400">{p.d}</div>}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {phase === "blueprint" && session?.profile && session.plan && (
            <motion.div key="blueprint" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: EASE }}>
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <SectionLabel>Stage 2–3 · Profile &amp; blueprint</SectionLabel>
                  <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white md:text-4xl">
                    Interview ready for <span className="font-display italic font-normal text-gradient-animated">{session.candidate_name}</span>
                  </h1>
                  <p className="mt-2 text-sm text-ink-300">
                    {session.role_title} · {session.plan.topics.length} topics · {session.mode} mode
                  </p>
                </div>
                <Button size="lg" onClick={() => router.push(`/interview/${session.id}`)} icon={<Play className="h-4 w-4" />}>
                  Begin interview
                </Button>
              </div>
              <div className="mt-8 grid gap-5 lg:grid-cols-[1fr_1.35fr]">
                <div className="space-y-5">
                  <ProfileCard profile={session.profile} name={session.candidate_name} />
                  <AlignmentCard plan={session.plan} />
                </div>
                <TopicPlan plan={session.plan} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}

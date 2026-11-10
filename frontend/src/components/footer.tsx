"use client";

import { BrainCircuit, Github } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Overview" },
  { href: "/interview/new", label: "New interview" },
  { href: "/knowledge", label: "Knowledge base" },
  { href: "/sessions", label: "Sessions" },
];

const STACK = ["Next.js 15", "TypeScript", "Tailwind v4", "Framer Motion", "FastAPI", "Gemini", "Qdrant", "BM25 + RRF", "PostgreSQL", "Web Speech API"];

export function Footer() {
  const path = usePathname();
  // The interview room is a focused, full-attention space.
  if (/^\/interview\/(?!new)/.test(path)) return null;
  return (
    <footer className="relative border-t border-white/[0.06] bg-ink-950/60">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-500/50 to-transparent" />
      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-12 md:grid-cols-[1.4fr_1fr_1.6fr]">
        <div>
          <Link href="/" className="inline-flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-violet-500 to-cyan-400 shadow-[0_0_20px_rgba(139,92,246,0.5)]">
              <BrainCircuit className="h-4 w-4 text-white" />
            </span>
            <span className="font-semibold text-white">
              Screen<span className="text-gradient">IQ</span>
            </span>
          </Link>
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-ink-400">
            A spoken, resume-aware technical interview — every question grounded in the textbooks that define the role.
          </p>
          <a
            href="https://github.com/SaiPranav13188/pgagi-screeniq"
            target="_blank"
            rel="noreferrer"
            className="mt-5 inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-ink-200 transition hover:border-violet-400/40 hover:text-white"
          >
            <Github className="h-3.5 w-3.5" /> Source on GitHub
          </a>
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-ink-500">Explore</div>
          <ul className="mt-4 space-y-2.5">
            {LINKS.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="text-sm text-ink-300 transition hover:text-white">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-ink-500">Built with</div>
          <div className="mt-4 flex flex-wrap gap-1.5">
            {STACK.map((s) => (
              <span key={s} className="rounded-lg border border-white/[0.07] bg-white/[0.02] px-2.5 py-1 text-[11.5px] text-ink-300">
                {s}
              </span>
            ))}
          </div>
        </div>
      </div>
      <div className="border-t border-white/[0.05] py-5 text-center text-xs text-ink-500">
        Built for the PGAGI AI/ML &amp; Backend Engineering assignment
      </div>
    </footer>
  );
}

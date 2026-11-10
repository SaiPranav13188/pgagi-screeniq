"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { BrainCircuit } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { api } from "@/lib/api";
import type { Health } from "@/lib/types";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/", label: "Overview" },
  { href: "/interview/new", label: "New interview" },
  { href: "/knowledge", label: "Knowledge base" },
  { href: "/sessions", label: "Sessions" },
];

export function Navbar() {
  const path = usePathname();
  const [health, setHealth] = useState<Health | null>(null);
  const [down, setDown] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    api.health().then(setHealth).catch(() => setDown(true));
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const active = (href: string) => (href === "/" ? path === "/" : path === href || (href === "/sessions" && path.startsWith("/report")));
  if (path.startsWith("/interview/") && path !== "/interview/new") return null; // focused interview room

  return (
    <motion.header
      initial={{ y: -30, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-4 print:hidden"
    >
      <nav
        className={cn(
          "flex w-full max-w-6xl items-center justify-between rounded-2xl px-3 py-2 transition-all duration-500",
          scrolled ? "glass-strong shadow-[0_10px_40px_-10px_rgba(0,0,0,0.8)]" : "bg-transparent",
        )}
      >
        <Link href="/" className="group flex items-center gap-2.5 pl-1">
          <span className="relative grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-violet-500 to-cyan-400 shadow-[0_0_24px_-4px_rgba(139,92,246,0.9)]">
            <BrainCircuit className="h-[18px] w-[18px] text-white transition-transform duration-500 group-hover:rotate-[20deg]" />
          </span>
          <span className="text-[15px] font-semibold tracking-tight text-white">
            Screen<span className="text-gradient-animated">IQ</span>
          </span>
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="relative rounded-lg px-3.5 py-1.5 text-sm">
              {active(l.href) && (
                <motion.span
                  layoutId="nav-pill"
                  className="absolute inset-0 rounded-lg bg-white/[0.07] ring-1 ring-white/10"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
              <span className={cn("relative transition-colors", active(l.href) ? "text-white" : "text-ink-300 hover:text-white")}>{l.label}</span>
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-2 pr-1 text-xs">
          <span className="relative flex h-2 w-2">
            <span className={cn("absolute inline-flex h-full w-full rounded-full animate-pulse-ring", down ? "bg-rose-400" : health ? "bg-emerald-400" : "bg-amber-400")} />
            <span className={cn("relative inline-flex h-2 w-2 rounded-full", down ? "bg-rose-400" : health ? "bg-emerald-400" : "bg-amber-400")} />
          </span>
          <span className="hidden text-ink-300 sm:inline">
            {down ? "API offline" : !health ? "Connecting…" : health.llm.enabled ? "Gemini · live" : "Offline mode"}
          </span>
          <ThemeToggle className="ml-2" />
        </div>
      </nav>
    </motion.header>
  );
}

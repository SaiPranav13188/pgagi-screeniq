"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Moon, Sun } from "lucide-react";
import { Toaster } from "sonner";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

/** Sun / moon switch. The icon spins out while the new theme sweeps in from the button. */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggle } = useTheme();
  const dark = theme === "dark";
  return (
    <button
      type="button"
      onClick={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        toggle({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
      }}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      title={dark ? "Light mode" : "Dark mode"}
      className={cn(
        "relative grid h-8 w-8 place-items-center overflow-hidden rounded-lg border border-white/10 bg-white/[0.04] text-ink-200 transition hover:border-violet-400/40 hover:text-white",
        className,
      )}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={theme}
          initial={{ y: 14, rotate: -90, opacity: 0, scale: 0.6 }}
          animate={{ y: 0, rotate: 0, opacity: 1, scale: 1 }}
          exit={{ y: -14, rotate: 90, opacity: 0, scale: 0.6 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="grid place-items-center"
        >
          {dark ? <Moon className="h-4 w-4 text-violet-300" /> : <Sun className="h-4 w-4 text-amber-500" />}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}

/** Toast styling follows the active theme. */
export function ThemedToaster() {
  const { theme } = useTheme();
  const dark = theme === "dark";
  return (
    <Toaster
      theme={theme}
      position="bottom-right"
      toastOptions={{
        style: dark
          ? { background: "rgba(14,16,24,0.95)", border: "1px solid rgba(255,255,255,0.08)", color: "#e7e9f2", backdropFilter: "blur(16px)" }
          : { background: "rgba(255,255,255,0.96)", border: "1px solid rgba(15,18,35,0.08)", color: "#1c2033", backdropFilter: "blur(16px)" },
      }}
    />
  );
}

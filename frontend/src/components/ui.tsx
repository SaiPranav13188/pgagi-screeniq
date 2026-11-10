"use client";

import { motion, type HTMLMotionProps } from "framer-motion";
import { Loader2 } from "lucide-react";
import { forwardRef, type ReactNode } from "react";
import { cn, DIFFICULTY_LABEL } from "@/lib/utils";

type BtnProps = HTMLMotionProps<"button"> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  icon?: ReactNode;
};

export const Button = forwardRef<HTMLButtonElement, BtnProps>(function Button(
  { variant = "primary", size = "md", loading, icon, className, children, disabled, ...rest },
  ref,
) {
  const sizes = { sm: "h-8 px-3 text-xs gap-1.5", md: "h-10 px-4 text-sm gap-2", lg: "h-12 px-6 text-[15px] gap-2.5" };
  const variants = {
    primary:
      "text-white bg-gradient-to-b from-violet-500 to-indigo-600 shadow-[0_0_0_1px_rgba(255,255,255,0.12)_inset,0_8px_30px_-8px_rgba(139,92,246,0.7)] hover:shadow-[0_0_0_1px_rgba(255,255,255,0.2)_inset,0_10px_40px_-6px_rgba(139,92,246,0.9)]",
    secondary: "text-ink-100 glass hover:bg-white/[0.07]",
    ghost: "text-ink-300 hover:text-white hover:bg-white/[0.05]",
    danger: "text-rose-200 bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20",
  };
  return (
    <motion.button
      ref={ref}
      whileHover={{ y: disabled || loading ? 0 : -1 }}
      whileTap={{ scale: disabled || loading ? 1 : 0.97 }}
      disabled={disabled || loading}
      className={cn(
        "group relative inline-flex cursor-pointer items-center justify-center overflow-hidden rounded-xl font-medium transition-[background,box-shadow,color] duration-300 disabled:cursor-not-allowed disabled:opacity-50",
        sizes[size],
        variants[variant],
        className,
      )}
      {...rest}
    >
      {variant === "primary" && (
        <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
      )}
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      <span className="relative">{children as ReactNode}</span>
    </motion.button>
  );
});

export function Badge({ children, color, className, dot }: { children: ReactNode; color?: string; className?: string; dot?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium tracking-wide",
        !color && "border-white/10 bg-white/[0.04] text-ink-200",
        className,
      )}
      style={color ? { borderColor: `${color}40`, background: `${color}14`, color } : undefined}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full" style={{ background: color || "currentColor" }} />}
      {children}
    </span>
  );
}

const PIP_COLORS = ["#34d399", "#22d3ee", "#8b5cf6", "#f472b6", "#fb7185"];

export function DifficultyPips({ level, showLabel = true, animate = true }: { level: number; showLabel?: boolean; animate?: boolean }) {
  const c = PIP_COLORS[Math.max(0, level - 1)];
  return (
    <span className="inline-flex items-center gap-2">
      <span className="flex gap-[3px]">
        {[1, 2, 3, 4, 5].map((i) => (
          <motion.span
            key={i}
            initial={animate ? { scaleY: 0.2, opacity: 0 } : false}
            animate={{ scaleY: 1, opacity: 1 }}
            transition={{ delay: 0.05 * i, type: "spring", stiffness: 400, damping: 20 }}
            className="h-3 w-1.5 origin-bottom rounded-sm"
            style={{ background: i <= level ? c : "rgba(255,255,255,0.1)", boxShadow: i <= level ? `0 0 8px ${c}80` : undefined }}
          />
        ))}
      </span>
      {showLabel && <span className="text-[11px] font-medium text-ink-300">{DIFFICULTY_LABEL[level]}</span>}
    </span>
  );
}

export function SectionLabel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.2em] text-ink-400", className)}>
      <span className="h-px w-6 bg-gradient-to-r from-violet-500 to-transparent" />
      {children}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("shimmer rounded-lg", className)} />;
}

export function ProgressBar({ value, className, color }: { value: number; className?: string; color?: string }) {
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]", className)}>
      <motion.div
        className="h-full rounded-full"
        style={{ background: color || "linear-gradient(90deg,#8b5cf6,#22d3ee)" }}
        initial={{ width: 0 }}
        animate={{ width: `${Math.max(0, Math.min(100, value))}%` }}
        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
      />
    </div>
  );
}

"use client";

import { animate, motion, useInView, useMotionValue, useSpring, useTransform, type HTMLMotionProps, type Variants } from "framer-motion";
import { useEffect, useRef, useState, type ReactNode, type MouseEvent } from "react";
import { cn } from "@/lib/utils";

export const EASE = [0.22, 1, 0.36, 1] as const;

/* ---------------------------------------------------------------- Aurora background */
export function Aurora({ className, intensity = 1 }: { className?: string; intensity?: number }) {
  return (
    <div aria-hidden className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}>
      <div className="absolute inset-0 bg-grid" />
      <div
        className="absolute -top-[30%] left-[10%] h-[70vh] w-[70vh] rounded-full blur-[120px] animate-aurora"
        style={{ background: "radial-gradient(circle, rgba(139,92,246,0.55), transparent 65%)", opacity: 0.55 * intensity }}
      />
      <div
        className="absolute -top-[20%] right-[0%] h-[60vh] w-[60vh] rounded-full blur-[120px] animate-aurora [animation-delay:-6s]"
        style={{ background: "radial-gradient(circle, rgba(34,211,238,0.45), transparent 65%)", opacity: 0.4 * intensity }}
      />
      <div
        className="absolute top-[30%] left-[35%] h-[50vh] w-[50vh] rounded-full blur-[140px] animate-aurora [animation-delay:-12s]"
        style={{ background: "radial-gradient(circle, rgba(244,114,182,0.35), transparent 65%)", opacity: 0.3 * intensity }}
      />
    </div>
  );
}

/* ---------------------------------------------------------------- Reveal on scroll */
export function Reveal({
  children,
  delay = 0,
  y = 24,
  className,
  once = true,
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
  once?: boolean;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y, filter: "blur(6px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once, margin: "-60px" }}
      transition={{ duration: 0.7, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

export const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.05 } },
};
export const itemUp: Variants = {
  hidden: { opacity: 0, y: 14, filter: "blur(4px)" },
  show: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.5, ease: EASE } },
};
export const itemPop: Variants = {
  hidden: { opacity: 0, scale: 0.6 },
  show: { opacity: 1, scale: 1, transition: { type: "spring", stiffness: 380, damping: 22 } },
};

/* ---------------------------------------------------------------- Spotlight card */
export function SpotlightCard({
  children,
  className,
  color = "139,92,246",
  tilt = false,
  ...rest
}: { children: ReactNode; className?: string; color?: string; tilt?: boolean } & HTMLMotionProps<"div">) {
  const ref = useRef<HTMLDivElement>(null);
  const mx = useMotionValue(-500);
  const my = useMotionValue(-500);
  const rx = useSpring(0, { stiffness: 200, damping: 20 });
  const ry = useSpring(0, { stiffness: 200, damping: 20 });
  const bg = useTransform(
    [mx, my],
    ([x, y]) => `radial-gradient(420px circle at ${x}px ${y}px, rgba(${color},0.14), transparent 45%)`,
  );

  function onMove(e: MouseEvent<HTMLDivElement>) {
    const r = ref.current!.getBoundingClientRect();
    mx.set(e.clientX - r.left);
    my.set(e.clientY - r.top);
    if (tilt) {
      rx.set(((e.clientY - r.top) / r.height - 0.5) * -7);
      ry.set(((e.clientX - r.left) / r.width - 0.5) * 7);
    }
  }
  function onLeave() {
    mx.set(-500);
    my.set(-500);
    rx.set(0);
    ry.set(0);
  }

  return (
    <motion.div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      style={tilt ? { rotateX: rx, rotateY: ry, transformPerspective: 900 } : undefined}
      className={cn("glass group relative overflow-hidden rounded-2xl", className)}
      {...rest}
    >
      <motion.div className="pointer-events-none absolute inset-0 z-0" style={{ background: bg }} />
      <div className="relative z-10 h-full">{children}</div>
    </motion.div>
  );
}

/* ---------------------------------------------------------------- Animated number */
export function AnimatedNumber({
  value,
  decimals = 0,
  duration = 1.4,
  className,
  suffix = "",
}: {
  value: number;
  decimals?: number;
  duration?: number;
  className?: string;
  suffix?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    if (!inView) return;
    const c = animate(0, value, { duration, ease: EASE, onUpdate: (v) => setDisplay(v) });
    return () => c.stop();
  }, [inView, value, duration]);
  return (
    <span ref={ref} className={cn("tabular-nums", className)}>
      {display.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
      {suffix}
    </span>
  );
}

/* ---------------------------------------------------------------- Score ring */
export function ScoreRing({
  value,
  max = 10,
  size = 120,
  stroke = 10,
  color = "#8b5cf6",
  label,
  decimals = 1,
  delay = 0.1,
}: {
  value: number;
  max?: number;
  size?: number;
  stroke?: number;
  color?: string;
  label?: string;
  decimals?: number;
  delay?: number;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, value / max));
  const id = `ring-${label?.replace(/\W/g, "") ?? "x"}-${size}`;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={color} />
            <stop offset="100%" stopColor="#22d3ee" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,0.07)" strokeWidth={stroke} fill="none" />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={`url(#${id})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - pct) }}
          transition={{ duration: 1.6, delay, ease: EASE }}
          style={{ filter: `drop-shadow(0 0 10px ${color}66)` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <AnimatedNumber value={value} decimals={decimals} className="font-semibold text-white" duration={1.6} />
        {label && <span className="mt-0.5 text-[10px] uppercase tracking-[0.18em] text-ink-400">{label}</span>}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- Typewriter */
export function Typewriter({ text, speed = 14, className, onDone }: { text: string; speed?: number; className?: string; onDone?: () => void }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    setN(0);
    let i = 0;
    const words = text.split(/(\s+)/);
    const id = setInterval(() => {
      i += 1;
      setN(i);
      if (i >= words.length) {
        clearInterval(id);
        onDone?.();
      }
    }, speed * 3);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);
  const words = text.split(/(\s+)/);
  return (
    <span className={className}>
      {words.slice(0, n).map((w, i) => (
        <motion.span key={i} initial={{ opacity: 0, filter: "blur(4px)" }} animate={{ opacity: 1, filter: "blur(0px)" }} transition={{ duration: 0.35 }}>
          {w}
        </motion.span>
      ))}
      {n < words.length && <span className="ml-0.5 inline-block h-[1em] w-[2px] translate-y-[2px] bg-violet-400 animate-blink" />}
    </span>
  );
}

/* ---------------------------------------------------------------- Magnetic wrapper */
export function Magnetic({ children, strength = 0.25 }: { children: ReactNode; strength?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const x = useSpring(0, { stiffness: 250, damping: 18 });
  const y = useSpring(0, { stiffness: 250, damping: 18 });
  return (
    <motion.div
      ref={ref}
      style={{ x, y }}
      className="inline-block"
      onMouseMove={(e) => {
        const r = ref.current!.getBoundingClientRect();
        x.set((e.clientX - r.left - r.width / 2) * strength);
        y.set((e.clientY - r.top - r.height / 2) * strength);
      }}
      onMouseLeave={() => {
        x.set(0);
        y.set(0);
      }}
    >
      {children}
    </motion.div>
  );
}

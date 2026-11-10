"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import { scoreColor } from "@/lib/utils";

/* ------------------------------------------------------------------ Radar */
export function RadarChart({ data, size = 320 }: { data: { label: string; value: number }[]; size?: number }) {
  const n = data.length;
  const cx = size / 2;
  const cy = size / 2;
  const R = size / 2 - 58;
  if (n < 3) return <BarList data={data} />;
  const pt = (i: number, r: number) => {
    const a = (Math.PI * 2 * i) / n - Math.PI / 2;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as const;
  };
  const poly = data.map((d, i) => pt(i, (R * Math.max(0.04, d.value)) / 10).join(",")).join(" ");
  const zero = data.map((_, i) => pt(i, 2).join(",")).join(" ");

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="w-full max-w-[360px]">
      <defs>
        <radialGradient id="radar-fill">
          <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.25" />
        </radialGradient>
      </defs>
      {[2, 4, 6, 8, 10].map((lvl) => (
        <polygon
          key={lvl}
          points={data.map((_, i) => pt(i, (R * lvl) / 10).join(",")).join(" ")}
          fill="none"
          stroke="rgba(255,255,255,0.07)"
          strokeDasharray={lvl === 10 ? undefined : "2 4"}
        />
      ))}
      {data.map((_, i) => {
        const [x, y] = pt(i, R);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="rgba(255,255,255,0.06)" />;
      })}
      <motion.polygon
        initial={{ points: zero, opacity: 0 }}
        animate={{ points: poly, opacity: 1 }}
        transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1], delay: 0.3 }}
        fill="url(#radar-fill)"
        stroke="#a78bfa"
        strokeWidth={2}
        style={{ filter: "drop-shadow(0 0 12px rgba(139,92,246,0.6))" }}
      />
      {data.map((d, i) => {
        const [x, y] = pt(i, (R * Math.max(0.04, d.value)) / 10);
        return (
          <motion.circle
            key={d.label}
            cx={x}
            cy={y}
            r={4}
            fill={scoreColor(d.value)}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 1.2 + i * 0.06, type: "spring" }}
          />
        );
      })}
      {data.map((d, i) => {
        const [x, y] = pt(i, R + 26);
        const anchor = Math.abs(x - cx) < 10 ? "middle" : x > cx ? "start" : "end";
        const words = d.label.split(" ");
        const lines = words.length > 2 ? [words.slice(0, Math.ceil(words.length / 2)).join(" "), words.slice(Math.ceil(words.length / 2)).join(" ")] : [d.label];
        return (
          <text key={d.label} x={x} y={y - (lines.length - 1) * 6} textAnchor={anchor} className="fill-ink-300 text-[10px]">
            {lines.map((l, k) => (
              <tspan key={k} x={x} dy={k ? 12 : 0}>
                {l}
              </tspan>
            ))}
          </text>
        );
      })}
    </svg>
  );
}

export function BarList({ data }: { data: { label: string; value: number }[] }) {
  return (
    <div className="w-full space-y-3">
      {data.map((d, i) => (
        <div key={d.label}>
          <div className="flex justify-between text-xs">
            <span className="text-ink-200">{d.label}</span>
            <span className="font-mono" style={{ color: scoreColor(d.value) }}>
              {d.value.toFixed(1)}
            </span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/[0.06]">
            <motion.div
              className="h-full rounded-full"
              style={{ background: scoreColor(d.value) }}
              initial={{ width: 0 }}
              whileInView={{ width: `${d.value * 10}%` }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08, duration: 1, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ Score × difficulty timeline */
export function ScoreTimeline({ points }: { points: { seq: number; score: number; difficulty: number; topic: string; kind: string }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 640;
  const H = 220;
  const P = { l: 34, r: 16, t: 16, b: 30 };
  const iw = W - P.l - P.r;
  const ih = H - P.t - P.b;
  const n = points.length;
  const x = (i: number) => P.l + (n === 1 ? iw / 2 : (iw * i) / (n - 1));
  const y = (s: number) => P.t + ih - (ih * s) / 10;
  const path = points.map((p, i) => `${i ? "L" : "M"}${x(i)},${y(p.score)}`).join(" ");
  const area = `${path} L${x(n - 1)},${P.t + ih} L${x(0)},${P.t + ih} Z`;
  const bw = Math.min(26, iw / Math.max(1, n) / 2);

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
        <defs>
          <linearGradient id="tl-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="tl-line" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#a78bfa" />
            <stop offset="100%" stopColor="#22d3ee" />
          </linearGradient>
        </defs>
        {[0, 2.5, 5, 7.5, 10].map((g) => (
          <g key={g}>
            <line x1={P.l} x2={W - P.r} y1={y(g)} y2={y(g)} stroke="rgba(255,255,255,0.05)" />
            <text x={P.l - 8} y={y(g) + 3} textAnchor="end" className="fill-ink-500 text-[9px]">
              {g}
            </text>
          </g>
        ))}
        {/* difficulty bars */}
        {points.map((p, i) => (
          <motion.rect
            key={`d${p.seq}`}
            x={x(i) - bw / 2}
            width={bw}
            rx={4}
            initial={{ y: P.t + ih, height: 0 }}
            animate={{ y: y(p.difficulty * 2), height: (ih * p.difficulty * 2) / 10 }}
            transition={{ delay: 0.2 + i * 0.07, duration: 0.7 }}
            fill={p.kind === "follow_up" ? "rgba(251,191,36,0.13)" : "rgba(255,255,255,0.05)"}
          />
        ))}
        <motion.path d={area} fill="url(#tl-area)" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1, duration: 0.8 }} />
        <motion.path
          d={path}
          fill="none"
          stroke="url(#tl-line)"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.6, ease: [0.22, 1, 0.36, 1], delay: 0.3 }}
          style={{ filter: "drop-shadow(0 0 8px rgba(139,92,246,0.7))" }}
        />
        {points.map((p, i) => (
          <g key={p.seq} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} className="cursor-pointer">
            <rect x={x(i) - 16} y={P.t} width={32} height={ih} fill="transparent" />
            <motion.circle
              cx={x(i)}
              cy={y(p.score)}
              r={hover === i ? 7 : 5}
              fill="#0a0b12"
              stroke={scoreColor(p.score)}
              strokeWidth={2.5}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.6 + i * 0.12, type: "spring" }}
            />
            <text x={x(i)} y={H - 10} textAnchor="middle" className="fill-ink-400 text-[10px] font-mono">
              Q{p.seq}
            </text>
          </g>
        ))}
      </svg>
      {hover !== null && (
        <div
          className="glass-strong pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-lg px-3 py-2 text-xs"
          style={{ left: `${(x(hover) / W) * 100}%`, top: `${(y(points[hover].score) / H) * 100}%`, marginTop: -12 }}
        >
          <div className="text-white">{points[hover].topic}</div>
          <div className="mt-0.5 font-mono text-ink-300">
            score {points[hover].score.toFixed(1)} · level {points[hover].difficulty}
            {points[hover].kind === "follow_up" ? " · follow-up" : ""}
          </div>
        </div>
      )}
      <div className="mt-2 flex items-center gap-4 text-[11px] text-ink-400">
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded bg-gradient-to-r from-violet-400 to-cyan-400" /> score /10
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-2.5 rounded-sm bg-white/10" /> difficulty level
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-2.5 rounded-sm bg-amber-400/25" /> follow-up
        </span>
      </div>
    </div>
  );
}

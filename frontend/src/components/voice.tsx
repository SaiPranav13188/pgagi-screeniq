"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Bot, Languages, Mic, MicOff, PenLine, Square, Volume2, VolumeX } from "lucide-react";
import { useEffect, useState } from "react";
import { LANGUAGES } from "@/lib/speech";
import { cn } from "@/lib/utils";

export type AnswerMode = "live" | "write" | "speak";

export function AnswerModeToggle({ mode, onChange, voiceSupported }: { mode: AnswerMode; onChange: (m: AnswerMode) => void; voiceSupported: boolean }) {
  const opts = [
    { id: "live" as const, icon: Bot, label: "AI Interview" },
    { id: "write" as const, icon: PenLine, label: "Type" },
    { id: "speak" as const, icon: Mic, label: "Dictate" },
  ];
  return (
    <div className="inline-flex rounded-xl border border-white/[0.07] bg-black/20 p-1">
      {opts.map((o) => {
        const disabled = o.id !== "write" && !voiceSupported;
        return (
          <button
            key={o.id}
            type="button"
            disabled={disabled}
            title={
              disabled
                ? "Voice needs Chrome or Edge"
                : o.id === "live"
                  ? "Spoken conversation with the AI interviewer"
                  : o.id === "write"
                    ? "Type your answers"
                    : "Dictate your answer, edit, then submit"
            }
            onClick={() => onChange(o.id)}
            className={cn("relative flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-medium transition-colors", disabled && "cursor-not-allowed opacity-40")}
          >
            {mode === o.id && (
              <motion.span
                layoutId="answer-mode-pill"
                className="absolute inset-0 rounded-lg bg-gradient-to-b from-violet-500/30 to-indigo-500/20 ring-1 ring-violet-400/40"
                transition={{ type: "spring", stiffness: 420, damping: 32 }}
              />
            )}
            <o.icon className={cn("relative h-3.5 w-3.5", mode === o.id ? "text-violet-200" : "text-ink-400")} />
            <span className={cn("relative", mode === o.id ? "text-white" : "text-ink-400")}>{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/* --------------------------------------------------------------- recorder panel */
export function VoicePanel({
  listening,
  interim,
  levels,
  error,
  lang,
  onLang,
  onToggle,
  disabled,
  hasText,
}: {
  listening: boolean;
  interim: string;
  levels: number[];
  error: string | null;
  lang: string;
  onLang: (c: string) => void;
  onToggle: () => void;
  disabled?: boolean;
  hasText: boolean;
}) {
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    if (!listening) return;
    setSecs(0);
    const t = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [listening]);
  const level = levels.reduce((a, b) => a + b, 0) / Math.max(1, levels.length);

  return (
    <div className="relative flex flex-col items-center gap-5 px-6 pb-2 pt-7">
      {/* orb */}
      <div className="relative grid h-32 w-32 place-items-center">
        <AnimatePresence>
          {listening &&
            [0, 1, 2].map((i) => (
              <motion.span
                key={i}
                className="absolute inset-0 rounded-full border border-violet-400/40"
                initial={{ scale: 0.7, opacity: 0.6 }}
                animate={{ scale: 1.6, opacity: 0 }}
                exit={{ opacity: 0 }}
                transition={{ repeat: Infinity, duration: 2.2, delay: i * 0.7, ease: "easeOut" }}
              />
            ))}
        </AnimatePresence>
        <motion.div
          className="absolute inset-3 rounded-full blur-2xl"
          animate={{ opacity: listening ? 0.45 + level * 1.2 : 0.15, scale: listening ? 1 + level * 0.6 : 0.9 }}
          transition={{ type: "spring", stiffness: 200, damping: 15 }}
          style={{ background: "radial-gradient(circle, #8b5cf6, #22d3ee 70%)" }}
        />
        <motion.button
          type="button"
          onClick={onToggle}
          disabled={disabled}
          whileHover={{ scale: disabled ? 1 : 1.05 }}
          whileTap={{ scale: disabled ? 1 : 0.94 }}
          animate={{ scale: listening ? 1 + level * 0.25 : 1 }}
          aria-label={listening ? "Stop recording" : "Start recording"}
          className={cn(
            "relative grid h-20 w-20 place-items-center rounded-full border transition-colors duration-300 disabled:opacity-50",
            listening
              ? "border-rose-300/40 bg-gradient-to-br from-rose-500 to-fuchsia-600 shadow-[0_0_40px_rgba(244,63,94,0.6)]"
              : "border-white/15 bg-gradient-to-br from-violet-500 to-indigo-600 shadow-[0_0_40px_rgba(139,92,246,0.55)]",
          )}
        >
          <AnimatePresence mode="wait">
            {listening ? (
              <motion.span key="stop" initial={{ scale: 0, rotate: -90 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0 }}>
                <Square className="h-6 w-6 fill-white text-white" />
              </motion.span>
            ) : (
              <motion.span key="mic" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                <Mic className="h-8 w-8 text-white" />
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>
      </div>

      {/* waveform */}
      <div className="flex h-10 items-center gap-[3px]">
        {levels.map((v, i) => {
          const center = 1 - Math.abs(i - levels.length / 2) / (levels.length / 2);
          const h = listening ? Math.max(4, (0.25 + v) * 40 * (0.45 + center * 0.55)) : 4;
          return (
            <motion.span
              key={i}
              className="w-[3px] rounded-full"
              animate={{ height: h }}
              transition={{ type: "spring", stiffness: 500, damping: 28 }}
              style={{ background: listening ? `linear-gradient(180deg, #c4b5fd, #22d3ee)` : "rgba(255,255,255,0.12)" }}
            />
          );
        })}
      </div>

      <div className="flex min-h-[44px] max-w-xl flex-col items-center text-center">
        <AnimatePresence mode="wait">
          {error ? (
            <motion.p key="err" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex items-center gap-2 text-sm text-rose-300">
              <MicOff className="h-4 w-4" /> {error}
            </motion.p>
          ) : listening ? (
            <motion.div key="live" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="flex items-center justify-center gap-2 text-xs text-rose-200">
                <span className="h-2 w-2 animate-pulse rounded-full bg-rose-400" /> Listening · {Math.floor(secs / 60)}:{(secs % 60).toString().padStart(2, "0")}
              </div>
              <p className="mt-2 text-sm italic text-ink-300">{interim || "Speak naturally — your words appear in the answer box below."}</p>
            </motion.div>
          ) : (
            <motion.p key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-sm text-ink-400">
              {hasText ? "Tap the mic to keep talking, or edit the transcript below." : "Tap the mic and answer out loud."}
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      <label className="flex items-center gap-1.5 text-[11px] text-ink-400">
        <Languages className="h-3.5 w-3.5" />
        <select
          value={lang}
          onChange={(e) => onLang(e.target.value)}
          className="rounded-md border border-white/10 bg-ink-850 px-2 py-0.5 text-[11px] text-ink-200 outline-none focus:border-violet-400/50"
        >
          {LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>
              {l.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

/* --------------------------------------------------------------- listen button */
export function ListenButton({ speaking, supported, onClick }: { speaking: boolean; supported: boolean; onClick: () => void }) {
  if (!supported) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      title={speaking ? "Stop reading" : "Read the question aloud"}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs transition",
        speaking ? "border-violet-400/50 bg-violet-500/15 text-white" : "border-white/10 bg-white/[0.03] text-ink-200 hover:border-violet-400/40 hover:text-white",
      )}
    >
      {speaking ? <VolumeX className="h-3.5 w-3.5 text-violet-300" /> : <Volume2 className="h-3.5 w-3.5 text-violet-300" />}
      {speaking ? (
        <span className="flex items-end gap-[2px]">
          {[0, 1, 2, 3].map((i) => (
            <motion.span
              key={i}
              className="w-[2px] rounded-full bg-violet-300"
              animate={{ height: [3, 10, 5, 9, 3] }}
              transition={{ repeat: Infinity, duration: 0.9, delay: i * 0.12 }}
            />
          ))}
        </span>
      ) : (
        "Listen"
      )}
    </button>
  );
}

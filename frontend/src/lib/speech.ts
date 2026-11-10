"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/* Minimal typings for the Web Speech API (not in lib.dom for all TS versions). */
type SRAlternative = { transcript: string };
type SRResult = { isFinal: boolean; 0: SRAlternative; length: number };
type SREvent = { resultIndex: number; results: ArrayLike<SRResult> };
type SRErrorEvent = { error: string };
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: SREvent) => void) | null;
  onerror: ((e: SRErrorEvent) => void) | null;
  onend: (() => void) | null;
}

function getRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as Record<string, unknown>;
  return (w.SpeechRecognition || w.webkitSpeechRecognition || null) as (new () => SpeechRecognitionLike) | null;
}

export const LANGUAGES = [
  { code: "en-IN", label: "English (India)" },
  { code: "en-US", label: "English (US)" },
  { code: "en-GB", label: "English (UK)" },
];

/**
 * Speech-to-text via the browser's Web Speech API, plus a live microphone level
 * (Web Audio analyser) to drive the waveform. Final phrases are delivered through
 * `onFinal` so the caller can append them to the editable answer.
 */
export function useSpeechToText(onFinal: (text: string) => void) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [levels, setLevels] = useState<number[]>(() => Array(28).fill(0));
  const [lang, setLang] = useState("en-IN");

  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const wantRef = useRef(false); // user intent: keep listening across Chrome's silence timeouts
  const onFinalRef = useRef(onFinal);
  const audioRef = useRef<{ ctx: AudioContext; stream: MediaStream; raf: number } | null>(null);
  onFinalRef.current = onFinal;

  useEffect(() => {
    setSupported(!!getRecognitionCtor());
    try {
      const saved = localStorage.getItem("speech-lang");
      if (saved) setLang(saved);
      else if (navigator.language?.startsWith("en-US")) setLang("en-US");
    } catch {}
  }, []);

  const stopMeter = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    cancelAnimationFrame(a.raf);
    a.stream.getTracks().forEach((t) => t.stop());
    a.ctx.close().catch(() => {});
    audioRef.current = null;
    setLevels(Array(28).fill(0));
  }, []);

  const startMeter = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const ctx = new AudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      analyser.smoothingTimeConstant = 0.75;
      ctx.createMediaStreamSource(stream).connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(data);
        const bars = Array.from({ length: 28 }, (_, i) => (data[(i % (data.length - 2)) + 1] || 0) / 255);
        setLevels(bars);
        audioRef.current!.raf = requestAnimationFrame(tick);
      };
      audioRef.current = { ctx, stream, raf: requestAnimationFrame(tick) };
    } catch {
      /* the waveform is decorative; recognition itself reports permission errors */
    }
  }, []);

  const stop = useCallback(() => {
    wantRef.current = false;
    recRef.current?.stop();
    setListening(false);
    setInterim("");
    stopMeter();
  }, [stopMeter]);

  const start = useCallback(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      setError("Voice input isn't supported in this browser. Use Chrome or Edge.");
      return;
    }
    setError(null);
    const rec = new Ctor();
    rec.lang = lang;
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (e) => {
      let live = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        const text = r[0].transcript;
        if (r.isFinal) onFinalRef.current(text.trim());
        else live += text;
      }
      setInterim(live);
    };
    rec.onerror = (e) => {
      if (e.error === "no-speech" || e.error === "aborted") return;
      wantRef.current = false;
      setListening(false);
      stopMeter();
      setError(
        e.error === "not-allowed" || e.error === "service-not-allowed"
          ? "Microphone access was blocked. Allow it from the address bar and try again."
          : e.error === "network"
            ? "Speech service unreachable. Check your internet connection."
            : `Voice input error: ${e.error}`,
      );
    };
    rec.onend = () => {
      // Chrome ends recognition after a pause; restart while the user still wants to talk.
      if (wantRef.current) {
        try {
          rec.start();
          return;
        } catch {}
      }
      setListening(false);
      setInterim("");
    };
    recRef.current = rec;
    wantRef.current = true;
    try {
      rec.start();
      setListening(true);
      startMeter();
    } catch {
      setError("Could not start the microphone.");
    }
  }, [lang, startMeter, stopMeter]);

  const changeLang = useCallback(
    (code: string) => {
      setLang(code);
      try {
        localStorage.setItem("speech-lang", code);
      } catch {}
      if (wantRef.current) stop();
    },
    [stop],
  );

  useEffect(
    () => () => {
      wantRef.current = false;
      recRef.current?.abort();
      stopMeter();
    },
    [stopMeter],
  );

  return { supported, listening, interim, error, levels, lang, setLang: changeLang, start, stop, toggle: () => (listening ? stop() : start()) };
}

/** Make LLM text pleasant to hear: drop LaTeX / markdown markup. */
export function speakable(text: string) {
  return text
    .replace(/\$([^$]+)\$/g, "$1")
    .replace(/[*`#>]/g, "")
    .replace(/[\\{}_^]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function pickVoice(lang: string) {
  const voices = window.speechSynthesis.getVoices();
  const natural = /natural|neural|google|online|premium|enhanced/i;
  return (
    voices.find((v) => v.lang === lang && natural.test(v.name)) ||
    voices.find((v) => v.lang.startsWith("en") && natural.test(v.name)) ||
    voices.find((v) => v.lang === lang) ||
    voices.find((v) => v.lang.startsWith("en")) ||
    null
  );
}

/**
 * Text-to-speech for the AI interviewer.
 *
 * - Long text is split into sentences and queued, which avoids Chrome's habit of cutting
 *   utterances off after ~15 seconds.
 * - `progress` follows word boundaries (where the voice reports them) to drive live captions.
 * - `speak(text, lang, onEnd)` calls `onEnd` exactly once — on completion, on error, on
 *   cancel-by-replacement it is NOT called — and a watchdog covers browsers whose `onend`
 *   never fires.
 */
export function useTextToSpeech() {
  const [supported, setSupported] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [text, setText] = useState("");
  const [progress, setProgress] = useState(0);
  const tokenRef = useRef(0);
  const watchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const ok = typeof window !== "undefined" && "speechSynthesis" in window;
    setSupported(ok);
    if (!ok) return;
    window.speechSynthesis.getVoices(); // voices load lazily in Chrome
    const warm = () => window.speechSynthesis.getVoices();
    window.speechSynthesis.addEventListener?.("voiceschanged", warm);
    return () => {
      window.speechSynthesis.removeEventListener?.("voiceschanged", warm);
      window.speechSynthesis.cancel();
    };
  }, []);

  const cancel = useCallback(() => {
    tokenRef.current++;
    if (watchdogRef.current) clearTimeout(watchdogRef.current);
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    setSpeaking(false);
  }, []);

  const speak = useCallback((raw: string, lang = "en-IN", onEnd?: () => void) => {
    const clean = speakable(raw);
    if (typeof window === "undefined" || !("speechSynthesis" in window) || !clean) {
      onEnd?.();
      return;
    }
    const synth = window.speechSynthesis;
    synth.cancel();
    if (watchdogRef.current) clearTimeout(watchdogRef.current);
    const token = ++tokenRef.current;
    let done = false;
    const finish = () => {
      if (done || token !== tokenRef.current) return;
      done = true;
      if (watchdogRef.current) clearTimeout(watchdogRef.current);
      setSpeaking(false);
      setProgress(clean.length);
      onEnd?.();
    };

    const sentences = clean.match(/[^.!?]+[.!?]+["')\]]*\s*|[^.!?]+$/g) ?? [clean];
    const voice = pickVoice(lang);
    let offset = 0;
    sentences.forEach((s, i) => {
      const start = offset;
      offset += s.length;
      const u = new SpeechSynthesisUtterance(s.trim());
      if (voice) u.voice = voice;
      u.lang = voice?.lang || lang;
      u.rate = 1.02;
      u.onstart = () => token === tokenRef.current && setProgress(start);
      u.onboundary = (e) => token === tokenRef.current && setProgress(start + e.charIndex + (e.charLength || 0));
      if (i === sentences.length - 1) u.onend = finish;
      u.onerror = (e) => {
        if (e.error !== "interrupted" && e.error !== "canceled") finish();
      };
      synth.speak(u);
    });

    setText(clean);
    setProgress(0);
    setSpeaking(true);
    // ~2.6 words/second plus slack; covers engines that never fire `onend`.
    const words = clean.split(/\s+/).length;
    watchdogRef.current = setTimeout(finish, (words / 2.6) * 1000 + 4000);
  }, []);

  return { supported, speaking, text, progress, speak, cancel };
}

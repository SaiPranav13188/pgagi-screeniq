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

/** Text-to-speech for reading questions aloud. */
export function useTextToSpeech() {
  const [supported, setSupported] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  useEffect(() => {
    setSupported(typeof window !== "undefined" && "speechSynthesis" in window);
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    };
  }, []);

  const speak = useCallback((text: string, lang = "en-IN") => {
    if (!("speechSynthesis" in window)) return;
    const synth = window.speechSynthesis;
    synth.cancel();
    // Strip LaTeX-ish markup the LLM may include so it is read naturally.
    const clean = text.replace(/\$([^$]+)\$/g, "$1").replace(/[\\{}_^]/g, " ");
    const u = new SpeechSynthesisUtterance(clean);
    const voices = synth.getVoices();
    u.voice =
      voices.find((v) => v.lang === lang && /natural|google|online/i.test(v.name)) ||
      voices.find((v) => v.lang === lang) ||
      voices.find((v) => v.lang.startsWith("en")) ||
      null;
    u.rate = 1;
    u.pitch = 1;
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    setSpeaking(true);
    synth.speak(u);
  }, []);

  const cancel = useCallback(() => {
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    setSpeaking(false);
  }, []);

  return { supported, speaking, speak, cancel };
}

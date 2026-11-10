import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const BOOK_COLORS: Record<string, string> = {
  mitchell: "#8b5cf6",
  ml_beginners: "#22d3ee",
  intro_ml_python: "#34d399",
  master_ml_algorithms: "#fbbf24",
  bishop_prml: "#f472b6",
  ai_ml_dl: "#60a5fa",
};

export const BOOK_SHORT: Record<string, string> = {
  mitchell: "Mitchell",
  ml_beginners: "ML for Beginners",
  intro_ml_python: "Intro ML w/ Python",
  master_ml_algorithms: "Master ML Algorithms",
  bishop_prml: "Bishop PRML",
  ai_ml_dl: "AI · ML · DL",
};

export function scoreColor(score: number | null | undefined, outOf = 10) {
  if (score == null) return "#6b7190";
  const s = (score / outOf) * 10;
  if (s >= 8) return "#34d399";
  if (s >= 6) return "#22d3ee";
  if (s >= 4) return "#fbbf24";
  return "#fb7185";
}

export function formatDuration(sec: number | null | undefined) {
  if (!sec) return "–";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m ? `${m}m ${s.toString().padStart(2, "0")}s` : `${s}s`;
}

export const DIFFICULTY_LABEL = ["", "Recall", "Explain", "Apply", "Analyse", "Expert"];

export const QTYPE_LABEL: Record<string, string> = {
  conceptual: "Conceptual",
  applied: "Applied",
  scenario: "Scenario",
  comparison: "Comparison",
  debugging: "Debugging",
  design: "Design",
};

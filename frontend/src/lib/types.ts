export type RoleBook = {
  id: string;
  title: string;
  author: string;
  level: string;
  color: string;
  tier: "primary" | "advanced";
  ingested: boolean;
  chunks: number;
};

export type Role = {
  id: string;
  title: string;
  tagline: string;
  description: string;
  books: RoleBook[];
  competencies: { id: string; name: string }[];
};

export type Skill = { name: string; category: string; evidence?: string | null };

export type Profile = {
  name: string | null;
  email: string | null;
  headline: string | null;
  seniority: "student" | "junior" | "mid" | "senior" | "lead";
  years_experience: number | null;
  summary: string;
  skills: Skill[];
  domains: string[];
  ml_concepts: string[];
  projects: { title: string; summary: string; technologies: string[] }[];
  education: string[];
  strength: "emerging" | "solid" | "strong";
  extraction_method: string;
  word_count: number;
};

export type PlannedTopic = {
  index: number;
  competency_id: string;
  title: string;
  focus: string;
  rationale: string;
  resume_anchor: string | null;
  difficulty: number;
  question_style: string;
  queries: string[];
};

export type Plan = {
  role_id: string;
  books: string[];
  calibration: { seniority: string; base_difficulty: number; advanced_unlocked: boolean; rationale: string };
  alignment: { competency_id: string; name: string; score: number; matched: string[] }[];
  topics: PlannedTopic[];
  generator: string;
};

export type TraceChunk = {
  id: string;
  book_id: string;
  book_title: string;
  section: string;
  page_start: number;
  page_end: number;
  text: string;
  dense_score: number;
  dense_rank: number | null;
  bm25_rank: number | null;
  rrf_score: number;
  matched_queries: string[];
  cited: boolean;
};

export type Trace = {
  queries: string[];
  books: string[];
  chunks: TraceChunk[];
  grounding_chunk_ids: string[];
  prompt_version: string;
  retrieval_ms: number;
  generation_ms: number;
};

export type Evaluation = {
  score: number;
  verdict: "excellent" | "strong" | "adequate" | "partial" | "weak" | "no_answer";
  covered_points: string[];
  missed_points: string[];
  strengths: string[];
  improvements: string[];
  misconceptions: string[];
  feedback: string;
  evaluator: string;
  decision?: Decision;
};

export type Decision = {
  action: "follow_up" | "next_topic" | "complete";
  label: string;
  reason: string;
  difficulty_offset: number;
};

export type Question = {
  id: string;
  seq: number;
  topic_index: number;
  topic: string;
  kind: "primary" | "follow_up";
  parent_id: string | null;
  text: string;
  question_type: string;
  difficulty: number;
  resume_link: string | null;
  rationale: string | null;
  generator: string;
  status: "asked" | "answered" | "skipped";
  created_at: string;
  trace: Trace | null;
  answer: {
    text: string;
    time_taken_seconds: number | null;
    created_at: string;
    decision?: Decision | null;
    score?: number;
    evaluation?: Evaluation;
    evaluator?: string;
  } | null;
  expected_points: string[] | null;
};

export type Progress = {
  topics_total: number;
  topics_done: number;
  questions_asked: number;
  answered: number;
  skipped: number;
  follow_ups: number;
  percent: number;
};

export type Session = {
  id: string;
  role_id: string;
  role_title: string;
  status: "created" | "planned" | "in_progress" | "completed";
  mode: "interview" | "practice";
  target_questions: number;
  candidate_name: string | null;
  resume_filename: string | null;
  profile: Profile | null;
  plan: Plan | null;
  llm_mode: string;
  follow_ups_used: number;
  difficulty_offset: number;
  created_at: string;
  completed_at: string | null;
  questions: Question[];
  current_question_id: string | null;
  progress: Progress;
};

export type SessionSummary = {
  id: string;
  role_id: string;
  role_title: string;
  candidate_name: string | null;
  status: string;
  created_at: string;
  questions: number;
  overall_score: number | null;
};

export type AnswerResult = {
  question: Question;
  evaluation: Evaluation | null;
  decision: Decision;
  progress: Progress;
};

export type ReportTopic = {
  index: number;
  title: string;
  competency: string;
  score: number;
  questions: number;
  difficulty: number;
  resume_anchor: string | null;
  claim_status: "verified" | "partially verified" | "not demonstrated" | null;
};

export type Report = {
  session_id: string;
  generator: string;
  created_at: string;
  overall_score: number;
  signal: { label: string; tone: "excellent" | "good" | "mixed" | "weak" };
  answered: number;
  skipped: number;
  follow_ups: number;
  avg_difficulty: number;
  total_time_seconds: number;
  avg_time_seconds: number | null;
  topics: ReportTopic[];
  question_types: Record<string, number>;
  timeline: { seq: number; topic: string; kind: string; difficulty: number; score: number; verdict: string; decision: string }[];
  claims: ReportTopic[];
  reading_list: { topic: string; book_id: string; book_title: string; author: string; section: string; pages: string }[];
  calibration: Plan["calibration"];
  books_used: { id: string; title: string }[];
  narrative: { headline?: string; summary?: string; strengths?: string[]; growth_areas?: string[]; next_steps?: string[] };
};

export type EventLog = {
  id: number;
  stage: string;
  message: string;
  data: Record<string, unknown> | null;
  duration_ms: number | null;
  created_at: string;
};

export type Health = {
  status: string;
  database: boolean;
  knowledge_base: { chunks: number; books: number };
  llm: { provider: string; enabled: boolean; models: string[]; active_model: string | null };
};

export type KnowledgeBase = {
  embedding_model: string;
  total_chunks: number;
  chunking: { target_words: number; max_words: number; overlap_sentences: number };
  retrieval: { candidates: number; top_k: number; rrf_k: number; mmr_lambda: number; min_dense_score: number };
  books: {
    id: string;
    title: string;
    author: string;
    level: string;
    color: string;
    available: boolean;
    chunks?: number;
    pages?: number;
    avg_words?: number;
    sections?: number;
    seconds?: number;
  }[];
};

export type SearchResult = {
  query: string;
  books: string[];
  elapsed_ms: number;
  candidates_considered: number;
  chunks: TraceChunk[];
};

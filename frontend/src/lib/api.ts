import type {
  AnswerResult,
  EventLog,
  Health,
  KnowledgeBase,
  Question,
  Report,
  Role,
  SearchResult,
  Session,
  SessionSummary,
} from "./types";

export const API_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/$/, "") + "/api/v1";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: init?.body instanceof FormData ? init?.headers : { "Content-Type": "application/json", ...init?.headers },
      cache: "no-store",
    });
  } catch {
    throw new ApiError("Can't reach the API server. Is the backend running on port 8000?", 0, "network_error");
  }
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const err = body?.error;
    throw new ApiError(err?.message || `Request failed (${res.status})`, res.status, err?.code || "error", err?.details);
  }
  return body as T;
}

export const api = {
  health: () => request<Health>("/health"),
  roles: () => request<Role[]>("/roles"),
  knowledgeBase: () => request<KnowledgeBase>("/knowledge-base"),
  search: (query: string, role_id?: string, top_k = 5) =>
    request<SearchResult>("/knowledge-base/search", { method: "POST", body: JSON.stringify({ query, role_id, top_k }) }),

  sessions: () => request<SessionSummary[]>("/sessions"),
  createSession: (form: FormData) => request<Session>("/sessions", { method: "POST", body: form }),
  session: (id: string) => request<Session>(`/sessions/${id}`),
  plan: (id: string) => request<Session>(`/sessions/${id}/plan`, { method: "POST" }),
  nextQuestion: (id: string) => request<Question | null>(`/sessions/${id}/questions/next`, { method: "POST" }),
  answer: (id: string, qid: string, answer: string, time_taken_seconds: number) =>
    request<AnswerResult>(`/sessions/${id}/questions/${qid}/answer`, {
      method: "POST",
      body: JSON.stringify({ answer, time_taken_seconds }),
    }),
  skip: (id: string, qid: string, time_taken_seconds: number) =>
    request<AnswerResult>(`/sessions/${id}/questions/${qid}/skip`, {
      method: "POST",
      body: JSON.stringify({ time_taken_seconds }),
    }),
  complete: (id: string) => request<Session>(`/sessions/${id}/complete`, { method: "POST" }),
  report: (id: string) => request<Report>(`/sessions/${id}/report`),
  events: (id: string) => request<EventLog[]>(`/sessions/${id}/events`),
  deleteSession: (id: string) => request<void>(`/sessions/${id}`, { method: "DELETE" }),
};

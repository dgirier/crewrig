/// <reference lib="dom" />
// Typed access to the local JSON API.

import type {
  AttemptAnswer,
  AttemptResult,
  Lesson,
  ProgressResponse,
  SddContent,
  Theme,
  ThemesResponse,
} from "../src/types.ts";

type Listener = (persisted: boolean) => void;
const listeners: Listener[] = [];

/** Register a callback told whether results are currently being saved. */
export function onPersistence(listener: Listener): void {
  listeners.push(listener);
}

function report(persisted: boolean): void {
  for (const l of listeners) l(persisted);
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as T;
}

const JSON_HEADERS = { "Content-Type": "application/json" };

export async function getThemes(): Promise<ThemesResponse> {
  const data = await request<ThemesResponse>("/api/themes");
  report(data.persisted);
  return data;
}

export async function getTheme(id: string): Promise<Theme & { bestStars: number }> {
  return request(`/api/themes/${encodeURIComponent(id)}`);
}

export async function postAttempt(id: string, answers: AttemptAnswer[]): Promise<AttemptResult> {
  const data = await request<AttemptResult>(`/api/themes/${encodeURIComponent(id)}/attempts`, {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ answers }),
  });
  report(data.persisted);
  return data;
}

export async function getLessons(): Promise<Lesson[]> {
  return request("/api/lessons");
}

export async function getSdd(): Promise<SddContent> {
  return request("/api/sdd");
}

export async function getProgress(): Promise<ProgressResponse> {
  const data = await request<ProgressResponse>("/api/lessons/progress");
  report(data.persisted);
  return data;
}

export async function completeLesson(lessonId: string): Promise<ProgressResponse> {
  const data = await request<ProgressResponse>("/api/lessons/progress", {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ lessonId }),
  });
  report(data.persisted);
  return data;
}

export async function resetResults(): Promise<void> {
  const data = await request<{ persisted: boolean }>("/api/results", { method: "DELETE" });
  report(data.persisted);
}

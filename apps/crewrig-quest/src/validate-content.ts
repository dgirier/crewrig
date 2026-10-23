// Content validation (spec 0278 R13). Pure checks over parsed JSON plus a
// filesystem helper; also runnable as a CLI:
//   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON apps/crewrig-quest/src/validate-content.ts
// Exit: 0 valid, 1 invalid content, 2 unreadable content.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Lesson, SddContent, Theme } from "./types.ts";

export const QUEST_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const REPO_ROOT = path.resolve(QUEST_ROOT, "..", "..");
export const CONTENT_DIR = path.join(QUEST_ROOT, "content");

export type Json = unknown;

/** Content that parsed but failed validation. */
export class ContentError extends Error {}

export function isRecord(v: Json): v is Record<string, Json> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function nonEmptyString(v: Json): v is string {
  return typeof v === "string" && v.trim() !== "";
}

/** Errors found in the parsed content of one theme; each names the theme and, when relevant, the question. */
export function validateTheme(raw: Json, where: string): string[] {
  if (!isRecord(raw)) return [`${where}: the theme is not an object`];
  const errors: string[] = [];
  const themeId = nonEmptyString(raw.id) ? raw.id : where;
  const at = `theme "${themeId}"`;
  if (!nonEmptyString(raw.id)) errors.push(`${at}: missing id`);
  if (!nonEmptyString(raw.title)) errors.push(`${at}: missing title`);
  if (!nonEmptyString(raw.description)) errors.push(`${at}: missing description`);
  const questions = raw.questions;
  if (!Array.isArray(questions) || questions.length === 0) {
    errors.push(`${at}: the theme has no questions`);
    return errors;
  }
  const seen = new Set<string>();
  questions.forEach((q: Json, i: number) => {
    const qid = isRecord(q) && nonEmptyString(q.id) ? q.id : `#${i + 1}`;
    const qat = `${at}, question "${qid}"`;
    if (!isRecord(q)) {
      errors.push(`${qat}: the question is not an object`);
      return;
    }
    if (!nonEmptyString(q.id)) errors.push(`${qat}: missing id`);
    else if (seen.has(q.id)) errors.push(`${qat}: duplicate question id`);
    else seen.add(q.id);
    if (!nonEmptyString(q.text)) errors.push(`${qat}: missing text`);
    if (!nonEmptyString(q.explanation)) errors.push(`${qat}: missing explanation`);
    if (!nonEmptyString(q.source)) errors.push(`${qat}: missing source`);
    const choices = q.choices;
    if (!Array.isArray(choices) || choices.length < 2) {
      errors.push(`${qat}: fewer than two choices`);
    } else {
      if (!choices.every(nonEmptyString)) errors.push(`${qat}: a choice is empty`);
      if (new Set(choices).size !== choices.length) errors.push(`${qat}: duplicate choices`);
    }
    const answer = q.answer;
    const count = Array.isArray(choices) ? choices.length : 0;
    if (Array.isArray(answer)) {
      errors.push(`${qat}: exactly one correct answer is required, found ${answer.length}`);
    } else if (!Number.isInteger(answer) || (answer as number) < 0 || (answer as number) >= count) {
      errors.push(`${qat}: answer must be an integer index of exactly one choice`);
    }
  });
  return errors;
}

/** Errors across a set of themes, including duplicate theme ids. */
export function validateThemes(themes: Json[]): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();
  themes.forEach((t, i) => {
    errors.push(...validateTheme(t, `theme file #${i + 1}`));
    if (isRecord(t) && nonEmptyString(t.id)) {
      if (seen.has(t.id)) errors.push(`theme "${t.id}": duplicate theme id`);
      seen.add(t.id);
    }
  });
  if (themes.length === 0) errors.push("no quiz theme found");
  return errors;
}

export function validateLessons(raw: Json): string[] {
  if (!Array.isArray(raw) || raw.length === 0) return ["lessons: the learning path has no lesson"];
  const errors: string[] = [];
  const seen = new Set<string>();
  raw.forEach((l: Json, i: number) => {
    const id = isRecord(l) && nonEmptyString(l.id) ? l.id : `#${i + 1}`;
    const at = `lesson "${id}"`;
    if (!isRecord(l)) {
      errors.push(`${at}: the lesson is not an object`);
      return;
    }
    if (!nonEmptyString(l.id)) errors.push(`${at}: missing id`);
    else if (seen.has(l.id)) errors.push(`${at}: duplicate lesson id`);
    else seen.add(l.id);
    if (!nonEmptyString(l.title)) errors.push(`${at}: missing title`);
    if (!nonEmptyString(l.summary)) errors.push(`${at}: missing summary`);
    if (!Array.isArray(l.body) || l.body.length === 0) errors.push(`${at}: empty body`);
    if (!Array.isArray(l.sources) || l.sources.length === 0 || !l.sources.every(nonEmptyString)) {
      errors.push(`${at}: at least one source document is required`);
    }
  });
  return errors;
}

export function validateSdd(raw: Json): string[] {
  if (!isRecord(raw)) return ["sdd: the section is not an object"];
  const errors: string[] = [];
  for (const key of ["stages", "findingClasses", "termination", "tiers", "sources"]) {
    const v = raw[key];
    if (!Array.isArray(v) || v.length === 0) errors.push(`sdd: "${key}" is missing or empty`);
  }
  for (const key of ["title", "intro", "disambiguation", "guardrail"]) {
    if (!nonEmptyString(raw[key])) errors.push(`sdd: "${key}" is missing`);
  }
  return errors;
}

/** Source documents named by the content that do not exist under `repoRoot`. */
export function missingSources(sources: string[], repoRoot: string): string[] {
  return sources.filter((s) => !existsSync(path.join(repoRoot, s)));
}

export interface LoadedContent {
  themes: Theme[];
  lessons: Lesson[];
  sdd: SddContent;
}

function readJson(file: string): Json {
  return JSON.parse(readFileSync(file, "utf8")) as Json;
}

/** Load and validate every content file; throws an Error listing every problem. */
export function loadContent(dir: string = CONTENT_DIR): LoadedContent {
  const themeDir = path.join(dir, "themes");
  const files = readdirSync(themeDir)
    .filter((f) => f.endsWith(".json"))
    .sort();
  const rawThemes = files.map((f) => readJson(path.join(themeDir, f)));
  const rawLessons = readJson(path.join(dir, "lessons.json"));
  const rawSdd = readJson(path.join(dir, "sdd.json"));
  const errors = [
    ...validateThemes(rawThemes),
    ...validateLessons(rawLessons),
    ...validateSdd(rawSdd),
  ];
  if (errors.length > 0) throw new ContentError(errors.join("\n"));
  return {
    themes: rawThemes as Theme[],
    lessons: rawLessons as Lesson[],
    sdd: rawSdd as SddContent,
  };
}

/** Every source path cited anywhere in the content. */
export function allSources(content: LoadedContent): string[] {
  const out = new Set<string>();
  for (const t of content.themes) for (const q of t.questions) out.add(q.source);
  for (const l of content.lessons) for (const s of l.sources) out.add(s);
  for (const s of content.sdd.sources) out.add(s);
  return [...out].sort();
}

function main(): number {
  let content: LoadedContent;
  try {
    content = loadContent();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`content invalid:\n${message}\n`);
    return err instanceof ContentError ? 1 : 2;
  }
  const missing = missingSources(allSources(content), REPO_ROOT);
  if (missing.length > 0) {
    process.stderr.write(`content cites missing documents:\n${missing.join("\n")}\n`);
    return 1;
  }
  const questions = content.themes.reduce((n, t) => n + t.questions.length, 0);
  process.stdout.write(
    `content valid: ${content.themes.length} themes, ${questions} questions, ${content.lessons.length} lessons\n`,
  );
  return 0;
}

if (import.meta.main) process.exitCode = main();

// Shared data shapes of CrewRig Quest. Imported with `import type` by the
// browser code too, so this file never reaches the browser as JavaScript.

/** Audience level of a lesson or a question (spec 0278 R16). */
export type Level = "discovery" | "team" | "contributor";

/** A multiple-choice question; the shape shared by quiz and lesson-check questions. */
export interface CheckQuestion {
  id: string;
  text: string;
  choices: string[];
  /** Index of the single correct choice. */
  answer: number;
  explanation: string;
  /** Repository-relative path of the document the question is drawn from. */
  source: string;
}

export interface Question extends CheckQuestion {
  level: Level;
}

export interface Theme {
  id: string;
  title: string;
  description: string;
  questions: Question[];
}

export interface LessonBlock {
  /** `p` paragraph, `ul` bullet list, `ol` numbered list, `note` highlighted aside. */
  type: "p" | "ul" | "ol" | "note";
  text?: string;
  items?: string[];
}

/** One step of a guided exercise: a real action or command taken from the framework documentation. */
export interface ChecklistStep {
  id: string;
  text: string;
  /** The command, verbatim from `source`; the game never runs it. */
  command?: string;
  /** Repository-relative path of the document the step comes from. */
  source: string;
}

export interface Lesson {
  id: string;
  level: Level;
  title: string;
  summary: string;
  body: LessonBlock[];
  /** Identifier of a diagram rendered by `web/diagrams.ts`. */
  diagram?: string;
  sources: string[];
  /** Short check of two to three questions, answered before the lesson can be completed (R17). */
  check: CheckQuestion[];
  /** Guided exercise of the setup lessons (R18). */
  checklist?: ChecklistStep[];
}

export interface SddStage {
  id: string;
  title: string;
  question: string;
  description: string;
}

export interface SddFindingClass {
  id: string;
  target: string;
  meaning: string;
  example: string;
}

export interface SddTier {
  id: string;
  team: string;
  planRevisionCap: number;
  note: string;
}

export interface SddContent {
  title: string;
  intro: string;
  stages: SddStage[];
  findingClasses: SddFindingClass[];
  disambiguation: string;
  termination: string[];
  guardrail: string;
  tiers: SddTier[];
  sources: string[];
}

export interface ThemeSummary {
  id: string;
  title: string;
  description: string;
  questionCount: number;
  bestStars: number;
}

export interface ThemesResponse {
  persisted: boolean;
  themes: ThemeSummary[];
}

export interface AttemptAnswer {
  questionId: string;
  choice: number;
}

export interface AttemptResult {
  correct: number;
  total: number;
  stars: number;
  previousBest: number;
  bestStars: number;
  persisted: boolean;
}

export interface CheckRecord {
  correct: number;
  total: number;
}

export interface ProgressResponse {
  persisted: boolean;
  completed: string[];
  total: number;
  /** Lessons whose check was answered, with the last result. */
  checked: Record<string, CheckRecord>;
  /** Ticked checklist step ids, per lesson id. */
  ticks: Record<string, string[]>;
}

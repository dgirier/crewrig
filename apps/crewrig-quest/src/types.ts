// Shared data shapes of CrewRig Quest. Imported with `import type` by the
// browser code too, so this file never reaches the browser as JavaScript.

export interface Question {
  id: string;
  text: string;
  choices: string[];
  /** Index of the single correct choice. */
  answer: number;
  explanation: string;
  /** Repository-relative path of the document the question is drawn from. */
  source: string;
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

export interface Lesson {
  id: string;
  title: string;
  summary: string;
  body: LessonBlock[];
  /** Identifier of a diagram rendered by `web/diagrams.ts`. */
  diagram?: string;
  sources: string[];
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

export interface ProgressResponse {
  persisted: boolean;
  completed: string[];
  total: number;
}

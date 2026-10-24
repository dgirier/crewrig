// Local results database: a single SQLite file written through `node:sqlite`.
// When the file cannot be opened or written the store keeps results in memory
// for the session and reports `persisted: false` (spec 0278 R14).

import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { CheckRecord } from "./types.ts";

interface MemoryAttempt {
  themeId: string;
  stars: number;
}

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS attempts (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    theme_id   TEXT    NOT NULL,
    correct    INTEGER NOT NULL,
    total      INTEGER NOT NULL,
    stars      INTEGER NOT NULL,
    created_at TEXT    NOT NULL
  );
  CREATE INDEX IF NOT EXISTS attempts_theme ON attempts (theme_id);
  CREATE TABLE IF NOT EXISTS lesson_progress (
    lesson_id    TEXT PRIMARY KEY,
    completed_at TEXT NOT NULL
  );
  -- Added after the first release (additive only: older files stay valid).
  CREATE TABLE IF NOT EXISTS lesson_checks (
    lesson_id   TEXT PRIMARY KEY,
    correct     INTEGER NOT NULL,
    total       INTEGER NOT NULL,
    answered_at TEXT    NOT NULL
  );
  CREATE TABLE IF NOT EXISTS checklist_ticks (
    lesson_id TEXT NOT NULL,
    step_id   TEXT NOT NULL,
    ticked_at TEXT NOT NULL,
    PRIMARY KEY (lesson_id, step_id)
  );
`;

export class QuestStore {
  #db: DatabaseSync | null;
  readonly #memoryAttempts: MemoryAttempt[] = [];
  readonly #memoryLessons = new Set<string>();
  readonly #memoryChecks = new Map<string, CheckRecord>();
  /** Ticked steps as `lessonId\u0000stepId`. */
  readonly #memoryTicks = new Set<string>();
  /** Why the database is unavailable, or null when it is open. */
  readonly openError: string | null;

  private constructor(db: DatabaseSync | null, openError: string | null) {
    this.#db = db;
    this.openError = openError;
  }

  /** Open (creating if needed) the database at `file`; never throws. */
  static open(file: string): QuestStore {
    try {
      mkdirSync(path.dirname(file), { recursive: true });
      const db = new DatabaseSync(file);
      db.exec(SCHEMA);
      return new QuestStore(db, null);
    } catch (err) {
      return new QuestStore(null, err instanceof Error ? err.message : String(err));
    }
  }

  /** True while results are written to the database file. */
  get persisted(): boolean {
    return this.#db !== null;
  }

  #degrade(): void {
    try {
      this.#db?.close();
    } catch {
      // The handle is already unusable; nothing more to release.
    }
    this.#db = null;
  }

  /** Best stars per theme id. */
  bestByTheme(): Map<string, number> {
    const best = new Map<string, number>();
    const db = this.#db;
    if (db !== null) {
      try {
        const rows = db
          .prepare("SELECT theme_id, MAX(stars) AS best FROM attempts GROUP BY theme_id")
          .all();
        for (const row of rows) best.set(String(row.theme_id), Number(row.best));
        return best;
      } catch {
        this.#degrade();
      }
    }
    for (const a of this.#memoryAttempts) {
      best.set(a.themeId, Math.max(best.get(a.themeId) ?? 0, a.stars));
    }
    return best;
  }

  bestStars(themeId: string): number {
    return this.bestByTheme().get(themeId) ?? 0;
  }

  /** Record an attempt. The best score is the maximum over all attempts, so it never decreases. */
  recordAttempt(themeId: string, correct: number, total: number, stars: number): boolean {
    const db = this.#db;
    if (db !== null) {
      try {
        db.prepare(
          "INSERT INTO attempts (theme_id, correct, total, stars, created_at) VALUES (?, ?, ?, ?, ?)",
        ).run(themeId, correct, total, stars, new Date().toISOString());
        return true;
      } catch {
        this.#degrade();
      }
    }
    this.#memoryAttempts.push({ themeId, stars });
    return false;
  }

  completedLessons(): string[] {
    const db = this.#db;
    if (db !== null) {
      try {
        const rows = db
          .prepare("SELECT lesson_id FROM lesson_progress ORDER BY completed_at")
          .all();
        return rows.map((r) => String(r.lesson_id));
      } catch {
        this.#degrade();
      }
    }
    return [...this.#memoryLessons];
  }

  completeLesson(lessonId: string): boolean {
    const db = this.#db;
    if (db !== null) {
      try {
        db.prepare(
          "INSERT OR IGNORE INTO lesson_progress (lesson_id, completed_at) VALUES (?, ?)",
        ).run(lessonId, new Date().toISOString());
        return true;
      } catch {
        this.#degrade();
      }
    }
    this.#memoryLessons.add(lessonId);
    return false;
  }

  /** Record (or replace, on a retry) the result of a lesson check. */
  recordCheck(lessonId: string, correct: number, total: number): boolean {
    const db = this.#db;
    if (db !== null) {
      try {
        db.prepare(
          "INSERT OR REPLACE INTO lesson_checks (lesson_id, correct, total, answered_at) VALUES (?, ?, ?, ?)",
        ).run(lessonId, correct, total, new Date().toISOString());
        return true;
      } catch {
        this.#degrade();
      }
    }
    this.#memoryChecks.set(lessonId, { correct, total });
    return false;
  }

  /** Last check result per lesson id. */
  checks(): Map<string, CheckRecord> {
    const db = this.#db;
    if (db !== null) {
      try {
        const rows = db.prepare("SELECT lesson_id, correct, total FROM lesson_checks").all();
        return new Map(
          rows.map((r) => [
            String(r.lesson_id),
            { correct: Number(r.correct), total: Number(r.total) },
          ]),
        );
      } catch {
        this.#degrade();
      }
    }
    return new Map(this.#memoryChecks);
  }

  hasCheck(lessonId: string): boolean {
    return this.checks().has(lessonId);
  }

  /** Tick or untick one checklist step. The game only remembers it; nothing is executed. */
  setTick(lessonId: string, stepId: string, ticked: boolean): boolean {
    const db = this.#db;
    if (db !== null) {
      try {
        if (ticked) {
          db.prepare(
            "INSERT OR IGNORE INTO checklist_ticks (lesson_id, step_id, ticked_at) VALUES (?, ?, ?)",
          ).run(lessonId, stepId, new Date().toISOString());
        } else {
          db.prepare("DELETE FROM checklist_ticks WHERE lesson_id = ? AND step_id = ?").run(
            lessonId,
            stepId,
          );
        }
        return true;
      } catch {
        this.#degrade();
      }
    }
    const key = `${lessonId}\u0000${stepId}`;
    if (ticked) this.#memoryTicks.add(key);
    else this.#memoryTicks.delete(key);
    return false;
  }

  /** Ticked step ids per lesson id. */
  ticks(): Map<string, string[]> {
    const out = new Map<string, string[]>();
    const add = (lesson: string, step: string): void => {
      out.set(lesson, [...(out.get(lesson) ?? []), step]);
    };
    const db = this.#db;
    if (db !== null) {
      try {
        const rows = db
          .prepare("SELECT lesson_id, step_id FROM checklist_ticks ORDER BY ticked_at, step_id")
          .all();
        for (const r of rows) add(String(r.lesson_id), String(r.step_id));
        return out;
      } catch {
        this.#degrade();
      }
    }
    for (const key of this.#memoryTicks) {
      const [lesson = "", step = ""] = key.split("\u0000");
      add(lesson, step);
    }
    return out;
  }

  /** Erase every attempt, lesson mark, check record and checklist tick. */
  reset(): boolean {
    this.#memoryAttempts.length = 0;
    this.#memoryLessons.clear();
    this.#memoryChecks.clear();
    this.#memoryTicks.clear();
    const db = this.#db;
    if (db !== null) {
      try {
        db.exec(
          "DELETE FROM attempts; DELETE FROM lesson_progress; DELETE FROM lesson_checks; DELETE FROM checklist_ticks;",
        );
        return true;
      } catch {
        this.#degrade();
      }
    }
    return false;
  }

  close(): void {
    this.#degrade();
  }
}

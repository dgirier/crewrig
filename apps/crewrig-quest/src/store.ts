// Local results database: a single SQLite file written through `node:sqlite`.
// When the file cannot be opened or written the store keeps results in memory
// for the session and reports `persisted: false` (spec 0278 R14).

import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

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
`;

export class QuestStore {
  #db: DatabaseSync | null;
  readonly #memoryAttempts: MemoryAttempt[] = [];
  readonly #memoryLessons = new Set<string>();
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

  /** Erase every attempt and every lesson mark. */
  reset(): boolean {
    this.#memoryAttempts.length = 0;
    this.#memoryLessons.clear();
    const db = this.#db;
    if (db !== null) {
      try {
        db.exec("DELETE FROM attempts; DELETE FROM lesson_progress;");
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

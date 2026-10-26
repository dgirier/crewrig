import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import { QuestStore } from "../src/store.ts";

function tempDir(): string {
  return mkdtempSync(path.join(tmpdir(), "quest-store-"));
}

test("best score never decreases (R7)", () => {
  const dir = tempDir();
  try {
    const store = QuestStore.open(path.join(dir, "q.db"));
    assert.equal(store.persisted, true);
    store.recordAttempt("t", 5, 5, 5);
    store.recordAttempt("t", 1, 5, 1);
    store.recordAttempt("u", 2, 5, 2);
    assert.equal(store.bestStars("t"), 5);
    assert.equal(store.bestStars("u"), 2);
    assert.equal(store.bestStars("none"), 0);
    store.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("results and lessons survive reopening the same file (R8)", () => {
  const dir = tempDir();
  try {
    const file = path.join(dir, "nested", "q.db");
    const a = QuestStore.open(file);
    a.recordAttempt("t", 4, 5, 4);
    a.completeLesson("l1");
    a.completeLesson("l2");
    a.completeLesson("l1");
    a.close();
    const b = QuestStore.open(file);
    assert.equal(b.bestStars("t"), 4);
    assert.deepEqual(b.completedLessons().sort(), ["l1", "l2"]);
    assert.equal(b.reset(), true);
    b.close();
    const c = QuestStore.open(file);
    assert.equal(c.bestStars("t"), 0);
    assert.deepEqual(c.completedLessons(), []);
    c.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("unwritable database degrades to memory (R14)", () => {
  const dir = tempDir();
  try {
    const blocker = path.join(dir, "file");
    writeFileSync(blocker, "x");
    const store = QuestStore.open(path.join(blocker, "q.db"));
    assert.equal(store.persisted, false);
    assert.notEqual(store.openError, null);
    assert.equal(store.recordAttempt("t", 3, 5, 2), false);
    assert.equal(store.bestStars("t"), 2);
    assert.equal(store.completeLesson("l1"), false);
    assert.deepEqual(store.completedLessons(), ["l1"]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("check records and checklist ticks survive reopening, and reset clears them", () => {
  const dir = tempDir();
  try {
    const file = path.join(dir, "q.db");
    const a = QuestStore.open(file);
    assert.equal(a.recordCheck("l1", 1, 3), true);
    assert.equal(a.recordCheck("l1", 3, 3), true);
    assert.equal(a.setTick("l1", "s1", true), true);
    assert.equal(a.setTick("l1", "s2", true), true);
    assert.equal(a.setTick("l1", "s3", true), true);
    assert.equal(a.setTick("l1", "s3", false), true);
    a.close();
    const b = QuestStore.open(file);
    assert.deepEqual(b.checks().get("l1"), { correct: 3, total: 3 });
    assert.deepEqual(b.ticks().get("l1")?.sort(), ["s1", "s2"]);
    assert.equal(b.hasCheck("l1"), true);
    assert.equal(b.hasCheck("l2"), false);
    assert.equal(b.reset(), true);
    b.close();
    const c = QuestStore.open(file);
    assert.equal(c.checks().size, 0);
    assert.equal(c.ticks().size, 0);
    c.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a database file written by the previous schema keeps working", () => {
  const dir = tempDir();
  try {
    const file = path.join(dir, "old.db");
    const old = new DatabaseSync(file);
    old.exec(`
      CREATE TABLE attempts (id INTEGER PRIMARY KEY AUTOINCREMENT, theme_id TEXT NOT NULL,
        correct INTEGER NOT NULL, total INTEGER NOT NULL, stars INTEGER NOT NULL, created_at TEXT NOT NULL);
      CREATE TABLE lesson_progress (lesson_id TEXT PRIMARY KEY, completed_at TEXT NOT NULL);
      INSERT INTO attempts (theme_id, correct, total, stars, created_at) VALUES ('t', 5, 5, 5, 'x');
      INSERT INTO lesson_progress (lesson_id, completed_at) VALUES ('l1', 'x');
    `);
    old.close();
    const store = QuestStore.open(file);
    assert.equal(store.persisted, true);
    assert.equal(store.bestStars("t"), 5);
    assert.deepEqual(store.completedLessons(), ["l1"]);
    assert.equal(store.setTick("l1", "s1", true), true);
    assert.equal(store.recordCheck("l1", 2, 2), true);
    store.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("degraded mode keeps checks and ticks in memory (R14)", () => {
  const dir = tempDir();
  try {
    const blocker = path.join(dir, "file");
    writeFileSync(blocker, "x");
    const store = QuestStore.open(path.join(blocker, "q.db"));
    assert.equal(store.persisted, false);
    assert.equal(store.recordCheck("l1", 1, 2), false);
    assert.equal(store.setTick("l1", "s1", true), false);
    assert.equal(store.setTick("l1", "s2", true), false);
    assert.equal(store.setTick("l1", "s2", false), false);
    assert.deepEqual(store.checks().get("l1"), { correct: 1, total: 2 });
    assert.deepEqual(store.ticks().get("l1"), ["s1"]);
    store.reset();
    assert.equal(store.checks().size + store.ticks().size, 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

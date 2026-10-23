import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
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

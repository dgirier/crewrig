import assert from "node:assert/strict";
import { test } from "node:test";
import {
  REPO_ROOT,
  allSources,
  loadContent,
  missingSources,
  validateTheme,
  validateThemes,
} from "../src/validate-content.ts";

const good = {
  id: "t",
  title: "T",
  description: "D",
  questions: [
    { id: "q1", text: "?", choices: ["a", "b"], answer: 1, explanation: "e", source: "AGENTS.md" },
  ],
};

function withQuestion(patch: Record<string, unknown>): unknown {
  return { ...good, questions: [{ ...good.questions[0], ...patch }] };
}

test("real content is valid and cites existing documents (R12, R13)", () => {
  const content = loadContent();
  assert.ok(content.themes.length >= 8);
  for (const t of content.themes) {
    assert.ok(t.questions.length >= 8 && t.questions.length <= 10, t.id);
    for (const q of t.questions) assert.equal(q.choices.length, 4, q.id);
  }
  assert.ok(content.lessons.length >= 10);
  assert.deepEqual(missingSources(allSources(content), REPO_ROOT), []);
});

test("a valid theme passes", () => {
  assert.deepEqual(validateTheme(good, "x"), []);
});

test("two correct answers are rejected, naming theme and question", () => {
  const errors = validateTheme(withQuestion({ answer: [0, 1] }), "x");
  assert.equal(errors.length, 1);
  assert.match(errors[0] ?? "", /theme "t", question "q1".*exactly one correct answer/);
});

test("out-of-range, fractional and missing answers are rejected", () => {
  for (const answer of [2, -1, 0.5, "1", undefined]) {
    assert.equal(validateTheme(withQuestion({ answer }), "x").length, 1, String(answer));
  }
});

test("fewer than two choices, missing explanation, empty theme, duplicates", () => {
  assert.match(
    validateTheme(withQuestion({ choices: ["a"], answer: 0 }), "x").join("\n"),
    /fewer than two choices/,
  );
  assert.match(
    validateTheme(withQuestion({ explanation: " " }), "x").join("\n"),
    /missing explanation/,
  );
  assert.match(
    validateTheme({ ...good, questions: [] }, "x").join("\n"),
    /theme "t": the theme has no questions/,
  );
  const dupQ = { ...good, questions: [good.questions[0], good.questions[0]] };
  assert.match(validateTheme(dupQ, "x").join("\n"), /duplicate question id/);
  assert.match(validateThemes([good, good]).join("\n"), /duplicate theme id/);
});

test("missingSources reports absent documents", () => {
  assert.deepEqual(missingSources(["AGENTS.md", "docs/nope.md"], REPO_ROOT), ["docs/nope.md"]);
});

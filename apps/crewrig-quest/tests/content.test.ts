import assert from "node:assert/strict";
import { test } from "node:test";
import { LEVELS, inTrack } from "../src/levels.ts";
import {
  REPO_ROOT,
  allSources,
  loadContent,
  missingSources,
  commandsNotInSource,
  validateLessons,
  validateTheme,
  validateThemes,
} from "../src/validate-content.ts";

const good = {
  id: "t",
  title: "T",
  description: "D",
  questions: [
    {
      id: "q1",
      level: "team",
      text: "?",
      choices: ["a", "b"],
      answer: 1,
      explanation: "e",
      source: "AGENTS.md",
    },
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

test("every theme mixes at least two levels; every track adds lessons (R16)", () => {
  const content = loadContent();
  for (const t of content.themes) {
    assert.ok(new Set(t.questions.map((q) => q.level)).size >= 2, t.id);
  }
  const counts = LEVELS.map(
    (track) => content.lessons.filter((l) => inTrack(l.level, track)).length,
  );
  assert.ok(counts[0] !== undefined && counts[0] > 0);
  assert.ok(counts[1] !== undefined && counts[1] > counts[0]);
  assert.ok(counts[2] !== undefined && counts[2] > counts[1]);
  assert.equal(counts[2], content.lessons.length);
  const contributorOnly = content.themes
    .flatMap((t) => t.questions)
    .filter((q) => q.level === "contributor").length;
  assert.ok(contributorOnly > 0);
});

test("a missing or unknown level is rejected, naming theme and question (R16)", () => {
  const missing = { ...good, questions: [{ ...good.questions[0], level: undefined }] };
  assert.match(validateTheme(missing, "x").join("\n"), /theme "t", question "q1": missing level/);
  for (const level of ["expert", 2, null, ""]) {
    assert.match(
      validateTheme(withQuestion({ level }), "x").join("\n"),
      /theme "t", question "q1": unknown level/,
      String(level),
    );
  }
  const lessons = structuredClone(loadContent().lessons) as unknown as Record<string, unknown>[];
  assert.deepEqual(validateLessons(lessons), []);
  delete lessons[0]?.level;
  assert.match(validateLessons(lessons).join("\n"), /lesson "[^"]+": missing level/);
  if (lessons[0] !== undefined) lessons[0].level = "novice";
  assert.match(validateLessons(lessons).join("\n"), /unknown level "novice"/);
});

test("every lesson carries a 2-3 question check of the MCQ shape (R17)", () => {
  const content = loadContent();
  for (const l of content.lessons) {
    assert.ok(l.check.length >= 2 && l.check.length <= 3, l.id);
    for (const q of l.check) assert.equal(q.choices.length, 4, q.id);
  }
  const lessons = structuredClone(content.lessons) as unknown as Record<string, unknown>[];
  const first = lessons[0] as { check: unknown[] };
  const [q1] = first.check;
  for (const bad of [[], [q1], [q1, q1, q1, q1], undefined]) {
    first.check = bad as unknown[];
    assert.match(validateLessons(lessons).join("\n"), /the check needs two or three questions/);
  }
  first.check = [q1, { ...(q1 as object), id: "other", answer: [0, 1] }];
  assert.match(validateLessons(lessons).join("\n"), /check question "other".*exactly one correct/);
  first.check = [q1, { ...(q1 as object), id: "no-expl", explanation: "" }];
  assert.match(
    validateLessons(lessons).join("\n"),
    /check question "no-expl".*missing explanation/,
  );
});

test("the setup lessons carry a checklist of real, cited steps (R18)", () => {
  const content = loadContent();
  const withList = content.lessons.filter((l) => l.checklist !== undefined).map((l) => l.id);
  assert.deepEqual(withList.sort(), ["fondations", "nouveau-projet"]);
  for (const l of content.lessons) {
    for (const step of l.checklist ?? []) {
      assert.ok(step.source.length > 0, step.id);
    }
  }
  // Nothing invented: every command appears verbatim in the document the step cites.
  assert.deepEqual(commandsNotInSource(content.lessons, REPO_ROOT), []);
  const forged = structuredClone(content.lessons);
  const step = forged[3]?.checklist?.[0];
  assert.ok(step);
  step.command = "rm -rf --not-in-the-docs";
  assert.equal(commandsNotInSource(forged, REPO_ROOT).length, 1);
  const lessons = structuredClone(content.lessons) as unknown as Record<string, unknown>[];
  (lessons[3] as { checklist: unknown }).checklist = [{ id: "a", text: "" }];
  assert.match(validateLessons(lessons).join("\n"), /checklist step "a": missing text/);
  assert.match(validateLessons(lessons).join("\n"), /checklist step "a": missing source/);
});

test("every source of the new content (checks, checklists) exists", () => {
  const content = loadContent();
  const sources = content.lessons.flatMap((l) => [
    ...l.check.map((q) => q.source),
    ...(l.checklist ?? []).map((s) => s.source),
  ]);
  assert.ok(sources.length >= 30);
  assert.deepEqual(missingSources(sources, REPO_ROOT), []);
  for (const s of sources) assert.ok(allSources(content).includes(s), s);
});

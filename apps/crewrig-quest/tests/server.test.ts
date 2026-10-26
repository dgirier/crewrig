import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import type { Server } from "node:http";
import { request } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, test } from "node:test";
import { createQuestServer } from "../src/server.ts";
import { QuestStore } from "../src/store.ts";
import { inTrack } from "../src/levels.ts";
import type { AttemptResult, Level, ProgressResponse, ThemesResponse } from "../src/types.ts";
import { QUEST_ROOT, loadContent } from "../src/validate-content.ts";

const dir = mkdtempSync(path.join(tmpdir(), "quest-server-"));
after(() => rmSync(dir, { recursive: true, force: true }));
const content = loadContent();
const webDir = path.join(QUEST_ROOT, "web");

interface Running {
  base: string;
  server: Server;
  store: QuestStore;
  port: number;
}

async function start(dbFile: string): Promise<Running> {
  const store = QuestStore.open(dbFile);
  const server = createQuestServer({ content, store, webDir });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const port = (server.address() as AddressInfo).port;
  return { base: `http://127.0.0.1:${port}`, server, store, port };
}

async function stop(r: Running): Promise<void> {
  r.server.closeAllConnections();
  await new Promise<void>((res) => r.server.close(() => res()));
  r.store.close();
}

async function json<T>(
  r: Running,
  method: string,
  url: string,
  body?: unknown,
): Promise<{ status: number; data: T }> {
  const res = await fetch(r.base + url, {
    method,
    headers: body === undefined ? {} : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, data: (await res.json()) as T };
}

function rawStatus(port: number, p: string, headers: Record<string, string> = {}): Promise<number> {
  return new Promise((resolve, reject) => {
    const req = request({ host: "127.0.0.1", port, path: p, headers }, (res) => {
      res.resume();
      resolve(res.statusCode ?? 0);
    });
    req.on("error", reject);
    req.end();
  });
}

function answers(themeId: string, right: number): { questionId: string; choice: number }[] {
  const theme = content.themes.find((t) => t.id === themeId);
  assert.ok(theme);
  return theme.questions.map((q, i) => ({
    questionId: q.id,
    choice: i < right ? q.answer : (q.answer + 1) % q.choices.length,
  }));
}

/** Answer every check question of a lesson, right or wrong, then mark the lesson completed. */
async function completeWithCheck(r: Running, lessonId: string | undefined, right: boolean) {
  const lesson = content.lessons.find((l) => l.id === lessonId);
  assert.ok(lesson);
  const checked = await json<CheckResponse>(r, "POST", `/api/lessons/${lesson.id}/check`, {
    answers: lesson.check.map((q) => ({
      questionId: q.id,
      choice: right ? q.answer : (q.answer + 1) % q.choices.length,
    })),
  });
  assert.equal(checked.status, 200);
  return json<ProgressResponse>(r, "POST", "/api/lessons/progress", { lessonId: lesson.id });
}

type CheckResponse = ProgressResponse & { result: { correct: number; total: number } };

test("attempt API: perfect, weaker retry, restart persistence, reset", async () => {
  const file = path.join(dir, "api.db");
  let r = await start(file);
  const themes = await json<ThemesResponse>(r, "GET", "/api/themes");
  assert.equal(themes.data.persisted, true);
  assert.ok(themes.data.themes.every((t) => t.bestStars === 0));

  const perfect = await json<AttemptResult>(r, "POST", "/api/themes/sdd/attempts", {
    answers: answers("sdd", 10),
  });
  assert.equal(perfect.data.stars, 5);
  assert.equal(perfect.data.persisted, true);

  const weak = await json<AttemptResult>(r, "POST", "/api/themes/sdd/attempts", {
    answers: answers("sdd", 2),
  });
  assert.equal(weak.data.stars, 1);
  assert.equal(weak.data.previousBest, 5);
  assert.equal(weak.data.bestStars, 5);

  const seven = await json<AttemptResult>(r, "POST", "/api/themes/memoire/attempts", {
    answers: answers("memoire", 7),
  });
  assert.equal(seven.data.stars, 4);
  const none = await json<AttemptResult>(r, "POST", "/api/themes/harness/attempts", {
    answers: [],
  });
  assert.equal(none.data.stars, 0);

  await completeWithCheck(r, content.lessons[0]?.id, true);
  await completeWithCheck(r, content.lessons[1]?.id, true);
  await stop(r);

  r = await start(file);
  const again = await json<ThemesResponse>(r, "GET", "/api/themes");
  assert.equal(again.data.themes.find((t) => t.id === "sdd")?.bestStars, 5);
  assert.equal(again.data.themes.find((t) => t.id === "memoire")?.bestStars, 4);
  assert.equal(
    (await json<ProgressResponse>(r, "GET", "/api/lessons/progress")).data.completed.length,
    2,
  );

  const reset = await json<{ persisted: boolean }>(r, "DELETE", "/api/results");
  assert.equal(reset.data.persisted, true);
  const cleared = await json<ThemesResponse>(r, "GET", "/api/themes");
  assert.ok(cleared.data.themes.every((t) => t.bestStars === 0));
  const empty = (await json<ProgressResponse>(r, "GET", "/api/lessons/progress")).data;
  assert.equal(empty.completed.length, 0);
  assert.deepEqual(empty.checked, {});
  assert.deepEqual(empty.ticks, {});
  await stop(r);
});

test("lesson cannot complete before its check is answered; wrong answers still complete", async () => {
  const r = await start(path.join(dir, "check.db"));
  const lesson = content.lessons.find((l) => l.check.length === 3);
  assert.ok(lesson);
  const wrong = lesson.check.map((q) => ({
    questionId: q.id,
    choice: (q.answer + 1) % q.choices.length,
  }));
  const complete = (): Promise<{ status: number; data: ProgressResponse }> =>
    json<ProgressResponse>(r, "POST", "/api/lessons/progress", { lessonId: lesson.id });

  assert.equal((await complete()).status, 409);
  // Partial, duplicate and unknown answers do not count as answering the check.
  const url = `/api/lessons/${lesson.id}/check`;
  assert.equal((await json(r, "POST", url, { answers: wrong.slice(0, 2) })).status, 400);
  const first = wrong[0];
  assert.ok(first);
  assert.equal((await json(r, "POST", url, { answers: [first, first, first] })).status, 400);
  assert.equal(
    (
      await json(r, "POST", url, {
        answers: [...wrong.slice(0, 2), { questionId: "x", choice: 0 }],
      })
    ).status,
    400,
  );
  assert.equal((await complete()).status, 409);

  const checked = await json<CheckResponse>(r, "POST", url, { answers: wrong });
  assert.equal(checked.status, 200);
  assert.deepEqual(checked.data.result, { correct: 0, total: 3 });
  assert.equal(checked.data.total, content.lessons.length);
  assert.equal(checked.data.persisted, true);
  const done = await complete();
  assert.equal(done.status, 200);
  assert.deepEqual(done.data.completed, [lesson.id]);
  assert.deepEqual(done.data.checked[lesson.id], { correct: 0, total: 3 });

  // The check can be retried; the latest result replaces the previous one.
  const retry = await json<CheckResponse>(r, "POST", url, {
    answers: lesson.check.map((q) => ({ questionId: q.id, choice: q.answer })),
  });
  assert.deepEqual(retry.data.result, { correct: 3, total: 3 });
  assert.deepEqual(retry.data.checked[lesson.id], { correct: 3, total: 3 });
  assert.equal((await json(r, "POST", "/api/lessons/nope/check", { answers: [] })).status, 404);
  await stop(r);
});

test("checklist ticks survive a restart and are cleared by reset; nothing is executed", async () => {
  const file = path.join(dir, "ticks.db");
  const lesson = content.lessons.find((l) => l.id === "nouveau-projet");
  const steps = lesson?.checklist;
  assert.ok(lesson && steps && steps.length >= 3);
  const [s1, s2, s3] = steps;
  assert.ok(s1 && s2 && s3);
  const tick = (r: Running, id: string, ticked: boolean) =>
    json<ProgressResponse>(r, "PUT", `/api/lessons/${lesson.id}/checklist/${id}`, { ticked });
  let r = await start(file);
  assert.equal((await tick(r, s1.id, true)).status, 200);
  assert.equal((await tick(r, s2.id, true)).status, 200);
  assert.equal((await tick(r, s3.id, true)).status, 200);
  const after = await tick(r, s3.id, false);
  assert.equal(after.data.persisted, true);
  assert.deepEqual(after.data.ticks[lesson.id]?.sort(), [s1.id, s2.id].sort());
  assert.equal((await tick(r, "nope", true)).status, 404);
  assert.equal(
    (await json(r, "PUT", `/api/lessons/${lesson.id}/checklist/${s1.id}`, { ticked: "yes" }))
      .status,
    400,
  );
  assert.equal(
    (await json(r, "PUT", `/api/lessons/nope/checklist/${s1.id}`, { ticked: true })).status,
    404,
  );
  assert.equal((await json(r, "GET", `/api/lessons/${lesson.id}/checklist/${s1.id}`)).status, 405);
  await stop(r);

  r = await start(file);
  const reopened = await json<ProgressResponse>(r, "GET", "/api/lessons/progress");
  assert.deepEqual(reopened.data.ticks[lesson.id]?.sort(), [s1.id, s2.id].sort());
  await json(r, "DELETE", "/api/results");
  const cleared = await json<ProgressResponse>(r, "GET", "/api/lessons/progress");
  assert.deepEqual(cleared.data.ticks, {});
  assert.deepEqual(cleared.data.checked, {});
  await stop(r);
});

test("switching track keeps progress: completion is keyed by lesson id (R16)", async () => {
  const r = await start(path.join(dir, "track.db"));
  const discovery = content.lessons.filter((l) => inTrack(l.level, "discovery"));
  assert.ok(discovery.length >= 3);
  for (const l of discovery.slice(0, 3)) await completeWithCheck(r, l.id, false);
  // The track is a client display choice: the API serves every lesson with its level
  // and the same completion list whichever track the player looks at.
  const lessons = await json<{ id: string; level: string }[]>(r, "GET", "/api/lessons");
  assert.equal(lessons.data.length, content.lessons.length);
  assert.ok(lessons.data.every((l) => ["discovery", "team", "contributor"].includes(l.level)));
  const progress = (await json<ProgressResponse>(r, "GET", "/api/lessons/progress")).data;
  const contributor = lessons.data.filter((l) => inTrack(l.level as Level, "contributor"));
  assert.equal(contributor.length, content.lessons.length);
  assert.deepEqual(
    contributor
      .filter((l) => progress.completed.includes(l.id))
      .map((l) => l.id)
      .sort(),
    discovery
      .slice(0, 3)
      .map((l) => l.id)
      .sort(),
  );
  await stop(r);
});

test("bad requests are rejected", async () => {
  const r = await start(path.join(dir, "bad.db"));
  assert.equal((await json(r, "GET", "/api/themes/unknown")).status, 404);
  assert.equal(
    (
      await json(r, "POST", "/api/themes/sdd/attempts", {
        answers: [{ questionId: "nope", choice: 0 }],
      })
    ).status,
    400,
  );
  assert.equal((await json(r, "POST", "/api/themes/sdd/attempts", { answers: "x" })).status, 400);
  assert.equal((await json(r, "POST", "/api/lessons/progress", { lessonId: "nope" })).status, 404);
  assert.equal((await json(r, "POST", "/api/lessons/progress", {})).status, 400);
  const cross = await fetch(r.base + "/api/results", {
    method: "DELETE",
    headers: { Origin: "http://evil.example" },
  });
  assert.equal(cross.status, 403);
  assert.equal(await rawStatus(r.port, "/api/themes", { Host: "evil.example" }), 421);
  await stop(r);
});

test("degraded mode: unwritable database still plays and says so (R14)", async () => {
  const blocker = path.join(dir, "blocker");
  writeFileSync(blocker, "x");
  const r = await start(path.join(blocker, "q.db"));
  const themes = await json<ThemesResponse>(r, "GET", "/api/themes");
  assert.equal(themes.data.persisted, false);
  const result = await json<AttemptResult>(r, "POST", "/api/themes/sdd/attempts", {
    answers: answers("sdd", 10),
  });
  assert.equal(result.status, 200);
  assert.equal(result.data.persisted, false);
  assert.equal(result.data.stars, 5);
  const lesson = content.lessons.find((l) => l.checklist !== undefined);
  assert.ok(lesson?.checklist?.[0]);
  const step = lesson.checklist[0];
  const tick = await json<ProgressResponse>(
    r,
    "PUT",
    `/api/lessons/${lesson.id}/checklist/${step.id}`,
    { ticked: true },
  );
  assert.equal(tick.data.persisted, false);
  assert.deepEqual(tick.data.ticks[lesson.id], [step.id]);
  const done = await completeWithCheck(r, lesson.id, false);
  assert.equal(done.status, 200);
  assert.equal(done.data.persisted, false);
  assert.deepEqual(done.data.completed, [lesson.id]);
  await stop(r);
});

test("static files are served and traversal is refused", async () => {
  const r = await start(path.join(dir, "static.db"));
  const home = await fetch(r.base + "/");
  assert.equal(home.status, 200);
  assert.match(await home.text(), /lang="fr"/);
  const ts = await fetch(r.base + "/app.ts");
  assert.match(ts.headers.get("content-type") ?? "", /javascript/);
  const attacks = [
    "/../src/server.ts",
    "/%2e%2e/src/server.ts",
    "/..%2fsrc/server.ts",
    "/a/../../README.md",
    "/.git/config",
    "/%00",
    "/..%5csrc",
  ];
  for (const p of attacks) assert.equal(await rawStatus(r.port, p), 404, p);
  await stop(r);
});

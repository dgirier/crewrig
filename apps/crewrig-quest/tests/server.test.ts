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
import type { AttemptResult, ProgressResponse, ThemesResponse } from "../src/types.ts";
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

  await json(r, "POST", "/api/lessons/progress", { lessonId: content.lessons[0]?.id });
  await json(r, "POST", "/api/lessons/progress", { lessonId: content.lessons[1]?.id });
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
  assert.equal(
    (await json<ProgressResponse>(r, "GET", "/api/lessons/progress")).data.completed.length,
    0,
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

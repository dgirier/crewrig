// HTTP server of CrewRig Quest: static browser code plus a small JSON API.
// Bound to the loopback interface only (spec 0278 R1).

import { createServer } from "node:http";
import type { IncomingMessage, Server, ServerResponse } from "node:http";
import { isRecord } from "./validate-content.ts";
import type { LoadedContent } from "./validate-content.ts";
import { SECURITY_HEADERS, serveStatic } from "./static.ts";
import { computeStars } from "./stars.ts";
import type { QuestStore } from "./store.ts";
import type {
  AttemptAnswer,
  AttemptResult,
  CheckRecord,
  ProgressResponse,
  ThemesResponse,
} from "./types.ts";

export interface QuestServerOptions {
  content: LoadedContent;
  store: QuestStore;
  webDir: string;
}

const MAX_BODY_BYTES = 64 * 1024;
const LOCAL_HOST = /^(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/;

class HttpError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, {
    ...SECURITY_HEADERS,
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(body));
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buf = chunk as Buffer;
    size += buf.length;
    if (size > MAX_BODY_BYTES) throw new HttpError(413, "request body too large");
    chunks.push(buf);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
  } catch {
    throw new HttpError(400, "request body is not valid JSON");
  }
}

/** Reject cross-site writes: a browser Origin, when present, must be this very host. */
function assertSameOrigin(req: IncomingMessage): void {
  const origin = req.headers.origin;
  if (origin === undefined) return;
  let host: string;
  try {
    host = new URL(origin).host;
  } catch {
    throw new HttpError(403, "forbidden origin");
  }
  if (host !== req.headers.host) throw new HttpError(403, "forbidden origin");
}

function parseAnswers(body: unknown): AttemptAnswer[] {
  if (!isRecord(body) || !Array.isArray(body.answers)) {
    throw new HttpError(400, "body must be { answers: [{ questionId, choice }] }");
  }
  return (body.answers as unknown[]).map((a) => {
    if (!isRecord(a) || typeof a.questionId !== "string" || !Number.isInteger(a.choice)) {
      throw new HttpError(400, "each answer needs a questionId and an integer choice");
    }
    return { questionId: a.questionId, choice: a.choice as number };
  });
}

function progress(opts: QuestServerOptions): ProgressResponse {
  const known = new Set(opts.content.lessons.map((l) => l.id));
  const checked: Record<string, CheckRecord> = {};
  for (const [id, rec] of opts.store.checks()) if (known.has(id)) checked[id] = rec;
  const ticks: Record<string, string[]> = {};
  for (const [id, steps] of opts.store.ticks()) if (known.has(id)) ticks[id] = steps;
  return {
    persisted: opts.store.persisted,
    completed: opts.store.completedLessons().filter((id) => known.has(id)),
    total: opts.content.lessons.length,
    checked,
    ticks,
  };
}

async function handleApi(
  opts: QuestServerOptions,
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string,
): Promise<void> {
  const { content, store } = opts;
  const method = req.method ?? "GET";
  if (method !== "GET") assertSameOrigin(req);

  if (pathname === "/api/themes" && method === "GET") {
    const best = store.bestByTheme();
    const body: ThemesResponse = {
      persisted: store.persisted,
      themes: content.themes.map((t) => ({
        id: t.id,
        title: t.title,
        description: t.description,
        questionCount: t.questions.length,
        bestStars: best.get(t.id) ?? 0,
      })),
    };
    sendJson(res, 200, body);
    return;
  }

  const themeMatch = /^\/api\/themes\/([a-z0-9-]+)(\/attempts)?$/.exec(pathname);
  if (themeMatch !== null) {
    const theme = content.themes.find((t) => t.id === themeMatch[1]);
    if (theme === undefined) throw new HttpError(404, "unknown theme");
    if (themeMatch[2] === undefined && method === "GET") {
      sendJson(res, 200, { ...theme, bestStars: store.bestStars(theme.id) });
      return;
    }
    if (themeMatch[2] !== undefined && method === "POST") {
      const answers = parseAnswers(await readJsonBody(req));
      const byId = new Map(theme.questions.map((q) => [q.id, q]));
      const seen = new Set<string>();
      let correct = 0;
      for (const a of answers) {
        const q = byId.get(a.questionId);
        if (q === undefined) throw new HttpError(400, `unknown question ${a.questionId}`);
        if (seen.has(a.questionId)) throw new HttpError(400, `duplicate answer ${a.questionId}`);
        seen.add(a.questionId);
        if (a.choice === q.answer) correct += 1;
      }
      const total = theme.questions.length;
      const stars = computeStars(correct, total);
      const previousBest = store.bestStars(theme.id);
      const wrote = store.recordAttempt(theme.id, correct, total, stars);
      const result: AttemptResult = {
        correct,
        total,
        stars,
        previousBest,
        bestStars: store.bestStars(theme.id),
        persisted: wrote && store.persisted,
      };
      sendJson(res, 200, result);
      return;
    }
    throw new HttpError(405, "method not allowed");
  }

  if (pathname === "/api/lessons" && method === "GET") {
    sendJson(res, 200, content.lessons);
    return;
  }
  if (pathname === "/api/sdd" && method === "GET") {
    sendJson(res, 200, content.sdd);
    return;
  }
  if (pathname === "/api/lessons/progress") {
    if (method === "GET") {
      sendJson(res, 200, progress(opts));
      return;
    }
    if (method === "POST") {
      const body = await readJsonBody(req);
      if (!isRecord(body) || typeof body.lessonId !== "string") {
        throw new HttpError(400, "body must be { lessonId }");
      }
      if (!content.lessons.some((l) => l.id === body.lessonId)) {
        throw new HttpError(404, "unknown lesson");
      }
      // R17: the lesson is completable only once its check has been answered.
      // A lesson already completed by an earlier version of the game stays completed.
      const already = store.completedLessons().includes(body.lessonId);
      if (!already && !store.hasCheck(body.lessonId)) {
        throw new HttpError(409, "lesson check not answered");
      }
      const wrote = store.completeLesson(body.lessonId);
      sendJson(res, 200, { ...progress(opts), persisted: wrote && store.persisted });
      return;
    }
    throw new HttpError(405, "method not allowed");
  }
  const lessonMatch = /^\/api\/lessons\/([a-z0-9-]+)\/(check|checklist\/([a-z0-9-]+))$/.exec(
    pathname,
  );
  if (lessonMatch !== null) {
    const lesson = content.lessons.find((l) => l.id === lessonMatch[1]);
    if (lesson === undefined) throw new HttpError(404, "unknown lesson");
    if (lessonMatch[3] === undefined && method === "POST") {
      // Every check question must be answered exactly once; wrong answers are recorded, never refused.
      const answers = parseAnswers(await readJsonBody(req));
      const byId = new Map(lesson.check.map((q) => [q.id, q]));
      const seen = new Set<string>();
      let correct = 0;
      for (const a of answers) {
        const q = byId.get(a.questionId);
        if (q === undefined) throw new HttpError(400, `unknown question ${a.questionId}`);
        if (seen.has(a.questionId)) throw new HttpError(400, `duplicate answer ${a.questionId}`);
        seen.add(a.questionId);
        if (a.choice === q.answer) correct += 1;
      }
      if (seen.size !== byId.size)
        throw new HttpError(400, "every check question must be answered");
      const wrote = store.recordCheck(lesson.id, correct, byId.size);
      sendJson(res, 200, {
        ...progress(opts),
        result: { correct, total: byId.size },
        persisted: wrote && store.persisted,
      });
      return;
    }
    if (lessonMatch[3] !== undefined && method === "PUT") {
      const step = lesson.checklist?.find((s) => s.id === lessonMatch[3]);
      if (step === undefined) throw new HttpError(404, "unknown checklist step");
      const body = await readJsonBody(req);
      if (!isRecord(body) || typeof body.ticked !== "boolean") {
        throw new HttpError(400, "body must be { ticked: boolean }");
      }
      const wrote = store.setTick(lesson.id, step.id, body.ticked);
      sendJson(res, 200, { ...progress(opts), persisted: wrote && store.persisted });
      return;
    }
    throw new HttpError(405, "method not allowed");
  }
  if (pathname === "/api/results" && method === "DELETE") {
    const wrote = store.reset();
    sendJson(res, 200, { persisted: wrote && store.persisted });
    return;
  }
  throw new HttpError(404, "not found");
}

/** Build the server; the caller decides the port and calls `listen` on 127.0.0.1. */
export function createQuestServer(opts: QuestServerOptions): Server {
  return createServer((req, res) => {
    void (async () => {
      try {
        // Host allow-list: refuses DNS-rebinding requests aimed at the loopback server.
        if (!LOCAL_HOST.test(req.headers.host ?? "")) throw new HttpError(421, "bad host");
        const pathname = new URL(req.url ?? "/", "http://localhost").pathname;
        if (pathname.startsWith("/api/")) {
          await handleApi(opts, req, res, pathname);
          return;
        }
        if (req.method !== "GET" && req.method !== "HEAD") {
          throw new HttpError(405, "method not allowed");
        }
        await serveStatic(res, opts.webDir, pathname, req.method === "HEAD");
      } catch (err) {
        if (res.headersSent) {
          res.end();
          return;
        }
        if (err instanceof HttpError) sendJson(res, err.status, { error: err.message });
        else sendJson(res, 500, { error: "internal error" });
      }
    })();
  });
}

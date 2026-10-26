// Static file serving for the browser code under `web/`, with path-traversal
// protection. TypeScript sources are served as JavaScript with their types
// stripped, so the game needs no build step and no dependency.

import { readFile, realpath } from "node:fs/promises";
import type { ServerResponse } from "node:http";
import { stripTypeScriptTypes } from "node:module";
import path from "node:path";

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".ts": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".json": "application/json; charset=utf-8",
  ".ico": "image/x-icon",
};

export const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "Cross-Origin-Resource-Policy": "same-origin",
  "Content-Security-Policy":
    "default-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
};

/**
 * Resolve a request pathname to a file inside `root`, or null when it would
 * escape the root (dot-dot segments, NUL bytes, encoded separators, symlinks).
 */
export async function resolveInside(root: string, pathname: string): Promise<string | null> {
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  if (decoded.includes("\0") || decoded.includes("\\")) return null;
  const segments = decoded.split("/").filter((s) => s !== "");
  if (segments.some((s) => s === ".." || s.startsWith("."))) return null;
  const candidate = path.join(root, ...segments);
  try {
    const [realRoot, realFile] = await Promise.all([realpath(root), realpath(candidate)]);
    if (realFile !== realRoot && !realFile.startsWith(realRoot + path.sep)) return null;
    return realFile;
  } catch {
    return null;
  }
}

function send(res: ServerResponse, status: number, type: string, body: string | Buffer): void {
  res.writeHead(status, {
    ...SECURITY_HEADERS,
    "Content-Type": type,
    "Cache-Control": "no-cache",
  });
  res.end(body);
}

/** Serve one static request. `pathname` is the raw URL pathname. */
export async function serveStatic(
  res: ServerResponse,
  root: string,
  pathname: string,
  headOnly: boolean,
): Promise<void> {
  const wanted = pathname === "/" ? "/index.html" : pathname;
  const file = await resolveInside(root, wanted);
  if (file === null) {
    send(res, 404, "text/plain; charset=utf-8", "Introuvable");
    return;
  }
  const ext = path.extname(file).toLowerCase();
  const type = MIME[ext];
  if (type === undefined) {
    send(res, 404, "text/plain; charset=utf-8", "Introuvable");
    return;
  }
  try {
    let body: string | Buffer = await readFile(file);
    if (ext === ".ts") {
      const source = body.toString("utf8");
      body = stripTypeScriptTypes(source, { mode: "strip" });
    }
    send(res, 200, type, headOnly ? "" : body);
  } catch {
    send(res, 404, "text/plain; charset=utf-8", "Introuvable");
  }
}

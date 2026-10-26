// Audience levels (spec 0278 R16), from the most accessible to the most
// specialised. A track is cumulative: it includes every level up to its own.
// The browser keeps its own copy in `web/levels.ts` because `src/` is never
// served to it.

import type { Level } from "./types.ts";

export const LEVELS: readonly Level[] = ["discovery", "team", "contributor"];

export function isLevel(v: unknown): v is Level {
  return typeof v === "string" && (LEVELS as readonly string[]).includes(v);
}

/** True when content of level `level` belongs to the cumulative track `track`. */
export function inTrack(level: Level, track: Level): boolean {
  return LEVELS.indexOf(level) <= LEVELS.indexOf(track);
}

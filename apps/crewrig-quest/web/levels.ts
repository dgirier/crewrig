/// <reference lib="dom" />
// Audience levels and tracks (spec 0278 R16). Mirrors `src/levels.ts`, which
// the browser cannot import. The chosen track is only a display preference
// kept in the browser; progress is keyed by lesson id on the server, so
// switching track never loses anything.

import { h } from "./dom.ts";
import type { Level } from "../src/types.ts";

export const LEVELS: readonly Level[] = ["discovery", "team", "contributor"];

export const LEVEL_LABELS: Record<Level, string> = {
  discovery: "Découverte",
  team: "Équipe",
  contributor: "Contributeur",
};

export const LEVEL_PITCH: Record<Level, string> = {
  discovery: "Vous découvrez les assistants de codage IA.",
  team: "Votre équipe adopte CrewRig.",
  contributor: "Vous contribuez au framework lui-même.",
};

export function inTrack(level: Level, track: Level): boolean {
  return LEVELS.indexOf(level) <= LEVELS.indexOf(track);
}

const STORAGE_KEY = "crewrig-quest-track";
let memoryTrack: Level = "discovery";

export function getTrack(): Level {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved !== null && (LEVELS as readonly string[]).includes(saved)) return saved as Level;
  } catch {
    // Storage may be blocked; fall back to the in-memory choice.
  }
  return memoryTrack;
}

export function setTrack(track: Level): void {
  memoryTrack = track;
  try {
    localStorage.setItem(STORAGE_KEY, track);
  } catch {
    // Not persisted across page loads, still honoured for this session.
  }
}

/** Small badge naming the level in words, so it never relies on colour alone. */
export function levelBadge(level: Level): HTMLElement {
  const dots = "●".repeat(LEVELS.indexOf(level) + 1);
  return h("span", { class: `badge badge-level badge-level-${level}` }, [
    h("span", { "aria-hidden": "true" }, [dots + " "]),
    `Niveau : ${LEVEL_LABELS[level]}`,
  ]);
}

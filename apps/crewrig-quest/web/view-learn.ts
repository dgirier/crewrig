/// <reference lib="dom" />
// Learning path: lesson list with progress, and one lesson at a time.

import { completeLesson, getLessons, getProgress } from "./api.ts";
import { diagram } from "./diagrams.ts";
import { h, inline, setTitle } from "./dom.ts";
import {
  LEVELS,
  LEVEL_LABELS,
  LEVEL_PITCH,
  getTrack,
  inTrack,
  levelBadge,
  setTrack,
} from "./levels.ts";
import { renderCheck } from "./view-check.ts";
import { renderChecklist } from "./view-checklist.ts";
import type { Lesson, LessonBlock, Level } from "../src/types.ts";

function block(b: LessonBlock): HTMLElement {
  switch (b.type) {
    case "ul":
      return h(
        "ul",
        {},
        (b.items ?? []).map((t) => h("li", {}, inline(t))),
      );
    case "ol":
      return h(
        "ol",
        {},
        (b.items ?? []).map((t) => h("li", {}, inline(t))),
      );
    case "note":
      return h("aside", { class: "note" }, inline(b.text ?? ""));
    default:
      return h("p", {}, inline(b.text ?? ""));
  }
}

export function diagramFigure(id: string): HTMLElement | null {
  const markup = diagram(id);
  if (markup === null) return null;
  const scroller = h("div", {
    class: "diagram-scroll",
    tabindex: "0",
    role: "region",
    "aria-label": "Schéma, défilable horizontalement",
  });
  scroller.innerHTML = markup;
  return h("figure", { class: "diagram-figure" }, [scroller]);
}

function trackSelector(track: Level, onChoose: (level: Level) => void): HTMLElement {
  const buttons = LEVELS.map((level) => {
    const b = h(
      "button",
      { type: "button", class: "btn track", "aria-pressed": String(level === track) },
      [
        h("strong", {}, [LEVEL_LABELS[level]]),
        h("span", { class: "track-pitch" }, [LEVEL_PITCH[level]]),
      ],
    );
    b.addEventListener("click", () => onChoose(level));
    return b;
  });
  return h("div", { class: "tracks", role: "group", "aria-labelledby": "tracks-title" }, [
    h("h2", { id: "tracks-title" }, ["Choisissez votre parcours"]),
    h("p", { class: "muted" }, [
      "Chaque parcours inclut ceux des niveaux inférieurs. Vous pouvez en changer à tout moment : votre progression est conservée.",
    ]),
    h("div", { class: "track-row" }, buttons),
  ]);
}

export async function renderLearn(root: HTMLElement): Promise<HTMLElement> {
  setTitle("Parcours d'apprentissage");
  const [all, progress] = await Promise.all([getLessons(), getProgress()]);
  const track = getTrack();
  const lessons = all.filter((l) => inTrack(l.level, track));
  const done = new Set(progress.completed);
  const doneInTrack = lessons.filter((l) => done.has(l.id)).length;
  const heading = h("h1", {}, ["Parcours d'apprentissage"]);
  const bar = h("progress", {
    max: String(lessons.length),
    value: String(doneInTrack),
    "aria-labelledby": "progress-label",
  });
  root.replaceChildren(
    heading,
    h("p", { class: "lead" }, [
      "Les bonnes pratiques de CrewRig, dans l'ordre. Répondez au test de chaque leçon pour la terminer et suivre votre progression.",
    ]),
    trackSelector(track, (level) => {
      setTrack(level);
      void renderLearn(root).then((hd) => {
        root.querySelector<HTMLElement>(`.track[aria-pressed="true"]`)?.focus();
        void hd;
      });
    }),
    h("div", { class: "panel" }, [
      h("p", { id: "progress-label" }, [
        `Progression du parcours ${LEVEL_LABELS[track]} : ${doneInTrack} leçon${doneInTrack > 1 ? "s" : ""} sur ${lessons.length}`,
      ]),
      bar,
    ]),
    h(
      "ol",
      { class: "lesson-list" },
      lessons.map((l, i) =>
        h("li", { class: done.has(l.id) ? "lesson-done" : "" }, [
          h("a", { href: `#/apprendre/${l.id}` }, [`${i + 1}. ${l.title}`]),
          h("span", { class: done.has(l.id) ? "badge badge-ok" : "badge" }, [
            done.has(l.id) ? "Terminée" : "À faire",
          ]),
          h("span", { class: "muted lesson-summary" }, [l.summary]),
          h("span", { class: "lesson-level" }, [levelBadge(l.level)]),
        ]),
      ),
    ),
  );
  return heading;
}

export async function renderLesson(root: HTMLElement, id: string): Promise<HTMLElement> {
  const [all, progress] = await Promise.all([getLessons(), getProgress()]);
  const lesson: Lesson | undefined = all.find((l) => l.id === id);
  if (lesson === undefined) throw new Error("unknown lesson");
  // Page through the current track; a lesson outside it is paged through the whole path.
  const track = getTrack();
  const inCurrent = all.filter((l) => inTrack(l.level, track));
  const lessons = inCurrent.some((l) => l.id === lesson.id) ? inCurrent : all;
  const index = lessons.findIndex((l) => l.id === lesson.id);
  setTitle(lesson.title);
  const heading = h("h1", {}, [lesson.title]);
  const completed = new Set(progress.completed).has(lesson.id);
  const status = h("p", { class: "lesson-status", role: "status" }, [
    completed ? "Leçon terminée." : "",
  ]);
  const button = h("button", { type: "button", class: "btn btn-primary", disabled: "" }, [
    "Marquer comme terminée",
  ]);
  const hint = h("p", { class: "muted", id: "complete-hint" }, [
    "Répondez à toutes les questions du test ci-dessus pour pouvoir terminer la leçon.",
  ]);
  button.setAttribute("aria-describedby", "complete-hint");
  const prior = progress.checked[lesson.id];
  const unlock = (): void => {
    button.disabled = false;
    hint.textContent = "Test terminé : vous pouvez maintenant terminer la leçon.";
  };
  if (prior !== undefined) unlock();
  const figure = lesson.diagram === undefined ? null : diagramFigure(lesson.diagram);
  const prev = lessons[index - 1];
  const next = lessons[index + 1];
  const nav = h("nav", { class: "pager", "aria-label": "Leçons" }, [
    prev === undefined
      ? h("span")
      : h("a", { class: "btn", href: `#/apprendre/${prev.id}` }, [`Précédente : ${prev.title}`]),
    next === undefined
      ? h("a", { class: "btn", href: "#/apprendre" }, ["Retour à la liste"])
      : h("a", { class: "btn", href: `#/apprendre/${next.id}` }, [`Suivante : ${next.title}`]),
  ]);
  const children: Node[] = [
    h("p", { class: "muted" }, [
      `Leçon ${index + 1} sur ${lessons.length}`,
      " · ",
      levelBadge(lesson.level),
    ]),
    heading,
    h("p", { class: "lead" }, [lesson.summary]),
    ...lesson.body.slice(0, 1).map(block),
  ];
  if (figure !== null) children.push(figure);
  children.push(...lesson.body.slice(1).map(block));
  const exercise = renderChecklist(lesson, progress.ticks[lesson.id] ?? []);
  if (exercise !== null) children.push(exercise);
  children.push(renderCheck(lesson, prior, unlock));
  children.push(
    h("p", { class: "muted" }, [
      "Sources : ",
      ...lesson.sources.flatMap((s, i) => [i > 0 ? ", " : "", h("code", {}, [s])]),
    ]),
    h("div", { class: "actions" }, completed ? [] : [button]),
    ...(completed ? [] : [hint]),
    status,
    nav,
  );
  root.replaceChildren(...children);
  button.addEventListener("click", () => {
    completeLesson(lesson.id)
      .then(() => {
        button.remove();
        hint.remove();
        status.textContent = "Leçon terminée. Bravo !";
      })
      .catch(() => {
        status.textContent = "Impossible d'enregistrer la progression.";
      });
  });
  // The label above heading shifts nothing for keyboard users: focus lands on the h1.
  return heading;
}

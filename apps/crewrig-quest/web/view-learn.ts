/// <reference lib="dom" />
// Learning path: lesson list with progress, and one lesson at a time.

import { completeLesson, getLessons, getProgress } from "./api.ts";
import { diagram } from "./diagrams.ts";
import { h, inline, setTitle } from "./dom.ts";
import type { Lesson, LessonBlock } from "../src/types.ts";

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

export async function renderLearn(root: HTMLElement): Promise<HTMLElement> {
  setTitle("Parcours d'apprentissage");
  const [lessons, progress] = await Promise.all([getLessons(), getProgress()]);
  const done = new Set(progress.completed);
  const heading = h("h1", {}, ["Parcours d'apprentissage"]);
  const bar = h("progress", {
    max: String(progress.total),
    value: String(done.size),
    "aria-labelledby": "progress-label",
  });
  root.replaceChildren(
    heading,
    h("p", { class: "lead" }, [
      "Les bonnes pratiques de CrewRig, dans l'ordre. Terminez chaque leçon pour suivre votre progression.",
    ]),
    h("div", { class: "panel" }, [
      h("p", { id: "progress-label" }, [
        `Progression : ${done.size} leçon${done.size > 1 ? "s" : ""} sur ${progress.total}`,
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
        ]),
      ),
    ),
  );
  return heading;
}

export async function renderLesson(root: HTMLElement, id: string): Promise<HTMLElement> {
  const [lessons, progress] = await Promise.all([getLessons(), getProgress()]);
  const index = lessons.findIndex((l) => l.id === id);
  const lesson: Lesson | undefined = lessons[index];
  if (lesson === undefined) throw new Error("unknown lesson");
  setTitle(lesson.title);
  const heading = h("h1", {}, [lesson.title]);
  const completed = new Set(progress.completed).has(lesson.id);
  const status = h("p", { class: "lesson-status", role: "status" }, [
    completed ? "Leçon terminée." : "",
  ]);
  const button = h("button", { type: "button", class: "btn btn-primary" }, [
    "Marquer comme terminée",
  ]);
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
    h("p", { class: "muted" }, [`Leçon ${index + 1} sur ${lessons.length}`]),
    heading,
    h("p", { class: "lead" }, [lesson.summary]),
    ...lesson.body.slice(0, 1).map(block),
  ];
  if (figure !== null) children.push(figure);
  children.push(...lesson.body.slice(1).map(block));
  children.push(
    h("p", { class: "muted" }, [
      "Sources : ",
      ...lesson.sources.flatMap((s, i) => [i > 0 ? ", " : "", h("code", {}, [s])]),
    ]),
    h("div", { class: "actions" }, completed ? [] : [button]),
    status,
    nav,
  );
  root.replaceChildren(...children);
  button.addEventListener("click", () => {
    completeLesson(lesson.id)
      .then(() => {
        button.remove();
        status.textContent = "Leçon terminée. Bravo !";
      })
      .catch(() => {
        status.textContent = "Impossible d'enregistrer la progression.";
      });
  });
  // The label above heading shifts nothing for keyboard users: focus lands on the h1.
  return heading;
}

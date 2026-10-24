/// <reference lib="dom" />
// Guided exercise (spec 0278 R18): the player ticks real steps of the
// framework documentation. Ticks are remembered by the server; the game never
// runs anything.

import { putTick } from "./api.ts";
import { h, inline } from "./dom.ts";
import type { Lesson } from "../src/types.ts";

export function renderChecklist(lesson: Lesson, ticked: string[]): HTMLElement | null {
  const steps = lesson.checklist;
  if (steps === undefined || steps.length === 0) return null;
  const done = new Set(ticked);
  const status = h("p", { class: "muted", role: "status" });
  const refresh = (): void => {
    status.textContent = `${done.size} étape${done.size > 1 ? "s" : ""} cochée${done.size > 1 ? "s" : ""} sur ${steps.length}.`;
  };
  refresh();
  const items = steps.map((step, i) => {
    const id = `step-${step.id}`;
    const box = h("input", { type: "checkbox", id });
    box.checked = done.has(step.id);
    box.addEventListener("change", () => {
      const wanted = box.checked;
      putTick(lesson.id, step.id, wanted)
        .then(() => {
          if (wanted) done.add(step.id);
          else done.delete(step.id);
          refresh();
        })
        .catch(() => {
          box.checked = !wanted;
          status.textContent = "Impossible d'enregistrer la case : le serveur local ne répond pas.";
        });
    });
    const detail: Node[] = [h("span", {}, [`Étape ${i + 1}. `, ...inline(step.text)])];
    if (step.command !== undefined) {
      detail.push(h("code", { class: "command" }, [step.command]));
    }
    detail.push(h("span", { class: "muted source" }, ["Source : ", h("code", {}, [step.source])]));
    return h("li", { class: "step" }, [box, h("label", { for: id }, detail)]);
  });
  return h("section", { class: "panel", "aria-labelledby": "exercise-title" }, [
    h("h2", { id: "exercise-title" }, ["Exercice guidé"]),
    h("p", {}, [
      "Cochez les étapes au fur et à mesure. Ce jeu n'exécute aucune commande : copiez-les vous-même dans votre terminal.",
    ]),
    h("ul", { class: "steps" }, items),
    status,
  ]);
}

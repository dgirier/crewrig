/// <reference lib="dom" />
// Lesson check (spec 0278 R17): two to three questions, the correct answer
// revealed after each; wrong answers never block and the check can be retried.

import { postCheck } from "./api.ts";
import { h, inline } from "./dom.ts";
import { choiceItem } from "./view-quiz.ts";
import type { AttemptAnswer, CheckQuestion, CheckRecord, Lesson } from "../src/types.ts";

export function renderCheck(
  lesson: Lesson,
  prior: CheckRecord | undefined,
  onChecked: (record: CheckRecord) => void,
): HTMLElement {
  const questions: CheckQuestion[] = lesson.check;
  const body = h("div", { class: "check-body" });
  const section = h("section", { class: "panel check", "aria-labelledby": "check-title" }, [
    h("h2", { id: "check-title" }, ["Vérifiez vos acquis"]),
    body,
  ]);

  function summary(record: CheckRecord): void {
    const again = h("button", { type: "button", class: "btn" }, ["Refaire le test"]);
    again.addEventListener("click", () => question(0, [], true));
    body.replaceChildren(
      h("p", { class: "check-result", role: "status" }, [
        `Test terminé : ${record.correct} bonne${record.correct > 1 ? "s" : ""} réponse${record.correct > 1 ? "s" : ""} sur ${record.total}. Une mauvaise réponse ne bloque rien : vous pouvez terminer la leçon, ou refaire le test.`,
      ]),
      again,
    );
  }

  function question(index: number, answers: AttemptAnswer[], focus = false): void {
    const q = questions[index];
    if (q === undefined) return;
    const name = `check-${lesson.id}-${index}`;
    const legend = h("legend", { class: "question-text" }, inline(q.text));
    const fieldset = h("fieldset", { class: "choices" }, [
      legend,
      ...q.choices.map((_, i) => choiceItem(name, q, i)),
    ]);
    const error = h("p", { class: "error", role: "alert", hidden: "" });
    const validate = h("button", { type: "submit", class: "btn btn-primary" }, [
      "Valider ma réponse",
    ]);
    const feedback = h("div", { class: "feedback", role: "status", tabindex: "-1" });
    const form = h("form", { class: "quiz-form" }, [fieldset, error, validate, feedback]);
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      if (form.dataset.state === "answered") return;
      const chosen = form.querySelector<HTMLInputElement>(`input[name="${name}"]:checked`);
      if (chosen === null) {
        error.hidden = false;
        error.textContent = "Choisissez une réponse avant de valider.";
        return;
      }
      error.hidden = true;
      const choice = Number(chosen.value);
      const next = [...answers, { questionId: q.id, choice }];
      form.dataset.state = "answered";
      fieldset.querySelectorAll<HTMLElement>(".choice").forEach((el, i) => {
        const input = el.querySelector("input");
        if (input !== null) input.disabled = true;
        if (i === q.answer) {
          el.classList.add("is-correct");
          el.querySelector("label")?.append(h("span", { class: "tag" }, [" Bonne réponse"]));
        } else if (i === choice) {
          el.classList.add("is-wrong");
          el.querySelector("label")?.append(h("span", { class: "tag" }, [" Votre réponse"]));
        }
      });
      const good = choice === q.answer;
      feedback.className = `feedback ${good ? "feedback-ok" : "feedback-ko"}`;
      feedback.replaceChildren(
        h("p", { class: "feedback-title" }, [good ? "Bonne réponse !" : "Pas tout à fait."]),
        h("p", {}, inline(q.explanation)),
        h("p", { class: "muted" }, ["Source : ", h("code", {}, [q.source])]),
      );
      const last = index === questions.length - 1;
      const go = h("button", { type: "button", class: "btn btn-primary" }, [
        last ? "Terminer le test" : "Question suivante",
      ]);
      go.addEventListener("click", () => {
        if (!last) {
          question(index + 1, next, true);
          return;
        }
        go.disabled = true;
        postCheck(lesson.id, next)
          .then((r) => {
            const record = r.result;
            summary(record);
            onChecked(record);
          })
          .catch(() => {
            go.disabled = false;
            error.hidden = false;
            error.textContent = "Impossible d'enregistrer le test : le serveur local ne répond pas.";
          });
      });
      validate.replaceWith(go);
      go.focus();
    });
    body.replaceChildren(
      h("p", { class: "muted", id: `check-progress-${index}` }, [
        `Question ${index + 1} sur ${questions.length}`,
      ]),
      form,
    );
    if (focus) {
      legend.setAttribute("tabindex", "-1");
      legend.focus();
    }
  }

  if (prior === undefined) question(0, []);
  else summary(prior);
  return section;
}

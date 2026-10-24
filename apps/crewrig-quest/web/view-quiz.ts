/// <reference lib="dom" />
// Quiz play: one multiple-choice question at a time, feedback, final result.

import { getTheme, postAttempt } from "./api.ts";
import { levelBadge } from "./levels.ts";
import { focusHeading, h, inline, setTitle, stars } from "./dom.ts";
import type { AttemptAnswer, AttemptResult, CheckQuestion, Question } from "../src/types.ts";

interface QuizState {
  index: number;
  answers: AttemptAnswer[];
}

export function choiceItem(name: string, q: CheckQuestion, i: number): HTMLElement {
  const id = `${name}-${i}`;
  const input = h("input", { type: "radio", name, id, value: String(i) });
  const label = h("label", { for: id }, [
    h("span", { class: "choice-text" }, inline(q.choices[i] ?? "")),
  ]);
  return h("div", { class: "choice" }, [input, label]);
}

function renderQuestion(
  root: HTMLElement,
  themeId: string,
  title: string,
  questions: Question[],
  state: QuizState,
  onDone: (answers: AttemptAnswer[]) => void,
): void {
  const q = questions[state.index];
  if (q === undefined) return;
  const heading = h("h1", {}, [title]);
  const progress = h("p", { class: "muted", id: "q-progress" }, [
    `Question ${state.index + 1} sur ${questions.length}`,
  ]);
  const level = h("p", { class: "muted" }, [levelBadge(q.level)]);
  const legend = h("legend", { class: "question-text", id: "q-legend" }, inline(q.text));
  const name = `q-${themeId}-${state.index}`;
  const fieldset = h("fieldset", { class: "choices", "aria-describedby": "q-progress" }, [
    legend,
    ...q.choices.map((_, i) => choiceItem(name, q, i)),
  ]);
  const error = h("p", { class: "error", role: "alert", hidden: "" });
  const feedback = h("div", { class: "feedback", role: "status", tabindex: "-1" });
  const validate = h("button", { type: "submit", class: "btn btn-primary" }, [
    "Valider ma réponse",
  ]);
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
    state.answers.push({ questionId: q.id, choice });
    form.dataset.state = "answered";
    const good = choice === q.answer;
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
    feedback.className = `feedback ${good ? "feedback-ok" : "feedback-ko"}`;
    feedback.replaceChildren(
      h("p", { class: "feedback-title" }, [good ? "Bonne réponse !" : "Pas tout à fait."]),
      h("p", {}, inline(q.explanation)),
      h("p", { class: "muted" }, ["Source : ", h("code", {}, [q.source])]),
    );
    const last = state.index === questions.length - 1;
    const next = h("button", { type: "button", class: "btn btn-primary" }, [
      last ? "Voir mon résultat" : "Question suivante",
    ]);
    next.addEventListener("click", () => {
      if (last) onDone(state.answers);
      else {
        state.index += 1;
        renderQuestion(root, themeId, title, questions, state, onDone);
      }
    });
    validate.replaceWith(next);
    next.focus();
  });

  root.replaceChildren(heading, progress, level, form);
  legend.setAttribute("tabindex", "-1");
  legend.focus();
}

function resultScreen(
  root: HTMLElement,
  themeId: string,
  title: string,
  result: AttemptResult,
): HTMLElement {
  const heading = h("h1", {}, ["Résultat : " + title]);
  const improved = result.stars > result.previousBest;
  const children: Node[] = [
    heading,
    h("p", { class: "score" }, [
      `${result.correct} bonne${result.correct > 1 ? "s" : ""} réponse${result.correct > 1 ? "s" : ""} sur ${result.total}`,
    ]),
    h("p", { class: "result-stars" }, [stars(result.stars, "Étoiles obtenues")]),
    h("p", {}, [
      result.stars === 5
        ? "Sans faute : cinq étoiles, bravo !"
        : "Cinq étoiles s'obtiennent uniquement avec toutes les réponses justes.",
    ]),
    h("p", { class: "muted" }, [
      improved ? "Nouveau meilleur score : " : "Meilleur score conservé : ",
      stars(result.bestStars, "Meilleur score"),
    ]),
  ];
  if (!result.persisted) {
    children.push(
      h("p", { class: "notice notice-inline" }, [
        "Ce résultat n'a pas pu être enregistré : la base de données locale est inaccessible. Il disparaîtra à l'arrêt de l'application.",
      ]),
    );
  }
  const again = h("a", { class: "btn btn-primary", href: `#/quiz/${themeId}` }, [
    "Rejouer ce thème",
  ]);
  again.addEventListener("click", (e) => {
    // The hash is unchanged when replaying from the result screen, so re-render by hand.
    if (location.hash === `#/quiz/${themeId}`) {
      e.preventDefault();
      void renderQuiz(root, themeId).then(focusHeading);
    }
  });
  children.push(
    h("p", { class: "actions" }, [again, h("a", { class: "btn", href: "#/" }, ["Retour au menu"])]),
  );
  root.replaceChildren(...children);
  return heading;
}

export async function renderQuiz(root: HTMLElement, themeId: string): Promise<HTMLElement> {
  const theme = await getTheme(themeId);
  setTitle(theme.title);
  const heading = h("h1", {}, [theme.title]);
  const start = h("button", { type: "button", class: "btn btn-primary" }, ["Commencer"]);
  root.replaceChildren(
    heading,
    h("p", { class: "lead" }, inline(theme.description)),
    h("p", { class: "muted" }, [
      `${theme.questions.length} questions. Meilleur score actuel : `,
      stars(theme.bestStars),
    ]),
    start,
  );
  start.addEventListener("click", () => {
    const state: QuizState = { index: 0, answers: [] };
    renderQuestion(root, theme.id, theme.title, theme.questions, state, (answers) => {
      postAttempt(theme.id, answers)
        .then((result) => {
          focusHeading(resultScreen(root, theme.id, theme.title, result));
        })
        .catch(() => {
          root.append(
            h("p", { class: "error", role: "alert" }, [
              "Impossible de joindre le serveur local. Relancez l'application puis réessayez.",
            ]),
          );
        });
    });
  });
  return heading;
}

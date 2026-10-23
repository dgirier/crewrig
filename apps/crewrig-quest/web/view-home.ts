/// <reference lib="dom" />
// Home screen: the quiz menu with the best score of each theme.

import { getProgress, getThemes } from "./api.ts";
import { h, inline, setTitle, stars } from "./dom.ts";
import type { ThemeSummary } from "../src/types.ts";

function themeCard(theme: ThemeSummary): HTMLElement {
  const titleId = `theme-${theme.id}`;
  return h("li", { class: "card" }, [
    h("h3", { id: titleId }, [theme.title]),
    h("p", { class: "muted" }, inline(theme.description)),
    h("p", { class: "meta" }, [
      h("span", {}, [`${theme.questionCount} questions`]),
      h("span", { class: "meta-stars" }, ["Meilleur score : ", stars(theme.bestStars)]),
    ]),
    h("a", { class: "btn btn-primary", href: `#/quiz/${theme.id}`, "aria-describedby": titleId }, [
      theme.bestStars > 0 ? "Rejouer" : "Jouer",
    ]),
  ]);
}

export async function renderHome(root: HTMLElement): Promise<HTMLElement> {
  setTitle("");
  const [themes, progress] = await Promise.all([getThemes(), getProgress()]);
  const heading = h("h1", {}, ["CrewRig Quest"]);
  const total = themes.themes.length;
  const mastered = themes.themes.filter((t) => t.bestStars === 5).length;
  root.replaceChildren(
    heading,
    h("p", { class: "lead" }, [
      "Apprenez CrewRig en jouant : choisissez un thème, répondez aux questions et décrochez cinq étoiles en ne faisant aucune erreur.",
    ]),
    h("section", { class: "panel", "aria-labelledby": "path-title" }, [
      h("h2", { id: "path-title" }, ["Parcours d'apprentissage"]),
      h("p", {}, [
        `${progress.completed.length} leçon${progress.completed.length > 1 ? "s" : ""} terminée${progress.completed.length > 1 ? "s" : ""} sur ${progress.total}.`,
      ]),
      h("a", { class: "btn", href: "#/apprendre" }, ["Ouvrir le parcours"]),
    ]),
    h("section", { "aria-labelledby": "quiz-title" }, [
      h("h2", { id: "quiz-title" }, ["Quiz par thème"]),
      h("p", { class: "muted" }, [
        `${mastered} thème${mastered > 1 ? "s" : ""} maîtrisé${mastered > 1 ? "s" : ""} sur ${total}.`,
      ]),
      h("ul", { class: "card-grid" }, themes.themes.map(themeCard)),
    ]),
  );
  return heading;
}

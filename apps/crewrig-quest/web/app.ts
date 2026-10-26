/// <reference lib="dom" />
// Hash router, global notice for the "results not saved" state, reset flow.

import { onPersistence, resetResults } from "./api.ts";
import { focusHeading, h } from "./dom.ts";
import { renderHome } from "./view-home.ts";
import { renderLearn, renderLesson } from "./view-learn.ts";
import { renderQuiz } from "./view-quiz.ts";
import { renderSdd } from "./view-sdd.ts";

const main = document.getElementById("main");
const notice = document.getElementById("notice");
if (main === null || notice === null) throw new Error("page skeleton is missing");

onPersistence((persisted) => {
  notice.hidden = persisted;
  notice.textContent = persisted
    ? ""
    : "Attention : la base de données locale est inaccessible. Vous pouvez jouer, mais vos résultats ne seront pas enregistrés.";
});

type Renderer = () => Promise<HTMLElement>;

function resolve(hash: string): { nav: string; render: Renderer } {
  const parts = hash
    .replace(/^#\/?/, "")
    .split("/")
    .filter((s) => s !== "");
  const root = main as HTMLElement;
  if (parts[0] === "quiz" && parts[1] !== undefined) {
    const id = parts[1];
    return { nav: "home", render: () => renderQuiz(root, id) };
  }
  if (parts[0] === "apprendre") {
    const id = parts[1];
    return {
      nav: "learn",
      render: () => (id === undefined ? renderLearn(root) : renderLesson(root, id)),
    };
  }
  if (parts[0] === "sdd") return { nav: "sdd", render: () => renderSdd(root) };
  return { nav: "home", render: () => renderHome(root) };
}

async function route(): Promise<void> {
  const { nav, render } = resolve(location.hash);
  document.querySelectorAll<HTMLAnchorElement>("[data-nav]").forEach((a) => {
    if (a.dataset.nav === nav) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
  try {
    const heading = await render();
    focusHeading(heading);
    window.scrollTo(0, 0);
  } catch {
    const heading = h("h1", {}, ["Page introuvable"]);
    (main as HTMLElement).replaceChildren(
      heading,
      h("p", {}, ["Cette page n'existe pas, ou le serveur local ne répond plus."]),
      h("a", { class: "btn", href: "#/" }, ["Retour à l'accueil"]),
    );
    focusHeading(heading);
  }
}

const dialog = document.getElementById("confirm-dialog");
const resetButton = document.getElementById("reset-button");
if (dialog instanceof HTMLDialogElement && resetButton !== null) {
  resetButton.addEventListener("click", () => {
    dialog.returnValue = "cancel";
    dialog.showModal();
  });
  dialog.addEventListener("close", () => {
    if (dialog.returnValue !== "confirm") return;
    resetResults()
      .then(() => route())
      .catch(() => {
        notice.hidden = false;
        notice.textContent = "L'effacement a échoué : le serveur local ne répond pas.";
      });
  });
}

window.addEventListener("hashchange", () => void route());
void route();

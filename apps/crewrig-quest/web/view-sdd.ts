/// <reference lib="dom" />
// SDD lifecycle section: stages, finding classes, termination, complexity tiers.

import { getSdd } from "./api.ts";
import { diagramFigure } from "./view-learn.ts";
import { h, inline, setTitle } from "./dom.ts";

function table(caption: string, head: string[], rows: string[][]): HTMLElement {
  return h(
    "div",
    {
      class: "table-scroll",
      tabindex: "0",
      role: "region",
      "aria-label": `${caption}, défilable horizontalement`,
    },
    [
      h("table", {}, [
        h("caption", {}, [caption]),
        h("thead", {}, [
          h(
            "tr",
            {},
            head.map((c) => h("th", { scope: "col" }, [c])),
          ),
        ]),
        h(
          "tbody",
          {},
          rows.map((r) =>
            h(
              "tr",
              {},
              r.map((c, i) =>
                i === 0 ? h("th", { scope: "row" }, inline(c)) : h("td", {}, inline(c)),
              ),
            ),
          ),
        ),
      ]),
    ],
  );
}

export async function renderSdd(root: HTMLElement): Promise<HTMLElement> {
  const sdd = await getSdd();
  setTitle(sdd.title);
  const heading = h("h1", {}, [sdd.title]);
  const figure = diagramFigure("sdd");
  root.replaceChildren(
    heading,
    h("p", { class: "lead" }, [sdd.intro]),
    ...(figure === null ? [] : [figure]),
    h("section", { "aria-labelledby": "sdd-stages" }, [
      h("h2", { id: "sdd-stages" }, ["Les quatre étapes"]),
      h(
        "ol",
        { class: "stage-list" },
        sdd.stages.map((s) =>
          h("li", {}, [
            h("strong", {}, [`${s.title} (${s.question}) : `]),
            ...inline(s.description),
          ]),
        ),
      ),
    ]),
    h("section", { "aria-labelledby": "sdd-classes" }, [
      h("h2", { id: "sdd-classes" }, ["Les classes de constats"]),
      h("p", {}, [
        "Chaque constat de REVIEW porte exactement une classe, qui détermine l'étape où l'on retourne.",
      ]),
      table(
        "Classes de constats et étape de retour",
        ["Classe", "Retour à", "Signification", "Exemple"],
        sdd.findingClasses.map((c) => [`\`${c.id}\``, c.target, c.meaning, c.example]),
      ),
      h("p", {}, inline(sdd.disambiguation)),
    ]),
    h("section", { "aria-labelledby": "sdd-end" }, [
      h("h2", { id: "sdd-end" }, ["Quand le cycle se termine-t-il ?"]),
      h("p", {}, ["Le cycle se termine uniquement lorsque les trois conditions sont réunies :"]),
      h(
        "ol",
        {},
        sdd.termination.map((t) => h("li", {}, inline(t))),
      ),
      h("p", {}, inline(sdd.guardrail)),
    ]),
    h("section", { "aria-labelledby": "sdd-tiers" }, [
      h("h2", { id: "sdd-tiers" }, ["Les paliers de complexité"]),
      table(
        "Paliers de complexité",
        ["Palier", "Équipe pour le DEV", "Plafond de révisions du PLAN", "Remarque"],
        sdd.tiers.map((t) => [`\`${t.id}\``, t.team, String(t.planRevisionCap), t.note]),
      ),
    ]),
    h("p", { class: "muted" }, [
      "Sources : ",
      ...sdd.sources.flatMap((s, i) => [i > 0 ? ", " : "", h("code", {}, [s])]),
    ]),
  );
  return heading;
}

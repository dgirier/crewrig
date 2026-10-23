// Inline SVG diagrams of the learning path. Each is a French-labelled SVG
// string using CSS custom properties from styles.css, so it stays legible in
// both the light and the dark theme, and carries a text alternative.

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
  lines: string[];
  kind?: "box" | "accent" | "group";
}

const esc = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function box(b: Box): string {
  const kind = b.kind ?? "box";
  const rect = `<rect class="dg-${kind}" x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="8"/>`;
  if (kind === "group") return rect;
  const lineH = 19;
  const top = b.y + b.h / 2 - ((b.lines.length - 1) * lineH) / 2;
  const texts = b.lines
    .map((line, i) => {
      const cls = i === 0 ? "dg-title" : "dg-text";
      return `<text class="${cls}" x="${b.x + b.w / 2}" y="${top + i * lineH}" text-anchor="middle" dominant-baseline="middle">${esc(line)}</text>`;
    })
    .join("");
  return rect + texts;
}

function label(x: number, y: number, text: string, anchor = "middle"): string {
  return `<text class="dg-label" x="${x}" y="${y}" text-anchor="${anchor}">${esc(text)}</text>`;
}

function defs(id: string): string {
  return `<defs><marker id="arrow-${id}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path class="dg-head" d="M0 0 L10 5 L0 10 z"/></marker></defs>`;
}

function edge(id: string, d: string, both = false): string {
  const start = both ? ` marker-start="url(#arrow-${id})"` : "";
  return `<path class="dg-edge" d="${d}" marker-end="url(#arrow-${id})"${start}/>`;
}

function svg(
  id: string,
  width: number,
  height: number,
  title: string,
  desc: string,
  body: string,
): string {
  return `<svg class="diagram" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="t-${id} d-${id}" xmlns="http://www.w3.org/2000/svg"><title id="t-${id}">${esc(title)}</title><desc id="d-${id}">${esc(desc)}</desc>${defs(id)}${body}</svg>`;
}

function architecture(): string {
  const id = "architecture";
  const body = [
    box({
      x: 20,
      y: 30,
      w: 230,
      h: 104,
      lines: [
        "config/",
        "SOUL · level · ORGANIZATION",
        "PROFILE · expertise · teams",
        "TOOLS · 60-tools.md",
      ],
    }),
    edge(id, "M250 82 H300"),
    box({
      x: 300,
      y: 52,
      w: 240,
      h: 60,
      lines: ["Setup par CLI", "task setup-<cli>-interactive"],
      kind: "accent",
    }),
    edge(id, "M540 82 H620"),
    box({
      x: 620,
      y: 30,
      w: 320,
      h: 104,
      lines: [
        "Répertoires de règles des CLI",
        "~/.claude/rules/ · ~/.gemini/",
        "~/.copilot/instructions/",
        "AGENTS.md concaténé (Antigravity)",
      ],
    }),
    box({
      x: 20,
      y: 200,
      w: 230,
      h: 90,
      lines: ["artifacts/", "skills · agents · commandes", "core · library · community · org"],
    }),
    edge(id, "M250 245 H300"),
    box({
      x: 300,
      y: 215,
      w: 240,
      h: 60,
      lines: ["Build", "scripts/build-components.ts"],
      kind: "accent",
    }),
    edge(id, "M540 245 H590"),
    box({ x: 590, y: 170, w: 360, h: 150, lines: [], kind: "group" }),
    label(770, 192, "Sorties compilées pour les quatre CLI"),
    box({ x: 604, y: 205, w: 160, h: 48, lines: [".claude/", "Claude Code"] }),
    box({ x: 776, y: 205, w: 160, h: 48, lines: [".gemini/", "Gemini CLI"] }),
    box({ x: 604, y: 263, w: 160, h: 48, lines: [".github/", "Copilot CLI"] }),
    box({ x: 776, y: 263, w: 160, h: 48, lines: [".agents/", "Antigravity CLI"] }),
    edge(id, "M770 320 V395", true),
    box({
      x: 300,
      y: 395,
      w: 650,
      h: 80,
      lines: [
        "MemPalace : mémoire partagée",
        "persistante entre sessions, lue et écrite par les quatre CLI",
      ],
      kind: "accent",
    }),
  ].join("");
  return svg(
    id,
    960,
    500,
    "Architecture du projet CrewRig",
    "Les fichiers de config/ sont déployés par les scripts de setup dans les répertoires de règles des quatre CLI. Les sources de artifacts/ sont compilées par scripts/build-components.ts vers .claude/, .gemini/, .github/ et .agents/. MemPalace relie les quatre CLI par une mémoire partagée.",
    body,
  );
}

function foundation(): string {
  const id = "foundation";
  const steps: [string, string[]][] = [
    ["1. Prérequis", ["git", "Node.js 24 ou plus", "Task + vos CLI"]],
    ["2. Cloner", ["git clone", "crewrig/crewrig", "(ou fork)"]],
    ["3. Préparer config/", ["/init-personal-profile", "/init-soul", "modèles *.template"]],
    ["4. Lancer le setup", ["task setup-<cli>-", "interactive", "équipe et expertise"]],
    ["5. Vérifier", ["fichiers numérotés", "dans le répertoire", "de chaque CLI"]],
  ];
  const parts: string[] = [];
  steps.forEach(([title, lines], i) => {
    const x = 12 + i * 208;
    parts.push(
      box({ x, y: 30, w: 184, h: 130, lines: [title, ...lines], kind: i === 3 ? "accent" : "box" }),
    );
    if (i < steps.length - 1) parts.push(edge(id, `M${x + 184} 95 H${x + 208}`));
  });
  const clis = ["Claude Code", "Gemini CLI", "Copilot CLI", "Antigravity CLI"];
  parts.push(edge(id, "M636 160 V205"));
  parts.push(label(480, 192, "un setup par CLI utilisé", "end"));
  clis.forEach((name, i) =>
    parts.push(box({ x: 150 + i * 190, y: 215, w: 170, h: 44, lines: [name] })),
  );
  parts.push(
    label(
      20,
      300,
      "Avant le déploiement, une organisation compile aussi les composants :",
      "start",
    ),
  );
  parts.push(
    label(
      20,
      322,
      "node scripts/lib/node-floor-guard.js puis node scripts/build-components.ts",
      "start",
    ),
  );
  return svg(
    id,
    1040,
    345,
    "Étapes de mise en place des fondations",
    "Cinq étapes : vérifier les prérequis, cloner le dépôt, préparer les fichiers de config/, lancer le setup de chaque CLI utilisé (Claude Code, Gemini CLI, Copilot CLI, Antigravity CLI), puis vérifier que les fichiers numérotés sont déployés.",
    parts.join(""),
  );
}

function newProject(): string {
  const id = "new-project";
  const steps: [string, string[]][] = [
    ["1. Issue", ["Elle sert aussi", "de journal de bord"]],
    ["2. ticket-pickup", ["task -x ticket-pickup", "-- --issue <N>"]],
    ["3. Worktree", ["git worktree add", ".worktrees/<ticket>/"]],
    ["4. SPECS", ["PR de spécification", "fusionnée en premier"]],
    ["5. PLAN", ["Commentaire sur l'issue", "relu puis approuvé"]],
    ["6. DEV", ["feat/<NNNN>-<slug>", "PR avec CI verte"]],
    ["7. REVIEW", ["Relecture indépendante", "jusqu'à zéro constat"]],
    ["Fusion", ["Accord de l'utilisateur,", "puis clôture de l'issue"]],
  ];
  const parts: string[] = [];
  steps.forEach(([title, lines], i) => {
    const row = Math.floor(i / 4);
    const col = i % 4;
    const x = 20 + col * 260;
    const y = 30 + row * 190;
    const kind = i === 3 || i === 6 ? "accent" : "box";
    parts.push(box({ x, y, w: 200, h: 100, lines: [title, ...lines], kind }));
    if (col < 3) parts.push(edge(id, `M${x + 200} ${y + 50} H${x + 260}`));
  });
  parts.push(edge(id, "M900 130 V180 H120 V220"));
  parts.push(
    label(
      500,
      405,
      "Chaque transition d'étape reçoit un commentaire sur l'issue (règle B).",
      "middle",
    ),
  );
  return svg(
    id,
    1020,
    430,
    "Étapes pour démarrer un nouveau projet avec CrewRig",
    "Sept étapes puis la fusion : ouvrir une issue, lancer ticket-pickup, créer un worktree dédié, rédiger la spécification dans sa propre PR, publier le plan, développer sur une branche avec une PR, passer la revue jusqu'à zéro constat, puis fusionner avec la permission de l'utilisateur.",
    parts.join(""),
  );
}

function sdd(): string {
  const id = "sdd";
  const stages = ["SPECS", "PLAN", "DEV", "REVIEW"];
  const sub = ["le QUOI", "le COMMENT", "implémenter", "vérifier"];
  const parts: string[] = [];
  stages.forEach((name, i) => {
    const x = 40 + i * 240;
    parts.push(
      box({
        x,
        y: 110,
        w: 170,
        h: 70,
        lines: [name, sub[i] ?? ""],
        kind: i === 3 ? "accent" : "box",
      }),
    );
    if (i < 3) parts.push(edge(id, `M${x + 170} 145 H${x + 240}`));
  });
  parts.push(label(125, 72, "intention de l'utilisateur", "middle"));
  parts.push(edge(id, "M125 82 V108"));
  parts.push(box({ x: 760, y: 10, w: 170, h: 46, lines: ["MERGE", "zéro constat"] }));
  parts.push(edge(id, "M845 108 V58"));
  parts.push(label(853, 90, "propre", "start"));
  parts.push(edge(id, "M800 180 V240 H605 V182"));
  parts.push(label(702, 232, "tech vers DEV"));
  parts.push(edge(id, "M845 180 V285 H365 V182"));
  parts.push(label(605, 277, "arch vers PLAN"));
  parts.push(edge(id, "M890 180 V330 H125 V182"));
  parts.push(label(507, 322, "spec vers SPECS (nouvelle delta-spec)"));
  parts.push(
    label(
      20,
      385,
      "Terminaison : verdict APPROVE, zéro constat de toute classe, CI verte. Plafond : 5 itérations.",
      "start",
    ),
  );
  return svg(
    id,
    1000,
    410,
    "Cycle de vie SDD avec boucle rétroactive",
    "Quatre étapes en séquence : SPECS, PLAN, DEV, REVIEW. Une REVIEW propre mène à MERGE. Un constat tech renvoie à DEV, un constat arch renvoie à PLAN, un constat spec renvoie à SPECS. Le cycle se termine seulement quand une passe complète ne produit aucun constat.",
    parts.join(""),
  );
}

const DIAGRAMS: Record<string, () => string> = {
  architecture,
  foundation,
  "new-project": newProject,
  sdd,
};

/** SVG markup of a diagram, or null when the id is unknown. */
export function diagram(id: string): string | null {
  const build = DIAGRAMS[id];
  return build === undefined ? null : build();
}

export const DIAGRAM_IDS: string[] = Object.keys(DIAGRAMS);

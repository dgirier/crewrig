# CrewRig Quest

A local serious game that teaches CrewRig. Player-facing content is in French;
code, comments and documentation are in English. It needs no account and no
network once Node.js 24 is installed, and it has no npm dependency.

## Run

```sh
task quest
```

Without `task`:

```sh
node scripts/lib/node-floor-guard.js
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --disable-warning=ExperimentalWarning apps/crewrig-quest/src/main.ts
```

Then open <http://127.0.0.1:4173/>. The server binds to the loopback interface
only. Stop it with Ctrl-C.

| Variable | Default | Meaning |
|---|---|---|
| `CREWRIG_QUEST_PORT` | `4173` | TCP port (`0` picks a free one) |
| `CREWRIG_QUEST_DB` | `apps/crewrig-quest/data/quest.db` | SQLite results file (gitignored directory) |

If the database cannot be opened or written, the game stays playable, the API
reports `persisted: false` and the interface shows a French notice that results
are not saved.

## What is in the game

- Quiz menu by theme; the best score is shown as 0 to 5 stars. Stars are the
  correct ratio scaled to five and rounded half up, with five stars only when
  every answer is right. The server recomputes every score; the best score
  never decreases.
- Learning path of lessons with four SVG diagrams (architecture, foundation
  setup, new-project flow, SDD lifecycle) and a progress indicator.
- A dedicated SDD lifecycle section.
- "Effacer mes résultats" erases stars and progress after confirmation.

## Test

```sh
task test-quest
```

This validates the content, then runs the suites with `node --test`: star
rule, best-score monotonicity, persistence across a restart, the attempt API,
reset, degraded mode, the content validator (positive and negative cases) and
static-file path traversal. Tests only write inside a temporary directory.

## Content authoring

Content lives in `content/` and is plain JSON:

- `themes/<id>.json`: `id`, `title`, `description` and `questions`; each
  question has `id`, `text`, `choices` (at least two), `answer` (the index of
  the one correct choice), `explanation` and `source`.
- `lessons.json`: ordered lessons with `id`, `title`, `summary`, `body` blocks
  (`p`, `ul`, `ol`, `note`), an optional `diagram` id and `sources`.
- `sdd.json`: the SDD lifecycle section.

Every `source` is a repository path of the document the fact comes from, and
must exist. Check your changes with:

```sh
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --disable-warning=ExperimentalWarning apps/crewrig-quest/src/validate-content.ts
```

The checker rejects a question without exactly one correct answer, fewer than
two choices, a missing explanation, a theme without questions and duplicate
ids, naming the theme and the question. A new diagram is a function in
`web/diagrams.ts`; use the CSS classes and custom properties of
`web/styles.css` so it works in both color schemes, and give it a title and a
description.

## Layout

```text
apps/crewrig-quest/
  src/      server, store (node:sqlite), star rule, content validator
  web/      browser code (TypeScript, types stripped on the fly), CSS, SVG diagrams
  content/  themes, lessons and SDD section as JSON
  tests/    node:test suites
  data/     local results database (gitignored)
```

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
- Three audience tracks: Découverte (`discovery`), Équipe (`team`) and
  Contributeur (`contributor`). Each track is cumulative of the lower levels.
  The player can switch track at any time; progress is keyed by lesson id, so
  nothing is lost. The chosen track is a display preference kept in the
  browser. Every lesson and every question shows its level as a badge with
  the level name in words.
- Lesson check: each lesson ends with 2 to 3 questions, the correct answer
  shown after each. A lesson can be marked completed only once every check
  question was answered; wrong answers never block and the check can be
  retried. The server enforces it: `POST /api/lessons/progress` answers `409`
  until `POST /api/lessons/<id>/check` recorded a complete set of answers.
- Guided exercises: the two setup lessons (`fondations`, `nouveau-projet`)
  carry a checklist of real steps and commands, each citing its source
  document. The player ticks them (`PUT /api/lessons/<id>/checklist/<step>`
  with `{ "ticked": true }`) and ticks are stored in the database. The game
  never runs a command.
- A dedicated SDD lifecycle section.
- "Effacer mes résultats" erases stars and progress after confirmation.

## Test

```sh
task test-quest
```

This validates the content, then runs the suites with `node --test`: star
rule, best-score monotonicity, persistence across a restart, the attempt API,
the lesson check gate, checklist ticks, track switching, reset, degraded mode,
opening a database written by the previous schema, the content validator
(positive and negative cases, levels, checks, checklists) and static-file path
traversal. Tests only write inside a temporary directory.

## Content authoring

Content lives in `content/` and is plain JSON:

- `themes/<id>.json`: `id`, `title`, `description` and `questions`; each
  question has `id`, `level` (`discovery`, `team` or `contributor`), `text`,
  `choices` (at least two), `answer` (the index of the one correct choice),
  `explanation` and `source`. Tag contributor-only material (build internals,
  core-layer rules, contribution rules) `contributor`.
- `lessons.json`: ordered lessons with `id`, `level`, `title`, `summary`,
  `body` blocks (`p`, `ul`, `ol`, `note`), an optional `diagram` id, `sources`,
  a `check` of 2 to 3 questions (same shape as a theme question, without
  `level`) and an optional `checklist` of steps `{ id, text, command?, source }`.
  A `command` must appear verbatim in its `source` document: the checker fails
  otherwise, so no command is invented.
- `sdd.json`: the SDD lifecycle section.

Every `source` is a repository path of the document the fact comes from, and
must exist. Check your changes with:

```sh
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --disable-warning=ExperimentalWarning apps/crewrig-quest/src/validate-content.ts
```

The checker rejects a question without exactly one correct answer, fewer than
two choices, a missing explanation, a theme without questions and duplicate
ids, a missing or unknown `level`, a lesson check that does not hold two or
three well-formed questions, a malformed checklist and a checklist command
absent from its source, naming the theme, the lesson and the question or step. A new diagram is a function in
`web/diagrams.ts`; use the CSS classes and custom properties of
`web/styles.css` so it works in both color schemes, and give it a title and a
description.

## Database schema

One SQLite file, opened with `CREATE TABLE IF NOT EXISTS` only, so a file
written by an earlier version keeps working and gains the new tables
additively:

| Table | Columns | Purpose |
|---|---|---|
| `attempts` | `id`, `theme_id`, `correct`, `total`, `stars`, `created_at` | quiz attempts |
| `lesson_progress` | `lesson_id` (key), `completed_at` | completed lessons |
| `lesson_checks` | `lesson_id` (key), `correct`, `total`, `answered_at` | last result of each lesson check |
| `checklist_ticks` | `lesson_id`, `step_id` (key), `ticked_at` | ticked guided-exercise steps |

In degraded mode (R14) the same data is kept in memory for the session.
"Effacer mes résultats" empties all four tables.

## Layout

```text
apps/crewrig-quest/
  src/      server, store (node:sqlite), star rule, levels, content validator
  web/      browser code (TypeScript, types stripped on the fly), CSS, SVG diagrams
  content/  themes, lessons and SDD section as JSON
  tests/    node:test suites
  data/     local results database (gitignored)
```

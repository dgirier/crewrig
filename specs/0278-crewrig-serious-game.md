---
id: "0278"
slug: crewrig-serious-game
status: approved
complexity: standard
interaction-mode: INTERMEDIATE
related-issue: 1
version: 1.0.0
---

# CrewRig serious game

## Intent

A newcomer to AI coding assistants, a team being coached on CrewRig, or a contributor to the framework opens a web page on their own machine and learns the framework by playing. A menu lists quiz themes, each showing the best score reached as up to five stars, five meaning every answer was correct. A learning path, offered in three tracks matching those audiences, walks through the good practices with diagrams of the project architecture, of the foundation setup steps, and of the setup of a new project. Each lesson ends with a short check, and the setup lessons carry a step-by-step checklist the player ticks off. A dedicated section explains the SDD software lifecycle. The whole experience is in French, needs no account and no network, and remembers the player's results between sessions.

## Requirements

1. **R1 (local launch).** The system SHALL be started by one documented command and SHALL be reachable from a browser on the same machine only; it SHALL NOT require network access to a third party once installed.
2. **R2 (French content).** Every text shown to the player (menus, questions, answers, explanations, lessons, diagram labels) SHALL be in French.
3. **R3 (quiz menu).** The home screen SHALL list the quiz themes, each with its title, its number of questions, and its best score shown as a star rating from zero to five stars.
4. **R4 (themes).** The system SHALL provide at least these quiz themes: CrewRig overview and five pillars; layered context files; memory (MemPalace); skills, agents and the build; the SDD lifecycle; branching, pull requests and logbooks; harness feedback loop; multi-CLI parity.
5. **R5 (quiz play).** Within a quiz, the system SHALL present the questions one at a time as multiple-choice questions, SHALL let the player pick an answer, SHALL then reveal whether it was right together with a short explanation, and SHALL end with the final score and the earned stars.
6. **R6 (star rule).** The star rating of an attempt SHALL be the number of correct answers divided by the number of questions, scaled to five and rounded to the nearest whole number, except that five stars SHALL be awarded if and only if every answer was correct and zero stars if none was.
7. **R7 (best score).** The system SHALL keep, per theme, the best star rating reached and SHALL never lower it after a weaker attempt.
8. **R8 (persistence).** Attempts and learning progress SHALL be stored in a simple local database file on the player's machine, SHALL survive a restart of the application, and SHALL be erasable by the player from the interface after confirmation.
9. **R9 (learning path).** The system SHALL provide an ordered learning path of good-practice lessons, each lesson being completable, with completed lessons marked and an overall progress indicator.
10. **R10 (diagrams).** The learning path SHALL include diagrams for at least: the architecture of the project (artifacts, build, the four CLI targets, memory); the steps to configure the foundation; the steps to start a new project with CrewRig. Diagrams SHALL stay legible in light and dark display themes and SHALL carry a text alternative.
11. **R11 (SDD lifecycle).** The system SHALL include a section on the SDD lifecycle that shows the four stages SPECS, PLAN, DEV and REVIEW, the finding classes that route back to a stage, the termination rule, and the complexity tiers, with a diagram.
12. **R12 (consistency with the framework).** The factual content SHALL match the framework documentation of the repository at the time of writing, and each lesson SHALL cite the repository document it is drawn from.
13. **R13 (validation of content).** The system SHALL ship an automated check that rejects malformed quiz content: a question without exactly one correct answer, fewer than two choices, a missing explanation, or a theme without questions.
14. **R14 (robustness).** If the database cannot be opened or written, the system SHALL still let the player play and SHALL tell the player in French that results will not be saved.
15. **R15 (accessibility).** The interface SHALL be usable with the keyboard alone and SHALL keep text contrast at WCAG 2.1 AA level.
16. **R16 (audience tracks).** Each lesson and each quiz question SHALL carry one level among discovery (new to AI coding assistants), team (a team adopting CrewRig) and contributor (a contributor to the framework). The learning path SHALL offer one track per level, each track being cumulative of the lower levels, and the player SHALL be able to choose a track at any time without losing progress.
17. **R17 (lesson check).** A lesson SHALL be marked completed only after the player has answered its short check, of two to three questions, with the correct answer revealed after each; failing the check SHALL NOT block the player from retrying it.
18. **R18 (guided exercises).** The setup lessons (foundation, new project) SHALL include a step-by-step checklist of the real commands and actions of the framework documentation, whose ticks the player sets and the system remembers. The system SHALL NOT run any command on the player's behalf.

## Scenarios

**Scenario:** perfect quiz earns five stars

```text
Given the player opens the theme "Cycle de vie SDD" with no previous attempt
When  the player answers every question correctly
Then  the final screen shows five stars
And   the home menu shows five stars on that theme after restarting the application
```

**Scenario:** weaker retry keeps the best score

```text
Given the theme "Mémoire" has a best score of four stars
When  the player retries and earns two stars
Then  the home menu still shows four stars on that theme
```

**Scenario:** partial score is rounded

```text
Given a theme of 10 questions
When  the player answers 7 correctly
Then  the attempt earns four stars (7/10 scaled to 5 is 3.5, rounded to 4)
```

**Scenario:** learning progress survives a restart

```text
Given the player completed two lessons of the learning path
When  the application is stopped and started again
Then  those two lessons are still marked completed
```

**Scenario:** malformed content is rejected

```text
Given a quiz question with two correct answers
When  the content check runs
Then  it fails and names the theme and the question
```

**Scenario:** unwritable database

```text
Given the database file cannot be written
When  the player finishes a quiz
Then  the final screen is shown with a French notice that the result was not saved
```

**Scenario:** lesson completion requires its check

```text
Given the player opened a lesson with a three-question check
When  the player has not yet answered every question of the check
Then  the lesson cannot be marked completed
And   once every question is answered the lesson is marked completed, even if some answers were wrong
```

**Scenario:** checklist ticks survive a restart

```text
Given the player ticked two steps of the "new project" checklist
When  the application is stopped and started again
Then  those two steps are still ticked and no command has been run by the system
```

**Scenario:** track selection keeps progress

```text
Given the player completed three lessons on the discovery track
When  the player switches to the contributor track
Then  the three lessons remain marked completed wherever they appear
```

**Scenario:** reset requires confirmation

```text
Given the player has recorded results
When  the player asks to erase their results and confirms
Then  all stars and progress return to zero
And   declining the confirmation changes nothing
```

## Out of scope

- Accounts, named player profiles, multi-user leaderboards, and any remote or hosted deployment. One player per machine.
- Deferred-correction quiz mode: every quiz reveals the correct answer after each question.
- Executing any command from the interface.
- Languages other than French.
- Authoring quiz content from the interface; content is edited as files in the repository.
- Publishing the game through the documentation site.
- Distribution of the game through the CLI deployment targets.

## Open questions

- None. Placement in the layer taxonomy (core layer, new top-level application directory) is settled in the PLAN stage.

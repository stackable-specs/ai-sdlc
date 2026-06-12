---
name: sdlc:resolve
description: Resolve open questions in an AI-SDLC artifact (Requirements Brief, Design Note, Risk Register, …) either automatically — by inferring answers from repo evidence and stated defaults — or manually, by asking the user one question at a time. Trigger when the user asks to resolve open questions, answer the Q1..Qn on an artifact, lock in design defaults before the next gate, or close out unresolved decisions.
when_to_use: Use between AI-SDLC gates whenever an artifact has an "Open questions" section that should be closed before the next gate runs. Produces a decisions log and edits the source artifact to replace open questions with locked-in resolutions. Do not use to author a brand-new artifact — use the specific gate skill for that.
argument-hint: "[run-slug] [mode] [artifact]"
arguments:
  - run-slug
  - mode
  - artifact
disable-model-invocation: false
user-invocable: true
allowed-tools:
  - Read
  - Write
  - Edit
  - Grep
  - Glob
  - Bash
---

# AI-SDLC — Resolve Open Questions

Close out the "Open questions" section of an SDLC artifact so the next gate has a
stable foundation. Two modes:

- **`auto`** — the agent reads the artifact, gathers evidence from the repo and
  context packs, applies stated defaults, and locks in answers with a confidence
  rating and a one-line justification per question.
- **`ask`** — the agent asks the user **one question at a time** via the
  `AskUserQuestion` tool, presenting the stated default as the recommended
  option, and records the answer verbatim.

Both modes end the same way: the artifact's "Open questions" table is replaced
with a "Resolved decisions" table, a sibling `resolutions.md` log is written, and
the run's `state.md` records the resolution event.

## Inputs

Positional arguments from `$ARGUMENTS`:

- `run-slug`: $run-slug — the run directory under `.sdlc/runs/`. If omitted, use
  the most recent in-progress run.
- `mode`: $mode — `auto` or `ask`. Default: `ask` (lower autonomy, fewer surprises).
- `artifact`: $artifact — the artifact file name within the run directory
  (e.g. `01-requirements-brief.md`, `02-design-note.md`). If omitted, pick the
  most recently-modified artifact in the run directory that contains an `Open
  questions` heading.

### Argument resolution (be tolerant of positional drift)

Users frequently type `/sdlc:resolve <artifact> <mode>` instead of
`/sdlc:resolve <run-slug> <mode> <artifact>`. Resolve in this priority order
before working:

1. If `$1` contains `/` matching `<slug>/<file>` → split into (run, artifact).
2. If `$1` looks like an artifact selector (matches `^\d{2}-` or ends in `.md`,
   or matches a known artifact stem like `01-risk-gate`) →
   treat as `(most-recent-in-progress-run, $1)`, shift remaining args left.
3. If a directory `.sdlc/runs/$1/` exists → treat as run slug.
4. Otherwise → treat as run slug; if no such run exists, fall back to the
   most-recent in-progress run and note the assumption in the report.

If `$2 ∈ {auto, ask}` apply as `mode`; else if `$2` looks like an artifact
selector and `mode` is unset, treat as `artifact`. State the resolved
`(run, mode, artifact)` triple in the final report so the user can verify the
parsing.

Read these before doing any work:

- `.sdlc/runs/<slug>/contract.md` — the run's objective and authority.
- `.sdlc/runs/<slug>/state.md` — the run's gate ledger and autonomy level.
- The target artifact itself.
- The relevant context packs under `.claude/sdlc/context-packs/` — do not ask the
  user anything a context pack already answers.

## Workflow

1. **Locate the artifact.** Resolve the run slug (argument → most recent
   in-progress run under `.sdlc/runs/`). Resolve the artifact (argument → most
   recently-modified `.md` in the run dir containing an `## Open questions`
   heading). If no `## Open questions` heading is present, apply the
   **Missing-section policy** (below) before aborting.

### Missing-section policy

Some artifacts use synonymous headings instead of `## Open questions`:

| Artifact | Equivalent heading |
|---|---|
| `03-risk-register.md` | `## Open questions` (canonical) or `## 6a Open questions` (appended at resolve time) |
| `escalations/NN-*.md` | `## Decisions requested` + `## 3a Resolved decisions` (appended at resolve time) |
| `02-design-note.md` | `## Open questions` or `## Open items` |

When the artifact has synonymous content (e.g. `Decisions requested` rows with stated
recommendations) but no formal `## Open questions` heading:

1. Append a new `## Open questions` section to the artifact, populated from the
   synonymous content. Each row MUST have a stated default.
2. Then resolve as normal.

When the artifact has no open-decision content at all → abort with "no open
questions found; nothing to resolve."
2. **Parse the open questions table.** Extract each row: `id` (e.g. `Q3`),
   `question`, `why it matters`, `default if unresolved`. Treat any rendering
   variant (table, numbered list, sub-headings) tolerantly — fall back to a
   `Qn` enumeration if no IDs are present.
3. **Branch on mode.**
   - **`auto`**: for each question, gather evidence (grep the repo, read
     adjacent artifacts, consult context packs), then choose either the stated
     default or an alternative answer when the evidence justifies it. Produce
     for each question:
     - `answer`: the locked-in decision (one sentence, concrete).
     - `confidence`: `high` / `medium` / `low`.
     - `justification`: one line, citing the evidence (`path:line` or
       artifact section).
     - `source`: `default` | `evidence-overrides-default` | `synthesized`.
   - **`ask`**: for each question, invoke `AskUserQuestion` with:
     - The question as the prompt.
     - A short `header` chip (≤12 chars, e.g. "Q3 explain").
     - 2–4 options. The first option MUST be the stated default, suffixed with
       "(Recommended)". Add at most three alternatives drawn from the
       question's "why it matters" context. Always include "Other" implicitly
       (the tool adds it).
     - Single-select (no `multiSelect: true`) unless the question explicitly
       enumerates multiple-choice answers.
     **Ask one question per `AskUserQuestion` call**, sequentially. Do not
     batch open questions into one prompt — the user reads them one at a time.
4. **Replace the artifact's "Open questions" section.** Edit the source
   artifact to:
   - Rename the heading from `## Open questions` to `## Resolved decisions`.
   - Replace the table body with one row per question: `id | question |
     decision | source | confidence (auto only) | resolved by`.
   - Preserve everything else in the artifact verbatim. Do not reformat the
     rest of the document.
5. **Write the decisions log.** Create
   `.sdlc/runs/<slug>/resolutions.md` (or append if it already exists). For
   each resolution write:
   ```markdown
   ## <Qid> — <one-line question>
   - **Decision:** <locked-in answer>
   - **Source:** default | evidence-overrides-default | synthesized | user-answer
   - **Mode:** auto | ask
   - **Confidence:** high | medium | low   _(auto mode only)_
   - **Justification / Evidence:** <one line, with `path:line` where applicable>
   - **Resolved by:** <agent | user>
   - **Resolved at:** <date>
   ```
6. **Update `state.md`.** Append an entry under a `## Resolutions log` section
   (create it if absent) with one line per resolved question:
   `- <date> · <Qid> · <mode> · <one-line decision>`.
7. **Risk reassessment.** If any question was resolved against its stated
   default (i.e. `source: evidence-overrides-default` or a user answer that
   wasn't the recommended option), note it in the response so the next gate
   knows the risk model may have shifted. Do not change the run's risk score
   — that's the Risk gate's job.
8. **Report.** Print the path to the edited artifact, the path to the
   resolutions log, and a compact summary table of `Qid → decision (mode,
   confidence)`.

## Instructions

- **One question at a time in `ask` mode.** Never combine multiple open
  questions into a single `AskUserQuestion` call — multi-question prompts are
  for clarifying one decision with multiple sub-facets, not for batching
  unrelated open questions.
- **Stated defaults are first-class.** The "Default if unresolved" column in
  the open-questions table is the recommended option in `ask` mode and the
  baseline answer in `auto` mode. Only override with explicit evidence.
- **Cite evidence.** In `auto` mode, every justification must point at a
  concrete artifact: a `path:line` reference, a context-pack section, a BDR
  ID, an existing test, or a stated assumption in the brief. "Common sense"
  is not a justification.
- **Do not invent new questions.** This skill resolves the questions already
  in the artifact. If you spot a missing question, append it to the artifact's
  Open Questions table FIRST (with a stated default), then resolve it. Do not
  silently introduce decisions that were not enumerated.
- **Do not change the artifact's other sections.** Resolving questions can
  imply changes to requirements or design, but those edits belong to the next
  gate's run, not to this skill. Capture the implication in the decisions log
  under "Justification" and let the next gate apply the downstream changes.
- **Respect autonomy level.** If the run's `state.md` records autonomy level
  ≤ 2 and the user invoked `auto` mode, ask the user once (single
  `AskUserQuestion` confirmation) before proceeding — auto-resolving against
  low autonomy is itself a decision that exceeds the agent's authority.
- **Idempotency.** Running the skill twice on a fully-resolved artifact is a
  no-op. Detect "no open questions found" and exit without editing.
- **No new artifacts.** This skill edits an existing artifact and writes one
  sibling `resolutions.md`. It does not create gate artifacts (those belong
  to `/sdlc:N-<gate>` skills).

## Output Format

Respond with:

1. The artifact that was edited (path).
2. The decisions log path (`.sdlc/runs/<slug>/resolutions.md`).
3. A compact summary table:

   ```
   | Q  | Decision (one line)                            | Source                   | Confidence |
   |----|------------------------------------------------|--------------------------|------------|
   | Q1 | ...                                            | default                  | high       |
   | Q2 | ...                                            | evidence-overrides-...   | medium     |
   ```
4. A one-line risk note: which (if any) decisions diverged from the stated
   default, and a recommendation for the next gate.
5. The next-gate suggestion (e.g. "Proceed to `/sdlc:2-design <slug>`").

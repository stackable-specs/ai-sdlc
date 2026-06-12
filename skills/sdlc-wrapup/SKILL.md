---
name: sdlc:wrapup
description: Close out a completed AI-SDLC run — reconcile README.md and docs/ against the new code, commit the work, and archive the run directory. Trigger when the user asks to wrap up a run, finalize a delivery, tidy after sdlc-9, archive an sdlc run, or refresh project docs after a feature ships.
when_to_use: Use after the Learning gate (sdlc-9-learning) has closed a run and the user wants to land the work — sync README.md / docs/ with the new behavior, commit, and move the run dir into `.sdlc/archive/`. Do not use mid-run; gate skills still own their artifacts until Gate 9 completes.
argument-hint: "[run-slug] [--no-commit] [--no-archive]"
arguments:
  - run-slug
  - flags
disable-model-invocation: true
user-invocable: true
allowed-tools:
  - Read
  - Write
  - Edit
  - Grep
  - Glob
  - Bash
  - Agent
---

# AI-SDLC — Wrap Up

## Goal

Reconcile project-facing documentation (`README.md`, `docs/`) with the code that
shipped during a run, commit the work, and archive the run directory under
`.sdlc/archive/<run-slug>/`. Produces a concise change list, applies the doc
edits, makes a single commit, and moves the run dir.

## Inputs

Positional arguments from `$ARGUMENTS`:

- `run-slug`: $run-slug — the run directory under `.sdlc/runs/`. If omitted, use
  the most-recent run whose `state.md` reports `Status: complete` (Gate 9
  closed). If no completed run exists, abort with a clear message naming the
  most-recent in-progress run.
- Flags (parsed positionally from any remaining args):
  - `--no-commit` — generate the doc edits + change list but do not run `git commit`.
  - `--no-archive` — skip the move to `.sdlc/archive/`.
  - `--dry-run` — print the planned change list and exit without writing or committing.

Read these before doing any work:

- `.sdlc/runs/<slug>/state.md` — must show `Status: complete`. Abort otherwise.
- `.sdlc/runs/<slug>/01-requirements-brief.md` — for user-facing scope.
- `.sdlc/runs/<slug>/02-design-note.md` — for new exports / surface.
- `.sdlc/runs/<slug>/07-release-plan.md` — for the version bump and the
  proposed changelog text (often under a "Changelog" or "Changelog (proposed)"
  heading — this is the canonical source for `CHANGELOG.md` entries).
- `.sdlc/runs/<slug>/09-post-implementation-review.md` (or `09-learning-notes.md`)
  — for follow-ups and divergence notes.
- `README.md` and the `docs/` tree — the files we will potentially edit.
- `CHANGELOG.md` (project root) — the changelog file to append/create.
- `package.json` — the new version (Gate 7 already bumped it).

## Workflow

1. **Verify run is closed.** Read `.sdlc/runs/<slug>/state.md`. If `Status` is
   not `complete`, abort with the message
   `"run <slug> is not complete (Status: <x>); run /sdlc:9-learning first"`.

2. **Build the doc-staleness report.** For each candidate target
   (`README.md`, every `*.md` under `docs/`, and `CHANGELOG.md`), determine
   whether the run added, changed, or removed something the file documents.
   The cheapest signals to use:
   - **Public exports drift.** Diff the symbol list against `src/index.ts`
     (project-specific — adapt to whatever the project uses as its public
     barrel file). Anything exported but not mentioned in README is a candidate.
   - **CLI / bin entries.** Diff `package.json#bin` against any CLI section
     of README. New bin entries that are not documented are candidates.
   - **CHANGELOG entry.** Read the new version from `package.json#version`.
     If `CHANGELOG.md` already has a `## [<version>]` heading, skip; otherwise
     record a CHANGELOG row in the change list. See step 3a for sourcing.
   - **Environment variables / config flags.** Grep run artifacts for
     `CTRL_LOOP_*` / `*_ENV` / `process.env.*` introductions and check
     they appear in the relevant docs page.
   - **New on-disk surfaces.** Grep for newly-created `.<project>/state/`
     paths or sidecar files mentioned in artifacts; ensure docs explain them.

   For each finding, record a row: `target file · what's stale · proposed
   edit (one line)`. This is the **change list**.

### 3a. Sourcing the CHANGELOG entry

The wrap-up always touches `CHANGELOG.md` when a version bump occurred.
Source the entry in this priority order:

1. **`07-release-plan.md` has a `## Changelog` / `## Changelog (proposed)` section** → copy that section verbatim under the new version heading.
2. **No Changelog section but `release-plan.md` has a `## 4. Changelog` or similar** → use it; treat headings under it as Keep-a-Changelog categories (`Added` / `Changed` / `Fixed` / `Removed` / `Deprecated` / `Security` / `Dependencies`).
3. **Neither** → synthesize from the run artifacts: derive `Added` from new `src/index.ts` exports + new bin entries; derive `Changed` from modified public-API symbols (rare — would have triggered a Gate 3 escalation); derive `Dependencies` from `package.json`'s diff vs the previous tag.

Format follows [Keep a Changelog](https://keepachangelog.com):

```markdown
## [<version>] - <YYYY-MM-DD>

### Added
- <bullet from release plan or synthesized from run artifacts>

### Changed
- <bullet>

### Dependencies
- Added: <pkg>@<semver> (with one-line reason)
```

If `CHANGELOG.md` does not exist, create it with this header:

```markdown
# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [<version>] - <YYYY-MM-DD>
...
```

The new version's entry MUST be inserted **at the top** of the version list
(after the header preamble, before any prior version). Do NOT reorder or
edit prior entries — they are historical.

3. **Present the change list before editing.** Always print the change list to
   the user as a numbered table. If `--dry-run` was passed, exit here.

   ```
   | # | File | What's stale | Proposed edit |
   |---|------|--------------|---------------|
   | 1 | README.md | No mention of new `ctrl-loop` CLI bin | Add a "## CLI" section after "## Installation" |
   | 2 | docs/usage.md | Lists only TS rules | Add Markdown rule discovery section |
   ```

   At autonomy L1–L2 (read from `state.md`), pause for explicit user approval
   before proceeding. At L3+ proceed without pausing unless the change list
   touches `>5` files.

4. **Apply doc edits one file at a time.** For each row in the change list:
   - Read the target.
   - Make the smallest targeted edit. Prefer extending existing sections to
     adding new ones. Mirror the project's existing prose style (look at
     adjacent sections for tone).
   - Do not introduce new top-level sections without strong cause.
   - Do not delete unrelated content.

5. **Stage the doc edits + the closed run artifacts.**
   `git add README.md CHANGELOG.md docs/ .sdlc/runs/<slug>/` plus any source
   files the run modified that have not been committed yet (rare — Gate 7
   should have left a clean tree, but verify with `git status` and
   explicitly add anything the user expects). If `.sdlc/runs/` is
   gitignored (some projects keep run artifacts local-only), drop it from
   the `git add` argv silently — do not error. Never `git add -A` or
   `git add .`.

6. **Commit (unless `--no-commit`).** Build a commit message from the
   Requirements Brief's restated objective + the release-plan version. Use
   a Conventional Commits style consistent with `git log`:

   ```
   <type>(<scope>): <one-line summary>

   - what changed (bullet 1)
   - what changed (bullet 2)

   Closes sdlc run: <slug>

   Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
   ```

   Determine `<type>` from the run's Change class: `feat` for New feature /
   Small feature increment, `fix` for Contained bug fix, `refactor` for
   Internal refactor, `chore` for Dependency / Infra. Use HEREDOC for
   formatting (see CLAUDE.md commit guidance).

   If pre-commit hooks fail, fix the underlying issue and create a NEW commit
   — do not amend or `--no-verify`.

7. **Archive the run (unless `--no-archive`).** Move
   `.sdlc/runs/<slug>/` → `.sdlc/archive/<slug>/`. Use `git mv` when the
   run dir is tracked, or plain `mv` when `.sdlc/runs/` is gitignored
   (check `git check-ignore .sdlc/runs/<slug>` first). Create
   `.sdlc/archive/` if it doesn't exist.

   Append a one-liner to `.sdlc/archive/INDEX.md` (create if absent):
   `- <date> · <slug> · <one-line objective> · final risk <score> · divergence <d>/<t> · primary artifacts: <list>`.

   If the move changed tracked state, make this a second commit:
   ```
   chore(sdlc): archive run <slug>
   ```
   If the run dir was gitignored, the archive step touches no tracked
   files — skip the second commit and note "archive: local-only" in
   the final report.

8. **Report.** Print:
   - Number of doc files edited and a one-line summary of each.
   - The two commit hashes (`git log -2 --oneline`).
   - The archive path.
   - Any follow-up backlog items from `09-*.md` that were NOT addressed by
     this wrap-up (these stay open in the index).

## Instructions

- **Never push.** This skill commits locally and archives. Pushing is a
  blocked action requiring explicit human request.
- **Never amend** an existing commit. If a hook fails, fix and re-commit.
- **Be conservative with deletes.** Removing a docs section requires a
  matching note in the run's release plan or learning notes — otherwise leave
  it and flag in the report.
- **No PR creation here.** This skill stops at local commits. Use a separate
  `gh pr create` step if the user wants a PR.
- **Stale snapshots.** When updating doc tables that quote numbers (test
  counts, coverage), prefer the operating manual's "live commands, not stale
  snapshots" guidance (`.claude/sdlc/agent/operating-manual.md`) — replace
  fixed counts with `bun test` invocations or dated stamps.
- **Idempotency.** Running the skill twice on an already-archived run is a
  no-op (state.md cannot be located under `.sdlc/runs/` after archive).
  Detect this and exit cleanly with "run already archived at .sdlc/archive/<slug>/".
- **Single commit per concern.** Doc edits + closed-run artifacts go in commit
  1. The archive move goes in commit 2. Do not bundle them — the archive
  rename should be reversible without losing the doc updates.

## Dynamic Context Examples

Uncomment when the skill needs live state before reasoning:

```!
# git status --short
# ls .sdlc/runs/
# grep -E "^- (Slug|Status):" .sdlc/runs/*/state.md
```

## Output Format

Respond with:

1. **Resolved inputs:** `<run-slug>` (source: argument | auto-pick) + flags applied.
2. **Change list** — the numbered table from step 2/3 (even after edits, for the record).
3. **Files edited** — bullet list with one-line summaries (always includes
   `CHANGELOG.md` when a version bumped; explicitly state "created" vs "appended").
4. **CHANGELOG entry** — quote the new `## [<version>] - <date>` block that was
   added so the user can verify wording at a glance.
5. **Commits** — `git log -2 --oneline` output (or single commit if archive was local-only).
6. **Archive location** — `.sdlc/archive/<slug>/` (or "skipped" if `--no-archive`,
   or "local-only" if `.sdlc/runs/` is gitignored).
7. **Follow-ups still open** — copied from the learning notes / divergence report; one bullet each.
8. **Next step suggestion** — typically `gh pr create` or `git push`, scoped to what the user signaled. If the run produced a tag-worthy version bump, also suggest `git tag v<version> && git push --tags`.

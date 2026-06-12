---
name: sdlc:workflow
description: Run a named AI-SDLC workflow defined in this skill's reference/ directory. Currently supports `plan` (gates 0–3 + resolve) and `execute` (gates 4–9 — build, test, security, release, validate, learn). Trigger when the user asks to run an SDLC workflow end-to-end, plan a change without building it, or build-and-ship a change that already has a plan.
when_to_use: Use as the entry point for multi-gate SDLC runs. Prefer over invoking individual gate skills one-by-one when the user wants the whole sequence executed with the right stop/resume rules. Do not use for a single gate — call that gate's skill directly. Do not use for ad-hoc lookups of framework knowledge — that is `/sdlc:knowledge`.
argument-hint: "<workflow-name> [run-slug] [level=N] [risk=N] | list"
arguments:
  - workflow-name
  - run-slug
disable-model-invocation: false
user-invocable: true
allowed-tools:
  - Read
  - Write
  - Edit
  - Grep
  - Glob
  - Bash
  - Skill
---

# AI-SDLC Workflow Runner

**Role:** dispatcher for named SDLC workflows. Loads a workflow spec from `reference/<name>.md`, then executes its numbered steps by invoking the gate skills it names — propagating the run slug, autonomy level, and risk tolerance through `.sdlc/runs/<slug>/state.md`.

This skill does not author run artifacts itself. Each gate skill it invokes does that.

## Available workflows

Files in `.claude/skills/sdlc-workflow/reference/`:

- `plan.md` — SDLC Plan (gates 0–3 + resolve). Takes a raw change intent through intake, requirements, design, risk, and open-question resolution. Stops before any code is written. Output: a planned, risk-cleared run ready for `execute`.
- `execute.md` — SDLC Build & Ship (gates 4–9). Picks up a planned run and takes it through implementation, test, security, release planning, deployment validation, and post-implementation learning. Pauses for the human at the release boundary (deploy is a blocked action).

Run `/sdlc:workflow list` to print this list from disk.

## Inputs

`$ARGUMENTS` parses as:

- `list` — print the available workflows (filenames + one-line purpose pulled from each spec's "Artifact Definition / Purpose" line) and stop.
- `<workflow-name>` — required for any run. Must match a `<name>.md` file under `reference/` (case-insensitive). Examples: `plan`, `execute`.
- `<run-slug>` — optional. For `plan`, omit it (gate 0 will create one). For `execute`, required — names the planned run to pick up.
- `level=N` — optional autonomy level (1–5). Only honored by `plan`, which writes it into `state.md`. `execute` reads it from `state.md`.
- `risk=N` — optional risk tolerance (2–10). Same rule as `level`.
- `resume <slug>` — for `execute`, resume a previously paused run (e.g., after the human-executed deploy).

## Workflow

1. Parse `$ARGUMENTS`. If empty, print "missing workflow name — try `/sdlc:workflow list`" and stop.
2. If `list`, glob `reference/*.md`, read the first `## Artifact Definition` block of each, and print `<name> — <purpose>` lines. Stop.
3. Resolve the workflow name to `reference/<name>.md`. If not found, list available names and stop.
4. **Pre-flight check:**
   - For `plan`: ensure no in-progress run blocks intake; if `resume <slug>` is given, refuse — `plan` is not resumable mid-flight (re-run the failed gate directly).
   - For `execute`: load `.sdlc/runs/<slug>/state.md`. Require rows 0–3 all `passed`, no open hard-stop triggers, risk score < risk tolerance. If any check fails, print which one and stop — point the user at `/sdlc:plan` or `/sdlc:resolve`.
5. `Read` the resolved workflow spec. Treat its **Workflow Steps** section as the script.
6. **Execute each step in order:**
   - For each step that says "Run `/sdlc:<gate>`", invoke that skill via the Skill tool, passing the run slug. Wait for completion before moving on.
   - For each step that says "HUMAN ACTION" (e.g., the deploy step in `execute.md`), write the workflow's current state into `state.md`, print the pause message + resume command, and **stop**. Do not continue past a human-action step in the same invocation.
   - After each gate completes, read its `### sdlc-result` block. If `status: escalate` or `status: error`, halt the workflow and surface the escalation — do not advance.
7. **Enforce the spec's gate checks:**
   - `state.md` formula drift between gate previews and the Risk gate's authoritative formula → hard error.
   - Acceptance criteria without tests, tests narrated rather than executed, missing rollback procedure, production gap in gate 8 — all halt per the spec's "Error Handling" section.
8. **On completion**, emit the workflow's summary block from its final step. Append a top-level `### sdlc-workflow-result` containing: workflow name, run slug, gates completed, final status, artifact paths.

## Instructions

- The workflow specs under `reference/` are the source of truth — do not encode step lists in this SKILL.md. If a workflow needs to change, edit its spec file. If a new workflow is needed, add a new `<name>.md` under `reference/` (and ideally mention it in the "Available workflows" list above).
- Each spec lists which gate skills it invokes. This runner just dispatches — it does not interpret gate semantics. Bugs in a gate are bugs in the gate skill, not in the workflow.
- Never skip a step in the spec. If a step is N/A for this change class (per the gate profile in `state.md`), record it as `skipped` with a reason in `state.md` — do not silently drop it.
- Human-action steps are **non-negotiable pause points**. Even at autonomy level 5, the deploy in `execute.md` is human-executed; this runner stops and waits.
- For lookups of framework knowledge during a run, the gate skills already call `/sdlc:knowledge` themselves — this runner doesn't need to.

## Output Format

For `list`:

```
### sdlc-workflows
- plan — <one-line purpose>
- execute — <one-line purpose>
```

For a run, after each gate prints its own `### sdlc-result`, the workflow's final line is:

```
### sdlc-workflow-result
workflow: plan | execute
slug: <run-slug>
gates: [0, 1, 2, 3, resolve]   # or [4, 5, 6, 7, 8, 9]
status: passed | paused-for-human | escalate | error
pause-reason: <only if paused — quotes the spec's human-action step>
artifacts: [.sdlc/runs/<slug>/...]
next: <e.g. "review PR and deploy, then `/sdlc:workflow execute resume <slug>`">
```

For a pause at a human-action step, print the pause-reason and the exact resume command — do not continue.

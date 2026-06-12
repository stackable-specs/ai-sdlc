---
name: sdlc:deliver
description: Run a software change end-to-end through the AI-SDLC quality-gate lifecycle. Trigger when the user asks to deliver a feature, fix, or change "properly", run the SDLC, run all the gates, or take a change from intent to production with controlled autonomy. Also handles resuming a paused run.
when_to_use: Use to orchestrate the full AI-SDLC loop (intake → 9 quality gates) for one change, with a chosen autonomy level and risk tolerance that pause the loop for human feedback. Use `resume` to continue a paused run. Do not use for a single isolated gate — invoke that gate skill directly.
argument-hint: "<intent> [level=N] [risk=N]  |  resume [slug]"
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
  - AskUserQuestion
  - Skill
---

# AI-SDLC Deliver — lifecycle orchestrator

## Goal

Move one software change from intent to production at best-in-class quality with the
minimum human input, by running it through the AI-SDLC quality gates. The human sets
two control knobs — **autonomy level** and **risk tolerance** — and the loop pauses for
feedback whenever risk meets the threshold, a hard-stop trigger fires, or the autonomy
level requires approval.

Read [control-model.md](control-model.md) — it defines risk scoring, hard-stop
triggers, blocked actions, and the autonomy → approval table. You must obey it.

## Inputs

`$ARGUMENTS` is one of:

- **A new change:** free-text intent, optionally with `level=N` (1–5) and `risk=N` (2–10).
  Example: `Add invitation expiry to workspace invites level=3 risk=6`
- **Resume:** `resume` or `resume <slug>` — continue a paused run from `.sdlc/runs/`.

If intent is missing for a new change, ask for it. If `level` or `risk` is missing, ask
with `AskUserQuestion` (one question for autonomy level, one for risk tolerance) — show
the options from the autonomy → approval table. Do not silently guess these two knobs.

## Workflow

### A. Start or resume

1. **Resume path:** if args start with `resume`, locate the run dir under `.sdlc/runs/`
   (use the given slug, else the most recent `paused` run; if several, ask which). Read
   its `state.md`. Re-read any escalation report and the human's response in context.
   Treat human approval as advancing **one gate only**. Jump to step C at the next
   pending gate.
2. **New change path:** confirm `level` and `risk` (ask if absent). Continue to B.

### B. Intake & classify

3. Invoke the **`sdlc:0-intake`** skill with the intent, level, and risk. It creates
   `.sdlc/runs/<slug>/`, writes `contract.md`, classifies the change, resolves the
   **gate profile**, and initializes `state.md` with the gate ledger.
4. Read the resulting `state.md`. Show the user: slug, restated objective, change
   class, gate profile, autonomy level, risk tolerance.

### C. Run the gates

For each gate in the profile, in order (map letters to skills: R→`1-requirements`,
D→`2-design`, K→`3-risk`, I→`4-implementation`, T→`5-test`, S→`6-security`,
L→`7-release`, P→`8-validation`, G→`9-learning`):

5. **Spawn a subagent** (`Agent`, `general-purpose`) so each gate runs in fresh context
   and this orchestrator stays lean. Prompt template:

   > Run AI-SDLC gate **`<gate>`** for the change in `.sdlc/runs/<slug>/`.
   > Invoke the Skill tool with skill `sdlc:<gate>`. If unavailable, read
   > `.claude/skills/sdlc-<gate>/SKILL.md` and follow it exactly.
   > Read `contract.md`, `state.md`, and all prior numbered artifacts first.
   > Write this gate's artifact, update the `state.md` ledger row, and return the
   > `### sdlc-result` block verbatim.

   Lightweight gates (`1-requirements`, `3-risk`, `7-release`, `8-validation`,
   `9-learning`) may instead be run inline via the `Skill` tool if subagent overhead
   isn't warranted. `2-design`, `4-implementation`, `5-test`, `6-security` should always
   be subagents.
6. After the subagent returns, **re-read `state.md`** (the gate updated its ledger row
   and the latest risk score). Trust `state.md` over the returned text.
7. **Run the pause evaluation** from `control-model.md`:
   - hard-stop trigger fired, **or** risk score ≥ tolerance → invoke **`sdlc:escalate`**,
     set run status `paused`, then **stop and report to the user**. Do not continue.
   - autonomy level requires approval at this gate → pause: summarize the gate's
     artifact, set status `paused (awaiting approval)`, stop and ask the user to
     approve before re-invoking `/sdlc:deliver resume <slug>`.
   - otherwise → continue to the next gate.
8. **Release gate special case:** production deployment is a blocked action. After
   `7-release` produces the plan, always pause for human approval before `8-validation`.

### D. Finish

9. When all profile gates are `done`, write `pr-package.md` in the run dir (summary,
   changes, out-of-scope, risk notes, test evidence, reviewer checklist, required
   reviewers, release/rollback pointer).
10. Set run status `complete`. Report: artifacts produced, gates passed, final risk
    score, escalations raised, and the PR package path.

## Instructions

- The prime directive: never skip from intent to code. Every gate produces its artifact
  before the next begins; never claim a gate passed without its artifact on disk.
- The human's stated Authority overrides the change class's default level — it may add
  rigor or lower autonomy, never raise it without explicit approval.
- Keep your own context lean: delegate heavy gates to subagents and rely on `state.md`
  and the numbered artifacts as the shared memory between gates.
- Record every escalation, approval, and autonomous completion in `state.md` so higher
  autonomy stays auditable.
- Reference framework detail by calling `/sdlc-knowledge` with queries: `agent/operating-manual.md`, `quality-gates/quality-gates.md`, `agent/change-classes.md`, or `autonomy` for autonomy policies.

## Output Format

1. Run header — slug, change class, gate profile, level, risk tolerance.
2. Per-gate line — gate, status, risk score, artifact path.
3. On pause — the trigger, the escalation report path, and exactly what the human must
   decide, then `/sdlc:deliver resume <slug>` to continue.
4. On completion — PR package path and the gate ledger summary.

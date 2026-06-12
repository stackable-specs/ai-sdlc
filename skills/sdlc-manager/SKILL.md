---
name: sdlc:manager
description: Orchestrate the AI-SDLC gate sequence in isolated subagents, propagating only the compact sdlc-result block between gates to keep the main context window lean. Enforces autonomy level and risk tolerance at every gate boundary.
when_to_use: Use when you want to run one or more SDLC gates hands-free, with each gate executing in its own subagent so artifact content never pollutes the main context. Prefer over calling individual gate skills when the user wants a sequence of gates to run automatically. Do not use for a single interactive gate where you want to see the artifact in-context — call that gate's skill directly.
argument-hint: "[run-slug] [gates=N] [through=N] [level=N] [risk=N]"
arguments:
  - run-slug
  - gates
  - through
  - level
  - risk
disable-model-invocation: false
user-invocable: true
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
  - Agent
  - Skill
---

# AI-SDLC Manager

**Role:** Thin orchestrator that runs SDLC gate skills in isolated subagents, extracts the compact `### sdlc-result` block from each, updates `state.md`, enforces stop rules, and asks the human only when the autonomy level or risk score requires it.

The manager never reads artifact content itself. All heavy context (requirements brief, design note, risk register, etc.) stays inside the subagent that produced it. Only the result block — gate, status, risk-score, triggers, artifact path — flows back to the main context.

## Inputs

`$ARGUMENTS` parses as:

| Token | Meaning |
|-------|---------|
| `<slug>` | Run slug — e.g. `tls-cert-manager-2026-06-02`. Omit to auto-detect the most recent in-progress run under `.sdlc/runs/`. |
| `gates=N` | Start at gate N (1–9). Default: the first required+pending gate in the ledger. |
| `through=N` | Stop after gate N (inclusive). Default: run all required pending gates in sequence. |
| `level=N` | Override autonomy level for this session (1–5). Never raises above the level in `state.md`. |
| `risk=N` | Override risk tolerance (2–10). Never raises above the tolerance in `state.md`. |

Examples:
- `/sdlc:manager tls-cert-manager-2026-06-02` — run all remaining pending gates
- `/sdlc:manager tls-cert-manager-2026-06-02 gates=2 through=3` — run only design + risk
- `/sdlc:manager tls-cert-manager-2026-06-02 level=3` — allow autonomous multi-gate run

## Gate Map

| # | Gate | Skill | Human-action gate? |
|---|------|-------|--------------------|
| 0 | Intake | `sdlc-0-intake` | no |
| 1 | Requirements | `sdlc-1-requirements` | no |
| 2 | Design | `sdlc-2-design` | no |
| 3 | Risk | `sdlc-3-risk` | no |
| 4 | Implementation | `sdlc-4-implementation` | no |
| 5 | Test | `sdlc-5-test` | no |
| 6 | Security | `sdlc-6-security` | no |
| 7 | Release | `sdlc-7-release` | no |
| 8 | Production Validation | `sdlc-8-validation` | no |
| 9 | Learning | `sdlc-9-learning` | no |

## Workflow

### 1. Resolve the run

1. Parse `$ARGUMENTS` for a slug. If absent, glob `.sdlc/runs/*/state.md`, read `Status:` lines, and pick the most recent `in-progress` run. If none found, tell the user and stop.
2. Read `.sdlc/runs/<slug>/state.md` (the only file the manager ever reads directly).
3. Extract from `state.md`:
   - Autonomy level — apply `level=N` override only if it **lowers** the value
   - Risk tolerance — apply `risk=N` override only if it **lowers** the value
   - Risk formula (frozen — never change it)
   - Gate ledger rows (gate #, Required, Status, Risk score)
4. Determine the **gate range**: start = `gates=N` arg or first row where `Required=yes AND Status=pending`; end = `through=N` arg or last row where `Required=yes`.
5. Print one-line summary: `Run: <slug> | Level: <N> | Tolerance: <N> | Gates: <start>–<end>`

### 2. Gate loop

For each gate in the resolved range (ascending), in order:

#### 2a. Skip check
- If `Required=no` → log `gate <N> skipped (not in gate profile)` and advance.
- If `Status=passed` or `Status=skipped` → log `gate <N> already complete, skipping` and advance.

#### 2b. Local-run verification gate (gate 7 — Release)
- Gate 7 (Release) is a local-run verification gate. It does NOT pause for human action.
- The subagent (step 2d) runs the `sdlc-7-release` skill, which reviews the project, starts the service(s) using the project's defined local method, and verifies they are healthy.
- Proceed to step 2d like any other gate.

#### 2c. Autonomy gate check (before running)
- If autonomy level ≤ 2 and this is not the first gate in the current invocation → pause:
  ```
  [PAUSED — level <N> requires human confirmation before each gate]
  Gate <N> (<name>) is next. Run: /sdlc:manager <slug> gates=<N>
  ```
  Stop. Do not advance.

#### 2d. Run the gate in a subagent

Spawn an Agent with the following prompt template (keep it minimal — the subagent reads everything it needs from disk):

```
You are running AI-SDLC gate <N> — <gate-name> for run slug `<slug>`.

Run directory: .sdlc/runs/<slug>/
State file: .sdlc/runs/<slug>/state.md

Invoke the `<skill-name>` skill by calling the Skill tool with args `<slug>`.

After the skill completes:
1. Extract ONLY the `### sdlc-result` fenced block from the output.
2. If the skill escalated or errored, also include the escalation summary (≤ 5 lines).
3. Return ONLY those extracted blocks — no artifact content, no explanatory prose.

Your entire response must fit in ≤ 30 lines. Do not repeat the artifact.
```

Wait for the subagent to complete.

#### 2e. Parse the result

Extract from the subagent response:
- `status:` — `passed | escalate | error`
- `risk-score:` — integer
- `hard-stop-triggers:` — list
- `artifact:` — path

#### 2f. Update state.md

Edit `.sdlc/runs/<slug>/state.md`:
- Update the gate's ledger row: `Status = <status>`, `Risk score = <n>`, `Artifact = <path>`
- Update `Latest risk score: <n>`

#### 2g. Stop-rule evaluation

In order:

1. **Error** — if `status=error` → print the error, halt. Do not advance the ledger further.

2. **Escalation** — if `status=escalate` or any hard-stop trigger is non-`none` → print:
   ```
   [ESCALATED at gate <N>]
   Trigger: <trigger-name>
   Review .sdlc/runs/<slug>/<artifact> and resolve with /sdlc:resolve <slug>
   ```
   Halt. Do not run subsequent gates.

3. **Risk tolerance breach** — if `risk-score >= risk-tolerance` (using the frozen formula from `state.md`) → print:
   ```
   [RISK BREACH at gate <N>]
   Score <risk-score> >= tolerance <tolerance>. Pausing for human review.
   Resolve with /sdlc:resolve <slug>, then resume: /sdlc:manager <slug> gates=<N+1>
   ```
   Halt.

4. **Autonomy gate check (after running, for next gate)** — handled at step 2c of the next iteration.

#### 2h. Log the gate result (one line)

```
✓ gate <N> <gate-name> — <status> (risk <score>) → <artifact-filename>
```

Advance to the next gate.

### 3. End-of-run summary

After all gates in range complete (or at halt), print:

```
### sdlc-manager-result
slug: <slug>
gates-run: [<N>, <N>, ...]
gates-skipped: [<N>, ...]
final-status: complete | paused | escalated | risk-breach | error
next: <exact command to continue, or "all required gates complete">
```

## Context discipline rules

These rules exist to keep the main context window small:

1. **Never read artifact content** — only read `state.md`. All other file I/O happens inside subagents.
2. **30-line subagent response cap** — the subagent prompt instructs it to return only the result block. If the subagent returns more, extract only the `### sdlc-result` block and discard the rest.
3. **No intermediate summaries** — do not summarize what each gate did beyond the one-line log in step 2h. The artifacts on disk are the source of truth.
4. **Stateless between gates** — each gate subagent is independent. It reads its inputs from disk, writes its artifact to disk, and returns only the result block. No state passes through the manager's context.
5. **state.md is the shared bus** — all gate metadata (status, risk score, artifact path) lives in `state.md`. The manager reads it once at the start, then patches it after each gate.

## Autonomy level reference

| Level | Behavior |
|-------|---------|
| 1 | Pause before every gate; show the result block; wait for human `y` |
| 2 | Pause between gates (step 2c); run one gate per invocation |
| 3 | Run gates sequentially without pause; halt only on escalation or risk breach |
| 4 | Same as 3; also auto-resolve non-judgment open questions via `/sdlc:resolve` |
| 5 | Maximum autonomy; bypass inter-gate pauses; still honor hard-stop triggers |

## Output Format

Progress lines during the run:

```
Run: tls-cert-manager-2026-06-02 | Level: 2 | Tolerance: 6 | Gates: 2–3
→ gate 2 design — running in subagent...
✓ gate 2 design — passed (risk 4) → 02-design-note.md
→ gate 3 risk — running in subagent...
✓ gate 3 risk — passed (risk 5) → 03-risk-register.md
```

Final block:

```
### sdlc-manager-result
slug: tls-cert-manager-2026-06-02
gates-run: [2, 3]
gates-skipped: []
final-status: complete
next: /sdlc:manager tls-cert-manager-2026-06-02 gates=4
```

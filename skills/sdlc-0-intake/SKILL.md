---
name: sdlc:0-intake
description: Intake and classify a software change for the AI-SDLC lifecycle. Trigger when starting a new change, writing the minimal human input contract, classifying a change, or setting up an SDLC run. Produces the contract, the change class, the gate profile, and the run state file.
when_to_use: Use as the first step of an AI-SDLC delivery, before any quality gate. Captures the five-part Minimal Human Input Contract, classifies the change, resolves which gates apply, and creates the run directory. Do not use to write requirements detail — that is the Requirements gate.
argument-hint: "<intent> [level=N] [risk=N]"
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

# AI-SDLC Gate 0 — Intake & Classify

## Goal

Turn a raw request into a **Minimal Human Input Contract**, classify the change, and
set up the run so the quality gates can execute against shared state.

## Inputs

`$ARGUMENTS`: the change intent, optionally `level=N` (autonomy 1–5) and `risk=N` (risk tolerance 2–10).

## Workflow

1. **Build the Minimal Human Input Contract** (run `/sdlc-knowledge templates/minimal-input-contract.md` for the contract template):
   - **Intent** — desired outcome (one sentence). Required; ask if missing.
   - **Context delta** — what is new, unusual, or risky vs. context packs. Infer and state assumption if absent.
   - **Priority** — tradeoff to optimize (safe rollout / auditability / speed / UX / perf / cost). Infer if absent.
   - **Authority** — autonomy level + escalation triggers. Default `level=2` if omitted; state it.
   - **Acceptance** — Gherkin happy-path + negative/boundary. Draft from intent if not provided; mark as drafted.
2. **Restate the objective** in one precise sentence; confirm understanding.
3. **Classify** into exactly one class (most rigorous when ambiguous):

   | Class | Default level | Gate profile |
   |-------|---------------|--------------|
   | Trivial | 4 | I, T(light), G |
   | Test-only | 3–4 | I, T, G |
   | Contained bug fix | 3 | R(light), K, I, T, P, G |
   | Internal refactor | 2–4 | D, K, I, T, P, G |
   | Small feature increment | 2–3 | R, D, K, I, T, S, L, P, G |
   | New feature | 2 | R, D, K, I, T, S, L, P, G (all nine) |
   | Schema / data migration | 2 | R, D, K, I, T, S, L, P, G |
   | Public API change | 2 | all nine |
   | Security / auth change | 1–2 | all nine + threat model |
   | Dependency change | 2–3 | K, I, T, S, L, P, G |
   | Infrastructure / deploy | 2–3 | D, K, I, T, S, L, P, G |

4. **Resolve autonomy**: human's stated level overrides class default (may lower, never raise). **Resolve risk tolerance**: use given `risk`, else level default per `control-model.md`.
5. **Create run directory** `.sdlc/runs/<slug>/` (`<slug>` = short kebab-case from intent).
6. **Write `contract.md`** — five contract sections + restated objective.
7. **Write `state.md`** per template below. Set `Required` = `yes` for gates in profile; `no` otherwise. Light gates (e.g. `R(light)`) are `yes` and run proportionately.
8. Report the slug, change class, gate profile, level, risk tolerance, and any inferred contract field assumptions. Identify the first required gate and tell the human the exact skill to run (e.g. `/sdlc-1-requirements`). If the effective autonomy level allows autonomous execution, proceed immediately; otherwise prompt the human to run it.

## state.md structure

```markdown
# AI-SDLC Run State

- Slug: <slug>
- Intent: <one line>
- Change class: <class>
- Autonomy level: <1-5>
- Risk tolerance: <2-10>   (pause when a gate's risk score >= this)
- Risk formula: Impact + Likelihood (range 2-10)   # authoritative; every gate uses this
- Latest risk score: <n/a until gate 3>
- Status: in-progress
- Created: <date>

## Gate ledger

| # | Gate | Required | Status | Risk score | Artifact |
|---|------|----------|--------|------------|----------|
| 1 | Requirements | yes/no | pending | - | - |
| 2 | Design | yes/no | pending | - | - |
| 3 | Risk | yes/no | pending | - | - |
| 4 | Implementation | yes/no | pending | - | - |
| 5 | Test | yes/no | pending | - | - |
| 6 | Security | yes/no | pending | - | - |
| 7 | Release | yes/no | pending | - | - |
| 8 | Production Validation | yes/no | pending | - | - |
| 9 | Learning | yes/no | pending | - | - |

## Escalation log

_(none yet)_
```

**Risk formula is frozen at intake.** Every gate reads the formula from `state.md`; escalate before computing if it disagrees — never silently switch math (e.g. addition vs. multiplication).

## Output Format

1. Run slug and directory path.
2. Restated objective.
3. Change class, effective autonomy level, risk tolerance, resolved gate profile.
4. Any assumptions made for inferred contract fields.

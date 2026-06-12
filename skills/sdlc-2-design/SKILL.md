---
name: sdlc:2-design
description: Run the AI-SDLC Design gate — produce a technically sound Design Note with options, tradeoffs, and a recommended design. Trigger when the user asks to design a solution, compare approaches, write a design doc or ADR, or plan architecture for a change.
when_to_use: Use as quality gate 2 of the AI-SDLC lifecycle, after Requirements and before Risk. Produces the Design Note covering architecture, API, data model, error handling, security, and observability. Do not use to write the step-by-step build plan — that is the Implementation gate.
argument-hint: "[run-slug]"
disable-model-invocation: false
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

# AI-SDLC Gate 2 — Design

**Artifact:** Design Note → `02-design-note.md`
**Gate question:** Is the solution technically sound?

## Inputs

The run slug in `$ARGUMENTS`, else the most recent in-progress run. Read `contract.md`,
`state.md`, `01-requirements-brief.md`, and context packs 03 (system context) and 04 (domain rules).

## Workflow

1. **Map the current state.** For non-trivial codebases, spawn an `Explore` subagent to find affected components, schemas, APIs, and call sites — keep this skill's context focused on conclusions.
2. **Gap analysis** — difference between current and desired behavior.
3. **Generate at least two solution options** with pros and cons for each.
4. **Tradeoff analysis** — compare options across complexity, risk, cost, maintainability, security, performance, and rollout safety.
5. **Recommend a design** within the contract's Authority. If the only sound design requires a public API or data-model change, that is a hard-stop trigger.
6. **Detail the design:** architecture/components, API contract, data model/schema changes, state model & transitions, error handling, security, observability, backward compatibility.
7. **Reassess risk** using `state.md`'s frozen Risk formula — raise Impact for new surface area, raise Likelihood for unfamiliar areas. For significant design decisions, record a Decision Record (run `/sdlc-knowledge templates/decision-record.md` for the template).
8. Write `02-design-note.md` (sections: current state, gap analysis, solution options ≥2 with pros/cons, tradeoff analysis, recommended design, design detail — architecture, API contract, data model/schema, state model, error handling, security, observability — and risks pointer to Risk Register). Update `state.md` ledger row and emit the result.

Escalate (`/sdlc:escalate`) if the design requires a public API change, data-model/schema change, new dependencies, or auth/authz changes.

## Patterns to apply when they fit

- **Cross-path merger → property test.** When a function merges results from two or more independent paths, the Design Note MUST define a preservation invariant (which inputs MUST be unchanged in the output); the Risk gate SHOULD then require a property-test suite asserting that invariant across generated inputs.
- **Schema additions → defaults-merge.** Prefer extending the existing defaults-merge over writing a migration script. Document the backward-compatibility test proving legacy files load cleanly.
- **Axis-dimensioned counters → sidecar.** When a typed field would be axis-dimensioned (per-file, per-command, per-key) and the count exceeds 1, prefer an NDJSON sidecar at `.ctrl-loop/state/<feature>.jsonl` to keep the typed schema flat.

## Output Format — append this block

```
### sdlc-result
gate: 2-design
status: passed | escalate
risk-score: <2-10 or n/a>
impact: <1-5>  likelihood: <1-5>
hard-stop-triggers: [<none | public-api-change | schema-migration | new-dependency | auth-change>]
artifact: .sdlc/runs/<slug>/02-design-note.md
note: <one line>
```

After appending the result block, **identify the next required pending gate** in `state.md` and tell the human the exact skill to run (e.g. `/sdlc-3-risk`). If the effective autonomy level allows autonomous execution, proceed immediately; otherwise prompt the human to run it.

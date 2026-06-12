---
name: sdlc:1-requirements
description: Run the AI-SDLC Requirements gate — turn intent into an explicit, testable Requirements Brief. Trigger when the user asks to write requirements, clarify a feature, extract functional and non-functional requirements, or define acceptance criteria for a change.
when_to_use: Use as quality gate 1 of the AI-SDLC lifecycle, after intake and before design. Produces the Requirements Brief and surfaces ambiguity before any code is written. Do not use to propose a technical solution — that is the Design gate.
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
---

# AI-SDLC Gate 1 — Requirements

**Artifact:** Requirements Brief → `01-requirements-brief.md`
**Gate question:** Are expectations explicit?

## Inputs

The run slug in `$ARGUMENTS`, else the most recent in-progress run under `.sdlc/runs/`.
Read `contract.md`, `state.md`, and load context packs 01–05 by calling `/sdlc-knowledge` with queries `context-packs/01` through `context-packs/05`. Do not ask the human for anything a context pack already answers.

## Workflow

1. Restate the objective in precise product and engineering terms; define **scope** and **out-of-scope** explicitly.
2. Extract **functional requirements** (what the system must do).
3. Extract **non-functional requirements** — performance, reliability, scalability, accessibility, privacy, security, compliance.
4. Normalize the contract's Gherkin into testable **acceptance criteria**; build the traceability table (scenario → requirements covered).
5. Identify stakeholders, user flows, edge cases, dependencies, assumptions, and open questions.
6. **Reassess risk:** if requirements are ambiguous or open questions block quality, raise Likelihood and flag the `ambiguous-requirements` hard-stop trigger. Use `state.md`'s frozen Risk formula — do not silently switch math. Mark any gate-1 risk score as `<n>` **(preview, formula: <as recorded>)**.
7. Write `01-requirements-brief.md` (sections: metadata table, restated objective, scope in/out, stakeholders, business value & success metrics, functional requirements, non-functional requirements, user flows, edge cases, dependencies, assumptions, open questions, acceptance criteria traceability table). Update the `state.md` ledger row and emit the result.

Escalate (`/sdlc:escalate`) if requirements are ambiguous, intent is uncertain, or unresolved open questions would change the design.

## Output Format — append this block

```
### sdlc-result
gate: 1-requirements
status: passed | escalate
risk-score: <2-10 or n/a>
impact: <1-5>  likelihood: <1-5>
hard-stop-triggers: [<none | ambiguous-requirements | ...>]
artifact: .sdlc/runs/<slug>/01-requirements-brief.md
note: <one line>
```

After appending the result block, **identify the next required pending gate** in `state.md` and tell the human the exact skill to run (e.g. `/sdlc-2-design`). If the effective autonomy level allows autonomous execution, proceed immediately; otherwise prompt the human to run it.

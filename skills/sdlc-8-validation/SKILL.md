---
name: sdlc:8-validation
description: Run the AI-SDLC Production Validation gate — confirm the released change works in production. Trigger when the user asks to validate a release, run post-deploy smoke tests, confirm a deploy is healthy, or check production behavior after shipping.
when_to_use: Use as quality gate 8 of the AI-SDLC lifecycle, after the change has been deployed and before the Learning gate. Produces the Production Validation Report. Do not use before deployment — that is the Release gate's plan.
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
  - Skill
---

# AI-SDLC Gate 8 — Production Validation

**Artifact:** Production Validation Report → `08-production-validation.md`
**Gate question:** Did it work in production?

## Inputs

The run slug in `$ARGUMENTS`, else the most recent in-progress run. Read `contract.md`,
`state.md`, the Release Plan (`07-release-plan.md`), and the acceptance criteria from
`01-requirements-brief.md`. This gate runs only after the change is deployed.

## Workflow

1. **Run post-deployment smoke tests** from the Release Plan's post-release validation
   list.
2. **Validate behavior against the acceptance criteria** — each Gherkin scenario,
   confirmed in the live environment.
3. **Check health signals** — metrics, logs, alerts, error rates, latency; compare to
   the Release Plan's abort thresholds.
4. Confirm no regression beyond what was expected.
5. **Run `/sdlc:simulate`** to exercise the deployed app as real users across multiple
   personas and cross-reference observability signals. Invoke it with
   `--output .sdlc/runs/<slug>/08-simulate-report.md` so the report lands inside the
   run directory next to the other gate artifacts. Pass the production app URL if
   known; otherwise let the skill discover it from `k8s/`, `Makefile`, or `state.md`.
   Fold any Critical/High UX or backend findings into the validation report's
   "Regressions observed" and acceptance-criteria sections; treat them as gate-blocking
   unless explicitly waived with rationale.
6. If a release-related defect, regression, or user impact is detected — that is a
   hard-stop trigger. **Run `/sdlc:escalate`** and reference the Release Plan's
   rollback plan.
7. **Reassess risk** based on observed production behavior; update `state.md`'s Latest
   risk score.
8. Write `08-production-validation.md` (sections: smoke test results; acceptance criteria verification — scenario → pass/fail; health signals — metrics, logs, alerts vs. thresholds; regressions observed; decision — validated / rollback recommended — linking the sibling `08-simulate-report.md`). Update the `state.md` ledger row and emit the result.

Escalate (`/sdlc:escalate`) on any release-related defect, regression, or user impact detected in production.

## Output Format — append this block

```
### sdlc-result
gate: 8-validation
status: passed | escalate
risk-score: <2-10>
acceptance: <n>/<total> scenarios verified
hard-stop-triggers: [<none | release-defect | regression | user-impact>]
artifact: .sdlc/runs/<slug>/08-production-validation.md
note: <one line>
```

After appending the result block, **identify the next required pending gate** in `state.md` and tell the human the exact skill to run (e.g. `/sdlc-9-learning`). If the effective autonomy level allows autonomous execution, proceed immediately; otherwise prompt the human to run it.

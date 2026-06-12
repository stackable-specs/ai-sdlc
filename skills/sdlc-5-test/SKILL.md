---
name: sdlc:5-test
description: Run the AI-SDLC Test gate — define a test strategy, ensure coverage, run all checks, and produce a Validation Report. Trigger when the user asks to test a change, write a test plan, prove the implementation works, or validate a build.
when_to_use: Use as quality gate 5 of the AI-SDLC lifecycle, after Implementation and before Security. Produces the Test Plan and the Validation Report with real run results. Do not use to write product code — that is the Implementation gate.
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

# AI-SDLC Gate 5 — Test

**Artifacts:** Test Plan → `05-test-plan.md` · Validation Report → `05-validation-report.md`
**Gate question:** Can we prove it works?

## Inputs

The run slug in `$ARGUMENTS`, else the most recent in-progress run. Read `contract.md`,
`state.md`, and artifacts `01`–`04`. Load the test-strategy context pack by calling `/sdlc-knowledge context-packs/06`.

## Workflow

1. **Define the test strategy** — overall approach; what is and is not worth testing,
   and why.
2. **Plan coverage** proportionate to the change class: unit, integration, contract
   (public APIs / event schemas), end-to-end, regression, and **negative & abuse**
   cases (invalid input, unauthorized access, timeouts, boundary failures).
3. Build the **traceability table** — every test maps to a Gherkin scenario and/or a
   risk from the Risk Register.
4. Add or update the tests.
5. **Run all checks** — the test suite plus static checks (lint, format, type, static
   analysis, dependency & secret scans).
6. **Analyze failures.** Fix only failures related to this change. If a test fails with
   an unclear cause, that is a hard-stop trigger — **run `/sdlc:escalate`**.
7. **Reassess risk** — lower Likelihood once coverage is strong and green; raise it if
   coverage gaps remain. Update `state.md`'s Latest risk score.
8. Write `05-test-plan.md` (sections: strategy, unit, integration, contract, E2E, regression, negative & abuse, performance/accessibility/security where relevant, test data, traceability table) and `05-validation-report.md` (sections: passed, failed + remediation, not run + reason, static checks, residual risk, requirements → implementation → tests → evidence traceability). Update the `state.md` ledger row and emit the result.

Escalate (`/sdlc:escalate`) on a failed test with an unclear cause, or a security/secret scan failure.

## Output Format — append this block

```
### sdlc-result
gate: 5-test
status: passed | escalate
risk-score: <2-10>
impact: <1-5>  likelihood: <1-5>
checks: <passed>/<total> passing
hard-stop-triggers: [<none | failed-tests-unclear | security-scan-failure>]
artifacts: .sdlc/runs/<slug>/05-test-plan.md, .sdlc/runs/<slug>/05-validation-report.md
note: <one line>
```

After appending the result block, **identify the next required pending gate** in `state.md` and tell the human the exact skill to run (e.g. `/sdlc-6-security`). If the effective autonomy level allows autonomous execution, proceed immediately; otherwise prompt the human to run it.

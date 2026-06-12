# Workflow Spec: SDLC Execute — Build & Ship (Gates 4–9)

## Artifact Definition
- **Name:** SDLC Execute — Implementation through Learning
- **Purpose:** Take a planned, risk-cleared change (output of `/sdlc:workflow plan`) all the way through build, validation, security review, release planning, deployment validation, and post-implementation learning. This is where code is actually written and shipped.
- **Audience:** The engineer/PM sponsoring the change; reviewers approving the PR and the deploy; oncall + the team during validation; the framework itself (gate 9 folds lessons back into the context packs).
- **Format:** Run-directory artifacts under `.sdlc/runs/<slug>/`: `04-implementation-plan.md`, `05-test-plan.md`, `05-validation-report.md`, `06-security-review.md`, `07-release-plan.md`, `pr-package.md`, `08-production-validation.md`, `09-post-implementation-review.md` — plus the actual code changes on a feature branch, the PR on GitHub, and (potentially) updated context-pack files (retrieved via `/sdlc-knowledge`) at gate 9.

## Trigger
- **Type:** manual
- **Source:** `/sdlc:workflow execute <slug>` (or `/sdlc:workflow execute resume <slug>` after the human-executed deploy).
- **Condition:** `.sdlc/runs/<slug>/state.md` must show rows 0–3 all `passed`, no open hard-stop triggers, and risk score < risk tolerance. Otherwise refuse to start and point the user at `/sdlc:workflow plan` or `/sdlc:resolve`.

## Inputs

| Source | Context |
|--------|---------|
| `.sdlc/runs/<slug>/state.md` | Gate ledger, autonomy level, risk tolerance, frozen risk formula |
| `.sdlc/runs/<slug>/01-requirements-brief.md` | Acceptance criteria — gates 4, 5, 8 all check against these |
| `.sdlc/runs/<slug>/02-design-note.md` | The recommended design — gate 4 implements it |
| `.sdlc/runs/<slug>/03-risk-register.md` | Top risks — gates 5, 6, 7 each target the relevant ones |
| `.sdlc/runs/<slug>/resolutions.md` | Locked-in answers to formerly open questions |
| `/sdlc-knowledge context-packs/02`, `/sdlc-knowledge context-packs/06`, `/sdlc-knowledge context-packs/07`, `/sdlc-knowledge context-packs/08`, `/sdlc-knowledge context-packs/09` | Engineering standards, test strategy, security/privacy, ops readiness, release governance |
| `/sdlc-knowledge templates/<artifact-name>` (e.g. `implementation-plan`, `test-plan`, `validation-report`, `release-plan`, `pr-package`, `post-implementation-review`) | Artifact shapes |
| `/sdlc-knowledge autonomy/escalation-policy.md` | Hard-stop triggers (production deploy is always one) |
| Working tree + git | Where code is read, edited, and committed |

## Workflow Steps

1. **Run `/sdlc:4-implementation`**
   - Load the design note and acceptance criteria.
   - Produce `04-implementation-plan.md`: a sequenced list of small, reviewable steps, each with the files it touches and the tests it adds.
   - **Then build it.** Execute the plan as commits on a feature branch, writing tests alongside code. Stop and ask the human if a step diverges materially from the design.
   - Update `state.md`.
   - **Gate check:** if a step uncovers a hidden requirement or design flaw, bounce back to gate 1 or 2 rather than improvising.

2. **Run `/sdlc:5-test`**
   - Produce `05-test-plan.md`: unit, integration, end-to-end, and non-functional checks tied to the risk register's top risks and to context-pack 06.
   - **Run the checks for real** — unit, integration, lint, type, build. Record real outputs in `05-validation-report.md`. No "checks passed (assumed)".
   - **Gate check:** if any check fails, fix the underlying issue and re-run; never mark the gate `passed` against a red test. If the failure reveals a design flaw, escalate to gate 2.

3. **Run `/sdlc:6-security`**
   - Load context-pack 07 and the design note.
   - Produce `06-security-review.md` covering authn/authz, injection, data exposure, secrets, abuse cases, privacy. For changes touching auth/payments/PII, also produce a threat model.
   - **Gate check:** any high-severity finding without a remediation is a hard stop — write an Escalation Report and halt.

4. **Run `/sdlc:7-release`**
   - Load context-pack 08 (operational readiness) and 09 (release governance).
   - Produce `07-release-plan.md`: rollout strategy (flag, canary, full), migration sequencing if any, monitoring + alerting hooks, rollback procedure, on-call comms.
   - Produce `pr-package.md`: PR title, summary, test plan, screenshots/output, link map to the run artifacts.
   - Open the PR (or update an existing one) using `pr-package.md` as the body.
   - **Gate check:** the gate produces the plan only. **Deployment itself is a blocked action** — the agent does not deploy. Workflow halts here pending the human-driven release.

5. **HUMAN ACTION — review the PR, merge, deploy**
   - The human reviews the PR + run artifacts, merges when satisfied, and executes the deploy per `07-release-plan.md`.
   - Workflow remains paused. Resume with `/sdlc:workflow execute resume <slug>` once the deploy is live, or `/sdlc:workflow execute rollback <slug>` if the deploy was reverted (which jumps to step 6 with `status: rolled-back`).

6. **Run `/sdlc:8-validation`**
   - Confirm the change works in production: smoke tests against the deployed environment, the acceptance criteria from `01-requirements-brief.md` checked against real behavior, dashboards and alerts from `07-release-plan.md` checked for the expected signals.
   - Produce `08-production-validation.md` with real evidence (URLs hit, dashboard screenshots, log snippets, metric values).
   - **Gate check:** if production behavior diverges from acceptance criteria, do not paper over it — write the gap into the artifact and escalate. If severe, recommend rollback per the procedure in gate 7.

7. **Run `/sdlc:9-learning`**
   - Produce `09-post-implementation-review.md`: what worked, what was harder than planned, what surprised us, where the framework slowed us down vs. helped, any near-misses.
   - **Fold lessons back into the framework** by calling `/sdlc-knowledge` to locate files and then editing them:
     - new patterns/constraints/edge cases → call `/sdlc-knowledge context-packs` to find the relevant pack
     - new hard-stop triggers learned from near-misses → call `/sdlc-knowledge autonomy/escalation-policy.md`
     - tighter/lighter gates → call `/sdlc-knowledge quality-gates` to find the relevant gate spec
     - a wrongly-classified change class → call `/sdlc-knowledge agent/change-classes.md`
   - Each edit is a small, justified change with a one-line rationale in the post-impl review; don't rewrite policy from a single data point.

8. **Emit the workflow summary**
   - Print the final state of the gate ledger.
   - List all artifact paths + the PR URL + the production validation evidence.
   - State explicitly: "Change shipped, validated, and lessons folded back — run `<slug>` complete."
   - Append the canonical `### sdlc-result` block with `gate: execute` and `status: passed | escalate | rolled-back`.

## Agent Configuration
- **Role:** Orchestrator + builder. Executes side effects — writes code, commits, opens a PR, hits production endpoints, edits framework files. Each gate skill may delegate heavy work to a subagent for fresh context; state flows through `state.md` and run-directory artifacts.
- **Trust Level:** `review_required` at default autonomy (level 2). Mandatory pause points regardless of autonomy:
  - Before opening the PR (gate 7 emits, human approves the package).
  - Production deploy itself (always human-executed — blocked action).
  - Any high-severity security finding in gate 6.
  - Any production-validation gap in gate 8.
  - At autonomy ≥ 4, gate-by-gate approval is skipped but the deploy pause and the security/validation halts are never skipped.

## Validation Criteria
- [ ] `state.md` shows rows 4–9 all `passed` (with row 7 paused for the human deploy and resumed thereafter)
- [ ] `04-implementation-plan.md` exists and every step has a corresponding commit on the feature branch
- [ ] Every acceptance criterion in `01-requirements-brief.md` has at least one test in `05-test-plan.md`, executed and passed against real output in `05-validation-report.md`
- [ ] `06-security-review.md` either shows no high-severity findings, or shows them with remediations applied and a re-review
- [ ] `07-release-plan.md` has an explicit rollback procedure that names commands or a runbook URL
- [ ] `pr-package.md` exists and matches the PR description on GitHub
- [ ] `08-production-validation.md` cites real production evidence (URLs, dashboards, logs, metrics) — not "looks fine"
- [ ] `09-post-implementation-review.md` exists and any framework-file edits it triggers are committed with a one-line rationale linking back to this run
- [ ] No silent skips — gates N/A for this change class are recorded as `skipped` with a reason in `state.md`
- [ ] Every artifact ends with the canonical `### sdlc-result` block

## Feedback Mechanism
- PR review comments → routed back into the run directory by `/sdlc:resolve` if they raise questions, or directly addressed by `/sdlc:4-implementation` if they're code changes.
- A `decision-record.md` is appended whenever the human overrides a gate recommendation (e.g., ship despite a medium-severity finding).
- The full framework-edit set from gate 9 is what closes the loop: next change in the same class needs less prompting, less escalation, fewer questions.

## Error Handling
- **Tests fail in gate 5** — fix root cause and re-run. If the failure reveals a design flaw, bounce back to gate 2 explicitly.
- **High-severity security finding in gate 6** — halt, write Escalation Report, do not proceed to gate 7.
- **Deploy fails or is rolled back** — `/sdlc:workflow execute rollback <slug>` jumps to gate 8 with `status: rolled-back`, then to gate 9. The rollback is captured as evidence in `08-production-validation.md`.
- **Production behavior diverges from acceptance criteria in gate 8** — do NOT mark `passed`. Either roll back per gate 7 or escalate for a tolerated-divergence decision (captured in a decision record).
- **Gate 9 wants to edit framework files in ways that contradict `agent/operating-manual.md`** — escalate; never silently rewrite the operating manual.
- **`state.md` formula drift mid-workflow** — Risk gate's frozen formula is authoritative. Halt on mismatch.

## Performance Targets
- Gate 4 (implementation) duration scales with change class; workflow adds < 10 minutes overhead across gates 5–9 combined.
- 0 cases where gate 8 is invoked before the human-executed deploy is confirmed live.
- 0 cases where framework files under `reference/` are edited *outside* of gate 9.
- ≥ 80% of runs reach gate 9 without an escalation between 4 and 8 (lagging quality signal — measured by `/sdlc:9-learning` over time).

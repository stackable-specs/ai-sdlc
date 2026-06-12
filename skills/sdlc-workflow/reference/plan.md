# Workflow Spec: SDLC Plan (Gates 0–3 + Resolve)

## Artifact Definition
- **Name:** SDLC Plan — Intake through Risk
- **Purpose:** Take a change from raw intent to a planned, requirement-clear, designed, and risk-scored state — fully prepped for the Implementation gate. Stops short of building anything.
- **Audience:** The engineer/PM sponsoring the change; reviewers who decide whether to greenlight implementation; the agent that will pick the run up at gate 4.
- **Format:** Run-directory artifacts under `.sdlc/runs/<slug>/`: `contract.md`, `state.md`, `01-requirements-brief.md`, `02-design-note.md`, `03-risk-register.md`, `resolutions.md`. Each artifact follows the template retrieved via `/sdlc-knowledge templates/<artifact-name>` and ends with a fenced `### sdlc-result` block.

## Trigger
- **Type:** manual
- **Source:** `/sdlc:workflow plan <change intent> [level=N] [risk=N]`
- **Condition:** No in-progress run blocks intake. If a paused run exists, start a new slug — `plan` is not resumable mid-flight.

## Inputs

| Source | Context |
|--------|---------|
| User prompt (`$ARGUMENTS`) | The change intent, optional `level=` (autonomy 1–5) and `risk=` (tolerance 2–10) |
| `/sdlc-knowledge templates/minimal-input-contract.md` | Shape of the contract built in gate 0 |
| `/sdlc-knowledge agent/change-classes.md` | Change taxonomy used by gate 0 to pick the gate profile |
| `/sdlc-knowledge context-packs/01` … `/sdlc-knowledge context-packs/09` | Per-repo knowledge — gates 1–3 each select the packs they need |
| `/sdlc-knowledge quality-gates` | Canonical gate specs and checklists |
| `/sdlc-knowledge autonomy/levels` and `/sdlc-knowledge autonomy/escalation-policy.md` | Autonomy level and hard-stop trigger list |
| `.sdlc/runs/<slug>/state.md` (after gate 0) | Gate ledger, autonomy level, risk tolerance, frozen risk formula |

## Workflow Steps

1. **Run `/sdlc:0-intake`**
   - Build the Minimal Human Input Contract → `contract.md`.
   - Classify the change against `agent/change-classes.md`.
   - Resolve which gates apply for this change class and write the gate profile + autonomy + risk tolerance into `state.md`.
   - Create the run directory `.sdlc/runs/<slug>/`.
   - **Gate check:** if intent is too ambiguous to classify, stop and ask the user — do not proceed.

2. **Run `/sdlc:1-requirements`**
   - Load `contract.md`, `state.md`, and context packs 01–05.
   - Produce `01-requirements-brief.md`: restated objective, scope/out-of-scope, functional + non-functional requirements, acceptance criteria with traceability, edge cases, dependencies, assumptions, open questions.
   - Update the `state.md` ledger row for gate 1.
   - **Gate check:** if open questions would block design, run `/sdlc:resolve` against the gate-1 artifact before moving on.

3. **Run `/sdlc:2-design`**
   - Load `contract.md`, `01-requirements-brief.md`, and the design-relevant context packs (03 system, 04 domain, 02 engineering standards).
   - Produce `02-design-note.md`: options, tradeoffs, recommended design, API/data model/error handling/security/observability sections, ADR-style decisions, open questions.
   - Update `state.md`.
   - **Gate check:** if the recommended design pulls in a hard-stop trigger (new dependency, public API break, schema migration, auth/payments/PII), flag it for gate 3 — do not pre-decide escalation here.

4. **Run `/sdlc:3-risk`**
   - Load all prior artifacts.
   - Build `03-risk-register.md`: enumerate risks, score each Impact × Likelihood, compute the change-level risk score using the formula frozen in `state.md`.
   - Compare risk score against the run's risk tolerance.
   - **Gate check:** if risk score ≥ tolerance, or any hard-stop trigger fired, write the Escalation Report and **stop the workflow**. The human must resume via `/sdlc:deliver resume <slug>` or adjust scope.

5. **Run `/sdlc:resolve` over all open-questions sections**
   - Pass over `01-requirements-brief.md`, `02-design-note.md`, `03-risk-register.md` in order.
   - For each open question: first try to infer the answer from repo evidence + stated defaults (auto mode); only ask the user when the answer is judgment-only.
   - Write decisions into `resolutions.md` and edit the source artifact to replace the "Open questions" section with the locked-in answer + a link to the decision record.
   - **Gate check:** if resolving a question would invalidate the requirements or design, send the run back to the affected gate rather than papering over it.

6. **Emit the workflow summary**
   - Print the final state of the gate ledger from `state.md`.
   - List the four artifact paths + `resolutions.md`.
   - State explicitly: "Plan complete — ready for `/sdlc:workflow execute <slug>`."
   - Append the canonical `### sdlc-result` block with `gate: plan` and `status: passed | escalate`.

## Agent Configuration
- **Role:** Orchestrator. Does not author artifacts directly — sequences the four gate skills + resolve, propagates `state.md` between them, enforces stop conditions.
- **Trust Level:** `review_required` at default autonomy (level 2). The four gates produce text only — no code, no deploys, no external side effects — so the agent can complete the whole sequence without human approval, but the human must review before invoking `/sdlc:workflow execute`. At autonomy ≥ 4 the human review can be skipped; at autonomy 1 the agent pauses at each gate boundary.

## Validation Criteria
- [ ] `.sdlc/runs/<slug>/` exists with `contract.md` and `state.md`
- [ ] Gate ledger in `state.md` shows rows 0, 1, 2, 3 all `passed` (or the last one `escalate`)
- [ ] `01-requirements-brief.md` has zero open questions, acceptance criteria are testable, traceability table maps every scenario → requirement
- [ ] `02-design-note.md` has a clearly marked recommended option and a decision record for each significant choice
- [ ] `03-risk-register.md` shows the formula used, the per-risk Impact × Likelihood, and the change-level score — and that score is consistent with the formula frozen in `state.md`
- [ ] `resolutions.md` exists and every open question in steps 2–4 is either resolved or explicitly punted (with reason)
- [ ] No hard-stop trigger is open and unaddressed
- [ ] If `risk-score ≥ risk-tolerance`, an Escalation Report exists under `escalations/` and the workflow halts cleanly
- [ ] Each artifact ends with the `### sdlc-result` block

## Feedback Mechanism
- The human reviewer comments inline in the run-directory artifacts; comments are picked up by `/sdlc:resolve` on the next pass.
- A `decision-record.md` is used for any decision the human overrides — captures the original recommendation, the override, and the reason.
- `/sdlc:9-learning` (run later via `execute`) folds anything surprising from this plan phase back into the context packs and the escalation policy.

## Error Handling
- **Slug collision in gate 0** — suffix `-2` and warn; never overwrite.
- **Gate skill errors** — if any gate emits `status: error`, stop the workflow and surface the error; do not advance the ledger.
- **`state.md` formula drift** — if a gate computes a risk preview using a formula different from the one frozen in `state.md`, treat as hard error.
- **`/sdlc:resolve` cannot answer auto-mode** — fall back to asking the user one question at a time; do not guess or default silently.
- **Hard-stop trigger fires mid-workflow** — finish the current gate's artifact (so the evidence is captured), then write the Escalation Report and halt before the next gate.

## Performance Targets
- End-to-end under 15 minutes for an Extra-Small or Small change class.
- < 1 question/round-trip to the human per gate on average at autonomy level 2.
- 0 cases where the next workflow (`execute`) is invoked while open questions remain unresolved.

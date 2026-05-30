# AI-SDLC Framework Specification

**Version:** v1.1
**Status:** proposed
**Scope:** The complete AI-SDLC skill suite — gates 0–9, lifecycle orchestrators, supporting skills, control model, autonomy levels, change classes, quality gates, workflows, templates, context packs, and observability.

---

## 1. Purpose & Problem

### 1.1 What this spec defines

This specification defines the **AI-SDLC framework**: a structured, gate-based software delivery lifecycle executed by an AI agent working from a minimal human input contract. It covers the full delivery pipeline from raw intent through production validation and post-implementation learning, the control model governing how much the agent may proceed autonomously, the artifact corpus each gate must produce, and the conformance rules that determine whether a delivery run is valid.

### 1.2 Problem statement

Without a structured process, AI-assisted software delivery produces one of two failure modes:

1. **Jump-to-code**: the agent skips from intent directly to implementation, hiding assumptions, product decisions, and risks inside the code.
2. **Specification overload**: the human must re-specify engineering standards, test expectations, security rules, deployment defaults, and escalation policy on every request.

AI-SDLC addresses both: it enforces a mandatory artifact-producing gate sequence so quality is process-derived, not prompt-derived, while encoding reusable knowledge in context packs so the human supplies only what is genuinely new.

### 1.3 Prime directive

> Never skip from intent to code. Quality comes from the *process*, not the prompt. Produce each intermediate artifact, pass each gate in the profile, and escalate the moment the work exceeds your authority.

### 1.4 Assumptions

- An AI agent is executing on behalf of a human who provides a Minimal Human Input Contract.
- The agent has access to the repository, CI tooling, and the skill suite described here.
- Reusable knowledge (engineering standards, test strategy, security defaults, domain rules, release governance) is encoded in context packs and does not need to be re-stated per change.
- Autonomy is a property of the *operating environment*, not the *model capability* alone. High autonomy requires tooling maturity, CI/CD gates, observability, and rollback.

### 1.5 Scope boundaries

**In scope:** gate definitions, artifact schemas, the control model, change classification, autonomy levels, escalation policy, lifecycle orchestrators, supporting skill definitions, context pack structure, and conformance rules.

**Out of scope:** the content of project-specific context packs (which a team fills in), CI/CD platform implementation, the underlying AI model, IDE integration, and deployment infrastructure.

---

## 2. Goals / Non-Goals

### Goals

- Define a complete, auditable SDLC gate sequence with traceable artifacts.
- Minimize the human input required per change by encoding reusable knowledge.
- Provide a typed control model (autonomy level + risk tolerance) that determines when the agent pauses for human approval.
- Make delivery speed proportional to change risk: trivial changes move fast; risky changes get full rigor.
- Close the learning loop so each delivery run improves the framework.
- Be stackable: individual gates are independently invocable; the orchestrators drive multi-gate sequences.

### Non-Goals

- Replace human judgment for high-blast-radius decisions.
- Define the content of team-specific context packs (only their structure).
- Specify how CI/CD platforms implement automated gate checks.
- Provide a fully autonomous Level-5 delivery system today (treated as an aspirational north star).
- Guarantee that a Level-4 run requires no human interaction (hard-stop triggers always pause, regardless of level).

---

## 3. System Overview

### 3.1 Architectural layers

The framework is organized in five layers, from most reusable to most project-specific:

| Layer | Contents | Reuse scope |
|---|---|---|
| 0 — Universal process | Operating manual, quality gate definitions, change classes | All AI-SDLC users |
| 1 — Universal context | Operating model (CP-01), Definition of Done (CP-05) | All projects |
| 2 — Organization | Engineering standards (CP-02), test strategy (CP-06), security/privacy (CP-07), release governance (CP-09) | All repos in org |
| 3 — Platform/team | System context (CP-03), domain rules (CP-04), operational readiness (CP-08) | Specific system |
| 4 — Run | Minimal Human Input Contract, run-directory artifacts, `state.md` | Single change |

### 3.2 Skill inventory

**Gate skills (one per quality gate):**

| Skill | Gate | Artifact produced |
|---|---|---|
| `sdlc:0-intake` | 0 | `contract.md`, `state.md` |
| `sdlc:1-requirements` | 1 | `01-requirements-brief.md` |
| `sdlc:2-design` | 2 | `02-design-note.md` |
| `sdlc:3-risk` | 3 | `03-risk-register.md` |
| `sdlc:4-implementation` | 4 | `04-implementation-plan.md` + code |
| `sdlc:5-test` | 5 | `05-test-plan.md`, `05-validation-report.md` |
| `sdlc:6-security` | 6 | `06-security-review.md` |
| `sdlc:7-release` | 7 | `07-release-plan.md`, `pr-package.md` |
| `sdlc:8-validation` | 8 | `08-production-validation.md` |
| `sdlc:9-learning` | 9 | `09-post-implementation-review.md` |

**Lifecycle orchestrators:**

| Skill | Purpose |
|---|---|
| `sdlc:deliver` | **Primary entry point.** Full lifecycle loop (intake → 9 gates) with control-model enforcement. Spawns each gate as a fresh subagent. Handles `resume`. Asks for `level` and `risk` if not provided. |
| `sdlc:workflow` | Named sub-workflows: `plan` (gates 0–3 + resolve) and `execute` (gates 4–9). Prefer `sdlc:deliver` for interactive sessions; `sdlc:workflow` for scripted or staged delivery. |

**Supporting skills:**

| Skill | Purpose |
|---|---|
| `sdlc:resolve` | Resolve open questions in gate artifacts; auto-infer or ask the user one question at a time. |
| `sdlc:escalate` | Emit an Escalation Report and pause the run. |
| `sdlc:rules` | Discover and load project-specific rules into context. |
| `sdlc:knowledge` | Read-only index of all framework reference material. |
| `sdlc:simulate` | Multi-persona UX simulation via Playwright subagents + OpenObserve correlation. |
| `sdlc:secops` | Multi-tool DevSecOps assessment (SAST, SCA, secrets, IaC, containers, SBOM, K8s). |
| `sdlc:code-quality` | Multi-tool code quality assessment (complexity, duplication, smells, coverage, dead code). |
| `sdlc:report` | Compile all run artifacts into a self-contained HTML report; open in browser. |
| `sdlc:wrapup` | Post-Gate-9 finalization: sync README/docs, append CHANGELOG, commit, archive the run directory. |
| `sdlc:transfusion` | Port a working pattern from an exemplar (internal or external) into the target codebase. |
| `sdlc:compile-bdr` | Compile all BDR files from `docs/bdr/` into `docs/SPEC.md` (deduplicate, extract, assemble). |
| `sdlc:ddd` | Apply Domain-Driven Design analysis to the codebase. |
| `sdlc:pyramid` | Assess and advise on the test pyramid health. |
| `sdlc:test-quality` | Assess test coverage and quality signals. |
| `sdlc:adr` | Author or retrieve Architecture Decision Records. |
| `sdlc:report` | Generate a visual HTML run report. |
| `sdlc:transfusion` | Port a working pattern from an exemplar. |
| `sdlc:wrapup` | Post-Gate-9 finalization step. |

### 3.3 Run directory

Every delivery run is anchored to a directory:

```
.sdlc/runs/<slug>/
  contract.md                  # Minimal Human Input Contract
  state.md                     # Gate ledger, control model, escalation log
  01-requirements-brief.md
  02-design-note.md
  03-risk-register.md
  resolutions.md               # Written by sdlc:resolve
  04-implementation-plan.md
  05-test-plan.md
  05-validation-report.md
  06-security-review.md
  06-secops-report.md          # Produced by sdlc:secops
  07-release-plan.md
  pr-package.md
  08-production-validation.md
  08-simulate-report.md        # Produced by sdlc:simulate
  09-post-implementation-review.md
  report.html                  # Produced by sdlc:report
  escalations/
    NN-<trigger>.md            # Produced by sdlc:escalate
  decision-record.md           # Appended on human overrides
```

Completed runs are archived to `.sdlc/archive/<slug>/` by `sdlc:wrapup`.

---

## 4. Domain Model

### 4.1 Minimal Human Input Contract

The five-part payload the human must supply (or that the agent drafts and marks as inferred):

| Field | Required | Description |
|---|---|---|
| `Intent` | **REQUIRED** | One sentence: the desired outcome. The agent MUST ask if missing. |
| `Context delta` | Inferred if absent | Only what is new, unusual, or risky vs. the context packs. |
| `Priority` | Inferred if absent | The tradeoff to optimize (safe rollout, auditability, speed, UX, performance, cost). |
| `Authority` | **REQUIRED** | Autonomy level (1–5) + explicit escalation triggers. Defaults to L2 if unspecified; agent MUST state the assumption. |
| `Acceptance` | **REQUIRED** | Gherkin scenarios (happy path + negative/boundary path). Agent drafts if absent; MUST mark as drafted. |

### 4.2 Run state (`state.md`)

The shared state file written at intake and updated by every gate:

| Field | Type | Description |
|---|---|---|
| `Slug` | string | Short kebab-case identifier, derived from intent |
| `Intent` | string | One-line objective |
| `Change class` | enum | One of the 11 change classes (§4.3) |
| `Autonomy level` | 1–5 | Effective authority level |
| `Risk tolerance` | 2–10 | Pause threshold; comparison target for gate risk scores |
| `Risk formula` | string | **FROZEN at intake.** Default: `Impact + Likelihood` (range 2–10) |
| `Latest risk score` | 2–10 \| n/a | Updated by gates 3, 4, 5, 6, 8 |
| `Status` | enum | `in-progress` \| `paused` \| `escalating` \| `complete` |
| `Created` | date | ISO date |

Gate ledger row (one per gate):

| Column | Values |
|---|---|
| `#` | 0–9 |
| `Gate` | Gate name |
| `Required` | `yes` \| `no` |
| `Status` | `pending` \| `in-progress` \| `passed` \| `escalate` \| `skipped` \| `paused` |
| `Risk score` | 2–10 \| `-` |
| `Artifact` | File path or `-` |

**Sections appended to `state.md` over time:**

- `## Autonomy log` — one line per mid-run level change.
- `## Escalation log` — one line per escalation (date, gate, trigger, report path).
- `## Resolutions log` — one line per resolved open question (written by `sdlc:resolve`).

**Invariant:** The risk formula recorded in `state.md` at intake is authoritative for all gates. A gate that previews risk using a different formula MUST flag the drift as an error; it MUST NOT silently switch math.

### 4.3 Change classes

Eleven named classes; when a change spans classes, the **most rigorous** class applies.

| Class | Default level | Required gates |
|---|---|---|
| Trivial | 4 | I, T(light), G |
| Test-only | 3–4 | I, T, G |
| Contained bug fix | 3 | R(light), K, I, T, P, G |
| Internal refactor | 2–4 | D, K, I, T, P, G |
| Small feature increment | 2–3 | R, D, K, I, T, S, L, P, G |
| New feature | 2 | All nine |
| Schema / data migration | 2 | R, D, K, I, T, S, L, P, G |
| Public API change | 2 | All nine |
| Security / auth change | 1–2 | All nine + threat model |
| Dependency change | 2–3 | K, I, T, S, L, P, G |
| Infrastructure / deploy | 2–3 | D, K, I, T, S, L, P, G |

**Test-only class invariant:** No file under `src/` or any deployed artifact changes. Adding or repairing tests, fixing test bugs, expanding coverage within an existing test file.

**Sub-class: full reference implementation.** When a "New feature" run produces a full reference implementation showcasing an entire realistic stack end-to-end, the agent MUST use full-reference defaults (full stack, auth enabled, Skaffold dev loop, OTEL, Storybook) rather than conservative minimal-demo defaults.

**The fast path:** Trivial and test-only changes, at Level 4, inside an approved operating domain, with all automated checks green, MAY complete without human review. This is the primary delivery speed lever — it removes ceremony from the 60–80% of changes that are low-risk.

### 4.4 Risk model

Risk score = `Impact + Likelihood` (default formula, frozen at intake, range 2–10).

**Impact (1–5):**

| Score | Meaning |
|---|---|
| 1 | Cosmetic; no user-visible effect |
| 2 | Minor; easily and fully reversible |
| 3 | Moderate; degrades one feature for some users |
| 4 | Major; data, security, or revenue exposure for some users |
| 5 | Severe; outage, data loss, breach, or financial loss at scale |

**Likelihood (1–5):**

| Score | Meaning |
|---|---|
| 1 | Well-understood change, fully covered by tests |
| 2 | Familiar area, good coverage |
| 3 | Some unknowns or partial coverage |
| 4 | Unfamiliar code, weak coverage, or ambiguity |
| 5 | Poorly understood, untested, or ambiguous requirements |

**Default risk tolerance by level:** L1 → 3, L2 → 4, L3 → 6, L4 → 8, L5 → 9.

---

## 5. Control Model

### 5.1 Autonomy levels

Six levels (0–5), adapted from SAE self-driving autonomy levels:

| Level | Name | Human role | AI role | Posture |
|---|---|---|---|---|
| 0 | No AI Assistance | All SDLC work | None / passive tooling | Human-controlled |
| 1 | AI Task Assistance | Owns delivery | Assists one bounded task | Human-led |
| 2 | AI Workflow Assistance | Supervises, reviews all output | Handles multiple steps | Human-supervised |
| 3 | Conditional AI Delivery | Defines gates, handles escalation | Executes workflow, escalates | Shared-control |
| 4 | Domain-Bounded Autonomy | Sets policy, audits | Delivers within a domain | AI-led, governed |
| 5 | Full Autonomous Delivery | Sets business intent | Owns end-to-end SDLC | Aspirational |

**Default operating level: L2.** Recommended for most teams.

**Autonomy ≠ capability.** A high-capability model with no tests, no CI/CD gates, and no rollback is L1–L2, not L4.

### 5.2 Approval points by level

| Level | The loop pauses for human approval … |
|---|---|
| 1 | After **every** gate |
| 2 | After Requirements; after Risk; after Implementation; before Release |
| 3 | Only on a hard-stop trigger or risk ≥ tolerance |
| 4 | Only on a hard-stop trigger or blocked action |
| 5 | Only on a blocked action |

### 5.3 Responsibility matrix (level × SDLC phase)

| Phase | L1 | L2 | L3 | L4 | L5 |
|---|---|---|---|---|---|
| Intake | Drafts problem statement | Structures requirements | Infers from ticket | Selects eligible backlog | Defines opportunities |
| Requirements | Assists | Drafts complete | Proceeds unless ambiguous | Policy-defined templates | Owns discovery |
| Design | Suggests options | Produces design brief | Selects within constraints | Designs inside domain | Owns architecture |
| Build | Generates snippets | Implements supervised | Implements conditional | Implements in domain | Implements any objective |
| Test | Generates tests | Creates test plan | Runs/updates tests | Must pass automated gates | Owns verification |
| Security | Checklist support | Initial review | Escalates risk | Enforced policy gates | Continuous assurance |
| Release | Drafts notes | Plans deployment | Prepares package | Deploys within scope | Owns rollout |
| Operate | Explains logs | Suggests dashboards | Diagnoses known issues | Bounded remediation | Owns incident response |

**What the human always retains (all levels):** desired business outcome and stakeholder priority; acceptance criteria and risk appetite; unique business constraints; final accountability for high-impact changes.

### 5.4 Mandatory hard-stop triggers

These pause the loop **regardless of score or autonomy level**:

- Authentication or authorization logic
- Payment logic
- PII or other sensitive data
- Database schema or data migrations
- Public API breaking changes
- New third-party dependencies
- Production deployment
- Failed tests with an unclear cause
- Security scan failures
- Ambiguous requirements / >20% uncertainty in intended behavior
- Any change exceeding the approved scope or autonomy level

### 5.5 Blocked actions

These **always require explicit human approval** regardless of level:

- Production deployment
- Secrets / credentials handling
- Dropping database columns or tables
- Disabling security controls
- Modifying audit logs

### 5.6 Pause evaluation — run after every gate

```
1. Any mandatory hard-stop trigger fired?    → PAUSE → run sdlc:escalate
2. Latest risk score ≥ risk tolerance?       → PAUSE → run sdlc:escalate
3. Autonomy level requires approval here?    → PAUSE for approval
4. Otherwise                                 → continue to next gate
```

### 5.7 Mid-run autonomy elevation

A human MAY elevate autonomy mid-run by stating it explicitly. When that happens:

1. The first gate at the elevated level MUST stamp a line in `state.md` under `## Autonomy log`:
   ```
   - <date> · L<old> → L<new> for gates <N>..<M> · granted by user
   ```
2. Pre-authorized escalation triggers from already-closed escalations carry over.
3. New triggers fired after the elevation still pause per the approval table.
4. Elevation MUST NOT bypass mandatory hard-stop triggers or blocked actions.
5. Elevation only moves forward; the agent MUST NOT silently re-raise the level.

---

## 6. Quality Gates

Gates are checkpoints a change must pass before the next phase. Each gate:
- MUST produce its named artifact.
- MUST self-check its checklist before advancing.
- MUST append the canonical `### sdlc-result` block to its artifact.
- MUST update the `state.md` gate ledger row.
- MUST NOT claim a gate passed without producing its artifact.
- MUST invoke `sdlc:rules` as the very first step (before its own workflow).

### Gate 0 — Intake & Classify

**Artifact:** `contract.md` + `state.md`
**Trigger:** Before any quality gate; first step of every AI-SDLC delivery.

**Workflow:**
1. Load project rules via `sdlc:rules` before proceeding.
2. Build the Minimal Human Input Contract (five sections).
3. Restate the objective in one precise sentence.
4. Classify the change into exactly one class; use most rigorous when classes overlap.
5. Resolve effective autonomy level and risk tolerance.
6. Create `.sdlc/runs/<slug>/`.
7. Write `contract.md` and `state.md` with the gate ledger pre-populated.
8. Report slug, change class, gate profile, level, risk tolerance, and any assumptions.

**Invariant:** Risk formula is frozen at this step and MUST NOT be re-derived by later gates.

---

### Gate 1 — Requirements

**Artifact:** `01-requirements-brief.md`
**Gate question:** Are expectations explicit?

**Checklist:**
- [ ] Objective restated in precise terms
- [ ] Scope and out-of-scope defined
- [ ] Functional + non-functional requirements captured
- [ ] Acceptance criteria normalized and testable
- [ ] Assumptions and open questions surfaced
- [ ] Edge cases and dependencies identified

**Inputs:** `contract.md`, `state.md`, context packs CP-01 through CP-05.

**Artifact structure:** Metadata table; Restated objective; Scope (in/out); Stakeholders; Business value & success metrics; Functional requirements; Non-functional requirements; User flows; Edge cases; Dependencies; Assumptions; Open questions; Acceptance criteria traceability table.

**Escalation trigger:** Requirements ambiguous or open questions would change the design.

---

### Gate 2 — Design

**Artifact:** `02-design-note.md`
**Gate question:** Is the solution technically sound?

**Checklist:**
- [ ] Current state and gap analyzed
- [ ] Options generated with tradeoff analysis
- [ ] Recommended design within authority
- [ ] Architecture, API, data model, state, error handling defined
- [ ] Backward compatibility considered

**Inputs:** `contract.md`, `state.md`, `01-requirements-brief.md`, CP-03, CP-04, CP-02.

**Workflow:** Map current state (spawn Explore subagent for non-trivial repos); gap analysis; generate ≥2 options with pros/cons; tradeoff analysis; recommend a design; detail architecture, API contract, data model, state transitions, error handling, security, observability; reassess risk.

**Artifact structure:** Current state; Gap analysis; Solution options (≥2, each pros/cons); Tradeoff analysis; Recommended design; Design detail; Risks pointer.

**Patterns MUST apply when applicable:**
- **Cross-path merger → property test**: when design introduces a function combining results from ≥2 independent paths, the Design Note MUST call out a preservation invariant; the Risk gate SHOULD require a property-test suite asserting it.
- **Schema additions → defaults-merge**: prefer extending the existing defaults-merge over a migration script; document backward-compatibility test.
- **Axis-dimensioned counters → sidecar files**: when a typed field would be axis-dimensioned and count > 1, consider an NDJSON sidecar.

**Escalation triggers:** Public API change, data-model/schema change, new dependencies, auth/authz changes.

---

### Gate 3 — Risk

**Artifact:** `03-risk-register.md`
**Gate question:** Is it safe to proceed?

**Checklist:**
- [ ] Risks classified by impact, blast radius, complexity, uncertainty
- [ ] Mitigations defined for every High/Med risk
- [ ] Risk score computed using `state.md`'s frozen Risk formula
- [ ] Open questions that change schema/data-model/on-disk surface include a "BDR / conformance impact" line
- [ ] Hard-stop escalation check completed
- [ ] Risk score compared to the run's risk tolerance

**This gate sets the authoritative risk score.** The score in `state.md` after this gate is the reference for all downstream gates.

**Workflow:** Enumerate risks (technical, product, delivery, security, operational); score each; apply frozen formula for change-level score; run hard-stop escalation check; for every open question touching schema/data-model, add a BDR/conformance impact line; define mitigations for every High/Med risk; decide pass or escalate.

**Artifact structure:** Risk table (#, Risk, Severity, Likelihood, Mitigation, Owner); Risk classification; Risk score with Impact/Likelihood breakdown; Hard-stop escalation checklist; `Escalation required: Yes/No — reason`.

**Invariant:** If a previous gate previewed risk with a different formula, gate 3 MUST flag the drift in §"Risk reassessment" rather than silently switching math.

---

### Gate 4 — Implementation

**Artifact:** `04-implementation-plan.md` + code changes
**Gate question:** Is the work reviewable and sequenced?

**Checklist:**
- [ ] Work broken into 2–5 slices, each with a runnable hard-gate exit criterion
- [ ] Each step maps to a slice, a requirement, and to tests
- [ ] No unrelated refactors
- [ ] Pre-implementation review passed; approval obtained if required
- [ ] Static checks pass on the changed code after each slice

**Slice discipline:** Steps MUST be grouped into 2–5 named slices. Each slice has:
- A theme (one phrase).
- A **hard gate** (a runnable check: typecheck clean, named test green, property suite green).
- An exit criterion expressed as a runnable command, not a count snapshot.

**Recommended slice ordering for typed fields / persisted state:**
1. Types + schema + backward-compat tests
2. Core load-bearing logic + safety invariants (property tests land here)
3. Consumers / presets / wiring
4. Surface (CLI, observability, public exports)

**Execution rules:**
- Smallest safe change; match existing patterns; no unrelated refactors.
- Write or update tests alongside each step; trace each test to an acceptance criterion or a risk.
- Run static checks (lint, format, type) after each step.
- If a step diverges materially from the design, STOP and ask the human.
- If a hidden requirement or design flaw is discovered, bounce back to gate 1 or 2; do not improvise.

**Escalation triggers:** Blocked action, new dependency, schema migration, public API change, auth/authz change, anything beyond approved scope.

---

### Gate 5 — Test

**Artifacts:** `05-test-plan.md` + `05-validation-report.md`
**Gate question:** Can we prove it works?

**Checklist:**
- [ ] Unit, integration, contract, E2E, regression coverage as relevant to the class
- [ ] Negative and abuse cases covered
- [ ] Tests trace to acceptance criteria and risks
- [ ] All checks run; results recorded honestly (passed / failed / not run)
- [ ] Failures analyzed; related ones remediated, unclear ones escalated

**Coverage types required by class (proportionate):** Unit, integration, contract (public APIs/event schemas), end-to-end, regression, negative & abuse cases.

**Traceability:** Every test MUST map to a Gherkin scenario and/or a risk from the Risk Register.

**Validation report invariant:** MUST contain real run results. "Checks passed (assumed)" is not acceptable. If a test fails with an unclear cause, that is a hard-stop trigger.

**Reassessment:** Lower Likelihood once coverage is strong and green; raise if coverage gaps remain.

**Artifact structures:**
- `05-test-plan.md`: Strategy; Unit; Integration; Contract; End-to-end; Regression; Negative & abuse; Performance/accessibility/security; Test data; Traceability table.
- `05-validation-report.md`: Passed; Failed + remediation; Not run + reason; Static checks; Residual risk; Traceability (requirements → implementation → tests → evidence).

---

### Gate 6 — Security & Privacy

**Artifact:** `06-security-review.md` (+ sibling `06-secops-report.md`)
**Gate question:** Is it safe?

**Checklist:**
- [ ] Authn/authz, input validation, injection, data exposure reviewed
- [ ] Secrets handled correctly; no sensitive data logged
- [ ] Abuse cases considered; least privilege enforced
- [ ] Privacy: PII, retention, consent, auditability addressed
- [ ] `sdlc:secops` run and findings folded in (or explicit reason it was skipped)
- [ ] Every finding has a severity and a mitigation

**Security review areas:** Authentication & authorization; Input validation & injection (SQL/command/template/path); Data exposure; Secrets handling; Unsafe logging; Abuse cases.

**Privacy review:** PII handling, data retention, consent, auditability, regulatory obligations.

**Threat model:** REQUIRED when change class is Security/auth change, or when the change touches auth, payments, or sensitive data.

**`sdlc:secops` integration:** MUST be invoked with `--output .sdlc/runs/<slug>/06-secops-report.md`. Pass `--diff` on re-runs. High/critical tool findings are gate-blocking unless explicitly waived with rationale.

**Escalation triggers:** Any security-sensitive behavior change, any auth/authz change, any medium/high-severity finding.

---

### Gate 7 — Release

**Artifact:** `07-release-plan.md`
**Gate question:** Can we ship safely?

**Checklist:**
- [ ] Rollout strategy, feature flags, migration sequencing defined
- [ ] Rollback plan defined *before* deployment
- [ ] Pre-deployment checks listed
- [ ] Observability in place to monitor the rollout
- [ ] Communication plan defined

**Pre-release quality re-run:** Before drafting the rollout plan, the gate MUST re-run `typecheck`, `test`, `lint`, `audit`, `build`. Lint MUST be scoped to the published surface (derived from `package.json` `files`, `main`, or workspace roots), not run repo-wide. Pre-existing failures outside the published surface MUST be reported separately and MUST NOT block the gate.

**Artifact structure:** Rollout strategy; Feature flags (name, on/off behavior, ramp plan, cleanup owner); Migration sequencing (expand → deploy → contract); Pre-deployment checks; Deployment steps; Rollback plan; Post-release validation; Monitoring during rollout; Communication.

**Hard invariant:** This gate ends in a pause. **Production deployment is a blocked action.** The agent MUST NOT deploy. The run status becomes `paused-awaiting-deploy-approval`.

---

### Gate 8 — Production Validation

**Artifact:** `08-production-validation.md` (+ sibling `08-simulate-report.md`)
**Gate question:** Did it work in production?

**Checklist:**
- [ ] Post-deployment smoke tests passed
- [ ] Behavior validated against every acceptance criterion
- [ ] Metrics, logs, alerts healthy; thresholds not breached
- [ ] No regression beyond expected
- [ ] `sdlc:simulate` run and Critical/High findings folded in (or explicit reason it was skipped)
- [ ] Rollback path confirmed still available

**Evidence invariant:** The validation report MUST cite real production evidence (URLs hit, dashboard screenshots, log snippets, metric values). "Looks fine" is not acceptable evidence.

**`sdlc:simulate` integration:** MUST be invoked with `--output .sdlc/runs/<slug>/08-simulate-report.md`. Critical/High UX or backend findings are gate-blocking unless explicitly waived with rationale.

**Dynamic content invariant:** When an acceptance criterion concerns client-side behavior *after* a dynamic content refresh (htmx swap, SSE re-render, websocket update, polling), the verification MUST exercise the refresh path and re-assert — not just confirm the initial page-load render.

**Connection-loss testing invariant:** To validate reconnect/recovery behavior for SSE or WebSocket streams, use `kill -9` (SIGKILL) — not SIGTERM (which triggers graceful shutdown and keeps the stream alive). Only a hard socket severing causes the client to observe a real drop.

**Escalation triggers:** Release-related defect, regression, or user impact detected in production.

---

### Gate 9 — Learning

**Artifact:** `09-post-implementation-review.md`
**Gate question:** Has the system improved?

**Checklist:**
- [ ] Outcome measured against success metrics
- [ ] Decision divergence ratio computed from `resolutions.md`
- [ ] Defects and technical debt logged
- [ ] Context packs, escalation rules, risk policy, and gates updated
- [ ] Default calibration proposed when divergence ratio is high
- [ ] Follow-up backlog created

**Decision divergence:** The gate MUST compute `<diverged> / <total>` resolutions from `resolutions.md` where the source was `evidence-overrides-default` or a user answer not matching the recommended option. When divergence ratio > ~30%, the gate MUST propose specific changes to upstream stated defaults.

**Framework update invariant:** Each edit to files under `.claude/skills/sdlc-knowledge/reference/` MUST be a small, justified change with a one-line rationale linking back to the run. The gate MUST NOT rewrite policy from a single data point. Context pack edits are the ONLY authorized mechanism for updating framework files; this MUST NOT happen outside gate 9.

**Framework files that may be updated:** `context-packs/` (new patterns, constraints, edge cases); `autonomy/escalation-policy.md` (new triggers from near-misses); `quality-gates/` (tighter/lighter gates); `agent/change-classes.md` (class boundary corrections).

**Invariant:** If framework edits would contradict `agent/operating-manual.md`, ESCALATE; never silently rewrite the operating manual.

**Escalation:** None — this gate has no escalation trigger. It closes the loop.

---

## 7. Lifecycle Orchestrators

### 7.1 `sdlc:deliver` — Primary Entry Point

**Trigger:** `/sdlc:deliver <intent> [level=N] [risk=N]` or `/sdlc:deliver resume [slug]`

This is the **primary skill** for interactive delivery sessions. It runs the full gate sequence under control-model enforcement and handles the complete lifecycle including pause/resume.

**Level and risk acquisition:** If `level` or `risk` is absent, the orchestrator MUST ask the user via `AskUserQuestion` — one question for autonomy level (showing the approval-points table), one for risk tolerance. MUST NOT silently guess these two control knobs.

**Resume path:** If args start with `resume`, locate the run directory (given slug, or the most recent `paused` run; if several, ask which). Re-read `state.md` and any escalation report + human response. Human approval advances **one gate only** — not blanket permission. Jump to the next pending gate.

**Gate execution pattern:** Each gate is spawned as a fresh **subagent** (`Agent`, `general-purpose`) so the orchestrator stays lean and each gate runs in fresh context. State flows through `state.md` and numbered artifacts as shared memory between gates. After each gate, re-read `state.md` — trust the file over the returned text.

**Subagent prompt template:**
> Run AI-SDLC gate `<gate>` for the change in `.sdlc/runs/<slug>/`. Invoke the Skill tool with skill `sdlc:<gate>`. Read `contract.md`, `state.md`, and all prior numbered artifacts first. Write this gate's artifact, update the `state.md` ledger row, and return the `### sdlc-result` block verbatim.

**Gate routing:** `R→1-requirements`, `D→2-design`, `K→3-risk`, `I→4-implementation`, `T→5-test`, `S→6-security`, `L→7-release`, `P→8-validation`, `G→9-learning`.

**Lightweight vs. heavy gates:** Gates 2, 4, 5, 6 SHOULD always use subagents (significant work). Gates 1, 3, 7, 8, 9 MAY run inline via the Skill tool when subagent overhead isn't warranted.

**Post-delivery:** After all profile gates pass, write `pr-package.md` in the run directory (§10 template). Set run status `complete`. Report artifacts, gates passed, final risk score, escalations raised, and the PR package path.

**Output format:**
1. Run header — slug, change class, gate profile, level, risk tolerance.
2. Per-gate line — gate, status, risk score, artifact path.
3. On pause — the trigger, the escalation report path, the specific human decision required, and the resume command.
4. On completion — PR package path and the gate ledger summary.

### 7.2 `sdlc:workflow plan` — Gates 0–3 + Resolve

**Trigger:** `/sdlc:workflow plan <intent> [level=N] [risk=N]`
**Precondition:** No in-progress run blocks intake.

**Sequence:**
1. Run `sdlc:0-intake` → `contract.md` + `state.md`.
2. Run `sdlc:1-requirements` → `01-requirements-brief.md`. If open questions block design, run `sdlc:resolve` before proceeding.
3. Run `sdlc:2-design` → `02-design-note.md`. Flag hard-stop triggers for gate 3; do not pre-decide escalation.
4. Run `sdlc:3-risk` → `03-risk-register.md`. If risk score ≥ tolerance or hard-stop trigger fired, write Escalation Report and STOP.
5. Run `sdlc:resolve` over all open-questions sections in order (01 → 02 → 03). Auto-infer where possible; ask the user only for judgment-only questions. Write `resolutions.md`; patch source artifacts.
6. Emit workflow summary with gate ledger, artifact paths, and explicit "Plan complete — ready for `/sdlc:workflow execute <slug>`."

**Agent role:** Orchestrator only. Does not author artifacts directly. Sequences gate skills, propagates `state.md`, enforces stop conditions.

**Trust level:** `review_required` at default autonomy (L2). Human MUST review before invoking `execute`. At L4+, human review may be skipped. At L1, agent pauses at each gate boundary.

**Validation criteria:**
- `.sdlc/runs/<slug>/` exists with `contract.md` and `state.md`.
- Gate ledger rows 0–3 all `passed` (or last one `escalate`).
- `01-requirements-brief.md` has zero open questions; acceptance criteria are testable; traceability table maps every scenario → requirement.
- `02-design-note.md` has a clearly marked recommended option and a decision record for each significant choice.
- `03-risk-register.md` shows the formula used, per-risk Impact × Likelihood, and the change-level score consistent with the frozen formula.
- `resolutions.md` exists; every open question is either resolved or explicitly punted with reason.
- No hard-stop trigger is open and unaddressed.
- Each artifact ends with the `### sdlc-result` block.

**Performance target:** < 15 minutes for XS/S change class. < 1 question/round-trip to human per gate on average at L2. 0 cases where `execute` is invoked while open questions remain unresolved.

### 7.3 `sdlc:workflow execute` — Gates 4–9

**Trigger:** `/sdlc:workflow execute <slug>` (post-plan); `/sdlc:workflow execute resume <slug>` (post-deploy).
**Precondition:** `state.md` MUST show rows 0–3 all `passed`, no open hard-stop triggers, risk score < risk tolerance.

**Sequence:**
1. Run `sdlc:4-implementation` → `04-implementation-plan.md` + code on feature branch.
2. Run `sdlc:5-test` → `05-test-plan.md` + `05-validation-report.md` (real run results).
3. Run `sdlc:6-security` → `06-security-review.md`. High-severity finding without remediation = hard stop.
4. Run `sdlc:7-release` → `07-release-plan.md` + `pr-package.md` + PR opened. **Workflow halts pending human deploy.**
5. **HUMAN ACTION:** review PR, merge, deploy per `07-release-plan.md`. Resume with `/sdlc:workflow execute resume <slug>` or rollback with `/sdlc:workflow execute rollback <slug>`.
6. Run `sdlc:8-validation` → `08-production-validation.md` (real production evidence).
7. Run `sdlc:9-learning` → `09-post-implementation-review.md` + framework file updates.
8. Emit final workflow summary with gate ledger, artifact paths, PR URL, production validation evidence, and explicit "Change shipped, validated, and lessons folded back — run `<slug>` complete."

**Mandatory pause points (regardless of autonomy):**
- Before opening the PR (gate 7 pause).
- Production deployment itself (always human-executed — blocked action).
- Any high-severity security finding in gate 6.
- Any production-validation gap in gate 8.

**Validation criteria:**
- `state.md` shows rows 4–9 all `passed`.
- Every acceptance criterion has ≥1 test executed against real output.
- `06-security-review.md` shows no unmitigated high-severity findings.
- `07-release-plan.md` has an explicit rollback procedure naming commands or a runbook URL.
- `pr-package.md` matches the PR description on GitHub.
- `08-production-validation.md` cites real evidence.
- `09-post-implementation-review.md` exists; any framework edits have a one-line rationale linking to the run.
- No silent skips: gates N/A for this class are recorded as `skipped` with reason in `state.md`.

**Performance targets:** Gate 4 duration scales with class; framework overhead across gates 5–9 < 10 minutes. 0 cases where gate 8 is invoked before human-executed deploy is confirmed live. ≥80% of runs reach gate 9 without an escalation between gates 4 and 8.

---

## 8. Supporting Skills

### 8.1 `sdlc:resolve`

Resolves open questions in gate artifacts. Operates in two modes:
- **Auto mode**: infers the answer from repo evidence + stated defaults. Does not ask the user.
- **Ask mode** (default): prompts the user one question at a time via `AskUserQuestion`, presenting the stated default as the recommended option.

**Argument tolerance (positional drift):** Users frequently pass arguments out of order. The skill MUST resolve in priority order: (1) if `$1` contains `/` matching `<slug>/<file>` — split; (2) if `$1` looks like an artifact selector (matches `^\d{2}-` or ends in `.md`) — treat as artifact, use most-recent run; (3) if `.sdlc/runs/$1/` exists — treat as run slug; (4) otherwise — treat as run slug, fall back to most-recent in-progress run with a note. Report the resolved `(run, mode, artifact)` triple so the user can verify.

**Missing-section policy:** Some artifacts use synonymous headings (`## Open items`, `## Decisions requested`). The skill MUST recognize these and either resolve directly or append a formal `## Open questions` section before resolving. "No open questions found" is only valid when the artifact has no open-decision content at all.

**Rules:**
- MUST write decisions to `resolutions.md` and MUST edit the source artifact to replace the "Open questions" section with a "Resolved decisions" table linking to the decision record.
- If resolving a question would invalidate requirements or design, MUST send the run back to the affected gate rather than papering over it.
- MUST NOT guess or default silently when auto mode cannot produce an answer.
- Each resolution entry MUST record: question, answer, source (`evidence-inferred` \| `evidence-overrides-default` \| `synthesized` \| `user-answer`), confidence (auto only), justification (citing `path:line` or artifact section), and date.
- MUST NOT invent new questions. If a missing question is spotted, append it to the Open Questions table first (with a stated default), then resolve it.
- MUST NOT change other sections of the artifact — downstream implications are captured in the decisions log and applied by the next gate.
- At autonomy level ≤ 2, if the user invoked `auto` mode, ask for a single confirmation before proceeding.
- Idempotent: running twice on a fully-resolved artifact is a no-op.
- After resolution, report a risk note: which decisions diverged from the stated default, and a recommendation for the next gate.

### 8.2 `sdlc:escalate`

Produces an Escalation Report and pauses the run.

**Report structure:** `# Escalation Report` with: a metadata table (Change, Autonomy level, Stage reached); Reason for escalation (which trigger, why); Work completed so far (gate, artifact paths); Specific decision(s) requested (numbered, answerable questions); Recommended option with rationale; Boundaries respected (what the agent did NOT do).

**File naming:** `.sdlc/runs/<slug>/escalations/NN-<trigger>.md` where NN is the next sequence number.

**After escalating:** Set run status to `paused`; mark the current gate `escalated`; append a line to `state.md`'s Escalation log (date, gate, trigger, report path). STOP.

**Resuming after escalation:** Human responds via `/sdlc:deliver resume <slug>`. Human approval advances the agent to the *next authorized gate only* — NOT blanket permission. If the human's decision sets a constraint future changes must honor, record it as a Decision Record.

### 8.3 `sdlc:rules`

**Called as the first step of every gate** (before the gate's own workflow). Searches for a rules directory in priority order: `.claude/rules/` → `.sdlc/rules/` → `docs/rules/`. Reads every rules file (`*.md`, `*.mdc`, `*.txt`, `*.yaml`/`*.yml`) in full. If rules conflict across directories, surfaces the conflict; default precedence is `.claude/rules` > `.sdlc/rules` > `docs/rules`. This skill is read-only — it surfaces and applies rules, never edits them.

### 8.4 `sdlc:simulate`

Multi-persona UX simulation against a deployed app.

**Inputs:** `app-url` (inferred from `Makefile`, `docker-compose.yml`, `k8s/*.yaml`, or `state.md` if absent); `persona-list-or-usecase` (derived from requirements/source if absent); `--output <path>`.

**Workflow:**
1. Discover the app URL and derive personas (default: new unauthenticated visitor, first-time registered user, returning power user, admin/operator, domain-specific role).
2. Launch one subagent per persona, each using `/playwright-cli` to navigate and record flows, errors, UX observations, and console errors.
3. Check observability via `/openobserve` if available: error/warn logs, high-latency traces, RUM events correlated to persona sessions, key metrics vs. baseline.
4. Aggregate, deduplicate, and classify findings by severity: Critical (blocks core use case) / High (degrades UX significantly) / Medium (minor friction) / Low (cosmetic).
5. Write the report to `--output` path if provided, else `.sdlc/runs/<current-slug>/sdlc-simulate-report.md`.

**Multi-persona isolation invariant:** Each persona agent MUST use an isolated user account. For single-account demo apps, each agent MUST clean up only the specific record IDs it created — not "delete all".

**Integration with gate 8:** Invoked by `sdlc:8-validation` with `--output .sdlc/runs/<slug>/08-simulate-report.md`. Critical/High findings are gate-blocking unless explicitly waived with rationale.

### 8.5 `sdlc:secops`

Multi-tool DevSecOps assessment covering: secrets (Group 1), SAST (Group 2), SCA (Group 3), IaC (Groups 4–6), containers (Groups 5–6), Kubernetes (Group 7).

**Inputs:** `target` (default: cwd); `--focus secrets|sast|sca|iac|containers|k8s|all` (default: `all`); `--diff`; `--output <path>`.

**Report path:** defaults to `<target>/secops-report.md`. When invoked from gate 6: `--output .sdlc/runs/<slug>/06-secops-report.md`.

**Deduplication rules:** Same file/line flagged by multiple tools → keep highest-confidence instance, note corroboration. Same check type failing across multiple resources (e.g., `runAsNonRoot` missing on N workloads) → collapse into ONE finding with resource list and count. Sort by severity descending (Critical → High → Medium → Low → Info).

**Delta mode (`--diff`):** Classifies each finding as New / Resolved / Persisting against the previous report at the same `--output` path.

**Integration with gate 6:** High/critical findings are gate-blocking unless explicitly waived with rationale. Pass `--diff` on re-runs.

### 8.6 `sdlc:code-quality`

Multi-tool code quality assessment: complexity, maintainability, duplication, language-specific smells, coverage, and dead code. Produces `code-quality-report.md` in the target directory.

**Tool groups:** Size baseline (always), multi-language complexity (lizard), duplication (jscpd), Python (radon/xenon), JS/TS (ts-complex, code-complexity), Java (PMD CPD), PHP (phpmd), Ruby (reek), coverage (language-native artifact readers), dead code (knip, vulture, depcheck).

**Advisory thresholds** (drive hot-spot lists; skill DOES NOT fail or block):

| Metric | Warn | Hot |
|---|---|---|
| Cyclomatic complexity / function | > 10 | > 15 |
| File length (LOC) | > 400 | > 800 |
| Duplication | > 5% | > 10% |
| Maintainability index (JS/TS, Python) | < 65 | < 40 |
| Line coverage (overall) | < 80% | < 60% |
| Unused exports / dead code | > 20 items | > 50 items |

**Delta mode (`--diff`):** Classifies hot-spots as New / Resolved / Persisting / Regressed vs. the previous report.

### 8.7 `sdlc:report`

Reads all run artifacts from `.sdlc/runs/<slug>/` and produces a self-contained HTML/JS report at `.sdlc/runs/<slug>/report.html`, then opens it in the system browser.

**Report sections:** Gate pipeline visualization; KPI cards (risk score, check pass rate, acceptance criteria coverage); requirements & scope; design summary; risk register; test results; security findings; production validation; personas simulated; incidents; backlog; learning-loop updates.

**Partial runs:** Works at any point in the lifecycle — gates that have not run yet are shown as pending.

### 8.8 `sdlc:wrapup`

Post-Gate-9 finalization. Called after Gate 9 closes the run and the user wants to land the work.

**Inputs:** `run-slug` (defaults to most recent `Status: complete` run); `--no-commit`; `--no-archive`; `--dry-run`.

**Workflow:**
1. Verify `state.md` shows `Status: complete`. Abort otherwise.
2. Read `01-requirements-brief.md` (scope), `02-design-note.md` (new surface), `07-release-plan.md` (version, proposed CHANGELOG text — the canonical changelog source), `09-post-implementation-review.md` (follow-ups), and `README.md` / `docs/`.
3. Diff new behavior against `README.md` and `docs/`; apply the minimal edits to reflect shipped behavior.
4. Append the release entry to `CHANGELOG.md` from the `07-release-plan.md` "Changelog" section.
5. Commit all changes (docs + changelog) as a single commit, unless `--no-commit`.
6. Move `.sdlc/runs/<slug>/` to `.sdlc/archive/<slug>/`, unless `--no-archive`.

### 8.9 `sdlc:transfusion`

Ports a working pattern from an exemplar (internal repo, external open-source project, or library) into the target codebase.

**Inputs:** `exemplar-ref` (local path, GitHub URL, or package name); `target-location`; `--language <lang>` (for cross-language synthesis); `--mode inline|library` (default: `inline`).

**Workflow:**
1. Identify the exemplar (local read, `WebFetch`, or shallow `git clone`). Record license — stop if incompatible.
2. Extract the pattern: structure (types, control flow), invariants (ordering, idempotency, retry), edge cases (from tests/comments/issues), dependencies.
3. Synthesize in the target context using existing codebase conventions. In `--mode library`: add dependency + wire config. In `--mode inline`: write target-language code preserving all invariants.
4. Write behavioral tests proving equivalence against the extracted invariants.
5. Write `sdlc-transfer-<slug>.md` (Pattern Transfer Note) recording what was transfused and what was adapted.

**License invariant:** MUST surface license incompatibilities before writing any target code.

### 8.10 `sdlc:compile-bdr`

Compiles all BDR markdown files from `docs/bdr/[0-9][0-9][0-9]-*.md` into a single `docs/SPEC.md`.

**Workflow:**
1. Collect BDRs (glob, sort numerically). On `--dry-run`: list files + detected duplicates and exit.
2. Detect duplicates in parallel (one subagent per BDR or batch of ~10). Cluster semantically equivalent behaviors.
3. For each merge group, produce one merged spec section using the lowest BDR number as canonical ID.
4. Extract and assemble remaining unique specs in parallel.
5. Write `docs/SPEC.md`.

**`disable-model-invocation: true`** — this skill is always driven by the subagent spawning pattern; it never runs inline.

### 8.11 `sdlc:knowledge`

Read-only index of all framework reference material. Resolves a topic or keyword to the canonical file under `.claude/skills/sdlc-knowledge/reference/` and reads it.

**Special inputs:** (empty) or `list` — print the full index. A keyword — match against index, read the top match. A relative path — read directly.

**Index structure:**
- `reference/agent/` — operating manual, change classes
- `reference/quality-gates/` — quality-gates.md + one file per gate
- `reference/autonomy/` — levels.md, responsibility-matrix.md, escalation-policy.md
- `reference/context-packs/` — CP-01 through CP-09, plus `starters/` (language starters for CP-02)
- `reference/templates/` — all artifact templates

---

## 9. Context Packs

Context packs encode reusable knowledge so the human does not re-specify it per change. Nine canonical packs, organized by layer:

| ID | Title | Layer | Contents |
|---|---|---|---|
| CP-01 | Operating Model | Universal | Default delivery process (13 steps), quality criteria, failure modes, artifact list |
| CP-02 | Engineering Standards | Org/Team | Conventions, error handling, logging, API standards, PR standards; language starters in `starters/` |
| CP-03 | System Context | Platform/Team | System topology, service map, data flows, existing contracts, technical debt register |
| CP-04 | Domain Rules | Platform/Team | Business rules, domain vocabulary, data classifications, valid state transitions, edge cases |
| CP-05 | Definition of Done | Org | Concrete production-ready checklist (10 criteria) |
| CP-06 | Test Strategy | Org/Team | Test pyramid, coverage expectations, Playwright patterns, deployment validation, HTMX/SSE test patterns |
| CP-07 | Security & Privacy | Org | Security defaults, privacy obligations, threat-modeling triggers, learned patterns (rate limiting, nginx headers, React auth) |
| CP-08 | Operational Readiness | Platform | Observability checklist, on-call, incident response, SLAs, runbook requirements; learned patterns (throttle store behavior) |
| CP-09 | Release Governance | Org/Platform | Feature flags, rollout defaults, rollback rules, approval requirements |

**Language starters (CP-02 supplements):** `starters/engineering-standards.go.md`, `starters/engineering-standards.python.md`, `starters/engineering-standards.typescript.md`. Copy the relevant starter into the "Project-specific" section of CP-02 and adjust.

**Definition of Done (CP-05) — a change is NOT complete unless:**
- Requirements are traceable to implementation.
- Acceptance criteria are satisfied.
- Relevant unit and integration tests are included.
- Edge cases and failure modes are handled.
- Security and privacy risks are reviewed.
- Logs, metrics, or traces are updated where operationally relevant.
- Deployment and rollback are understood and documented.
- Documentation or release notes are updated if behavior changes.
- The change is minimal in scope — no unrelated refactors.
- All quality gates have passed.

**Context pack update invariant:** Context packs are the ONLY place where reusable knowledge is stored. Updates MUST flow exclusively through gate 9. Direct edits outside gate 9 are a framework violation.

---

## 10. Templates

Templates under `.claude/skills/sdlc-knowledge/reference/templates/` define the canonical shape of each gate artifact:

| Template | Gate | Artifact | Key sections |
|---|---|---|---|
| `minimal-input-contract.md` | 0 | Minimal Human Input Contract | Intent, Context delta, Priority, Authority, Acceptance |
| `requirements-brief.md` | 1 | Requirements Brief | Metadata, Objective, Scope, Stakeholders, Functional reqs, NFRs, User flows, Edge cases, Dependencies, Assumptions, Open questions, Traceability |
| `design-note.md` | 2 | Design Note | Current state, Gap analysis, Options (≥2), Tradeoffs, Recommended design, Design detail, Risks pointer |
| `decision-record.md` | 2, 4 | Decision Record | Decision, Context, Alternatives, Consequences |
| `risk-register.md` | 3 | Risk Register | Risk table, Risk classification, Risk score, Escalation checklist, Escalation required |
| `escalation-report.md` | Any | Escalation Report | Metadata, Reason, Work completed, Decisions requested, Recommended option, Boundaries respected |
| `implementation-plan.md` | 4 | Implementation Plan | Slice table (Slice, Theme, Hard gate/exit criterion), Step table (Step, Slice, Purpose, Files, Tests, Risk, Validation), Escalation points, Out of scope |
| `test-plan.md` | 5 | Test Plan | Strategy, Unit, Integration, Contract, E2E, Regression, Negative & abuse, Test data, Traceability |
| `validation-report.md` | 5, 8 | Validation Report | Passed, Failed + remediation, Not run + reason, Static checks, Residual risk, Traceability |
| `release-plan.md` | 7 | Release & Rollback Plan | Rollout strategy, Feature flags, Migration sequencing, Pre-deployment checks, Deployment steps, Rollback plan, Post-release validation, Monitoring, Communication |
| `pr-package.md` | 7 | PR Package | Summary, Changes, Out of scope, Risk notes, Test evidence, Reviewer checklist (correctness / maintainability / security & PII / test coverage / migration safety / rollback), Required reviewers, Release & rollback pointer |
| `post-implementation-review.md` | 9 | Post-Implementation Review | Outcome vs. metrics, Decision divergence, What went well, What did not, Defects (table), Technical debt, Learning-loop updates, Follow-up backlog |

---

## 11. State Machine

### 11.1 Run lifecycle

```
                    ┌──────────────────────────────────────────┐
                    │                                          │
[start] → in-progress → paused ──resume──► in-progress → complete
               │                                    │
               └──────────► escalating ─────────────┘
                            (emit Escalation Report, wait)
                                                    │
                                                    ▼
                                              rolled-back
                                       (gate 8 + gate 9 still run)
```

**States:**

| State | Description |
|---|---|
| `in-progress` | Active gate work underway |
| `paused` | Hard-stop trigger, risk threshold, or autonomy pause; awaiting human response |
| `escalating` | Escalation Report emitted; agent is stopped; run is paused |
| `complete` | Gate 9 passed; run closed |
| `rolled-back` | Deploy was reverted; gate 8 captures evidence; gate 9 still runs |

**Transition rules:**
- `in-progress → paused`: any pause condition fires.
- `paused → in-progress`: human approval received via `/sdlc:deliver resume <slug>`.
- `in-progress → complete`: gate 9 passes and `state.md` is updated.
- `paused → complete`: not allowed; approval must return to `in-progress` first.
- A run in `complete` or `rolled-back` MUST NOT be resumed or modified.
- After `complete`: `sdlc:wrapup` archives the run to `.sdlc/archive/<slug>/`.

**Slug collision:** If a slug already exists at gate 0, suffix `-2` and warn. MUST NOT overwrite an existing run directory.

### 11.2 Gate status transitions

```
pending → in-progress → passed | escalate | skipped
```

A gate marked `no` in the Required column stays `pending` and MUST be recorded as `skipped` with a reason when the workflow passes it. "Light" gates (e.g., `R(light)`) are `yes` and MUST run proportionately — they are not skippable.

### 11.3 Risk score updates

The risk score in `state.md` (`Latest risk score`) is updated by: gate 3 (authoritative), gate 4 (may raise), gate 5 (may lower or raise), gate 6 (may raise), gate 8 (may raise). Each update MUST use the frozen formula from `state.md`.

---

## 12. Safety

### 12.1 Trust model

- The agent operates within the scope defined by the Minimal Human Input Contract's Authority field.
- The human retains final accountability for high-impact changes at all autonomy levels.
- Escalation reports are the primary control surface: they stop work, state the specific decision needed, and scope the human's response to the next authorized phase only.

### 12.2 Hard boundaries (all levels)

Production deployment, secrets handling, dropping database objects, disabling security controls, and modifying audit logs are **always blocked actions**. No autonomy level removes this constraint.

### 12.3 Audit trail

- Every gate artifact is a traceable record.
- Every escalation, approval, and override MUST be recorded in a decision record or the `state.md` escalation log.
- Mid-run autonomy elevation MUST be recorded in `state.md`.
- Higher autonomy requires *stronger* evidence in artifacts, not less.

### 12.4 Failure handling

| Failure | Required response |
|---|---|
| Gate skill emits `status: error` | Stop workflow; surface error; do NOT advance ledger |
| `state.md` formula drift | Treat as hard error; halt before advancing gate |
| `sdlc:resolve` cannot auto-answer | Fall back to asking user one question at a time; MUST NOT guess |
| Hard-stop trigger fires mid-workflow | Finish current gate artifact (evidence captured); write Escalation Report; halt before next gate |
| Tests fail with unclear cause | Hard-stop trigger; escalate |
| High-severity security finding without remediation | Hard-stop; write Escalation Report; halt before gate 7 |
| Production behavior diverges from acceptance criteria | MUST NOT mark gate 8 `passed`; either roll back or escalate for a tolerated-divergence decision record |
| Framework edits would contradict `agent/operating-manual.md` | Escalate; MUST NOT silently rewrite the operating manual |
| Exemplar license incompatible with target repo (`sdlc:transfusion`) | Stop before writing any target code; surface to user |
| Deploy executed before gate 7 plan is ready | Not permitted; gate 7 ends in a mandatory pause |

---

## 13. Observability

### 13.1 Gate result block (machine-readable)

Every gate artifact MUST end with a fenced `### sdlc-result` block. Required fields per gate:

**Common fields (all gates):**
```
gate: <N-name>
status: passed | escalate | skipped | paused
risk-score: <2-10 or n/a>
impact: <1-5>  likelihood: <1-5>
hard-stop-triggers: [<none | trigger-name | ...>]
artifact: <path>
note: <one line>
```

**Gate-specific additions:**

| Gate | Additional fields |
|---|---|
| 3-risk | `risk-tolerance`, `escalate-reason` |
| 4-implementation | `files-changed` |
| 5-test | `checks: <passed>/<total>` |
| 6-security | `findings: <n high>/<n med>/<n low>` |
| 7-release | `status: passed-awaiting-deploy-approval`, `blocked-action` |
| 8-validation | `acceptance: <n>/<total> scenarios verified` |
| 9-learning | `divergence: <diverged>/<total>`, `framework-updates`, `followups: <count>` |

### 13.2 Run health surfaces

| Surface | Location | Purpose |
|---|---|---|
| Gate ledger | `state.md` | Primary: which gates passed, current risk score, open escalations, artifact paths |
| HTML report | `report.html` (via `sdlc:report`) | Visual: gate pipeline, KPI cards, test results, security findings, production evidence |
| Escalation log | `state.md` `## Escalation log` section | Audit: all hard-stop events and human approvals |
| Resolutions log | `resolutions.md` + `state.md` `## Resolutions log` | Traceability: all open-question decisions with source and confidence |
| Decision records | `decision-record.md` (appended) | Governance: human overrides of agent recommendations |

---

## 14. Conformance Levels

Three conformance levels define how much of the framework an implementation MUST support.

### Level 1 — Basic (Gated Delivery)

An implementation is **Basic-conformant** if:

- [ ] It classifies every change into exactly one of the 11 change classes before any gate runs.
- [ ] It produces the gate artifact for every required gate in the change class's profile.
- [ ] It appends the `### sdlc-result` block to every gate artifact.
- [ ] It creates a run directory with `contract.md` and `state.md`.
- [ ] It never marks a gate `passed` without producing its artifact.
- [ ] It pauses on every mandatory hard-stop trigger.
- [ ] It never deploys to production without explicit human approval.
- [ ] It never writes to secrets, auth, or database schema without escalation.
- [ ] It uses the formula frozen in `state.md` for all risk computations (no formula drift).
- [ ] It invokes `sdlc:rules` as the first step of every gate.

### Level 2 — Standard (Controlled Autonomy)

A **Standard-conformant** implementation satisfies Level 1 and additionally:

- [ ] It implements all five autonomy levels with the correct approval-point table.
- [ ] It implements risk tolerance comparison (pause when risk score ≥ tolerance).
- [ ] It writes an Escalation Report and pauses before any hard-stop-triggered action.
- [ ] It runs `sdlc:resolve` over open questions before advancing from the plan phase to execute.
- [ ] `resolutions.md` is produced and every resolved question cites its source.
- [ ] Mid-run autonomy elevation is stamped in `state.md`'s `## Autonomy log`.
- [ ] Gate 7 ends in a mandatory pause (the agent does NOT deploy).
- [ ] Gate 8 cites real production evidence (no synthetic or assumed results).
- [ ] Gate 9 computes the decision divergence ratio and folds framework updates.
- [ ] `sdlc:deliver` asks the user for `level` and `risk` if not provided (no silent defaults).
- [ ] Gate ledger skipped entries are recorded as `skipped` with a reason, not silently omitted.

### Level 3 — Full (Learning Framework)

A **Full-conformant** implementation satisfies Level 2 and additionally:

- [ ] It invokes `sdlc:secops` in gate 6 and folds findings; high/critical findings are gate-blocking unless waived.
- [ ] It invokes `sdlc:simulate` in gate 8 and folds Critical/High findings; gate-blocking unless waived.
- [ ] Gate 7 re-runs quality checks (`typecheck`, `test`, `lint`, `audit`, `build`) scoped to the published surface.
- [ ] Gate 9 applies default calibration when divergence ratio > ~30%.
- [ ] Framework file edits from gate 9 include a one-line rationale linking back to the run.
- [ ] The `## Autonomy log` section in `state.md` is maintained across all mid-run level changes.
- [ ] The slice discipline in gate 4 is enforced: steps MUST be grouped into 2–5 slices with hard gate exit criteria.
- [ ] The cross-path-merger and schema-addition patterns in gate 2 are applied when applicable.
- [ ] Validation of dynamic content (post-swap, post-SSE, post-WebSocket) is performed in gate 8 for applicable acceptance criteria.
- [ ] The connection-loss/reconnect behavior test methodology (SIGKILL not SIGTERM) is followed in gate 8 when validating streaming connections.
- [ ] `sdlc:wrapup` is invoked after gate 9 to sync docs, append CHANGELOG, commit, and archive the run.
- [ ] `sdlc:resolve` argument-tolerance (positional drift handling) is implemented.
- [ ] `sdlc:transfusion` extracts and validates invariants from the exemplar before writing any target code.

---

## 15. Extension Points

### 15.1 Context pack slots

Context packs 02–09 are the designated extension surface for team-specific knowledge. An organization MUST NOT add reusable knowledge outside of context packs. Custom packs MUST use the same layer taxonomy (Universal → Org → Platform/Team → Run) and MUST NOT override the invariants in CP-01 or CP-05.

**Language starters:** The `starters/` directory under CP-02 provides pre-populated engineering standards for Go, Python, and TypeScript. Copy the relevant file into the "Project-specific" section of your CP-02 and adjust.

### 15.2 Gate profile customization

A project MAY define a custom gate profile for a custom change class by:
1. Adding the class to `agent/change-classes.md` with a clear class boundary and a default autonomy level.
2. Specifying the required gate set.
3. Defining the escalation triggers specific to the class.

Custom classes MUST NOT reduce the required gates for changes that touch auth, payments, PII, schema, or public APIs below the mandatory level for those categories.

### 15.3 Template overrides

A project MAY extend the canonical templates by adding project-specific sections after the canonical sections. Extensions MUST NOT remove or rename canonical sections. The `### sdlc-result` block MUST appear last and MUST NOT be modified.

### 15.4 Risk formula override

A project MAY use a multiplicative formula (`Impact × Likelihood`) or a weighted variant instead of the default additive formula, provided:
1. The custom formula is documented in the context packs.
2. It is recorded in `state.md` at intake.
3. The risk tolerance thresholds are recalibrated for the new scale.
4. All gates use the custom formula consistently (no drift).

### 15.5 BDR-driven specification

Projects may maintain Behavioral Design Requirements (BDRs) as numbered markdown files in `docs/bdr/[0-9][0-9][0-9]-*.md`. The `sdlc:compile-bdr` skill compiles these into a unified `docs/SPEC.md`, deduplicating overlapping behaviors using parallel subagents. This provides a bottom-up spec authoring workflow complementary to the top-down gate artifacts.

---

*This specification was extracted and refined from the AI-SDLC skill suite at `.claude/skills/sdlc-*`. Status: proposed. Version: v1.1. Generated: 2026-05-28.*

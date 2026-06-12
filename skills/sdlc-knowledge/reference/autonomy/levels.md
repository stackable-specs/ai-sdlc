# The 6 Levels of AI-SDLC Autonomy

Adapted from the SAE self-driving autonomy levels. The question at each level:
**Who performs the SDLC task, who verifies quality, and under what conditions can the
AI proceed without a human?**

Autonomy is not capability. A powerful model with no tests, no deployment gates, and
no audit trail is Level 1–2, not Level 4. Autonomy depends on tooling, CI/CD maturity,
policy enforcement, observability, rollback, and organizational risk tolerance.

| Level | Name | Human role | AI role | Posture |
|-------|------|-----------|---------|---------|
| 0 | No AI Assistance | Performs all SDLC work | None / passive tooling | Human-controlled |
| 1 | AI Task Assistance | Owns delivery | Assists one bounded task | Human-led |
| 2 | AI Workflow Assistance | Supervises, reviews all output | Handles multiple steps | Human-supervised |
| 3 | Conditional AI Delivery | Defines gates, handles escalation | Executes workflow, escalates | Shared-control |
| 4 | Domain-Bounded Autonomy | Sets policy, audits | Delivers within a domain | AI-led, governed |
| 5 | Full Autonomous Delivery | Sets business intent | Owns end-to-end SDLC | Aspirational |

## Level 0 — No AI Assistance
Humans perform the entire lifecycle. AI is at most passive tooling (linting,
autocomplete, build warnings). Quality depends entirely on human discipline.

## Level 1 — AI Task Assistance
AI assists with one isolated task; the human owns planning, sequencing, verification,
and integration. **AI output is a draft, not a deliverable.** Required gates: human
review, local validation, test execution, consistency check, security sanity check.

## Level 2 — AI Workflow Assistance
AI handles multiple connected SDLC activities under continuous human supervision. It
must not silently skip steps — each phase produces an artifact, states assumptions,
identifies risks, and waits for approval before the next major phase. **Default level
for most teams.**

## Level 3 — Conditional AI Delivery
AI executes a defined workflow with significant independence but **must escalate** when
it hits an uncertainty, risk, or policy threshold (see `escalation-policy.md`).
Artifacts become control points. **Best for mature engineering workflows.**

## Level 4 — Domain-Bounded Autonomous Delivery
AI delivers autonomously **within a fenced operating domain** (specific repos, paths,
change classes, risk classes, environments). Humans define policy, guardrails, and
audit requirements rather than supervising each action. The AI may complete work
without intervention only if all automated gates pass and the change stays in-domain.
**Best for tightly bounded, low-risk work.**

## Level 5 — Full Autonomous Software Delivery
AI owns the full SDLC across domains, from business intent to production operation,
with no routine human supervision. Governance shifts from approving changes to auditing
outcomes. **Aspirational for most organizations today — treat as a north star.**

## Choosing a level

Match autonomy to the **risk of the work, not the capability of the model**.

> The higher the blast radius, the lower the autonomy level should be.

| Task | Appropriate level |
|------|-------------------|
| Explain legacy code | 1 |
| Generate unit tests | 1–2 |
| Draft requirements from a ticket | 2 |
| Fix a small bug with tests | 2–3 |
| Update internal documentation | 3–4 |
| Refactor payment logic | 1–2 |
| Modify authentication | 1–2, mandatory review |
| Deploy production infrastructure | 2–3, rarely 4 |
| Own product strategy and delivery | 5 (aspiration) |

Recommended operating modes: **Level 2 default**, **Level 3 advanced**, **Level 4 only
inside strict boundaries**.

# Human vs. Agent Responsibility

## By autonomy level

| Level | Human responsibility | Agent responsibility |
|-------|---------------------|----------------------|
| 0 | All work | None |
| 1 | Owns workflow | Assists task |
| 2 | Supervises workflow | Executes steps |
| 3 | Handles escalation | Executes conditionally |
| 4 | Sets policy / audits | Delivers within domain |
| 5 | Sets intent / governance | Owns end-to-end delivery |

## By SDLC phase

| Phase | L1 | L2 | L3 | L4 | L5 |
|-------|----|----|----|----|----|
| Intake | Drafts problem statement | Structures requirements | Infers from ticket | Selects eligible backlog | Defines opportunities |
| Requirements | Assists | Drafts complete | Proceeds unless ambiguous | Policy-defined templates | Owns discovery |
| Design | Suggests options | Produces design brief | Selects within constraints | Designs inside domain | Owns architecture |
| Build | Generates snippets | Implements supervised | Implements conditional | Implements in domain | Implements any objective |
| Test | Generates tests | Creates test plan | Runs/updates tests | Must pass automated gates | Owns verification |
| Security | Checklist support | Initial review | Escalates risk | Enforced policy gates | Continuous assurance |
| Release | Drafts notes | Plans deployment | Prepares package | Deploys within scope | Owns rollout |
| Operate | Explains logs | Suggests dashboards | Diagnoses known issues | Bounded remediation | Owns incident response |

## The human always retains

Even at high autonomy, the human provides or approves:

- the desired business outcome and stakeholder priority;
- acceptance criteria and risk appetite;
- unique business constraints;
- final accountability for high-impact changes.

The goal is not to remove the human. It is to remove the **repetitive specification
burden** — see `../docs/ai-sdlc-overview.md`.

## What humans should NOT have to re-specify

How to write requirements, structure a design doc, the team's code style, test
expectations, required security checks, observability expectations, deployment and
rollback meaning, domain vocabulary, common edge cases, prior failures, escalation
rules. All of these live in `../context-packs/`.

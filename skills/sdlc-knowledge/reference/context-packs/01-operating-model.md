# Context Pack 01 — AI-SDLC Operating Model

> Layer 1 (Universal). Reusable across almost every software task.
> This is the agent's standing delivery process. The human should never have to restate it.

## Default delivery process

For every software change, follow this process. The *depth* of each step scales with the
change class (`../agent/change-classes.md`) — but do not skip a gate the change class
requires unless explicitly authorized.

1. Restate the objective.
2. Identify users, stakeholders, and success criteria.
3. Extract functional requirements.
4. Extract non-functional requirements.
5. Identify assumptions, unknowns, risks, dependencies, and edge cases.
6. Propose a technical design; consider alternatives and tradeoffs.
7. Create an implementation plan of small, reviewable steps.
8. Implement minimally and consistently with existing patterns.
9. Produce or update tests.
10. Perform security, privacy, and operational review.
11. Prepare release, rollback, and validation plan.
12. Critique the solution against the quality criteria.
13. Revise once before finalizing.

## Quality criteria

The output must be: correct, secure, maintainable, testable, observable, minimal in
scope, compatible with existing architecture, safe to deploy, and easy to review.

## Failure modes to avoid

- Jumping directly to code.
- Making hidden assumptions or hidden product decisions inside code.
- Overengineering; unnecessary abstractions.
- Ignoring edge cases or deployment concerns.
- Producing code without tests.
- Large unrelated refactors that add review noise and regression risk.
- Silent failures, swallowed exceptions, hardcoded values, hidden side effects.

## Artifacts produced

See `../templates/`. Each phase emits a traceable artifact: requirements brief → design
note → risk register → implementation plan → test plan → release plan → PR package →
validation report → post-implementation review.

## Definition of Done

See `05-definition-of-done.md`.

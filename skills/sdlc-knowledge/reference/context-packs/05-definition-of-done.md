# Context Pack 05 — Definition of Done

> Layer 2 (Organization). Reusable across almost all AI-SDLC work. This is what
> "production-ready" means concretely — so the human never has to say it vaguely.

A change is **not complete** unless:

- [ ] Requirements are traceable to implementation.
- [ ] Acceptance criteria are satisfied.
- [ ] Relevant unit and integration tests are included.
- [ ] Edge cases and failure modes are handled.
- [ ] Security and privacy risks are reviewed.
- [ ] Logs, metrics, or traces are updated where operationally relevant.
- [ ] Deployment and rollback are understood and documented.
- [ ] Documentation or release notes are updated if behavior changes.
- [ ] The change is minimal in scope — no unrelated refactors.
- [ ] All quality gates (`../quality-gates/quality-gates.md`) have passed.

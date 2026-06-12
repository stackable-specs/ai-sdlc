# Context Pack 02 — Engineering Standards

> Layers 2–3 (Organization / Team). Reusable across the org or team.
> Adapt the specifics to your stack; the principles are stable.
> A language-specific starting point is available in `starters/` — copy it over the
> "Project-specific" section below and adjust.

## Standards

- Use existing project conventions before introducing new patterns.
- Prefer small, reviewable changes.
- Do not introduce new dependencies without escalation.
- Use typed interfaces for external boundaries.
- Handle errors explicitly. Do not swallow exceptions.
- No silent failures, hardcoded values, or hidden side effects.
- Add tests for behavior, not implementation details.
- Keep public API changes backward-compatible unless explicitly approved.
- Update documentation when behavior changes.
- Match the comment density, naming, and idiom of the surrounding code.

## Learned patterns

### Verify ratchet files before stating ratchet assumptions in contracts

When a contract or requirements brief includes an assumption about the state of a build
ratchet file (`.betterer.results`, type-check baselines, etc.), **read that file at
Gate 1 and count the tracked entries**. Do not state ratchet-state assumptions as facts
without inspection.

- A ratchet file with zero entries means the ratchet is clean.
- A ratchet file with N > 0 entries means those N errors will be exposed if the
  corresponding override (e.g. `tsconfig.build.json strict: false`) is removed.
- Mark unverified ratchet-state claims as open questions (OQ) rather than stated
  assumptions — the OQ path resolves at Gate 4 without a scope-breaking escalation.

**Anti-pattern:** `A-1: "The betterer ratchet is at 0 strict errors"` written in a
contract without reading `.betterer.results`. In practice `.betterer.results` may have
hundreds of tracked errors. When this assumption is wrong it fires an EC-5 escalation
at Gate 4, defers the highest-value finding, and degrades the delivered scope.

> Added: ims-228-cr-remediation-2026-06-03, 2026-06-03.

---

## Project-specific (fill in)

- **Languages / frameworks:** _…_
- **Naming & formatting conventions:** _…_
- **Error envelope / error handling pattern:** _…_
- **Logging format:** _…_
- **API conventions:** _…_
- **Test framework & conventions:** _…_
- **Dependency policy:** _…_
- **Pull request standards / template:** _…_
- **Documentation requirements:** _…_

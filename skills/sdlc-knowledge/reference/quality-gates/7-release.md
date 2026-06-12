# 7. Release Gate
**Artifact:** Release & Rollback Plan. **Question:** Can we ship safely?

- [ ] Rollout strategy, feature flags, migration sequencing defined
- [ ] Rollback plan defined *before* deployment
- [ ] Pre-deployment checks listed
- [ ] Observability in place to monitor the rollout
- [ ] Post-release smoke checks assert **functional/rendered output**, not just a 2xx
      status. For UI-bearing changes a shell-only `curl → 200` is insufficient — the SPA
      can fail to mount behind a 200. See context-pack 06 § "Smoke checks for SPAs".

**Escalation:** production deployment — always requires explicit approval.

> Anti-pattern (steamtrap-ui-docker-2026-06-04): a `curl :5173 → 200` post-release check
> passed while the frontend never rendered (missing import in `App.tsx`); the defect was
> not surfaced until gate 8. Smoke checks must prove the app *works*, not that it *responds*.

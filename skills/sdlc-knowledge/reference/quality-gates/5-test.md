# 5. Test Gate
**Artifact:** Test Plan + Validation Report. **Question:** Can we prove it works?

- [ ] Unit, integration, contract, E2E, regression coverage as relevant
- [ ] Negative and abuse cases covered
- [ ] Tests trace to acceptance criteria and risks
- [ ] All checks pass; failures analyzed and remediated
- [ ] For any packaged/containerized artifact: a check **imports/runs the app's actual
      entrypoint module graph** (not just a list of named packages, and not just a
      successful build) — proves transitive/undeclared deps are installed. See
      context-pack 06 § "Dependency validation". A build-only green does not satisfy this.

**Escalation:** tests fail with an unclear cause.

> Anti-pattern (steamtrap-ui-docker-2026-06-04): the dependency check imported only the
> five packages named in `requirements.txt`, so a transitive `numpy` import in
> `analysis.py` stayed invisible until it crashed the backend at deploy time. Image
> *build* success is not *startup* success.

# 8. Production Validation Gate
**Artifact:** Validation Report (post-deploy). **Question:** Did it work in production?

- [ ] Post-deployment smoke tests passed
- [ ] Behavior validated against acceptance criteria
- [ ] Metrics, logs, alerts healthy; no regression beyond expected
- [ ] For any UI-bearing change: smoke tests assert the app **actually renders** (mounted
      DOM / transformed module), not merely that the server returned HTTP 200. A dev server
      answers 200 on the static shell even when the SPA never mounts. See context-pack 06
      § "Smoke checks for SPAs".

**Escalation:** release-related defect, regression, or user impact detected.

> Gate-profile note (steamtrap-ui-docker-2026-06-04): this gate is `Required=no` for the
> Infrastructure/deploy default, but when run by human override it caught a **Critical**
> defect (frontend never rendered) that every earlier gate — including a build-green test
> gate and a shell-only release smoke check — missed. For **UI-bearing changes**, treat
> Production Validation as **required**: it is the only gate that exercises the deployed
> system the way a user would. See `../agent/change-classes.md`.

> Anti-pattern (steamtrap-ui-docker-2026-06-04): gate 7's release smoke check was
> `curl :5173 → 200`. Vite returns 200 for the HTML shell even when `App.tsx` fails to
> resolve an import and the SPA never mounts. HTTP-200-on-dev-server is not proof the app
> works. Assert rendered output.

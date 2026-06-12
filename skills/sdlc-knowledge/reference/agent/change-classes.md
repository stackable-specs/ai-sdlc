# Change Classes & Gate Profiles

The full nine quality gates are the *default*, not a tax on every change. Matching the
process weight to the change is how AI-SDLC delivers **speed without losing quality**:
trivial changes move fast; risky changes get full rigor.

Classify every change into exactly one class. The class sets the **gate profile** and a
**default autonomy level**; the Authority in the Minimal Human Input Contract always
overrides the default.

## Gate index

`R` Requirements · `D` Design · `K` Risk · `I` Implementation · `T` Test ·
`S` Security/Privacy · `L` Release · `P` Production Validation · `G` Learning
(see `../quality-gates/quality-gates.md`)

## The classes

| Change class | Examples | Default level | Required gates | Mandatory escalation |
|--------------|----------|---------------|----------------|----------------------|
| **Trivial** | Docs, comments, copy, config value with no behavior change | 4 | I, T(light), G | If behavior changes |
| **Test-only** | Add or repair tests, no source change — includes adding new test scenarios for existing production behavior, fixing test bugs (e.g. wrong URLs, broken selectors), and expanding test coverage within an existing test file, as long as no file under `src/` or any deployed artifact changes | 3–4 | I, T, G | Failing tests with unclear cause |
| **Contained bug fix** | Localized fix, no schema/API change | 3 | R(light), K, I, T, P, G | Cause unclear; fix touches auth/data/API |
| **Internal refactor** | Behavior-preserving restructure | 2–4 | D, K, I, T, P, G | Blast radius beyond the module |
| **Small feature increment** | New behavior within an existing surface | 2–3 | R, D, K, I, T, S, L, P, G | Schema / API / auth / dependency change |
| **New feature** | New user-visible capability | 2 | All nine | Schema / API / auth / dependency change |
| **Schema / data migration** | DB schema or data change | 2 | R, D, K, I, T, S, L, P, G | Always — before the migration |
| **Public API change** | Endpoint, schema, or event contract change | 2 | All nine | Always — before the change |
| **Security / auth change** | Authn, authz, crypto, secrets handling | 1–2 | All nine + threat model | Always — mandatory human review |
| **Dependency change** | Add / remove / upgrade a library or service | 2–3 | K, I, T, S, L, P, G | Always — before adding |
| **Infrastructure / deploy** | IaC, pipeline, runtime config | 2–3 | D, K, I, T, S, L, P, G | Production-affecting changes |

## How to use it

1. Pick the class. When a change spans classes, use the **most rigorous** one.
2. Take its gate profile and default level.
3. Apply the human's Authority — it can raise rigor or lower autonomy, never the reverse
   without explicit approval.
4. "Light" gates still happen — they are just proportionate (a one-line restated
   objective instead of a full Requirements Brief).

## Sub-class: full reference implementation (example apps)

When a "New feature" run produces a **full reference implementation** (not a minimal
demo) — meaning it showcases an entire realistic stack end-to-end — use the following
defaults instead of the conservative "minimal footprint" defaults for example apps:

| Decision point | Conservative default (minimal demo) | Full-reference default |
|----------------|--------------------------------------|------------------------|
| Stack scope | Frontend slice only | Full stack (backend + frontend + infra) |
| Auth | Optional / anonymous | Auth enabled (JWT or session) |
| Dev loop | docker-compose | Skaffold (if k8s is in scope) |
| Observability | Off | OTEL + collector in-cluster |
| Storybook | Off | On (if component library present) |
| Node version | Current LTS (≥20) | Upstream spec version (e.g. ≥26) |
| SHA pinning | Pin upstream spec at scaffold time | Track `main`; record SHA in README |

**Why:** The 2026-05-24 `examples-todo-app` run had a 43% decision divergence ratio
(6/14 overrides) because the agent defaulted to the conservative column for all of the
above, and the user overrode each one toward the full-reference column. For runs where
the contract says "full walkthrough" or "realistic demonstration", start in the
full-reference column to avoid unnecessary question rounds.

**How to identify:** The contract's Priority field says "clarity and reproducibility"
*and* the scope includes multiple layers (auth + persistence + observability + tests),
*and* the target audience is engineers learning from the example.

## Gate-profile rule: UI-bearing changes require Production Validation (P)

> Added: steamtrap-ui-docker-2026-06-04 run (gate-8 cycle).

Whenever a change ships **user-facing UI** — regardless of its class — **Production
Validation (P) is required**, not optional. In the steamtrap-ui-docker run, an
Infrastructure/deploy change carried a UI (a Vite/React frontend). Gate P is `Required=no`
for Infrastructure/deploy by default, so the run nearly closed without it; a human override
ran gate 8 and it caught a **Critical** defect (the frontend never rendered — a missing
import) that the build-green test gate and the shell-only release smoke check both missed.
P is the only gate that exercises the deployed system as a user would.

**Rule:** if the deliverable renders anything to an end user, mark gate P required in the
profile even when the change's base class lists it as optional. Pair with the SPA
smoke-check rule (context-pack 06 § "Smoke checks for SPAs"): the gate must assert
**rendered output**, not an HTTP 200.

> Reinforced: steam-savings-report-docker-2026-06-04 run (recurrence, gate-9).

A second Infrastructure/deploy run that shipped a UI (a Vue 3 + Vite SPA served by nginx
via Compose) again left gate P marked `Required=no`/`pending` and closed straight to gate 9
Learning, **despite the rule above**. It was lower-consequence here — the deploy target was
local docker-compose (no shared/prod environment) and gate 7's post-release checks did
assert rendered output (correct `<title>`, real JS bundle, deep-link fallback 200), so the
SPA-mount false-pass class was caught at release. But the gate-profile defect recurred: the
required-gate ledger for an Infrastructure/deploy run carrying UI was not flipped to make P
required. The recurrence signals the rule is not being enforced at gate-0/intake where the
profile is set. **Enforcement fix:** gate 0 (intake) MUST set gate P = required whenever the
deliverable renders UI, regardless of base class — do not rely on a later gate to notice.
For purely local/CI tooling deploys with no shared environment, P MAY be satisfied by the
release gate's rendered-output post-release checks, but it must still be an explicit,
recorded gate decision, not silently skipped.

## Gate-profile rule: local-only Infrastructure/deploy — gate P must be explicitly decided at intake

> Added: migrate-local-lab-to-docker-desktop-k8s-impl-2026-06-04 run (gate-9 cycle).

The Infrastructure/deploy change class lists Production Validation (P) in its required gate profile. For runs that explicitly target **local-only** environments (docker-desktop, local K8s, local Compose — no shared/prod cluster), gate P is frequently left `Required=no` without a recorded intake decision. This silently closes the SDLC run without live-cluster validation.

**Rule:** gate 0 (intake) MUST explicitly decide gate P for every Infrastructure/deploy run:

- **Local-only, no shared environment:** gate P MAY be waived. Record the justification in the gate profile (e.g., "gate P waived — local-dev-only, no shared cluster; live validation is developer-gated per OQ items in release plan"). Gate 7's post-release checks must cover at minimum: dry-run passes, post-apply pod status, and any reproduction-gated items documented as explicit follow-ups.
- **Shared/CI/production environment:** gate P is required. Mark `Required=yes` and run `sdlc-8-validation` after deploy.

**The default is not silence.** Leaving gate P `Required=no` with no justification is not acceptable — it reads as "P not applicable" when it may mean "P was forgotten." Intake must either set `Required=yes` or record why P is waived.

## The fast path

Trivial and test-only changes, at Level 4, inside an approved operating domain, with all
automated checks green, may complete without human review. Everything else stops at its
profile's human gates.

This is the single biggest lever for delivery speed — it removes ceremony from the
60–80% of changes that are low-risk, so reviewer attention concentrates where blast
radius is real.

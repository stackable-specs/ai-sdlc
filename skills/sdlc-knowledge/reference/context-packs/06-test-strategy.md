# Context Pack 06 — Test Strategy

> Layers 2–3 (Organization / Team). Reusable, with project-specific overlays.

## Default test strategy

- Add unit tests for pure business logic.
- Add integration tests for service / database / API boundaries.
- Add contract tests when public APIs or event schemas change.
- Add regression tests for bug fixes.
- Add negative tests for invalid input, permissions, timeouts, and failure states.
- Do not mock the behavior being tested.
- Prefer deterministic tests over broad snapshot tests.
- Test behavior, not implementation details.
- Use fixed or mocked time for time-dependent logic.

## Test pyramid

Many fast unit tests → fewer integration tests → few end-to-end tests.

## When to add more

- **Performance / load tests:** latency-, throughput-, or capacity-sensitive paths.
- **Accessibility tests:** any user-facing UI change.
- **Security tests:** auth, input handling, or sensitive-data paths.

## Test data

Safe, realistic, repeatable. No production PII in test fixtures.

## Traceability

Every test should trace back to a Gherkin scenario and/or a risk mitigation. State
explicitly which tests are *not* worth adding, and why.

## Playwright / browser e2e patterns

> Added: todo-e2e-k8s-playwright run, 2026-05-24.

**Selector strategy (priority order):**
1. `aria-label` and `role` — most stable; survive CSS refactors.
2. `:has-text()` scoped to a parent row (`li`, `article`) — targets the right item when text is unique per row.
3. `button:has-text("Add")` — text-content fallback only where `aria-label` is absent.
4. Never use CSS utility class selectors (`.line-through`, `.btn-active`) — brittle to design-system changes.

**Dynamic `aria-label` values:** When a component uses a template literal (e.g. `aria-label={`Delete "${item.text}"`}`), use a starts-with match: `[aria-label^="Delete"]`. Exact-match `[aria-label="Delete"]` will not find it. Always read the component source for buttons with contextual labels before writing selectors.

**State assertions — read the DOM, not assumed class names:** For toggled states (completed, selected, active), read the component source before writing assertions. Common patterns:
- Checkbox state → `toBeChecked()` / `not.toBeChecked()` on `<input type="checkbox">` — NOT `toHaveClass(/completed/)` on a parent `<li>` unless the component actually sets that class.
- Pressed button → `toHaveAttribute('aria-pressed', 'true')`.
- Disabled element → `toBeDisabled()`.

**`beforeAll` + `afterEach` API cleanup:** For Playwright tests against a shared DB with a single seeded user, obtain a JWT in `beforeAll` via direct API call, then use it in `afterEach` to DELETE all records the test created. Idempotent across retries; avoids test-order dependencies. Pair with `fullyParallel: false` to prevent cleanup racing the next test's setup.

**`playwright-cli` availability:** The Claude Code `playwright-cli` skill requires a live stack reachable at the configured `baseURL`. Treat it as an interactive second pass for already-running stacks — it cannot substitute for `pnpm test:e2e` or for a running server.

**Throttle-aware login strategy (when login is rate-limited):**
When the login endpoint has a strict rate limit (e.g., 5 req / 15 min, in-memory per
pod), E2E tests must not call the login API once per test. Use this pattern instead:
1. `beforeAll`: obtain one JWT via a direct backend API call (counts 1 against the throttle).
2. Per test requiring auth: inject the JWT via `page.addInitScript` → `sessionStorage.setItem('access_token', token)` before `page.goto('/')`.
3. `afterEach`: clean up test data via direct API calls using the `beforeAll` token (no additional logins).
4. If `beforeAll` is called multiple times (Playwright spawns a new worker on retry), restart the backend pod to reset the in-memory throttle before re-running.

For `addInitScript` injection to work with React sessionStorage auth, the React context
**must** use a `useState` lazy initializer to read storage — not `useEffect`. See
`07-security-privacy.md` § "React auth: lazy `useState` init".

> Added: todo-ux-bugfixes run, 2026-05-26.

---

## Deployment validation — Docker/k8s image freshness

> Added: todo-ux-bugfixes run, 2026-05-26.

Docker Desktop's k8s uses containerd's image store, **separate** from the Docker
daemon's store. Running `docker build` (even `--no-cache`) in the Docker daemon does
not guarantee k8s serves the new image when the deployment references the same tag —
containerd caches the prior digest independently.

**Before running E2E tests against a k8s stack, verify the deployed bundle matches
current source:**

```bash
# Check which JS bundle is running in the pod
kubectl exec -n <ns> deploy/<frontend> -- find /usr/share/nginx/html -name 'index-*.js'
# Compare hash against locally-built output in dist/
```

If mismatched during development:
- **Fast fix:** `kubectl cp dist/ <pod>:/usr/share/nginx/html/` — immediate effect, lasts until pod restart
- **Correct fix:** rebuild with a new/unique tag; update the k8s deployment image reference

**Preferred workflow:** use `skaffold dev` — it builds with content-addressed tags and
syncs images to k8s automatically, eliminating the stale-image class of failure entirely.

---

## Dependency validation — import the app's module graph, not the named packages

> Added: steamtrap-ui-docker-2026-06-04 run.

A successful `docker build` only proves that the packages **listed** in
`requirements.txt` / `package.json` install. It does **not** prove the app can start:
`uvicorn main:app` (or any entrypoint) imports the full module graph, which can pull in
a transitive dependency that no manifest declares. In this run `analysis.py` imported
`numpy`, `requirements.txt` omitted it, the image built clean, and the backend crashed
with `ModuleNotFoundError` at deploy time (gate-7 escalation 01).

**Rule:** an import/dependency check must import the **actual application entrypoint
modules** — the same graph the runtime loads — not a hand-maintained list of package
names. The hand-maintained list silently drifts from the real import set.

```bash
# WEAK — only catches packages someone remembered to list:
docker run --rm <img> python -c "import fastapi, uvicorn, requests"
# STRONG — exercises the real startup module graph, catching transitive/undeclared deps:
docker run --rm <img> python -c "import main, analysis"   # or the app's entrypoints
```

For Node, the analogue is a build/`import`-the-entry step (`node -e "require('./dist/main.js')"`
or a `tsc --noEmit`), not just `npm ci` succeeding. Generalize: **prove the artifact
*runs/imports*, not merely that it *builds*.** A build-only green is a false-pass signal
for any "missing dependency" class defect.

---

## Smoke checks for SPAs — assert the app renders, not that the server returns 200

> Added: steamtrap-ui-docker-2026-06-04 run (gate-8 cycle, escalation 02).

A dev server (Vite, webpack-dev-server, CRA, Next dev) returns **HTTP 200 for the HTML
shell even when the application never mounts**. The shell is static; the real app is the
JS module graph the browser transforms and executes *after* the 200. A broken import,
type error, or missing module fails inside that graph and the user sees a blank/broken
page — while `curl :5173 → 200` reports green. In this run `App.tsx` imported a missing
`./types` module; Vite served an *error document* with status 200, the SPA never mounted,
and gate 7's shell-only `:5173 → 200` smoke check gave a false green that gate 8 caught.

**Rule:** for any UI-bearing change, the smoke check must assert the app **actually
renders**, not that the server answered. Strengthen weak → strong:

```bash
# WEAK — passes even when the SPA never mounts (shell-only):
curl -fsS http://localhost:5173/ -o /dev/null   # 200 on the HTML shell

# STRONG — drives the module transform / rendered output and fails on an error document:
curl -fsS http://localhost:5173/src/App.tsx | grep -q 'Failed to resolve import' && exit 1
# or assert the transformed module is real JS, or drive a headless browser and assert the
# mounted DOM (a known root element / text is present), e.g. Playwright `toBeVisible()`.
```

This run adopted `scripts/smoke-check.sh` (6 assertions: backend `/docs`, `/openapi.json`,
`/api/steamtraps`; frontend `/src/App.tsx` transforms to real JS with zero Vite error
markers; a `/src/types.ts` regression guard). Generalize: **HTTP 200 on a dev server is
not proof the SPA mounts — assert rendered output.** Same family as the dependency lesson
above: prove the artifact *works for a user*, not merely that it *responds*.

---

## SPA path-prefix deploys — assert the FETCH-LAYER prefix, not just the asset prefix

> Added: steamtrap-ui-shared-apps-deploy-2026-06-04 run (post-deploy hotfix, found by human browser test).

When a SPA is served behind a path prefix (Traefik/ingress `PathPrefix(/app)` + strip-prefix
Middleware), there are **two independent prefix surfaces** and a green check on one does NOT
imply the other:

1. **Asset prefix** — Vite `base: '/app/'` makes hashed `<script>`/`<link>` URLs resolve under
   the prefix. Easy to verify statically (grep the built `index.html` for `/app/assets/`).
2. **Fetch prefix** — the runtime `fetch()`/XHR base the JS uses for API calls. If `api.ts`
   defaults `BASE_URL` to `''`, calls go to **root-relative** `/api/...`, which bypass the
   `/app` PathPrefix and **404 at the ingress** — even though every asset loads fine.

In this run gate-4/5 static checks verified the asset prefix wiring (R3) but never asserted the
fetch-layer URLs; the in-cluster smoke curled the *post-strip* path (`/api/...`) directly, so it
also missed the gap. The defect only surfaced when a human opened the app in an authenticated
browser and the network calls 404'd. Fix: derive `BASE_URL` from `import.meta.env.BASE_URL`
(the Vite base, trailing slash trimmed) so calls go to `/app/api/...`.

**Rule:** for any SPA deployed under a path prefix, the smoke check must assert the **served
JS bundle issues prefixed network calls** — not merely that assets carry the prefix and not by
curling the stripped backend path. Strengthen weak → strong:

```bash
# WEAK — verifies asset prefix only; root-relative fetches still 404 at ingress:
grep -q '/app/assets/' dist/index.html

# WEAK — curls the POST-STRIP path directly, never exercising the ingress prefix match:
curl -fsS http://svc/api/steamtraps    # backend sees /api/... regardless of fetch base

# STRONG — assert the served bundle's runtime fetch base carries the prefix:
curl -fsS http://svc/app/assets/index-*.js | grep -q '/app/api' \
  || { echo 'fetch base is root-relative — will 404 at ingress'; exit 1; }
# and/or drive a headless browser at the PREFIXED ingress URL and assert the API call 200s
# (network-tab assertion), not just that the page renders.
```

Generalize: an ingress path prefix is matched **before** strip; any URL the app emits that does
not carry the prefix never reaches the route. Asset prefix and fetch prefix are separate wirings —
test both, and test them through the prefix, not around it.

---

## Container healthchecks — address `127.0.0.1`, not `localhost` (busybox/alpine)

> Added: steam-savings-report-docker-2026-06-04 run (gate-4 mid-stream fix, R-4).

On `alpine`/busybox-based images (`node:20-alpine`, `nginx:1.27-alpine`), a healthcheck or
readiness probe that targets `localhost` can falsely report **unhealthy** even when the
service is up. busybox's resolver tries IPv6 (`::1`) first, but the server commonly binds
IPv4 (`0.0.0.0`/`127.0.0.1`) only — so the probe gets "connection refused" against `::1`
while the service is perfectly reachable on `127.0.0.1`. This silently blocks Compose
`depends_on: { condition: service_healthy }` gating, so dependent services never start.

A second false-unhealthy trap: probing an HTTP path that the server legitimately 404s
(e.g. Prism mock returns 404 at `/`). Use a **TCP** check for "is it listening", and an
HTTP check only against a path the server actually serves with 2xx.

```yaml
# WEAK — false "unhealthy" on busybox (IPv6-first) and on path-404:
healthcheck:
  test: ["CMD", "wget", "--spider", "http://localhost/"]      # ::1 refused; path 404s
# STRONG — explicit IPv4, TCP for liveness or a real served path for readiness:
healthcheck:
  test: ["CMD", "nc", "-z", "-w", "2", "127.0.0.1", "8080"]   # mock: is it listening?
  # or for nginx serving a real asset:
  # test: ["CMD", "wget", "-q", "-O", "-", "http://127.0.0.1:80/"]
```

**Rule:** in container healthchecks/readiness probes on alpine/busybox images, address
`127.0.0.1` explicitly (never `localhost`), and prefer a TCP check or a known-2xx path over
probing `/`.

---

## Compose `compose.yaml` lint — `yamllint quoted-strings` is a false positive

> Added: steam-savings-report-docker-2026-06-04 run (gate-7 release lint).

`yamllint`'s `quoted-strings` rule flags Docker Compose's conventionally/required-quoted
scalars — port mappings (`"8080:8080"`), healthcheck `test` array entries, and URL values —
as "redundantly quoted". The quoting is **semantically required by Compose**: unquoting a
healthcheck-array scalar breaks `docker compose config`, and port mappings are quoted to
avoid YAML sexagesimal (`MM:SS`) misparsing. Treat these as linter-vs-Compose-convention
mismatches, not release-surface defects. Validate the file with `docker compose config`
(the authoritative check) and add a `yamllint` rule exception for `compose.yaml`/
`docker-compose.yml` rather than unquoting.

---

## UX simulation — persona account isolation

When running multi-persona UX simulations (e.g., `/sdlc:simulate`), each persona
agent MUST use an isolated user account. If all personas share the same JWT / user ID:
- Cleanup by one agent deletes data created by concurrent agents.
- State assertions fail for reasons unrelated to application bugs (false positives).

For single-account demo apps: obtain a fresh shared token, give it to all agents,
and have each agent clean up only the specific record IDs it created (not "delete all").
Document concurrent-agent data pollution as a test isolation artifact, not an app bug.

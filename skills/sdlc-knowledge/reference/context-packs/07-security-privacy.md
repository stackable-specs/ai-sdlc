# Context Pack 07 — Security & Privacy

> Layer 2 (Organization). Reusable. Security must not depend on the human remembering
> to ask for it.

## Security defaults

- Never log secrets, tokens, credentials, or sensitive PII.
- Validate all external inputs.
- Enforce authorization server-side.
- Use least privilege.
- Do not expose internal errors to users.
- Do not introduce cryptography, authentication, or authorization logic without
  escalation.
- Classify data before storing, transmitting, or logging it.
- Encode output to prevent injection.

## Privacy obligations

- Handle PII per its data classification.
- Respect retention and consent requirements.
- Keep sensitive actions auditable.
- Collect the minimum data necessary.

## Threat-modeling triggers

Produce a threat model when the change touches authentication, authorization, payment,
sensitive data, the public attack surface, or a new external integration.

## Escalation

Security-sensitive changes follow `../autonomy/escalation-policy.md`. For each risk,
classify severity and recommend a mitigation.

---

## Learned patterns

### NestJS rate limiting with `@nestjs/throttler`

`ThrottlerModule.forRoot([...])` applies **all registered named throttlers to every
route globally** — there is no per-endpoint named throttler. The only correct pattern
for endpoint-specific limits is:

1. Register a single `default` throttler in `ThrottlerModule.forRoot` with a permissive
   default (e.g. 60 requests / 60 seconds).
2. Override the login (or any sensitive) endpoint with
   `@Throttle({ default: { limit: N, ttl: T_ms } })` — this overrides the `default`
   throttler for that route only.

**Anti-pattern:** registering a second named throttler (e.g. `login`) alongside
`default`. `@nestjs/throttler` v5+ applies both to every route; the stricter throttler
bleeds onto unrelated endpoints, causing unexpected 429s (e.g. CRUD routes).

### nginx `add_header` inheritance

Server-level `add_header` directives are **not inherited** by any `location {}` block
that defines its own `add_header`. To apply security headers (CSP, X-Frame-Options,
etc.) to all responses including proxied locations:

- Place all `add_header` directives at the `server {}` block level with the `always`
  flag.
- Do **not** add any `add_header` inside `location {}` blocks that proxy upstream
  traffic — nginx will silently stop applying server-level headers to those locations
  the moment a location-level header appears.

### React auth: lazy `useState` init for module-level token synchronization

When a React component must synchronize a module-level singleton (e.g., an API client's
`_token` field) with React state on mount, use the `useState` lazy initializer —
**not `useEffect`**. The lazy initializer fires synchronously before any child renders;
`useEffect` fires *after* children mount, so child `useEffect`s (e.g., `fetchTodos`)
can fire before the parent's `useEffect` sets the token. This creates an auth race
condition: the first API call has no Authorization header → 401 → forced logout.

```typescript
// Correct: lazy init fires synchronously before any child renders
const [token, setLocalToken] = useState<string | null>(() => {
  const t = sessionStorage.getItem('access_token');
  setToken(t); // updates module-level singleton before children mount
  return t;
});

// Anti-pattern: useEffect fires after children, causing a race condition
// useEffect(() => { setToken(sessionStorage.getItem('access_token')); }, []);
```

**Security implication:** the anti-pattern is exploitable as a denial-of-session —
any authenticated user who reloads the page is immediately logged out by a 401 from
their own app.

> Added: todo-ux-bugfixes run, 2026-05-26.

---

### `useLayoutEffect` for DOM focus after edit-mode transitions

When a component transitions from view-mode to edit-mode by setting state (e.g.,
`setEditing(true)`) and the edit input must be focused immediately, use
`useLayoutEffect` — **not `useEffect`** and not `setTimeout(fn, 0)`.
`useLayoutEffect` fires synchronously after DOM mutations but before the browser
paints. `useEffect` fires asynchronously and can miss the focus if the browser
dispatches a blur event from the triggering click before the effect runs.

```typescript
// Correct
useLayoutEffect(() => {
  if (editing && editRef.current) {
    editRef.current.focus();
    editRef.current.select();
  }
}, [editing]);
```

> Added: todo-ux-bugfixes run, 2026-05-26.

---

### Timing-safe auth: dummy bcrypt pattern

When a login path has a "user not found" fast-exit, an attacker can enumerate valid
email addresses via response timing. Mitigation:

1. On `OnModuleInit`, pre-compute `dummyHash = await bcrypt.hash('__DUMMY__', cost)`.
2. On the "user not found" path, run `await bcrypt.compare(password, dummyHash)` before
   throwing — this equalizes timing with the real-user path.
3. Use the same cost factor as production password hashing.
4. Store `dummyHash` as a private field (never returned, never compared against real
   credentials). Knowledge of the hash provides no advantage — it is a hash of a public
   constant.

---

### Kubernetes NetworkPolicy scope gap — new pod with different label

When adding a new Deployment to a namespace that already has `NetworkPolicy` resources,
**check whether the new pod's labels match any existing policy's `podSelector`**.

A pod with `app.kubernetes.io/name: nginx-example` is NOT covered by a NetworkPolicy
that selects `app.kubernetes.io/name: nginx`. Labels must match exactly. A new pod
with no matching NetworkPolicy has unrestricted inbound cluster traffic (any pod in
the cluster can reach it on any port).

**Gate 6 check:** For every new Deployment, grep the namespace's NetworkPolicies and
verify the new pod's labels match at least one `podSelector`. If not, add a policy or
explicitly accept the gap for local-only deployments.

```bash
# Check existing NetworkPolicies in the namespace
kubectl get networkpolicy -n <ns> -o yaml | grep -A5 "podSelector:"
# Compare against the new Deployment's labels
kubectl get deployment <name> -n <ns> -o jsonpath='{.spec.template.metadata.labels}'
```

> Added: nginx-ingress-example-2026-06-02, 2026-06-02.

---

### nginx serve-stage container hardening defaults (Dockerized SPA)

> Added: steam-savings-report-docker-2026-06-04 run (gate-6 F-4/F-5).

When authoring a multi-stage Dockerfile whose final stage serves static assets via nginx,
apply these defense-in-depth defaults at author time so the security gate does not have to
file them as findings every run:

- **Non-root user:** add `USER nginx` before `CMD` in the serve stage (CKV_DOCKER_3).
  `nginx:alpine` already ships an `nginx` user; the master otherwise starts as root.
- **Header/version hardening:** in `nginx.conf`, set `server_tokens off;` and baseline
  headers (`X-Frame-Options`, `X-Content-Type-Options`, CSP) at the `server {}` level with
  the `always` flag (see "nginx `add_header` inheritance" above).
- **Base-image currency (R-9 class):** pin specific tags (never bare `latest`), but expect
  a pinned tag to accrue fixable OS-package CVEs over time. A `grype`/Trivy scan of the
  image will report Critical/High base-layer CVEs that are *inherited, not introduced* —
  collapse them into one "base-image currency" finding with a tag-bump remediation owner
  rather than dozens of blocking rows, and add a periodic base-image refresh to the
  maintenance cadence. devDependency CVEs (vite/postcss/etc.) do **not** ship in a lean
  nginx+static final image and belong in the app's own dependency backlog, not the gate.

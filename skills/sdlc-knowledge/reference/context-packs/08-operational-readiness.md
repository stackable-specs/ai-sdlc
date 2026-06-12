# Context Pack 08 — Operational Readiness

> Layers 2–3 (Organization / Platform). Reusable across production systems.
> Production-quality software needs visibility.

## Operational defaults

- Emit structured logs for meaningful state transitions and failure paths.
- Include correlation IDs in service-to-service flows.
- Add metrics for success, failure, latency, retry, and queue depth where relevant.
- Alert only on user-impacting or SLO-threatening conditions.
- Update runbooks for new operational failure modes.

## Observability checklist for a change

- [ ] What should be logged (and what must NOT be — see `07-security-privacy.md`)
- [ ] What metrics should be emitted
- [ ] What alerts are needed, with thresholds, severity, and routing
- [ ] What failures operators need to diagnose
- [ ] What dashboard changes are needed
- [ ] What runbook updates are needed

## Operational readiness

- SLO / SLA impact assessed.
- Capacity impact assessed.
- On-call ownership clear.
- Incident severity model understood.

---

## Learned patterns

### NestJS `@nestjs/throttler` — in-memory store resets on pod restart

`ThrottlerModule.forRoot` defaults to an in-memory store. This means:
- Throttle state is **lost on pod restart** — useful for clearing test-induced exhaustion
  (`kubectl rollout restart deployment/<backend> -n <ns>`).
- In multi-replica deployments, each replica has an **independent throttle bucket** —
  a user can bypass a 5-req limit by hitting 5 different replicas.

For production multi-pod deployments, configure a Redis store:
```typescript
ThrottlerModule.forRootAsync({
  imports: [ConfigModule],
  useFactory: (cfg: ConfigService) => ({
    throttlers: [{ ttl: 900_000, limit: 5 }],
    storage: new ThrottlerStorageRedisService(cfg.get('REDIS_URL')),
  }),
  inject: [ConfigService],
})
```

Document single-pod in-memory throttle resets in the runbook — they are an operational
tool for clearing test-induced exhaustion, not a bug.

> Added: todo-ux-bugfixes run, 2026-05-26.

---

### `set -euo pipefail` + `curl -w "%{http_code}"` silent abort

Bash scripts that capture HTTP status codes via `curl -w "%{http_code}" ... url` must
append `|| true` to each curl invocation when `set -euo pipefail` is active. Without it:
- `curl` exits non-zero on any connection error
- `set -e` terminates the script immediately
- The status variable is never captured; the script prints its banner and silently stops

**Fix:**
```bash
status=$(curl -s -o /dev/null -w "%{http_code}" "$url") || true
# curl -w "%{http_code}" still writes "000" to stdout on connection failure;
# the || true just prevents set -e from aborting before capture
```

This applies to any curl that combines `-w "%{http_code}"` with `set -e` error handling.

> Added: ims-87-rabbitmq-ha-removal-2026-05-29, 2026-06-01.

---

### Go+CGO local Docker builds on Apple Silicon (arm64 host)

Go services using native CGO libraries (e.g. `confluent-kafka-go` with static librdkafka)
cannot be built for `linux/amd64` on an arm64 Docker host without explicit platform pinning.

Two problems:
1. `go mod vendor` copies Go source files but **not** pre-built `.a` static libraries.
   Copy them manually before building:
   ```bash
   GOMODCACHE=$(go env GOMODCACHE)
   mkdir -p vendor/<pkg>/librdkafka_vendor/
   cp "$GOMODCACHE/<pkg>@<ver>/kafka/librdkafka_vendor/librdkafka_glibc_linux.a" \
      vendor/<pkg>/librdkafka_vendor/
   cp "$GOMODCACHE/<pkg>@<ver>/kafka/librdkafka_vendor/rdkafka.h" \
      vendor/<pkg>/librdkafka_vendor/
   cp "$GOMODCACHE/<pkg>@<ver>/kafka/librdkafka_vendor/librdkafka.go" \
      vendor/<pkg>/librdkafka_vendor/
   ```

2. When `GOARCH=amd64` is set on an arm64 host without a cross-compiler, Go **silently
   disables CGO**, producing misleading `undefined: kafka.Producer` errors (not a linker
   error — the package is simply uncompiled).

**Fix:** Force `linux/amd64` in the Dockerfile for local builds:
```dockerfile
FROM --platform=linux/amd64 golang:1.21-bullseye AS builder
```
And pass `--platform linux/amd64` to `docker build` or set `platform: linux/amd64` in
`docker-compose.local.yml`.

> Added: ims-87-rabbitmq-ha-removal-2026-05-29, 2026-06-01.

---

### `runAsNonRoot: true` needs a NUMERIC UID — `USER app` fails kubelet verification

> Added: steamtrap-ui-shared-apps-deploy-2026-06-04 run (dev rollout fix).

When a pod/container sets `securityContext.runAsNonRoot: true`, the kubelet verifies the
container is non-root **before** starting it. That check can only read a **numeric** UID. If the
image declares its user by **name** (`USER app` in the Dockerfile) and the manifest does not pin
`runAsUser`, the kubelet cannot resolve the name to a UID at admission time, fails the non-root
check, and the pod gets stuck in **`CreateContainerConfigError`** — never starting, no app logs
to diagnose from.

In this run the backend image used `USER app` (non-numeric); `runAsNonRoot: true` was set but
`runAsUser` was not. Rollout failed with `CreateContainerConfigError`. Fix: pin a numeric
`runAsUser` in the container `securityContext` (`runAsUser: 100`, matching the image's `app`
UID) and re-apply — pod went 2/2 Ready.

```yaml
# BROKEN — image declares `USER app` (a name); kubelet can't verify non-root → CreateContainerConfigError:
securityContext:
  runAsNonRoot: true
# WORKING — pin the numeric UID the image user maps to:
securityContext:
  runAsNonRoot: true
  runAsUser: 100        # numeric UID of the image's `app` user
```

**Rule:** any container destined for a `runAsNonRoot` pod must either (a) declare its user with a
**numeric** UID in the Dockerfile (`USER 100`), or (b) have the manifest pin a numeric `runAsUser`.
A named `USER` alone is not sufficient. Verify the image's resolved UID (`docker inspect` / `id`
in the image) and pin it explicitly rather than relying on the name resolving at runtime.

> Added: steamtrap-ui-shared-apps-deploy-2026-06-04 run.

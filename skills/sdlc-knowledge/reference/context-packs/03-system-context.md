# Context Pack 03 — System Context

> Layer 4 (System). Reusable within one repo / service / product.
> **This pack is a template. Fill it in for your system.**

## System purpose
_What this system does and why it exists._

## Architecture overview
_Key components, service boundaries, deployment topology._

## Data stores
_Databases, caches, queues, object stores — and what each holds._

## APIs & integration points
_Public APIs, internal APIs, events consumed/produced, third-party integrations._

## Authentication & authorization model
_How identity and permissions work._

## Known constraints & invariants
_e.g. events must be idempotent; ordering not guaranteed; PII must not be logged;
schema changes need backward compatibility for N release cycles._

## Known technical debt
_Shortcuts and fragile areas the agent should be aware of._

## Ownership
_Owning team, on-call, escalation contacts._

---

## Learned patterns

### brokermanager — CGO build constraint for local Docker builds

`brokermanager` depends on `confluent-kafka-go` which requires CGO (wraps librdkafka).
`CGO_ENABLED=0` cross-compilation fails. The production `Dockerfile` builds inside a
`golang:1.21-bullseye` container using a `CI_JOB_TOKEN` in `~/.netrc` for private GitLab
modules.

**For local Docker Desktop builds** (without CI_JOB_TOKEN):
1. Use `docker run` with the module download cache mounted as a file GOPROXY:
```bash
docker run --rm --platform linux/amd64 \
  -v "$(pwd):/src" \
  -v "$HOME/go/pkg/mod/cache/download:/go/pkg/mod/cache/download" \
  -e GOPROXY="file:///go/pkg/mod/cache/download,off" \
  -e GONOSUMDB="*" -e GOFLAGS="-mod=mod" \
  -w /src golang:1.21-bullseye \
  bash -c "apt-get update -qq && apt-get install -y -qq build-essential && \
    go build -o out/brokermanager-linux ./cmd/brokermanager/main.go"
```
2. Then build the runtime image from a separate `Dockerfile.local` that copies the pre-built binary into `debian:bullseye-slim`.

**Local-lab run config:** Use `VAULT_KV_ENABLED=false`, `RABBITMQ_INTERNAL_CONN=private`,
and connect to `local-lab-rabbitmq` on the `cloudlab_local-dev` Docker network.

> Added: ims-87-remove-ha-policy-2026-06-01, 2026-06-01.

### brokermanager — integration test config initialization

Integration tests that use `services/rabbitmq.NewRabbitMQClient` directly must initialize
`config.PKConfig` before calling it, as `NewRabbitMQClient` calls
`config.PKConfig.GetString(config.SYSTEM_LOG_LEVEL)`. Use this pattern in `TestMain`:

```go
func TestMain(m *testing.M) {
    config.InitConfig(false) // CLI mode: empty viper, no Vault KV
    os.Exit(m.Run())
}
```

Gate this with `//go:build integration` to avoid conflicts with the unit test suite
(which uses mocks and doesn't need `config.InitConfig`).

> Added: ims-87-remove-ha-policy-2026-06-01, 2026-06-01.

---

### Traefik kubernetesIngress provider — patterns and invariants

Validated on Traefik v3.7.1 (chart 40.2.0) with Docker Desktop k8s v1.32.2.

**Provider coexistence:** `kubernetesCRD` and `kubernetesIngress` providers are additive
and independently scoped in Traefik v3. Enabling `kubernetesIngress: true` has zero impact
on existing IngressRoute/Middleware CRD-based routes. CRD routes retain higher priority
when paths overlap.

**IngressClass auto-creation:** When `kubernetesIngress: enabled: true` is set in the
Traefik Helm chart values, IngressClass `traefik` (controller: `traefik.io/ingress-controller`)
is created automatically. Use `spec.ingressClassName: traefik` on Ingress resources —
do NOT use the deprecated `kubernetes.io/ingress.class` annotation on k8s 1.18+.

**`@kubernetescrd` cross-provider reference:** Standard Ingress annotations can reference
Middleware CRDs via the `@kubernetescrd` provider suffix. Format: `<namespace>-<name>@kubernetescrd`.
Example: `oauth2-proxy-demo-forward-auth@kubernetescrd` references `Middleware/forward-auth` in
the `oauth2-proxy-demo` namespace. This is the mechanism that lets annotation-based routes
use shared CRD-defined middlewares (e.g., shared ForwardAuth) without redefining them.

**ForwardAuth ordering invariant (Ingress annotations):** The `traefik.ingress.kubernetes.io/router.middlewares`
annotation applies middlewares **left-to-right** in the comma-separated value. ForwardAuth
MUST be listed first so it sees the full request path (not the stripped path) when constructing
the `rd=` redirect parameter. Annotation format:
```
traefik.ingress.kubernetes.io/router.middlewares: "<ns>-forward-auth@kubernetescrd,<ns>-strip-prefix-<app>@kubernetescrd"
```

**`kubectl apply` alphabetical ordering race:** `kubectl apply -f <dir>/` applies resources
in filename alphabetical order. If `ingress.yaml` precedes `service.yaml` alphabetically
(`i` < `s`), Traefik's kubernetesIngress provider logs a transient `ERR Cannot create service
"service not found"` for 1–10s until the Service is created and reconciled. The route becomes
active once the Service exists — no manual intervention needed. To avoid the noise, apply
Service before Ingress explicitly:
```bash
kubectl apply -f service.yaml -f middleware.yaml -f ingress.yaml -f configmap.yaml -f deployment.yaml
```
Or use Kustomize with explicit resource ordering.

> Added: nginx-ingress-example-2026-06-02, 2026-06-02.

---

### Example (billing service)

> Handles customer billing events: receives events from the commerce platform,
> normalizes them, persists billing state, publishes downstream notifications.
>
> Constraints: billing events must be idempotent; event ordering is not guaranteed;
> duplicate events are expected; customer PII must not be logged; external calls
> require retry with bounded backoff; schema changes require backward compatibility
> for at least two release cycles.

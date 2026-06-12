# Context Pack 04 — Domain Rules

> Layer 5 (Domain). Reusable across many features in the same business domain.
> **This pack is a template. Fill it in for your domain.**

## Domain vocabulary
_Define the terms. The agent should not rediscover these from the human each time._

## Business invariants
_Rules that must always hold._

## Valid & invalid states
_The legal states of core entities and the allowed transitions._

## Decision rules & domain workflows
_The business logic that governs how the domain behaves._

## Regulatory & compliance constraints
_Jurisdictional rules, audit obligations, mandated controls._

## Data classification
_What data is sensitive and how it must be handled._

## Known domain edge cases
_Unusual cases the agent should always account for._

---

## Learned patterns

### CloudAMQP HA policy management — runtime-applied, not Terraform-tracked

In the IMS CloudAMQP environment, RabbitMQ vhost HA policies (`ha-all`) are applied at
**runtime** by brokermanager's `CreateHAPolicy` call during tenant provisioning. They
are NOT declared in `evercloud-rabbitmq` Terraform. The Terraform `cloudamqp_*`
resources manage the cluster node count, vhost quotas, and connection URLs — not
per-vhost policies.

**Invariant:** Before any "Infrastructure / deploy" change involving CloudAMQP policy
state, scan the management API directly:
```bash
curl -s -u "$ADMIN_USER:$ADMIN_PASSWORD" \
  "$CLOUDAMQP_MANAGEMENT_URL/api/policies" | jq '.'
```
Do not assume Terraform state reflects policy reality. A `terraform plan` will show
no changes even when 100+ runtime-applied HA policies exist.

**As of IMS-87 (`ims-87-remove-ha-policy-2026-06-01`, commit `feccc2c`):**
`CreateHAPolicy` is removed from the `RabbitMQAPI` interface, implementation, and all
mocks. New vhosts are created as **classic queues with no HA policy and no
`default_queue_type` property**. This is the intentional end state — quorum queues were
ruled out because MQTT connection queues scale to hundreds of gateways, making quorum
queue overhead unsuitable at that cardinality.

Existing vhosts retain their `ha-all` policies until a separate Phase 2 migration is
run. That migration is out of scope for IMS-87 and is tracked as a follow-up.

> Note: MR !141 (now closed) incorrectly used `SetDefaultQueueType("quorum")` — that
> approach was wrong. Do not add any quorum queue or `default_queue_type` setting to
> brokermanager vhost provisioning.

> Updated: ims-87-remove-ha-policy-2026-06-01, 2026-06-01.

---

### Example (payments domain)

> - A payment may be authorized, captured, voided, refunded, partially refunded,
>   disputed, or failed.
> - A refund cannot exceed the captured amount.
> - A void is only valid before capture settlement.
> - Payment failure reasons must be preserved for audit.
> - Do not expose raw processor errors directly to end users.
> - Payment events must be idempotent.
> - Payment state transitions must be auditable.

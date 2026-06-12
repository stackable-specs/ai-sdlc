# Context Pack 09 — Release Governance

> Layers 2–3 (Organization / Platform). Reusable across delivery workflows. Shipping
> is part of quality — "works locally" is not "ships safely".

## Release defaults

- Prefer feature flags for user-facing behavior changes.
- Maintain backward compatibility across deployments.
- Separate schema expansion from schema contraction.
- Define rollback before deployment.
- Validate production behavior after release.
- Monitor errors, latency, and adoption after rollout.

## Rollout

Phase exposure by environment → tenant → user segment → percentage → geography. Define
abort thresholds before starting.

## Feature flags

Every flag needs: defined on/off behavior, a ramp plan, an owner, and a cleanup plan.
For risky changes, split "set" and "enforce" behind separate flags for safer phasing.

## Rollback

- Disabling a flag is the fastest rollback — prefer it.
- Do not drop database columns or tables as an emergency rollback.
- Document the rollback path in the Release & Rollback Plan before deploying.

## Approval

Production deployment always requires explicit human approval — see
`../autonomy/escalation-policy.md`.

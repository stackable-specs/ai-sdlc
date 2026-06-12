# Risk & Escalation Policy

> Layer 2 (Organization). Reusable. Lets the human give less input while keeping
> control: the agent proceeds autonomously *only while the work stays inside the
> approved operating conditions.*

## Mandatory escalation triggers

Stop and request human approval before proceeding if the change involves:

- Authentication or authorization logic
- Payment logic
- PII or other sensitive data
- Database schema or data migrations
- Public API breaking changes
- New third-party dependencies
- Production deployment
- Failed tests with an unclear cause
- Security scan failures
- Ambiguous requirements
- More than ~20% uncertainty in intended behavior
- Any change exceeding the approved scope or autonomy level

## Escalation decision tree

```
Touches auth / authz? .................. yes → ESCALATE
Touches sensitive data / PII? .......... yes → ESCALATE
Requires a database migration? ......... yes → ESCALATE
Changes public API behavior? ........... yes → ESCALATE
New third-party dependency? ............ yes → ESCALATE
Validation failed, cause unclear? ...... yes → ESCALATE
Exceeds approved scope / authority? .... yes → ESCALATE
Otherwise ............................. continue within authority
```

## When escalating

Produce an **Escalation Report** (`../templates/escalation-report.md`): the trigger,
work completed so far, the specific decision(s) requested, a recommended option, and
the boundaries respected. Then stop. Human approval moves the agent to the *next
authorized phase only* — it is not blanket permission to proceed unsupervised.

## Allowed autonomous actions (within authority)

Interpreting tickets, inspecting code, proposing options, implementing in-scope
changes, generating and running tests, updating documentation, preparing PRs,
summarizing risk and validation results.

## Blocked actions (always require approval, regardless of level)

Production deployment, secrets/credentials handling, dropping database columns or
tables, disabling security controls, modifying audit logs.

## Audit requirements

Every escalation, approval, override, and autonomous completion should be recorded
(decision record + evidence trail) so higher autonomy remains auditable. Higher
autonomy requires *stronger* evidence, not less.

## Resolution tracking at autonomy level 5

> Added: migrate-local-lab-to-docker-desktop-k8s-impl-2026-06-04 run (gate-9 cycle).

At level 5, agents proceed without human confirmation between gates. This means `resolutions.md` is often never created — the agent makes all decisions autonomously and moves on. Gate 9 (Learning) then has no divergence signal: it cannot tell whether defaults were well-calibrated or the agent made non-default choices silently.

**Rule:** at autonomy level 5, gate agents MUST still record key decisions that deviated from a stated default — particularly:
- Open questions resolved during implementation (e.g. "OQ-02 resolved: PVC data survived restart → OQ closed as mitigated")
- Any choice where the recommended option was NOT taken (with reason)
- Reproduction-gated items resolved or confirmed unresolved at deploy time

These may be short inline notes in the gate artifact (e.g., a "Decision log" section in the implementation plan or release plan), not necessarily a separate `resolutions.md`. The gate 9 PIR author can then compute a divergence ratio even without a formal resolutions file.

**Minimum bar for gate 9 divergence assessment:** if no resolutions.md exists, the PIR must state explicitly "divergence indeterminate — no decision log produced" rather than reporting 0/0 as if all defaults held.

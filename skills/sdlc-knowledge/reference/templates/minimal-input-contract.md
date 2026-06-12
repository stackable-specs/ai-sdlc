# Minimal Human Input Contract

> The complete human payload for a change, assuming the reusable context packs are
> loaded. Copy this file, fill the five sections, hand it to the agent.

## Intent
_One sentence: what outcome do we want?_

## Context delta
_Only what is new, unusual, or risky about this request. Skip anything already covered
by the context packs._

## Priority
_The main tradeoff to optimize for (e.g. safe rollout, auditability, speed, UX,
performance, cost)._

## Authority
_Allowed autonomy level (see `../autonomy/levels.md`) and explicit escalation triggers._

## Acceptance
_Gherkin scenarios — the behavioral acceptance layer._

```gherkin
Feature: <name>

  Scenario: <happy path>
    Given <precondition>
    When <action>
    Then <expected outcome>

  Scenario: <negative / boundary path>
    Given <precondition>
    When <action>
    Then <expected outcome>
```

---

## Example

**Intent:** Allow merchant admins to issue partial refunds with a required internal
reason code.

**Context delta:** Reason codes are for internal reporting and fraud review only; they
must not be shown to end customers.

**Priority:** Optimize for safe rollout, auditability, and backward compatibility.

**Authority:** Level 3. Proceed through requirements, design, implementation plan, and
test strategy. Escalate before database migration, public API changes, payment
processor integration changes, or production deployment.

**Acceptance:**
```gherkin
Feature: Partial refund reason codes

  Scenario: Merchant admin issues a partial refund with a reason code
    Given a captured payment exists
    And the merchant admin has permission to issue refunds
    When the merchant admin issues a partial refund
    And selects the reason code "Customer request"
    Then the refund should be created
    And the reason code should be stored with the refund
    And the reason code should not be visible to the customer

  Scenario: Merchant admin attempts a partial refund without a reason code
    Given a captured payment exists
    When the merchant admin attempts a partial refund without selecting a reason code
    Then the refund should not be created
    And the merchant admin should see a validation error
```

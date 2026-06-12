# AI-SDLC Quality Gates

Quality gates should not only exist as documents — each is a checkpoint the change must
pass before the next phase. Each gate defines a required artifact, required evidence, a
human-approval condition, and an escalation trigger.

> In a runtime setting these gates become executable controls (see ctrl-loop in
> `../SPEC.md`). Here they are the review checklists.

```
Requirements → Design → Risk → Implementation → Test → Security
   → Release → Production Validation → Learning
```

> Not every change runs all nine. The **change class** selects a proportionate gate
> profile — see `../agent/change-classes.md`. The nine below are the full default.

## 1. Requirements Gate
**Artifact:** Requirements Brief. **Question:** Are expectations explicit?

- [ ] Objective restated in precise terms
- [ ] Scope and out-of-scope defined
- [ ] Functional + non-functional requirements captured
- [ ] Acceptance criteria normalized and testable
- [ ] Assumptions and open questions surfaced
- [ ] Edge cases and dependencies identified

**Escalation:** requirements ambiguous or intent uncertain.

## 2. Design Gate
**Artifact:** Design Note. **Question:** Is the solution technically sound?

- [ ] Current state and gap analyzed
- [ ] Options generated with a tradeoff analysis
- [ ] Recommended design within authority
- [ ] Architecture, API, data model, state, error handling defined
- [ ] Backward compatibility considered

**Escalation:** public API or data-model change required.

## 3. Risk Gate
**Artifact:** Risk Register. **Question:** Is it safe to proceed?

- [ ] Risks classified by impact, blast radius, complexity, uncertainty
- [ ] Mitigations defined
- [ ] Escalation check completed (`../autonomy/escalation-policy.md`)

**Escalation:** any risk exceeds the approved autonomy level.

## 4. Implementation Gate
**Artifact:** Implementation Plan. **Question:** Is the work reviewable and sequenced?

- [ ] Work broken into small, sequenced, reviewable steps
- [ ] Each step maps to requirements and tests
- [ ] No unrelated refactors
- [ ] Pre-implementation review passed; approval obtained if required

**Escalation:** plan requires a blocked or out-of-scope action.

## 5. Test Gate
**Artifact:** Test Plan + Validation Report. **Question:** Can we prove it works?

- [ ] Unit, integration, contract, E2E, regression coverage as relevant
- [ ] Negative and abuse cases covered
- [ ] Tests trace to acceptance criteria and risks
- [ ] All checks pass; failures analyzed and remediated

**Escalation:** tests fail with an unclear cause.

## 6. Security & Privacy Gate
**Artifact:** Security review section of the Design Note. **Question:** Is it safe?

- [ ] Authn/authz, input validation, injection, data exposure reviewed
- [ ] Secrets handled correctly; no sensitive data logged
- [ ] Abuse cases considered; least privilege enforced
- [ ] Privacy: PII, retention, consent, auditability addressed

**Escalation:** security-sensitive behavior, or medium/high risk.

## 7. Release Gate
**Artifact:** Release & Rollback Plan. **Question:** Can we ship safely?

- [ ] Rollout strategy, feature flags, migration sequencing defined
- [ ] Rollback plan defined *before* deployment
- [ ] Pre-deployment checks listed
- [ ] Observability in place to monitor the rollout

**Escalation:** production deployment — always requires explicit approval.

## 8. Production Validation Gate
**Artifact:** Validation Report (post-deploy). **Question:** Did it work in production?

- [ ] Post-deployment smoke tests passed
- [ ] Behavior validated against acceptance criteria
- [ ] Metrics, logs, alerts healthy; no regression beyond expected

**Escalation:** release-related defect, regression, or user impact detected.

## 9. Learning Gate
**Artifact:** Post-Implementation Review. **Question:** Has the system improved?

- [ ] Outcome measured against success metrics
- [ ] Defects and technical debt logged
- [ ] Context packs, escalation rules, risk policy, and gates updated
- [ ] Follow-up backlog created

**Escalation:** none — this gate closes the learning loop.

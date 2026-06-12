---
name: sdlc:6-security
description: Run the AI-SDLC Security & Privacy gate — review the change for authn/authz, injection, data exposure, secrets, abuse cases, and privacy. Trigger when the user asks for a security review, threat model, privacy review, or to check a change is safe.
when_to_use: Use as quality gate 6 of the AI-SDLC lifecycle, after Test and before Release. Produces the Security & Privacy Review and, for auth/security changes, a threat model. Do not use as a substitute for the Test gate's functional validation.
argument-hint: "[run-slug]"
disable-model-invocation: false
user-invocable: true
allowed-tools:
  - Read
  - Write
  - Edit
  - Grep
  - Glob
  - Bash
  - Agent
  - Skill
---

# AI-SDLC Gate 6 — Security & Privacy

**Artifact:** Security & Privacy Review → `06-security-review.md`
**Gate question:** Is it safe?

## Inputs

The run slug in `$ARGUMENTS`, else the most recent in-progress run. Read `contract.md`,
`state.md`, and artifacts `01`–`05`. Load the security/privacy context pack by calling `/sdlc-knowledge context-packs/07`.

## Workflow

1. **Review security**, classifying each finding by severity:
   - Authentication & authorization — correct, least-privilege, no gaps.
   - Input validation & injection — SQL/command/template/path, untrusted input.
   - Data exposure — over-broad responses, error leakage, insecure direct refs.
   - Secrets — no secrets in code, logs, or config; correct secret handling.
   - Unsafe logging — no PII or credentials written to logs.
   - Abuse cases — how the feature could be misused; rate limiting.
2. **Review privacy** — PII handled, data retention, consent, auditability,
   regulatory obligations.
3. For a **security / auth-class change**, also produce a **threat model** — assets,
   attack surface, threats, controls, residual risk.
4. Optionally invoke the built-in `/security-review` skill for a diff-level scan and
   fold its findings in.
5. **Run `/sdlc:secops`** for a full multi-tool DevSecOps assessment (SAST, SCA,
   secrets, IaC, containers, SBOM, supply chain, Kubernetes) against the project
   directory. Invoke it with `--output .sdlc/runs/<slug>/06-secops-report.md` so the
   report lands inside the run directory next to the other gate artifacts (not at the
   target's root). Pass `--diff` on re-runs so the report includes a "Changes Since
   Last Scan" section against the previous gate run. Fold its consolidated findings
   into the review, deduplicating against steps 1–4. Treat high/critical tool findings
   as gate-blocking unless explicitly waived with rationale.
6. For each finding: severity + recommended mitigation. Apply in-scope fixes; escalate
   anything that changes auth behavior or is medium/high severity.
7. **Reassess risk** — raise Impact/Likelihood for any unmitigated finding. Update
   `state.md`'s Latest risk score.
8. Write `06-security-review.md` (sections: findings table — #, Area, Finding, Severity, Mitigation, Status; privacy review; threat model for auth/security changes; residual security risk — linking the sibling `06-secops-report.md`). Update the `state.md` ledger row and emit the result.

Escalate (`/sdlc:escalate`) on any security-sensitive behavior change, auth/authz change, or medium/high-severity finding.

## Output Format — append this block

```
### sdlc-result
gate: 6-security
status: passed | escalate
risk-score: <2-10>
impact: <1-5>  likelihood: <1-5>
findings: <n high>/<n med>/<n low>
hard-stop-triggers: [<none | auth-change | security-sensitive>]
artifact: .sdlc/runs/<slug>/06-security-review.md
note: <one line>
```

After appending the result block, **identify the next required pending gate** in `state.md` and tell the human the exact skill to run (e.g. `/sdlc-7-release`). If the effective autonomy level allows autonomous execution, proceed immediately; otherwise prompt the human to run it.

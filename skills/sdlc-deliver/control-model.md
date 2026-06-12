# AI-SDLC Control Model

Canonical reference for the two human control knobs — **autonomy level** and **risk
tolerance** — and how the skill suite pauses the loop for human feedback. Every
`sdlc:*` skill obeys this model.

## The two knobs

The human sets these once per change (passed to `/sdlc:deliver`, or asked at intake):

- **Autonomy level (1–5)** — how independently the agent may proceed. Run `/sdlc-knowledge autonomy/levels.md` for the full definition. Default `2`.
- **Risk tolerance (2–10)** — the risk score at or above which the loop **pauses** for
  human feedback. Lower = more cautious. Default derived from the level.

## Risk score

Every gate computes a **risk score = Impact + Likelihood**, each rated 1–5, total 2–10.

### Impact — how bad if this change goes wrong

| Score | Meaning |
|-------|---------|
| 1 | Cosmetic; no user-visible effect |
| 2 | Minor; easily and fully reversible |
| 3 | Moderate; degrades one feature for some users |
| 4 | Major; data, security, or revenue exposure for some users |
| 5 | Severe; outage, data loss, breach, or financial loss at scale |

### Likelihood — how likely something goes wrong

| Score | Meaning |
|-------|---------|
| 1 | Well-understood change, fully covered by tests |
| 2 | Familiar area, good coverage |
| 3 | Some unknowns or partial coverage |
| 4 | Unfamiliar code, weak coverage, or ambiguity |
| 5 | Poorly understood, untested, or ambiguous requirements |

The **Risk gate (`/sdlc:3-risk`)** sets the authoritative score. Every later gate
re-assesses and may raise it; the orchestrator always uses the latest score in
`state.md`.

## Mandatory hard-stop triggers

These **pause the loop regardless of score or autonomy level** (run `/sdlc-knowledge autonomy/escalation-policy.md` for the full policy):

- Authentication / authorization logic
- Payment logic
- PII or other sensitive data
- Database schema or data migration
- Public API breaking change
- New third-party dependency
- Production deployment
- Failed tests with an unclear cause
- Security scan failure
- Ambiguous requirements / more than ~20% uncertainty about intended behavior
- Any change exceeding the approved scope or autonomy level

## Blocked actions — always require explicit human approval

Regardless of level: production deployment, secrets/credentials handling, dropping
database columns or tables, disabling security controls, modifying audit logs.

## Pause evaluation — run after every gate

1. Did any mandatory hard-stop trigger fire? → **PAUSE** → `/sdlc:escalate`.
2. Is the latest risk score ≥ risk tolerance? → **PAUSE** → `/sdlc:escalate`.
3. Does the autonomy level require approval at this gate (table below)? → **PAUSE** for approval.
4. Otherwise → continue to the next gate.

## Autonomy → approval points

| Level | The loop pauses for human approval … |
|-------|--------------------------------------|
| 1 | After **every** gate — each artifact is reviewed before the next |
| 2 | After Requirements; after Risk; after Implementation; before Release |
| 3 | Only on a hard-stop trigger or risk ≥ tolerance |
| 4 | Only on a hard-stop trigger or blocked action; trivial / test-only changes fast-path with no pause |
| 5 | Only on a blocked action |

**Default risk tolerance by level:** L1 → 3, L2 → 4, L3 → 6, L4 → 8, L5 → 9.

## Resuming after a pause

A pause writes an Escalation Report under `escalations/` and sets the run status to
`paused`. The human responds, then re-invokes `/sdlc:deliver resume <slug>`. Human
approval advances the loop to the **next authorized gate only** — it is not blanket
permission to run unsupervised.

## Mid-run autonomy elevation

A user may elevate autonomy for a *range of remaining gates* mid-run by stating it
explicitly (e.g. "proceed with sdlc-4 to sdlc-9 with full autonomy",
"L5 for the rest", or passing `level=5` to a later gate skill). When that happens:

1. The first gate skill at the elevated level MUST stamp a line in `state.md` under
   a `## Autonomy log` section (create it if absent):

   ```
   - <date> · L<old> → L<new> for gates <N>..<M> · granted by user
   ```

2. Pre-authorized triggers from already-closed escalations carry over — the
   elevation does NOT require re-escalating them. New triggers fired *after* the
   elevation still pause the loop per the autonomy → approval table above
   (e.g. a new schema migration introduced in Implementation that was not pre-cleared
   at Gate 3).

3. The elevation never bypasses the **mandatory hard-stop triggers** list or the
   **blocked actions** list (production deploy, secrets, dropping DB objects,
   disabling security controls, modifying audit logs). Those always require explicit
   human approval regardless of level.

4. Elevation only moves *forward*. A user can later lower the level back, but the
   agent must not silently re-raise without a fresh user statement.

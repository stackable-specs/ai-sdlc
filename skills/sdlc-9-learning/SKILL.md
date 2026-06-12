---
name: sdlc:9-learning
description: Run the AI-SDLC Learning gate — measure the outcome and fold lessons back into the framework so the next change needs less human input. Trigger when the user asks for a post-implementation review, a retro on a delivered change, or to close the learning loop.
when_to_use: Use as quality gate 9, the final gate of the AI-SDLC lifecycle, after Production Validation. Produces the Post-Implementation Review and updates the reusable context packs, escalation policy, and risk policy. Do not use mid-delivery — it closes the loop.
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
---

# AI-SDLC Gate 9 — Learning

**Artifact:** Post-Implementation Review → `09-post-implementation-review.md`
**Gate question:** Has the system improved?

This gate closes the learning loop — its whole purpose is to make the **next** change
need less human input and fewer escalations.

## Inputs

The run slug in `$ARGUMENTS`, else the most recent run awaiting this gate. Read
`contract.md`, `state.md`, and all numbered artifacts `01`–`08`.

## Workflow

1. **Measure the outcome** against the success metrics in the Requirements Brief —
   observed results vs. intended.
2. **Capture decision divergence** from `resolutions.md`. Count the resolutions
   whose `Source` was `evidence-overrides-default` or a user answer that wasn't
   the recommended option, and report the ratio (`<diverged> / <total>`). High
   divergence is a signal that the upstream artifacts' stated defaults are
   miscalibrated — fold that signal into the framework updates step 4.
3. Capture **what went well** and **what did not**.
4. Log **defects discovered** (severity, root cause, owner, resolution) and **technical
   debt** taken on (shortcuts, deferred cleanup, test/doc gaps).
5. **Fold lessons back into the framework** — the core of this gate. Concretely update:
   - call `/sdlc-knowledge context-packs` to locate context pack files — update with new patterns, constraints, domain rules, edge cases.
   - call `/sdlc-knowledge autonomy/escalation-policy.md` to locate the escalation policy — update with new triggers learned from a near-miss.
   - call `/sdlc-knowledge quality-gates` to locate gate specs — update gates that should be tighter or lighter.
   - call `/sdlc-knowledge agent/change-classes.md` to locate the change-class taxonomy — update a class boundary that proved wrong.
   - **default calibration** — if step 2's divergence ratio is high (>~30%),
     propose specific changes to the stated defaults in the upstream gate skills.
   Make the edits, or list them precisely if the framework files are read-only here.
6. Create the **follow-up backlog**.
7. Write `09-post-implementation-review.md` (sections: outcome vs. success metrics; decision divergence — `<diverged>/<total>` resolutions with per-question annotations; what went well; what did not go well; defects discovered table; technical debt captured; learning-loop updates — specific framework edits made; follow-up backlog). Set `state.md` run status to `complete`, update gate-9 ledger row, and emit the result.

## Output Format — append this block

```
### sdlc-result
gate: 9-learning
status: passed
risk-score: <final 2-10>
divergence: <diverged>/<total>   # from resolutions.md
framework-updates: [<files changed or proposed>]
followups: <count>
artifact: .sdlc/runs/<slug>/09-post-implementation-review.md
note: <one line>
```

After appending the result block, **mark the run complete** in `state.md` (set `Status: complete`). There is no next gate — the SDLC run is finished. Summarize any follow-up items or framework-update proposals for the human.

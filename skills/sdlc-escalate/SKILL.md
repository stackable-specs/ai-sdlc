---
name: sdlc:escalate
description: Pause an AI-SDLC run and produce an Escalation Report when a hard-stop trigger fires, risk meets the tolerance threshold, or a decision exceeds the agent's authority. Trigger when a gate hits an escalation condition or the user asks to escalate, pause the loop, or request human approval.
when_to_use: Use whenever an AI-SDLC gate or the orchestrator must stop for human judgment — a mandatory trigger, risk score at or above tolerance, a blocked action, or work beyond approved scope. Produces the Escalation Report and pauses the run. Do not use to skip a gate.
argument-hint: "[run-slug] [trigger]"
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

# AI-SDLC — Escalate

Pause the run, hand a clear decision to the human, and wait. Human approval advances
the loop to the **next authorized gate only** — never blanket permission.

## Inputs

The run slug and (optionally) the trigger name in `$ARGUMENTS`, else the current
in-progress run under `.sdlc/runs/`. Read `contract.md` and `state.md`.

## When this fires

- a **mandatory hard-stop trigger** (auth, payments, PII, schema migration, public API
  break, new dependency, production deploy, failed tests with unclear cause, security
  scan failure, ambiguous requirements, work beyond scope);
- the latest **risk score ≥ the run's risk tolerance**;
- a **blocked action** (production deploy, secrets handling, dropping DB objects,
  disabling security controls, modifying audit logs).

## Workflow

1. Identify the trigger and the gate where it fired.
2. Summarize the work completed so far — artifacts produced, decisions made.
3. State the **specific decision(s)** the human must make — phrased as concrete,
   answerable questions.
4. Give a **recommended option** with rationale.
5. State the **boundaries respected** — what the agent did NOT do.
6. Write the report to `.sdlc/runs/<slug>/escalations/NN-<trigger>.md` (NN is the next sequence number) with sections: metadata table (Change, Autonomy level, Stage reached); Reason for escalation; What the agent has completed; Decision(s) requested; Recommended option; Boundaries respected.
7. Update `state.md`: set run status to `paused`, mark the current gate `escalated`, and append a line to the Escalation log (date, gate, trigger, report path).
8. **Stop.** Present the decision to the human. Do not proceed.

## Resuming

After the human decides, the run continues with `/sdlc:deliver resume <slug>`. Record
the human's decision as a Decision Record (run `/sdlc-knowledge templates/decision-record.md` for the template) when it sets
a constraint future changes must honor.

## Output Format

1. The trigger and the gate it fired at.
2. The escalation report path.
3. The exact decision(s) the human must make, and the recommended option.
4. The resume command: `/sdlc:deliver resume <slug>`.

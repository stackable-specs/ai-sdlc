---
name: sdlc:knowledge
description: Look up AI-SDLC framework knowledge by topic — operating manual, change classes, quality gates, autonomy levels, escalation policy, context packs, and templates. Trigger when a gate skill, the orchestrator, or the user needs the canonical reference for an SDLC concept, template, or policy without searching the repo manually.
when_to_use: Use as a read-only index of the AI-SDLC knowledge layer. Other SDLC skills call this to resolve "where is X documented?" — e.g. the risk formula, the escalation policy, a template, a context pack. Do not use to author run artifacts (use the gate skills) or to author new knowledge (edit the source files directly under reference/).
argument-hint: "[topic | list | path-to-doc]"
arguments:
  - topic
disable-model-invocation: false
user-invocable: true
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash(ls *)
  - Bash(find *)
---

# AI-SDLC Knowledge Index

**Role:** read-only reference layer. Resolves a topic or query to the canonical knowledge file under `reference/` and (optionally) reads it. Does not write or modify anything.

All knowledge files live in `reference/`, co-located with this skill at `.claude/skills/sdlc-knowledge/reference/`. The paths in the index below are relative to this skill's directory (the `reference/…` form) — equivalently, `.claude/skills/sdlc-knowledge/reference/…` from the repo root.

## Inputs

A topic, keyword, or path in `$ARGUMENTS`. Special values:

- *(empty)* or `list` — print the full index below and stop.
- A keyword (e.g. `risk formula`, `autonomy level 3`, `test plan template`) — match against the index, return the best file(s), then read the top match.
- A relative path (e.g. `reference/quality-gates/3-risk.md` or `quality-gates/3-risk.md`) — read that file directly.

## Knowledge index

### Agent operating layer
- `reference/agent/operating-manual.md` — how the agent runs the lifecycle (canonical agent behavior).
- `reference/agent/change-classes.md` — change classes and their gate profiles.

### Quality gates (canonical gate specs)
- `reference/quality-gates/quality-gates.md` — index of all nine gates and the gate model.
- `reference/quality-gates/1-requirements.md` … `reference/quality-gates/9-learning.md` — one file per gate.

### Autonomy & escalation
- `reference/autonomy/levels.md` — autonomy levels 1–5 and what each implies.
- `reference/autonomy/responsibility-matrix.md` — human vs. agent responsibilities per gate × level.
- `reference/autonomy/escalation-policy.md` — hard-stop triggers, risk tolerance, escalation flow.

### Context packs (per-repo knowledge consumed by gates)
- `reference/context-packs/01-operating-model.md`
- `reference/context-packs/02-engineering-standards.md`
- `reference/context-packs/03-system-context.md`
- `reference/context-packs/04-domain-rules.md`
- `reference/context-packs/05-definition-of-done.md`
- `reference/context-packs/06-test-strategy.md`
- `reference/context-packs/07-security-privacy.md`
- `reference/context-packs/08-operational-readiness.md`
- `reference/context-packs/09-release-governance.md`
- `reference/context-packs/starters/README.md` — how to bootstrap a new repo's packs.
- `reference/context-packs/starters/engineering-standards.{go,python,typescript}.md` — language starters.

### Templates (shape of run artifacts)
- `reference/templates/minimal-input-contract.md` — intake contract.
- `reference/templates/requirements-brief.md` (gate 1)
- `reference/templates/design-note.md` (gate 2)
- `reference/templates/risk-register.md` (gate 3)
- `reference/templates/implementation-plan.md` (gate 4)
- `reference/templates/test-plan.md` (gate 5) · `reference/templates/validation-report.md` (gate 5)
- `reference/templates/release-plan.md` (gate 7)
- `reference/templates/post-implementation-review.md` (gate 9)
- `reference/templates/escalation-report.md` — used by `/sdlc:escalate`.
- `reference/templates/pr-package.md` — release PR bundle.
- `reference/templates/decision-record.md` — ADR-style decision capture.
- `reference/templates/adoption-metrics.md` — adoption tracking.

### Top-level repo docs (referenced for completeness — not under reference/)
- `SPEC.md` — top-level AI-SDLC specification (repo root).
- `README.md` — framework overview (repo root).
- `CHANGELOG.md` — version history (repo root).
- `.claude/skills/README.md` — skill map for the framework.
- `.claude/skills/sdlc-deliver/control-model.md` — the orchestrator's control loop.

## Workflow

1. Parse `$ARGUMENTS`. If empty or `list`, print the index above verbatim and stop.
2. If the argument looks like a path (`*.md` or contains `/`):
   - Accept both `reference/...` and the legacy bare form (`agent/...`, `templates/...`, etc.). If the legacy form is given, resolve it to `reference/<same path>`.
   - `Read` the resolved file and return its contents.
3. Otherwise treat the argument as a topic query:
   a. Match it against the index headings and filenames above (case-insensitive, keyword match).
   b. If one strong match → `Read` that file, return its contents, and cite the path.
   c. If multiple plausible matches → list them with one-line descriptions and ask the caller to narrow.
   d. If no match in the curated index → `Grep` across `reference/agent/`, `reference/autonomy/`, `reference/quality-gates/`, `reference/context-packs/`, `reference/templates/` for the query and return the top hits with file:line.
4. Never write, edit, or move files. If the caller asks to update knowledge, point them at the source file path under `reference/` and stop.

## Instructions

- This skill is **read-only**. It indexes existing knowledge — it does not duplicate or summarize it in place. The source files under `reference/` remain canonical.
- Keep the index above in sync with the actual `reference/` tree. If a `Glob` shows new files under `reference/agent/`, `reference/autonomy/`, `reference/quality-gates/`, `reference/context-packs/`, or `reference/templates/` that are not listed here, mention them in the response so a human can add them.
- When other skills invoke this (e.g. a gate skill asking "what's the escalation policy?"), return the path and contents of the canonical file — do not paraphrase.
- Prefer the curated index over a fresh `Grep`. Only fall back to grep when the topic doesn't match a known file.
- Do not load context packs the caller didn't ask for — gates already select their own packs (`reference/context-packs/01..09`).

## Output Format

For a topic lookup:

```
### sdlc-knowledge
query: <argument>
matched: <repo-relative path under .claude/skills/sdlc-knowledge/reference/>
why: <one line — what this file covers>

<contents of the matched file>
```

For a list / no-argument call: print the **Knowledge index** section verbatim.

For ambiguous queries: a numbered list of candidate paths with one-line descriptions, then prompt the caller to pick one.

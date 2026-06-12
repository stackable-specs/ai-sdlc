---
name: sdlc:simulate
description: Simulate real user behavior across the deployed app by launching multi-persona subagents via /playwright-cli, then reviewing observability data in /openobserve. Trigger when the user asks to simulate users, run a UX simulation, explore the app as a user, test user flows end-to-end across personas, or produce a user experience report.
when_to_use: Use after a deployment or during production validation to uncover UX issues, broken flows, or observability gaps that automated tests miss. Pairs well with the sdlc:8-validation gate. Do not use as a substitute for the sdlc:5-test gate — this is experiential, not structural.
argument-hint: "[app-url] [persona-list-or-usecase] [--output <path>]"
arguments:
  - app-url
  - persona-list-or-usecase
  - output
disable-model-invocation: false
user-invocable: true
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - Grep
  - Agent
---

# AI-SDLC — User Simulation

**Artifact:** UX Simulation Report → `sdlc-simulate-report.md` (written to the active run dir or cwd)
**Gate question:** What does a real user actually experience?

## Goal

Launch multiple subagents, each embodying a distinct user persona, to explore the application's UI and API as a genuine user would. Aggregate findings — broken flows, confusing UX, performance problems, error messages — into a structured report. Optionally cross-reference with live observability data from OpenObserve to surface backend signals (errors, slow traces, anomalous metrics, RUM events) that correlate with what the personas encountered.

## Inputs

- `app-url`: `$app-url` — base URL of the running application. If omitted, inspect `k8s/`, `docker-compose.yml`, `Makefile`, or the most recent SDLC run's `state.md` to infer it.
- `persona-list-or-usecase`: `$persona-list-or-usecase` — comma-separated persona names or use-case descriptions. If omitted, derive personas from the app's domain (see Workflow step 1).
- `--output <path>`: Optional. Absolute or repo-relative path where the report should be written. Overrides the default path logic in step 5. Used by `/sdlc:8-validation` to land the report at `.sdlc/runs/<slug>/08-simulate-report.md` alongside the gate artifacts. Create parent directories if missing.
- All raw arguments: `$ARGUMENTS`

If the app URL cannot be determined, ask the user before proceeding.

## Workflow

1. **Discover the app and derive personas.**
   - If `app-url` is not provided: read `Makefile`, `docker-compose.yml`, `k8s/*.yaml`, and the most recent `.sdlc/runs/*/state.md` to find the service URL.
   - If personas are not provided: read `01-requirements-brief.md`, `02-design-brief.md`, or the app source (`README`, route definitions, auth code) to identify the main user roles and 3–5 high-value use cases. Default to: **new unauthenticated visitor**, **first-time registered user**, **returning power user**, **admin/operator**, and any domain-specific role implied by the codebase.

2. **Launch one subagent per persona** via the `Agent` tool (subagent_type: `claude`).
   Each persona subagent must:
   - Open a browser session using `/playwright-cli` (invoke the `playwright-cli` skill).
   - Navigate the app as that user: sign up or log in, complete the primary use case, explore secondary flows, attempt edge cases (empty states, validation errors, unauthorized access).
   - Record: pages visited, actions taken, errors encountered, confusing UI elements, performance observations (slow loads, layout shifts), and any console errors.
   - Return a structured findings block: `{persona, flows_tested, issues[], observations[]}`.

3. **Check observability (if available).**
   - Detect whether OpenObserve is reachable: look for `OPENOBSERVE_URL` env var, `k8s/openobserve.yaml`, or a running service at the default port.
   - If reachable, invoke `/openobserve` to:
     - Search logs for ERROR/WARN entries generated during the simulation window.
     - Query traces for high-latency spans or failed requests.
     - Pull RUM events (if configured) correlated to the persona sessions.
     - Check key metrics (request rate, error rate, p99 latency) against baseline.
   - Map each observability finding back to the persona that likely triggered it.

4. **Aggregate findings.**
   - Collect all persona reports and observability signals.
   - Deduplicate overlapping issues.
   - Classify each issue by severity: **Critical** (blocks core use case), **High** (degrades UX significantly), **Medium** (minor friction), **Low** (cosmetic or edge-case).

5. **Write the report.**
   - Determine output path: use `--output` if provided; else `.sdlc/runs/<current-slug>/sdlc-simulate-report.md` if a run is active; otherwise `./sdlc-simulate-report.md`.
   - Create parent directories if they do not exist.
   - Write the report using the structure below.

## Report Structure

```markdown
# UX Simulation Report
**App:** <url>  **Date:** <ISO date>  **Personas:** <count>

## Executive Summary
<2–4 sentence summary of overall UX health>

## Personas Simulated
| Persona | Flows Tested | Issues Found |
|---------|-------------|--------------|
| ...     | ...          | ...          |

## Critical Issues
### [C-1] <title>
- **Persona:** ...
- **Flow:** ...
- **Steps to reproduce:** ...
- **Observed:** ...
- **Observability signal:** (if any)

## High Issues
...

## Medium / Low Issues
...

## Observability Highlights
- Logs: ...
- Traces: ...
- Metrics: ...
- RUM: ...

## Recommendations
1. ...

## Coverage Gaps
<flows not tested and why>
```

## Instructions

- Run persona subagents in parallel where possible (single `Agent` call with multiple blocks, or sequential if the app has concurrency/rate-limit constraints).
- Each subagent must actually interact with the app — do not fabricate findings.
- If `/playwright-cli` is unavailable (headless not supported, no display), note it and fall back to API-only exploration via `curl` or the app's REST/GraphQL endpoints.
- Do not modify any application code or data permanently during simulation (read/explore only; any test data created should be clearly labelled or cleaned up).
- If OpenObserve is not configured, skip step 3 and note its absence in the report.
- Claim a finding only if actually observed — do not speculate.
- Keep the final report concise: one entry per distinct issue, not one per persona-occurrence.

## Output Format

Respond with:

1. Path to the written `sdlc-simulate-report.md`
2. Personas simulated and flows covered
3. Issue count by severity (Critical / High / Medium / Low)
4. Top 3 recommendations
5. Whether observability data was used and what it revealed

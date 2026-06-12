---
name: sdlc:7-release
description: Run the AI-SDLC Release gate — review the project, start the service(s) locally using the project's defined method, and verify they are healthy. Produces a release note documenting the local verification result.
when_to_use: Use as quality gate 7 of the AI-SDLC lifecycle, after Security and before Production Validation. Verifies the service(s) build and run correctly in the local environment before proceeding to production validation.
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

# AI-SDLC Gate 7 — Release (Local Verification)

**Artifact:** Release Verification Note → `07-release-verification.md`
**Gate question:** Do the service(s) build and run correctly locally?

## Inputs

The run slug in `$ARGUMENTS`, else the most recent in-progress run. Read `contract.md`,
`state.md`, and artifacts `01`–`06`.

## Local run method discovery

Discover how to run the service(s) locally by inspecting the project:

1. Check for `docker-compose.yml` / `compose.yml` in the project root or `src/` — this is the preferred method.
2. Check for a `Makefile` with targets like `up`, `run`, `start`, `dev`.
3. Check `package.json` for `scripts.start`, `scripts.dev`, `scripts.up`.
4. Check for `README.md` or `BUILD-PLAN.md` with local development instructions.
5. Check for `Dockerfile`(s) that can be built and run individually.
6. Check for `Procfile`, `docker-compose.yaml`, or other orchestration files.

Use the most specific method found. If multiple services exist, run them all.

## Workflow

1. **Review the project structure.** Identify all service components (web app, API, database, search engine, etc.) and their interdependencies.

2. **Run quality checks.** Before starting services, run:
   - `typecheck` (if applicable)
   - `test` (unit/integration tests)
   - `lint` (scoped to the service surface)
   - `build` (if a build step is required)
   
   Report any failures. Pre-existing failures outside the service surface should be noted but do not block the gate.

3. **Start the service(s) locally.** Use the discovered method:
   - `docker compose up -d` (preferred — starts all services)
   - `make up` / `make run`
   - `npm start` / `npm run dev`
   - Direct `docker run` for individual containers
   
   If the method requires environment variables or configuration files, check for `.env.example`, `.env`, or `config/` directories and set up as needed.

4. **Verify service(s) are healthy.** For each service:
   - Check the process is running (`docker ps`, `ps aux`, `curl` health endpoint)
   - Hit the health endpoint or main endpoint and confirm HTTP 2xx
   - Check logs for errors (last 50 lines)
   - For multi-service stacks, verify inter-service connectivity (e.g. API can reach the database)

5. **Document the verification.** Write `07-release-verification.md` with:
   - Services discovered and their purposes
   - Method used to run locally
   - Quality check results (typecheck, test, lint, build)
   - Startup steps taken
   - Health check results for each service (endpoint, response, status)
   - Any errors or warnings observed
   - Overall verdict: all services running and healthy, or specific failures

6. **Stop the service(s).** Unless the user has requested otherwise, stop the local services:
   - `docker compose down`
   - `make down`
   - Kill background processes
   
   Note: do not remove volumes with persistent data unless explicitly asked.

7. Update the `state.md` ledger row with the artifact path.

**If local startup fails** — escalate via `/sdlc:escalate` with the failure details.

## Output Format — append this block

```
### sdlc-result
gate: 7-release
status: passed | escalate
risk-score: <2-10>
hard-stop-triggers: <none | service-unhealthy | build-failure>
artifact: .sdlc/runs/<slug>/07-release-verification.md
note: <one-line summary of verification result>
```

After appending the result block, **identify the next required pending gate** in `state.md` and tell the human the exact command to continue (e.g. `/sdlc:manager <slug> gates=8`).

---
name: sdlc:transfusion
description: Move a working pattern from an exemplar (internal repo, external open-source project, or library) into the target codebase by extracting structure, invariants, and edge cases, then synthesizing an equivalent implementation and validating it with behavioral tests. Trigger when the user asks to port a pattern, transfuse a feature, copy an approach from another project, reproduce X's behavior here, or adapt a reference implementation into the current code estate.
when_to_use: Use when there is a concrete working exemplar of the behavior the user wants — inside this repo or outside it — and the goal is to reproduce that behavior in a new context (different language, different module, different stack) without simply copy-pasting. Pairs well with the sdlc:2-design and sdlc:4-implementation gates. Do not use when the exemplar does not exist yet (use sdlc:2-design to invent one) or when the target is purely a refactor of code already present here.
argument-hint: "<exemplar-ref> <target-location> [--language <lang>] [--mode inline|library]"
arguments:
  - exemplar-ref
  - target-location
  - language
  - mode
disable-model-invocation: false
user-invocable: true
allowed-tools:
  - Read
  - Write
  - Edit
  - Grep
  - Glob
  - Bash
  - WebFetch
  - Agent
---

# AI-SDLC — Gene Transfusion

**Artifact:** Pattern Transfer Note → `sdlc-transfer-<slug>.md` (written to the active run dir or cwd)
**Gate question:** Can we reproduce this working pattern here, with equivalent behavior, without forking the source?

## Goal

Move a proven solution from an exemplar implementation into the target codebase. The exemplar can be an internal module, an external open-source project (e.g., Caddy's Let's Encrypt integration), or a documented library. Extract the structure, invariants, and edge cases the exemplar encodes; synthesize an equivalent implementation in the target context; and validate behavioral equivalence with tests. The output is working code in the target plus a transfer note that records what was transfused and what was adapted.

## Inputs

- `exemplar-ref`: `$exemplar-ref` — pointer to the working pattern. May be a repo path (`path/to/file.go`), a GitHub URL (`https://github.com/caddyserver/caddy/tree/master/modules/caddytls`), a package name (`autocert`), or a description with enough specificity to locate the source.
- `target-location`: `$target-location` — where in this codebase the pattern should land (e.g., `apps/backend/src/tls/`).
- `--language <lang>`: Optional. Target language if different from the exemplar (`go`, `python`, `typescript`, `rust`, …). Triggers cross-language synthesis in step 3.
- `--mode inline|library`: Optional. `inline` (default) embeds the pattern directly. `library` introduces it as a dependency relationship — adds the package, wires configuration, omits reimplementation.
- All raw arguments: `$ARGUMENTS`

If `exemplar-ref` cannot be located, stop and ask the user for a more specific pointer (file path, URL, or commit SHA). Do not invent an exemplar.

## Workflow

1. **Identify the exemplar.**
   - If the ref is a local path: read it directly with `Read` / `Grep`.
   - If the ref is a GitHub URL or external project: use `WebFetch` to pull the relevant files, or clone shallowly to `/tmp` with `git clone --depth 1` if multiple files are needed.
   - If the ref is a library/package name: locate the source (registry → repo URL) and read the public API plus one or two representative implementations.
   - Record: exemplar location, commit SHA or version, license. Stop and surface to the user if the license is incompatible with this repo's use (GPL into MIT, etc.).

2. **Extract the pattern.** Read enough of the exemplar to enumerate:
   - **Structure** — public surface (types, functions, config), control flow, state machine if any.
   - **Invariants** — what must always hold (ordering, idempotency, retry semantics, concurrency assumptions).
   - **Edge cases** — what the exemplar's tests, comments, or issue tracker reveal it handles (rate limits, partial failures, race conditions, malformed input).
   - **Dependencies** — what it relies on (filesystem, network, clock, crypto, OS primitives).
   Capture this in a working note before writing any target code. The note becomes the basis of the Pattern Transfer artifact in step 6.

3. **Synthesize in the target context.**
   - In `--mode library`: add the dependency to the target's manifest (`package.json`, `go.mod`, `pyproject.toml`, …), wire its configuration into the target's existing config layer, expose the surface the target needs. Skip to step 4.
   - In `--mode inline` (default): write target-language code that preserves the structure, invariants, and edge-case handling from step 2. Use the target codebase's existing conventions (file layout, naming, error handling, logging, dependency injection) — do not import the exemplar's idioms wholesale. Cross-language: map types and idioms to the target language's standard patterns (Go channels → TS async iterators, Python context managers → Go defer, etc.).
   - Adapt to local constraints: target runtime, available libraries, existing abstractions in the codebase. Note every place the synthesis departs from the exemplar and why.

4. **Validate behavioral equivalence.**
   - Write behavioral tests in the target that exercise the same scenarios as the exemplar's tests (happy path, each documented edge case, each invariant). Tests assert outcomes, not implementation details.
   - If the exemplar has a public test suite: port the test cases (not the test framework). One ported test per documented edge case is the floor.
   - Run the tests. Iterate on the synthesis until they pass. Do not claim equivalence until tests actually run green — record the command and exit code in the transfer note.

5. **Propagate.** Make the new implementation reusable inside this code estate:
   - If `inline`: extract the smallest stable surface (one or two exported symbols, a configuration shape) so the next caller does not re-transfuse from the original.
   - If `library`: document the wrapper module path so future code uses the wrapper rather than the raw dependency.
   - Add a short cross-reference in the transfer note pointing to the exemplar so future transfusions can build on the same trail.

6. **Write the Pattern Transfer Note.** Output path: prefer `.sdlc/runs/<active-slug>/transfer-<short-slug>.md` if an active run directory exists (check `.sdlc/runs/*/state.md` for the most recent `status: active`). Otherwise write to `./sdlc-transfer-<short-slug>.md`. The note must include:
   - Exemplar location, version/SHA, license
   - Pattern summary (structure, invariants, edge cases) — copied from the step-2 working note
   - Target location and mode (inline vs library)
   - Departures from the exemplar with rationale for each
   - Validation evidence: test files added, command run, result
   - Propagation hooks: the stable surface other callers should use

## Instructions

- **The exemplar is the ground truth.** When in doubt about behavior, re-read the exemplar before guessing. Do not "improve" the pattern during transfusion — that is a separate change.
- **Preserve invariants, not implementation.** A Go `select` statement and a TypeScript `Promise.race` may both honor the same invariant; pick the target-idiomatic form. Do not transliterate.
- **Validate before claiming done.** A transfer with no behavioral test is a guess. If tests cannot run in this environment, say so explicitly in the note — do not silently skip.
- **Respect licenses.** GPL/AGPL exemplars cannot be inlined into non-GPL targets. Surface this in step 1 and stop if there is a conflict.
- **Do not transfuse what the codebase already has.** Before step 3, grep the target for the pattern — if an equivalent already exists, propose extending it rather than introducing a parallel implementation.
- **One exemplar at a time.** If the user names multiple exemplars in one call, transfuse them sequentially with separate notes; do not blend two patterns into one synthesis.
- Keep the final response concise — point to the transfer note and the test result.

## Output Format

Respond with:

1. Exemplar identified (path/URL + version/SHA + license)
2. Target location and mode (inline | library)
3. Files added or modified
4. Validation: test files, command run, pass/fail
5. Departures from the exemplar (one line each)
6. Path to the Pattern Transfer Note

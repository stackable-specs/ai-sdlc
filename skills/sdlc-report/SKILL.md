---
name: sdlc:report
description: Compile all SDLC run artifacts from .sdlc/runs/<slug> into a self-contained HTML/JS report and open it in the browser. Trigger when the user asks to generate a report, view run results, or produce an HTML summary of an SDLC run.
when_to_use: Use after any SDLC run gate has produced artifacts and the user wants a visual summary. Works at any point in the lifecycle — partial runs produce a partial report showing completed gates only. Do not use to replace run artifacts; this skill only reads and renders.
argument-hint: "[run-slug]"
arguments:
  - slug
disable-model-invocation: false
user-invocable: true
allowed-tools:
  - Read
  - Bash
  - Glob
  - Grep
  - Write
---

# AI-SDLC Report Generator

## Goal

Read all artifacts from `.sdlc/runs/<slug>/` and produce a single-file, self-contained
HTML/JS report at `.sdlc/runs/<slug>/report.html`, then open it in the system browser.
The report visualizes the full run: gate pipeline, KPI cards, bugs fixed, test results,
security findings, production validation, incidents, backlog, and learning-loop updates.

## Inputs

- `slug`: `$slug` — the run slug (kebab-case directory name under `.sdlc/runs/`). If
  omitted, use the most recently modified run directory.
- All raw arguments: `$ARGUMENTS`

If the slug cannot be resolved, list available runs from `.sdlc/runs/` and ask.

## Workflow

1. **Resolve the run directory.** If `$slug` is provided, verify `.sdlc/runs/$slug/`
   exists. If omitted, run:
   ```bash
   ls -t .sdlc/runs/ | head -1
   ```
   to find the most recently modified run.

2. **Read all run artifacts** in order:
   - `state.md` — slug, intent, autonomy level, risk tolerance, risk formula, latest
     risk score, status, gate ledger (required, pass if gate ledger row exists).
   - `contract.md` — intent, acceptance criteria (Gherkin), authority.
   - `01-requirements-brief.md` — functional + non-functional requirements, scope, edge cases.
   - `02-design-note.md` — solution options, recommended design, architecture notes.
   - `03-risk-register.md` — risk table, impact/likelihood scores per gate.
   - `04-implementation-plan.md` — slices, steps, files changed.
   - `05-test-plan.md` and `05-validation-report.md` — test suites, pass/fail counts,
     traceability table.
   - `06-security-review.md` and `06-secops-report.md` — findings table, threat model.
   - `07-release-plan.md` (if present) — release notes, rollback plan.
   - `08-production-validation.md` and `08-simulate-report.md` — AC results, smoke
     tests, personas, observability highlights.
   - `09-post-implementation-review.md` — success metrics, divergence, defects, backlog,
     framework updates.

   Read only files that exist — skip missing ones and mark the gate as incomplete in the
   report.

3. **Extract structured data** from the artifacts:
   - Gate ledger rows → pipeline visualization data (gate #, name, status, risk score,
     artifact link).
   - Risk scores per gate → chart series `[{gate, score}, ...]`.
   - Bug list from requirements brief or implementation plan → `[{id, title, severity,
     file, description, fix}]`.
   - Test suite results from validation report → `[{suite, passed, total, label}]`.
   - Security findings from security review → `[{id, area, severity, status, note}]`.
   - Acceptance criteria from production validation → `[{id, description, result,
     evidence}]`.
   - Incidents from PIR → `[{id, type, description, resolution}]`.
   - Backlog items from PIR → `[{id, title, priority, source}]`.
   - Learning-loop updates from PIR → `[{file, pattern, summary}]`.
   - KPI values: bugs fixed, total tests, ACs verified, final risk score, regression
     count, backlog size.

4. **Generate the HTML/JS report.** Produce a single-file self-contained HTML document
   with no external CDN dependencies (all CSS and JS inline). Follow the canonical
   template structure described in §Report Structure below, and use the reference
   example at `${CLAUDE_SKILL_DIR}/references/todo-ux-bugfixes.html` for visual design
   and code patterns. Hardcode all extracted data as JS `const` declarations at the top
   of the `<script>` block.

5. **Write the output** to `.sdlc/runs/<slug>/report.html`.

6. **Open in browser:**
   ```bash
   open .sdlc/runs/<slug>/report.html
   ```

7. **Report** the output path and a one-line summary (gates complete, issues, final risk).

## Report Structure

The HTML/JS report must include all of the following sections (omit a section only if
all its source artifacts are missing):

### Required sections (always present)

| Section | Source | Content |
|---------|---------|---------|
| **Sticky nav** | — | Smooth-scroll links to each section |
| **Hero** | `state.md` | Run slug, intent, status badge, metadata chips (date, autonomy, risk tolerance) |
| **KPI stat cards** | All gates | Bugs fixed, tests run, ACs verified, final risk score, regressions, backlog size |
| **Gate pipeline** | `state.md` ledger | Visual node + connector row, gate table with artifact links |

### Conditional sections (include when source exists)

| Section | Source | Content |
|---------|---------|---------|
| **Risk score chart** | Gates 1–9 | SVG/CSS bar chart showing risk score per gate with tolerance line |
| **Bugs fixed** | Gates 1–4 | Card grid: severity-coded left border, ID, title, file tags, fix description |
| **Test results** | Gate 5 | Animated progress bars per suite (backend unit, frontend unit, E2E) |
| **Security findings** | Gate 6 | Cards grid: severity-coded, pre-existing vs. change-introduced vs. improvement |
| **Production validation** | Gate 8 | AC table (pass/fail), smoke-test table, persona simulation table |
| **Incidents timeline** | Gate 9 PIR | Chronological list: type (bad/good), description, resolution |
| **Follow-up backlog** | Gate 9 PIR | Tabbed by priority; each item has ID, title, source note |
| **Learning-loop updates** | Gate 9 PIR | Collapsible `<details>` per context pack file; code blocks for patterns |

### Visual design rules

Follow these rules (derived from the canonical example):

- **Dark theme** using CSS custom properties: `--bg: #0f1117`, `--surface: #1a1d27`,
  `--surface2: #22263a`, `--border: #2e3250`, `--accent: #6c63ff`, `--accent2: #00d4ff`.
- **Severity colors**: `--pass: #22c55e`, `--fail: #ef4444`, `--warn: #f59e0b`,
  `--crit: #ef4444`, `--high: #f97316`, `--med: #f59e0b`, `--low: #64748b`.
- **No external dependencies** — all fonts, icons, and scripts inline. Use system font
  stack (`-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif`).
- **Responsive grid** with `repeat(auto-fit, minmax(..., 1fr))` for cards.
- **Animations**: test bars animate width from 0 to `data-pct`% on load; risk bars
  animate height after 200ms; use `cubic-bezier(0.16,1,0.3,1)` easing.
- **Tabs** for backlog: `showTab(filter)` function filters `.backlog-item[data-pri]`.
- **Gate pipeline**: `.gate-node` + `.gate-connector` flex row; connector color follows
  the upstream gate's status (`passed` → green, `skipped` → dimmed, `pending` → blue).

## Instructions

- Read every file that exists — do not invent data. If a field is genuinely absent from
  all artifacts, mark it as "—" in the report rather than guessing.
- The JS data block at the top of `<script>` should define `const GATES`, `const BUGS`,
  `const RISK_SERIES`, `const TEST_SUITES`, `const SEC_FINDINGS`, `const ACS`,
  `const BACKLOG`, `const TIMELINE`, `const KPIS` — exactly as in the canonical example.
- Parse artifact markdown files with regex and string matching, not by invoking external
  parsers. Gate ledger rows follow the format `| N | Name | yes/no | status | score | artifact |`.
- For runs where Gate 9 is not yet complete, populate backlog and incidents as empty
  arrays and suppress those sections from the rendered output.
- The output file must be self-contained — no `<link>` or `<script src>` tags pointing
  outside the file.
- After writing, always open with `open <path>` — never skip this step.

## Supporting Files

- [references/todo-ux-bugfixes.html](references/todo-ux-bugfixes.html): Canonical
  reference report for the `todo-ux-bugfixes` run (1021 lines). Study its CSS
  variables, JS data shape, animation patterns, and section layout before generating
  any new report. Do not copy slugs or run-specific data from it — only copy structure
  and style.

## Output Format

Respond with:

1. Path to the written HTML report
2. Sections included (list any omitted sections and why)
3. One-line summary: gates complete, final risk score, issue counts

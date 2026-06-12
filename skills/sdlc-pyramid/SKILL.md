---
name: sdlc:pyramid
description: Produce reversible multi-zoom summaries of a corpus of items (bugs, PRs, incidents, requirements, files, log clusters, …) so an agent or human can survey many items at low detail, then expand only the interesting ones. Each item is summarized at multiple "zoom levels" — 2, 4, 8, 16, 32, 64, 128 words — with the full text preserved at the deepest level. Trigger when the user asks to pyramid-summarize, build collapsible summaries, do a multi-resolution survey, scan a large list of issues/PRs/incidents, prepare a triage view, or compress context without losing fidelity.
when_to_use: Use when the corpus is too large to read in full but each item carries enough signal that a single summary would lose what matters. Pairs well with map-reduce / clustering flows — generate pyramids in parallel, cluster by the compressed level, then expand on demand. Pairs naturally with sdlc:9-learning (post-implementation review across many runs) and sdlc:0-intake (triaging an inbox of change requests). Do not use for a single item — just read it. Do not use as a replacement for a focused report (use the relevant report/summary skill).
argument-hint: "<source> [--levels 2,4,8,16,32,64,128] [--output <path>] [--parallel N]"
arguments:
  - source
  - levels
  - output
  - parallel
disable-model-invocation: false
user-invocable: true
allowed-tools:
  - Read
  - Write
  - Glob
  - Grep
  - Bash
  - WebFetch
  - Agent
---

# AI-SDLC — Pyramid Summaries

**Artifact:** Pyramid Index → `sdlc-pyramid-<slug>.md` (written to the active run dir or cwd), plus one detail file per item under `sdlc-pyramid-<slug>/items/<item-id>.md`.
**Core question:** Can the reader see the whole forest at a glance, then zoom to any tree without losing detail?

## Goal

Take a corpus of N items and produce a reversible multi-zoom summary set. Every item is summarized at a fixed ladder of word budgets — by default `2, 4, 8, 16, 32, 64, 128` words — with the full source preserved at the deepest level. The output is one **index file** that lists all items at the chosen survey level (default 2 or 4 words) plus per-item detail files containing every zoom level. The reader (human or agent) scans the index, picks interesting items, then opens the per-item file to expand.

## Inputs

- `source`: `$source` — what to summarize. Accepts:
  - A glob (`.sdlc/runs/*/state.md`, `docs/incidents/*.md`)
  - A directory (treated as all `*.md` inside)
  - A file containing one item per heading (`# Item Title` blocks)
  - A GitHub query (`gh:issues:is:open`, `gh:prs:state:merged`) — uses `gh issue list` / `gh pr list` for the body
  - A URL (treated as a single item, fetched via `WebFetch`)
- `--levels 2,4,8,16,32,64,128`: Optional. Word-budget ladder. Default doubles from 2 to 128. Strictly increasing positive integers. Final level always implicitly includes the **full source text** as the bottom of the pyramid.
- `--output <path>`: Optional. Index file path. Default: `./sdlc-pyramid-<slug>.md` (slug derived from the source). Per-item files land in a sibling directory `<index-stem>/items/`.
- `--parallel N`: Optional. Number of subagents to fan out across items via the `Agent` tool. Default `4`. Set to `1` to disable parallelism.
- All raw arguments: `$ARGUMENTS`

If the source resolves to zero items, stop and report. If it resolves to one item, ask the user to confirm — a pyramid for one item is rarely useful.

## Workflow

1. **Resolve the corpus.**
   - Expand globs with `Glob`. List directory contents. Run `gh issue list --json number,title,body --limit 200` (or equivalent) for GitHub queries.
   - For multi-item single files: split on top-level Markdown headings (`^# `) — each section is one item.
   - Assign each item a stable `item-id` (kebab-case from the title or filename; fall back to `item-NNN`).
   - Record: total item count, source type, target output paths. If `count > 50`, warn and confirm before proceeding (cost grows linearly).

2. **Compute the level ladder.** Parse `--levels` or use the default `[2, 4, 8, 16, 32, 64, 128]`. Add a synthetic top-of-pyramid level `full` that means "include the original text verbatim." Levels must be strictly increasing.

3. **Generate pyramids in parallel.** Fan out to `--parallel` subagents (`Agent` tool, `subagent_type: claude`). Each subagent receives a batch of items and, for each item, produces summaries at every level in the ladder.
   - **Invariant — semantic monotonicity:** every level-K summary must be a faithful compression of the full text such that no level adds detail absent at level K+1. Higher levels are strictly subsets of the meaning at lower levels.
   - **Invariant — independent comprehensibility:** a level-2 summary must stand alone (e.g., "auth broken" not "see below") so survey readers can act on it without expanding.
   - **Invariant — word budget honored:** word counts within ±1 of the budget. Hard cap at +20%.
   - Skip levels whose budget exceeds the original word count (an item shorter than 32 words has no 64- or 128-word level — record the truncated ladder for that item).

4. **Write per-item detail files.** For each item, write `<index-stem>/items/<item-id>.md` with:
   - Frontmatter: `id`, `source` (original path or URL), `word_count` (of full text), `levels` (the ladder actually generated).
   - One `## L<N>` heading per level containing the summary at that word budget.
   - A final `## Full` section containing the original text verbatim (for file/URL sources) or a link to the original (for sources too large to inline — over ~2,000 words).

5. **Write the index file.** At `--output` (or the default path). Structure:
   - Header: corpus description, item count, level ladder, generation timestamp.
   - One table row per item: `item-id | L2 summary | L4 summary | link to detail file`.
   - Default survey level shown is the lowest two levels side-by-side (configurable in the header).
   - At the bottom, a short "How to use" block reminding the reader that detail files contain every higher level and the full text.

6. **Report.** Print: corpus size, items processed, items skipped (with reason), index file path, detail directory path. Suggest two next-step verbs the reader can run: "scan the index" or "cluster by L4" (the latter is a follow-up that the user may invoke with a downstream skill).

## Instructions

- **Pyramids are reversible — never destroy the source.** The full text always lives at the bottom of every item file. If the source is too large to inline, link to it explicitly; do not paraphrase the "full" level.
- **Each level stands alone.** A reader scanning at L2 should not need L4 to decide whether to expand. Avoid placeholders ("various issues", "multiple causes") and cross-references ("see L8") at any level.
- **Preserve named entities at every level.** Numbers, error codes, customer/product names, dates, and ticket IDs survive compression — they are the signal that lets a reader spot the interesting item.
- **Word budgets are floors of meaning, not literal essay length.** A 4-word summary may be a noun phrase; a 16-word summary may be a single sentence. Use whichever grammar best preserves meaning at that budget.
- **Do not invent items.** If the corpus has 23 items, produce 23 pyramids — not 24, not 22. Items that fail to parse are surfaced in the report, not silently dropped.
- **Parallelism is for throughput, not creativity.** All subagents must apply the same level ladder and the same invariants. Spot-check 2–3 random items at the end for monotonicity before finalizing.
- **No "executive summary" of the whole corpus.** The index is a catalogue, not a synthesis. Synthesis belongs in a downstream reduce step (e.g., the user pipes the index into `sdlc:knowledge`, `summary`, or `insights`).
- Keep the final response concise — point to the index and the detail directory.

## Output Format

Respond with:

1. Corpus resolved (source type, item count)
2. Level ladder used
3. Index file path
4. Detail directory path
5. Items skipped (id + reason), if any
6. Suggested next step (e.g., "scan the index; expand items whose L2 mentions <pattern>")

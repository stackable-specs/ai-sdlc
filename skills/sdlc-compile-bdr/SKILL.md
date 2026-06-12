---
name: sdlc:compile-bdr
description: Compile all BDR markdown files from docs/bdr/ into a single docs/SPEC.md — deduplicating similar behaviors first, then extracting and assembling specs using parallel subagents. Use when the user asks to compile specs, rebuild SPEC.md, regenerate the spec from BDRs, or sync docs/SPEC.md with the current BDR set.
when_to_use: Use after new BDRs are added or existing BDRs are updated and docs/SPEC.md needs to reflect the full current set. Do not use mid-BDR authoring — wait until the BDR file is finalized.
argument-hint: "[--dry-run]"
arguments:
  - flags
disable-model-invocation: true
user-invocable: true
allowed-tools:
  - Read
  - Write
  - Glob
  - Bash
  - Skill
---

# SDLC — Compile BDR

## Goal

Rebuild `docs/SPEC.md` from the complete set of BDR files in `docs/bdr/`. Detects similar or duplicate behaviors across BDRs, merges them, then extracts and assembles specs using parallel subagents.

## Inputs

- `--dry-run` — list BDRs, show detected duplicates, and exit without writing.

## Workflow

1. **Collect BDRs.** Glob `docs/bdr/[0-9][0-9][0-9]-*.md` and sort numerically. Exclude subdirectories. If no files match, abort with `"no BDR files found in docs/bdr/"`.

2. **Dry-run exit.** If `--dry-run` was passed, print the sorted file list and any detected duplicate groups, then exit.

3. **Detect duplicates in parallel.** Spawn one subagent per BDR (or batch into groups of ~10 for large sets). Each subagent reads its assigned BDR files, extracts the behavior title and a one-sentence summary of the normative requirement, and returns a list of `{ bdr: "BDR-NNN", title, summary }` entries. Collect all results, then cluster entries whose summaries are semantically equivalent or highly overlapping into merge groups.

4. **Merge duplicate groups.** For each merge group, produce a single merged spec section that:
   - Uses the lowest BDR number as the canonical ID
   - Lists all merged BDR IDs in a `<!-- merged: BDR-NNN, BDR-MMM -->` comment
   - Combines acceptance criteria, deduplicating identical bullets
   - Keeps the most complete Behavior and Context prose

5. **Extract specs in parallel.** Spawn one subagent per remaining BDR (post-merge). Each subagent invokes `/extract-spec <file>` and returns the extracted normative content. Run all subagents concurrently.

6. **Assemble SPEC.md.** Collect extracted sections, order by canonical BDR number, and concatenate under:

   ```markdown
   # Ctrl-Loop Policy Engine — Specification

   **Version:** (read from package.json#version)
   **Status:** Proposed
   **Sources:** BDR-001 through BDR-<NNN>
   **Compiled:** <YYYY-MM-DD>

   ---

   <merged + extracted sections in BDR order>
   ```

7. **Write.** Overwrite `docs/SPEC.md` with the assembled content.

8. **Report.** Print: BDRs processed, merge groups found, any BDRs that yielded no content (warn, do not abort).

## Instructions

- Parallelize steps 3 and 5 — never process BDRs sequentially when subagents can run concurrently.
- Order the final spec by canonical BDR number — the ordering must be deterministic.
- If a BDR yields no content from `/extract-spec`, emit `<!-- BDR-NNN: no spec content extracted -->` as a placeholder.
- Never delete `docs/SPEC.md` before the new content is ready — assemble fully in memory, then write once.
- Merging is advisory: only merge when two BDRs describe the same observable behavior. Do not merge merely similar-sounding titles.

## Output Format

```
Detected <M> merge group(s): <BDR-NNN + BDR-MMM>, …
Compiled <N> BDRs → docs/SPEC.md  (after merges: <K> sections)
  Warnings: <BDRs with no extractable content, or "none">
```

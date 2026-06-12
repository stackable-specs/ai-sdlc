---
name: sdlc:render-html
description: Render one or more Markdown documents as self-contained HTML/JS reports and open them in the browser. Trigger when the user asks to render a report, convert markdown to HTML, visualize a document, or view a .md file as a web page.
when_to_use: Use when the user has one or more Markdown files and wants a polished, browser-viewable HTML version. Works on any Markdown — SDLC gate artifacts, meeting notes, research docs, briefs, plans. For a full SDLC run dashboard (gate pipeline, KPI cards, all gates combined), use sdlc:report instead.
argument-hint: "<path/to/report.md> [path/to/report2.md ...]"
arguments:
  - files
disable-model-invocation: false
user-invocable: true
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - Grep
---

# SDLC Render HTML

## Goal

Convert one or more Markdown documents into self-contained, single-file HTML/JS reports
and open each in the system browser. Each output file is written alongside its source
with the same name and a `.html` extension (e.g. `01-requirements-brief.md` →
`01-requirements-brief.html`). No external CDN or network dependencies — everything
inline.

## Inputs

- `files`: One or more Markdown file paths passed in `$ARGUMENTS` (space-separated,
  may include globs like `*.md`). If omitted, ask the user which file(s) to render.

All raw arguments: `$ARGUMENTS`

## Workflow

1. **Resolve file list.** Split `$ARGUMENTS` on spaces and expand any globs with:
   ```bash
   ls <pattern>
   ```
   Confirm each resolved path exists. If a path does not exist, warn and skip it —
   do not abort the whole run.

2. **For each Markdown file:**

   a. **Read the file** with the `Read` tool.

   b. **Parse structure** from the Markdown:
      - Extract `# H1` as the page title.
      - Extract `## H2` headings as sidebar nav sections (with anchor IDs).
      - Extract `### H3` headings as sub-sections.
      - Detect frontmatter fences (`---`) and parse key/value pairs for a metadata
        header card.
      - Detect `| table |` rows and render as styled `<table>` elements.
      - Detect fenced code blocks (triple backtick) and render as `<pre><code>`.
      - Detect `### sdlc-result` blocks and render as a gate-result card with colored
        status pill (passed → green, escalate → orange, error → red).
      - Detect `**bold**`, `*italic*`, `` `inline code` ``, `[link](url)` inline markup.
      - Detect checklist items (`- [ ]` / `- [x]`) and render as interactive checkboxes.
      - Detect blockquotes (`> `) and render as styled callout boxes.
      - All other text → paragraphs, bullet lists, numbered lists.

   c. **Generate the HTML document.** Produce a single self-contained HTML file:
      - Dark theme matching existing IMS SDLC reports (CSS custom properties below).
      - Sticky left sidebar nav (240px) auto-generated from H2 sections, with
        IntersectionObserver scrollspy for active highlighting.
      - Main content area (max-width 960px) rendering the parsed Markdown.
      - Metadata header card (from frontmatter or first H1 + surrounding context).
      - If the document contains an `### sdlc-result` block, render a floating status
        chip in the top-right corner of the page header (color-coded by status).
      - Collapsible sections: clicking an H2 heading collapses/expands its content.
        Default: all expanded.
      - `<pre><code>` blocks get a one-click copy button.
      - Checklist items render as `<input type="checkbox">` with state saved to
        `localStorage` keyed by `<filename>:<item-index>`.
      - No `<link>`, `<script src>`, or `<img src>` pointing outside the file.

   d. **CSS custom properties to use** (keep consistent with project design system):
      ```css
      --bg: #0d1117;
      --surface: #161b22;
      --surface2: #1c2230;
      --border: #30363d;
      --blue: #58a6ff;
      --blue-dim: #1f3a5f;
      --green: #3fb950;
      --green-dim: #1a3a22;
      --orange: #d29922;
      --orange-dim: #3a2a10;
      --red: #f85149;
      --red-dim: #3a1012;
      --purple: #bc8cff;
      --purple-dim: #2d1f4a;
      --text: #e6edf3;
      --text-muted: #8b949e;
      --text-dim: #6e7681;
      ```

   e. **Write** the output HTML to `<source-dir>/<source-stem>.html` using the `Write`
      tool.

   f. **Open** in browser:
      ```bash
      open <output-path>
      ```

3. **After all files are processed**, report:
   - List of output paths written.
   - Any files that were skipped and why.

## Instructions

- Render faithfully — do not invent content not in the source Markdown. If a section
  is empty, render it as empty rather than adding placeholder text.
- For multi-file runs, process files in the order given. Open each with `open` as it
  is written — do not batch all opens at the end.
- The sidebar nav is generated from `## H2` headings only — do not include H3 or
  deeper in the top-level nav. H3s appear as indented sub-items under their parent H2.
- Table of contents / nav IDs: slugify heading text (lowercase, spaces → hyphens,
  strip punctuation).
- `### sdlc-result` is a special block — always render it as a distinct visual card
  at the bottom of the page, separate from normal prose flow.
- Checklist state persists in `localStorage` per file — key format:
  `sdlc-render:<basename>:<index>`.
- Code copy button uses `navigator.clipboard.writeText`. Degrade gracefully if the
  Clipboard API is unavailable (hide the button rather than erroring).
- Keep the generated HTML under 1,500 lines where possible. If the source document
  is very long, prioritize structural fidelity over decorative embellishment.
- Do not add sections, summaries, or analysis beyond what is in the source Markdown.

## Output Format

After processing, respond with:

1. **Output files:** list each written path.
2. **Skipped files:** any that were missing or unreadable, with reason.
3. One-line summary: number of files rendered and total sections found.

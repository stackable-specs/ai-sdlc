---
name: sdlc:code-quality
description: Run a multi-tool code quality assessment of a project — complexity, maintainability, duplication, and language-specific code smells — and consolidate findings into a single report. Trigger when the user asks for a code quality scan, complexity audit, maintainability report, duplication check, or wants to know which parts of a codebase are the riskiest to maintain.
when_to_use: Use to produce a standalone code quality posture report for a project, or as a complement to the sdlc:5-test gate when assessing maintainability. Detects which languages are present, activates only the applicable analyzers from the installed OSS toolset, runs them in parallel, and writes a single `code-quality-report.md` to the target directory. Do not use as a substitute for the sdlc:6-security gate (that is sdlc:secops) or for runtime profiling.
argument-hint: "<target-path> [--focus size|complexity|duplication|smells|all] [--diff]"
arguments:
  - target
  - focus
  - diff
disable-model-invocation: false
user-invocable: true
allowed-tools:
  - Read
  - Write
  - Bash
  - Agent
  - Glob
  - Grep
---

# AI-SDLC Code Quality Assessment

**Artifact:** Code Quality Report → `code-quality-report.md` in the target directory
**Gate question:** Which parts of this codebase are too complex, too duplicated, or too smelly to maintain safely?

## Inputs

- `target`: Path to the directory to analyze. Default: current working directory.
- `focus`: Optional filter — `size`, `complexity`, `duplication`, `smells`, `coverage`, `dead-code`, or `all` (default: `all`). Maps to groups:
  - `size` → Group 1
  - `complexity` → Groups 2, 4, 5
  - `duplication` → Groups 3, 6
  - `smells` → Groups 5, 6, 7, 8
  - `coverage` → Group 9
  - `dead-code` → Group 10
  - `all` → all applicable groups
- `--diff`: If passed, and a previous `code-quality-report.md` exists in the target, load it and emit a "Changes Since Last Scan" section comparing current findings against previous ones (New / Resolved / Persisting / Regressed).
- All raw arguments: $ARGUMENTS

If `target` is omitted, use the current working directory. If it does not exist, stop and report the error.

## Advisory Thresholds

These thresholds drive the "hot-spot" lists in the report. They are **advisory only** — the skill does not fail or block on violations.

| Metric | Threshold | Source |
|---|---|---|
| Cyclomatic complexity per function | > 10 warn, > 15 hot | lizard, radon |
| Cognitive complexity per function | > 15 warn, > 25 hot | lizard (NLOC × CCN proxy), escomplex |
| File length (LOC) | > 400 warn, > 800 hot | scc / cloc per-file |
| Function length (NLOC) | > 50 warn, > 100 hot | lizard |
| Duplication | > 5% warn, > 10% hot | jscpd, pmd cpd |
| Maintainability index (Radon, Python) | < 65 warn, < 40 hot | radon mi |
| Maintainability (ts-complex, JS/TS) | < 65 warn, < 40 hot | ts-complex (via scripts/ts-maintainability.js) |
| Line coverage (overall) | < 80% warn, < 60% hot | coverage.py, c8, jest, go test -cover, jacoco |
| Line coverage (changed code) | < 80% warn, < 50% hot | diff_cover, codecov patch |
| Critical-module coverage | < 90% warn, < 70% hot | language-native coverage tool |
| Unused exports / dead code | > 20 items warn, > 50 items hot | knip, ts-prune, vulture, deadcode |
| Unused dependencies | ≥ 1 warn, ≥ 5 hot | depcheck, knip, cargo-machete |

A finding is **hot** when it crosses the second threshold (these go in the executive summary). A finding is **warn** when it crosses the first but not the second.

## Workflow

1. **Detect project profile** — inspect the target to determine which languages and structures are present (see Detection Logic below). This drives which tool groups to activate. Only activate a group if its trigger condition is met.

2. **Check for existing report (delta mode)** — if `--diff` was passed and `<target>/code-quality-report.md` exists, read it and store its hot-spot list for comparison in step 5.

3. **Launch parallel analysis subagents** — spawn one Agent per active tool group. Each agent runs its tools, captures output (truncated to top N findings ordered by severity), and returns a structured findings block. Run all applicable groups concurrently.

4. **Consolidate findings** — collect all agent results and apply these deduplication rules:
   - If lizard and a language-specific tool both flag the same function for complexity, keep the language-specific tool's number (more accurate) and note both agreed.
   - If jscpd and PMD CPD report the same duplicate block, keep one row and merge the tool list.
   - Group file-level metrics (LOC, MI) by file, not by tool, so the report has one row per file.
   - Sort each section by severity (hot → warn → ok) then by metric value descending.

5. **Delta comparison (if --diff)** — compare current hot-spots against the previous report. Classify each as: New (not previously flagged), Resolved (previously flagged, no longer hot), Persisting (still hot), Regressed (was warn, now hot OR metric worsened by ≥ 25%). Add a "Changes Since Last Scan" section.

6. **Write the report** — produce `code-quality-report.md` in the target directory using the artifact structure below.

7. **Emit the result summary** inline.

## Detection Logic

Before spawning subagents, detect the project profile by running these commands with the resolved `<target>` path:

```bash
TARGET="<resolved-absolute-target-path>"

echo "=== Languages present ==="
find "$TARGET" -maxdepth 6 -name "*.py" -not -path "*/node_modules/*" -not -path "*/.venv/*" -not -path "*/venv/*" | head -1
find "$TARGET" -maxdepth 6 \( -name "*.js" -o -name "*.jsx" -o -name "*.ts" -o -name "*.tsx" \) -not -path "*/node_modules/*" -not -path "*/dist/*" -not -path "*/build/*" | head -1
find "$TARGET" -maxdepth 6 -name "*.go" -not -path "*/vendor/*" | head -1
find "$TARGET" -maxdepth 6 -name "*.rb" -not -path "*/vendor/*" | head -1
find "$TARGET" -maxdepth 6 -name "*.php" -not -path "*/vendor/*" | head -1
find "$TARGET" -maxdepth 6 -name "*.java" -not -path "*/target/*" | head -1
find "$TARGET" -maxdepth 6 -name "*.kt" -not -path "*/build/*" | head -1
find "$TARGET" -maxdepth 6 -name "*.rs" -not -path "*/target/*" | head -1
find "$TARGET" -maxdepth 6 \( -name "*.c" -o -name "*.cpp" -o -name "*.h" -o -name "*.hpp" \) | head -1
find "$TARGET" -maxdepth 6 -name "*.swift" | head -1
find "$TARGET" -maxdepth 6 -name "*.cs" -not -path "*/bin/*" -not -path "*/obj/*" | head -1

echo "=== Size baseline (always run) ==="
command -v scc >/dev/null && scc --no-cocomo "$TARGET" 2>/dev/null | tail -20
```

Activate groups based on findings:

- **Group 1 (size baseline)** — always
- **Group 2 (multi-language complexity)** — any supported source file found (lizard handles 16+ languages)
- **Group 3 (duplication)** — always when any source detected
- **Group 4 (Python complexity & maintainability)** — `.py` found
- **Group 5 (JavaScript/TypeScript complexity & maintainability)** — `.js`/`.jsx`/`.ts`/`.tsx` found
- **Group 6 (Java + multi-language CPD via PMD)** — `.java` found OR caller wants a second duplication signal
- **Group 7 (PHP smells)** — `.php` found
- **Group 8 (Ruby smells)** — `.rb` found
- **Group 9 (code coverage)** — any source detected AND at least one supported coverage artifact or runner is present (see group for detection)
- **Group 10 (dead code & unused dependencies)** — any source detected; activates per-language sub-tools based on which languages are present

If `--focus` is set, activate only the groups mapped to that focus value (see Inputs). Group 1 always runs because the report header needs the size baseline.

---

## Subagent Tool Groups

### Group 1 — Size Baseline
**Run when:** always
**Tools:** `cloc`, `scc`, `tokei` (use the first one installed; prefer `scc`)
**Commands:**
```bash
TARGET="<resolved-absolute-target-path>"

if command -v scc >/dev/null; then
  echo "=== scc (size by language) ==="
  scc --no-cocomo --format-multi "tabular:stdout" "$TARGET" 2>/dev/null
  # Per-file LOC top offenders
  echo "=== scc largest files ==="
  scc --by-file --sort lines "$TARGET" 2>/dev/null | head -40
elif command -v tokei >/dev/null; then
  tokei "$TARGET" 2>/dev/null
  tokei --files "$TARGET" 2>/dev/null | head -40
elif command -v cloc >/dev/null; then
  cloc --quiet "$TARGET" 2>/dev/null
fi
```
**Returns:** total LOC by language, file count by language, and the top ~30 longest files (path + LOC). Flag any file > 400 LOC as warn, > 800 as hot.

---

### Group 2 — Multi-Language Complexity (Lizard)
**Run when:** any source file detected
**Tools:** `lizard`
**Commands:**
```bash
TARGET="<resolved-absolute-target-path>"

# CSV output: NLOC, CCN, token, PARAM, length, location
lizard "$TARGET" --CCN 10 --length 50 --arguments 6 \
  --exclude "*/node_modules/*" --exclude "*/.venv/*" --exclude "*/venv/*" \
  --exclude "*/vendor/*" --exclude "*/dist/*" --exclude "*/build/*" \
  --exclude "*/target/*" --exclude "*.min.js" \
  --csv 2>/dev/null | head -200

# Warnings summary (functions exceeding the thresholds above)
echo "=== lizard warnings summary ==="
lizard "$TARGET" --CCN 10 --length 50 --arguments 6 \
  --exclude "*/node_modules/*" --exclude "*/.venv/*" --exclude "*/vendor/*" \
  --exclude "*/dist/*" --exclude "*/build/*" --exclude "*.min.js" \
  -w 2>/dev/null | head -120
```
**Returns:** per-function rows (file, function, CCN, NLOC, parameters) for every function over CCN 10 or NLOC 50, sorted by CCN descending. Flag CCN > 15 OR NLOC > 100 as hot.

---

### Group 3 — Duplication (jscpd)
**Run when:** always when any source detected
**Tools:** `jscpd`
**Commands:**
```bash
TARGET="<resolved-absolute-target-path>"
OUT_DIR=$(mktemp -d)

jscpd "$TARGET" \
  --min-tokens 50 \
  --min-lines 5 \
  --ignore "**/node_modules/**,**/.venv/**,**/venv/**,**/vendor/**,**/dist/**,**/build/**,**/target/**,**/*.min.js,**/*.map,**/pnpm-lock.yaml,**/package-lock.json,**/yarn.lock,**/Cargo.lock,**/go.sum" \
  --reporters json,consoleFull \
  --output "$OUT_DIR" \
  --silent 2>/dev/null

# Parse the JSON report for totals and top duplicate pairs
if [ -f "$OUT_DIR/jscpd-report.json" ]; then
  python3 -c "
import json
r = json.load(open('$OUT_DIR/jscpd-report.json'))
s = r.get('statistics', {}).get('total', {})
print(f\"duplication: {s.get('percentage',0)}% ({s.get('duplicatedLines',0)}/{s.get('lines',0)} lines, {s.get('clones',0)} clones)\")
for d in r.get('duplicates', [])[:40]:
    a = d.get('firstFile', {}); b = d.get('secondFile', {})
    print(f\"  {d.get('lines',0)}L  {a.get('name','?')}:{a.get('startLoc',{}).get('line','?')}  <->  {b.get('name','?')}:{b.get('startLoc',{}).get('line','?')}\")
" 2>/dev/null
fi
```
**Returns:** overall duplication percentage; top ~40 duplicate blocks with the two file:line pairs and clone size. Flag percentage > 5% as warn, > 10% as hot.

**Alternative / supplementary duplication tools** (use if `jscpd` is unavailable, or to corroborate findings in a single language):

```bash
TARGET="<resolved-absolute-target-path>"

# Simian — structural similarity (Java/JS/C#/C++/Python/Ruby/etc); commercial-free for OSS
if command -v simian >/dev/null; then
  echo "=== simian ==="
  simian -threshold=6 -reportDuplicateText "$TARGET" 2>&1 | head -80
fi

# duplo — Go-only structural duplicate detection
if command -v duplo >/dev/null && find "$TARGET" -name "*.go" -not -path "*/vendor/*" | head -1 | grep -q .; then
  echo "=== duplo (Go) ==="
  find "$TARGET" -name "*.go" -not -path "*/vendor/*" | duplo -threshold 50 2>&1 | head -60
fi

# flay — Ruby structural duplication (AST-based, catches near-duplicates jscpd misses)
if command -v flay >/dev/null && find "$TARGET" -name "*.rb" -not -path "*/vendor/*" | head -1 | grep -q .; then
  echo "=== flay (Ruby) ==="
  flay "$TARGET" 2>&1 | head -60
fi

# RuboCop duplication cops — Ruby (Lint/DuplicateMethods, Style/DuplicatedKey, Metrics/AbcSize)
if command -v rubocop >/dev/null && find "$TARGET" -name "*.rb" -not -path "*/vendor/*" | head -1 | grep -q .; then
  echo "=== rubocop (duplication-relevant cops) ==="
  rubocop "$TARGET" --only Lint/DuplicateMethods,Lint/DuplicateBranch,Style/DuplicatedKey \
    --format simple --no-color 2>&1 | head -60
fi
```

When two duplication tools agree on the same block (file pair + ≥50% line overlap), raise that row's severity to **hot** and list both tools in the source column.

---

### Group 4 — Python: Complexity & Maintainability
**Run when:** `.py` files detected
**Tools:** `radon`, `xenon`
**Commands:**
```bash
TARGET="<resolved-absolute-target-path>"

# Cyclomatic complexity per function/class — show rank C and worse
echo "=== radon cc ==="
radon cc "$TARGET" --min C --average --total-average \
  --exclude "*/.venv/*,*/venv/*,*/node_modules/*,*/build/*" 2>/dev/null | head -120

# Maintainability index per file — show rank B and worse
echo "=== radon mi ==="
radon mi "$TARGET" --min B --show \
  --exclude "*/.venv/*,*/venv/*,*/node_modules/*,*/build/*" 2>/dev/null | head -120

# Raw metrics (LOC/SLOC/comments per file)
echo "=== radon raw (summary) ==="
radon raw "$TARGET" --summary \
  --exclude "*/.venv/*,*/venv/*,*/node_modules/*,*/build/*" 2>/dev/null | tail -20

# Halstead (effort / difficulty / time-to-understand)
echo "=== radon hal (top) ==="
radon hal "$TARGET" \
  --exclude "*/.venv/*,*/venv/*,*/node_modules/*,*/build/*" 2>/dev/null | head -60

# Xenon — threshold check (non-zero exit means a threshold was breached; we capture stdout)
echo "=== xenon (threshold violations only) ==="
xenon --max-absolute B --max-modules B --max-average A \
  --exclude "**/.venv/**,**/venv/**,**/node_modules/**,**/build/**" \
  "$TARGET" 2>&1 | head -40 || true
```
**Returns:** functions with rank ≥ C (CCN ≥ 11) ordered by CCN descending; files with maintainability index ≤ 65 (rank ≥ B) ordered by MI ascending; Halstead effort/time outliers; xenon threshold breaches.

---

### Group 5 — JavaScript/TypeScript: Complexity & Maintainability

**Run when:** `.js` / `.jsx` / `.ts` / `.tsx` files detected

**Tools:**
- **`ts-complex`** (primary, via the bundled wrapper at `scripts/ts-maintainability.js`) — Halstead-based Maintainability Index for TypeScript and JavaScript files, computed per file (avg + min MI). Library-only; the wrapper handles directory walking, exclusions, filtering of sentinel `-1` results (files with no analyzable functions: decorator-only NestJS modules, type-only files, config files), and JSON output.
- **`code-complexity`** (optional, churn × complexity hotspot ranking) — combines git churn with LOC/cyclomatic/Halstead complexity to rank files that are both complex AND frequently changed. Requires the command to run from the git repository root. Skips automatically when the target is not inside a git repo.

**Install (if missing):**
```bash
npm install -g ts-complex code-complexity
```

**Commands:**
```bash
TARGET="<resolved-absolute-target-path>"
SKILL_DIR="<absolute-path-to-this-skill-directory>"  # the directory containing SKILL.md

# --- Primary: ts-complex via wrapper ---
# Detect: any .ts/.tsx/.js/.jsx outside excluded dirs
HAS_TS_JS=$(find "$TARGET" \
  \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \) \
  -not -path "*/node_modules/*" -not -path "*/dist/*" -not -path "*/build/*" \
  -not -path "*/.next/*" -not -path "*/coverage/*" -not -name "*.min.js" -not -name "*.d.ts" \
  2>/dev/null | head -1)

if [ -n "$HAS_TS_JS" ]; then
  if command -v node >/dev/null && [ -f "$SKILL_DIR/scripts/ts-maintainability.js" ]; then
    echo "=== ts-complex maintainability (per-file MI) ==="
    node "$SKILL_DIR/scripts/ts-maintainability.js" "$TARGET" --limit 30 2>&1 | head -80

    # Also emit JSON for programmatic consolidation
    node "$SKILL_DIR/scripts/ts-maintainability.js" "$TARGET" --limit 200 --json \
      > /tmp/ts-maintainability.json 2>/dev/null
    echo "TS_MAINTAINABILITY_JSON=/tmp/ts-maintainability.json"
  else
    echo "WARNING: ts-complex wrapper not available (need: node + scripts/ts-maintainability.js)"
  fi
fi

# --- Optional: code-complexity (churn × complexity hotspots) ---
# Requires git root. Find the git root that contains TARGET.
GIT_ROOT=$(cd "$TARGET" 2>/dev/null && git rev-parse --show-toplevel 2>/dev/null || true)
if [ -n "$GIT_ROOT" ] && command -v code-complexity >/dev/null; then
  REL=$(python3 -c "import os; print(os.path.relpath('$TARGET', '$GIT_ROOT'))")
  if [ "$REL" = "." ]; then
    FILTER="**,!**/node_modules/**,!**/dist/**,!**/build/**,!**/.playwright-cli/**,!**/playwright-report/**,!**/test-results/**,!**/*.lock,!**/pnpm-lock.yaml,!**/package-lock.json,!**/yarn.lock"
  else
    FILTER="${REL}/**,!${REL}/node_modules/**,!${REL}/dist/**,!${REL}/build/**,!${REL}/.playwright-cli/**,!${REL}/playwright-report/**,!${REL}/test-results/**,!${REL}/pnpm-lock.yaml,!${REL}/package-lock.json,!${REL}/yarn.lock"
  fi
  echo ""
  echo "=== code-complexity (churn × complexity, top 20 by score) ==="
  (cd "$GIT_ROOT" && code-complexity . --filter "$FILTER" --limit 20 --sort score 2>&1) | head -60
fi
```

**Returns:**
- From `ts-complex` wrapper: per-file `avgMaintainability` and `minMaintainability` (0–100, higher is better), counts of hot (`min MI < 40`) / warn (`40 ≤ min MI < 65`) / ok (`min MI ≥ 65`), and an average MI for the project. Skipped files (sentinel `-1` — no analyzable functions) are listed but not counted as hot.
- From `code-complexity`: top files by churn × complexity score, useful for identifying refactoring priorities (high-complexity files that also change frequently). Use this list to break ties between equally-complex files when prioritizing the Recommended Actions section.

**Severity:** Flag `min MI < 65` as **warn**, `min MI < 40` as **hot**. Prefer `minMaintainability` over `avgMaintainability` for the severity classification — a single bad function in a file is enough to make the file risky to maintain.

**Caveat:** `ts-complex` returns `-1` for files with no analyzable function bodies (NestJS modules whose body is only `@Module({...})` decoration, pure type/interface files, Vite/Jest config files). The wrapper filters these out and reports them under `filesSkipped` rather than treating them as MI=0.

---

### Group 6 — PMD CPD (multi-language copy-paste detection)
**Run when:** `.java` files detected OR caller wants a corroborating duplication signal alongside Group 3
**Tools:** `pmd` (provides `cpd` subcommand)
**Commands:**
```bash
TARGET="<resolved-absolute-target-path>"

# pmd >= 7 uses `pmd cpd --dir <path> --language <lang>`
# Run once per detected language that CPD supports
for LANG in java javascript typescript python ruby go php cpp; do
  case $LANG in
    java) PAT="*.java" ;;
    javascript|typescript) PAT="*.js|*.ts" ;;
    python) PAT="*.py" ;;
    ruby) PAT="*.rb" ;;
    go) PAT="*.go" ;;
    php) PAT="*.php" ;;
    cpp) PAT="*.cpp" ;;
  esac
  FIRST_HIT=$(find "$TARGET" -name "${PAT%%|*}" -not -path "*/node_modules/*" -not -path "*/vendor/*" -not -path "*/target/*" | head -1)
  [ -z "$FIRST_HIT" ] && continue

  echo "=== pmd cpd ($LANG) ==="
  pmd cpd --dir "$TARGET" --language "$LANG" --minimum-tokens 75 --format text 2>/dev/null \
    | head -80 || true
done
```
**Returns:** duplicate blocks (tokens, line range, file pairs) per detected language. Use to corroborate jscpd; if jscpd and CPD agree on a block, raise its severity to hot.

---

### Group 7 — PHP Mess Detection
**Run when:** `.php` files detected
**Tools:** `phpmd`
**Commands:**
```bash
TARGET="<resolved-absolute-target-path>"

# Rulesets: cleancode, codesize, controversial, design, naming, unusedcode
# Output text (concise) and parse top offenders
phpmd "$TARGET" text codesize,design,unusedcode \
  --exclude vendor,node_modules,dist,build 2>/dev/null | head -120

echo "=== phpmd: naming + cleancode ==="
phpmd "$TARGET" text naming,cleancode \
  --exclude vendor,node_modules,dist,build 2>/dev/null | head -60
```
**Returns:** rule, file, line range, severity, message — one row per violation. Group by rule, count per file.

---

### Group 8 — Ruby Smells (Reek)
**Run when:** `.rb` files detected
**Tools:** `reek`
**Commands:**
```bash
TARGET="<resolved-absolute-target-path>"

reek "$TARGET" --format json --no-progress 2>/dev/null \
  | python3 -c "
import json, sys, collections
try:
    data = json.load(sys.stdin)
except Exception as e:
    print(f'reek parse error: {e}')
    sys.exit(0)
by_smell = collections.Counter()
print(f'reek: {len(data)} smells')
for s in data[:80]:
    by_smell[s.get('smell_type','?')] += 1
    print(f\"  {s.get('smell_type','?')}  {s.get('source','?')}:{','.join(map(str, s.get('lines',[])))[:40]}  {s.get('message','')[:80]}\")
print()
print('=== smell type counts ===')
for k, v in by_smell.most_common():
    print(f'  {v:4d}  {k}')
" 2>/dev/null
```
**Returns:** ordered list of smells (type, file, lines, message) plus a frequency table of smell types.

---

### Group 9 — Code Coverage

**Run when:** any source detected, AND at least one of:
- An existing coverage artifact is found in the target (e.g. `coverage/`, `coverage.xml`, `lcov.info`, `coverage.out`, `.coverage`, `jacoco.xml`, `cobertura.xml`).
- A runnable test target is detected AND the user passed `--focus coverage` (then we may invoke the runner to produce coverage).

**Philosophy:** Prefer **reading existing coverage artifacts** to running tests. The skill is an assessment, not a build step — re-running test suites can be slow, flaky, or have side effects. Only invoke the language coverage runner when (a) `--focus coverage` was explicitly requested and (b) no artifact exists. Never run coverage against production data or networked test suites.

**Tool inventory by ecosystem:**

| Ecosystem | Primary tools | Artifact formats consumed |
|---|---|---|
| Platforms / aggregators | Codecov, Coveralls, SonarQube coverage import | XML/LCOV/JSON imported by these platforms |
| JavaScript / TypeScript | Istanbul / `nyc`, `c8`, Jest `--coverage`, Vitest `--coverage` | `coverage/coverage-final.json`, `coverage/lcov.info`, `coverage/clover.xml` |
| Python | `coverage.py`, `pytest-cov` | `.coverage`, `coverage.xml`, `htmlcov/` |
| Java / Kotlin | JaCoCo, Cobertura (legacy) | `jacoco.xml`, `cobertura.xml` |
| .NET | OpenCover, Coverlet | `coverage.cobertura.xml`, `coverage.opencover.xml` |
| C / C++ | `gcov` + `lcov`, `llvm-cov` | `lcov.info` |
| Rust | `grcov`, `tarpaulin`, `llvm-cov` | `lcov.info`, `cobertura.xml`, `tarpaulin-report.json` |
| Ruby | SimpleCov | `coverage/.last_run.json`, `coverage/coverage.json` |
| PHP | Xdebug coverage | `coverage.xml` (Clover) |
| Go | `go test -cover -coverprofile` | `coverage.out` |
| Shell / misc | `kcov` | `cobertura.xml` |

**Detection + parse commands:**

```bash
TARGET="<resolved-absolute-target-path>"

echo "=== Coverage artifacts detected ==="
ART=()
for P in \
  "$TARGET/coverage/lcov.info" \
  "$TARGET/coverage/coverage-final.json" \
  "$TARGET/coverage/clover.xml" \
  "$TARGET/coverage.xml" \
  "$TARGET/.coverage" \
  "$TARGET/coverage.out" \
  "$TARGET/jacoco.xml" \
  "$TARGET/target/site/jacoco/jacoco.xml" \
  "$TARGET/build/reports/jacoco/test/jacocoTestReport.xml" \
  "$TARGET/cobertura.xml" \
  "$TARGET/coverage.cobertura.xml" \
  "$TARGET/coverage.opencover.xml" \
  "$TARGET/tarpaulin-report.json"; do
  [ -f "$P" ] && { echo "  found: $P"; ART+=("$P"); }
done

# Generic LCOV parser (works for JS/TS, C/C++/Rust grcov/llvm-cov, kcov output)
parse_lcov() {
  local F="$1"
  python3 -c "
import re, sys
lf=lh=bf=bh=fnf=fnh=0
for line in open('$F'):
  if line.startswith('LF:'): lf += int(line.split(':')[1])
  elif line.startswith('LH:'): lh += int(line.split(':')[1])
  elif line.startswith('BRF:'): bf += int(line.split(':')[1])
  elif line.startswith('BRH:'): bh += int(line.split(':')[1])
  elif line.startswith('FNF:'): fnf += int(line.split(':')[1])
  elif line.startswith('FNH:'): fnh += int(line.split(':')[1])
def pct(h,f): return f'{(100.0*h/f):.1f}%' if f else 'n/a'
print(f'  lines:    {lh}/{lf}  ({pct(lh,lf)})')
print(f'  branches: {bh}/{bf}  ({pct(bh,bf)})')
print(f'  funcs:    {fnh}/{fnf}  ({pct(fnh,fnf)})')
"
}

for P in "${ART[@]}"; do
  echo ""
  echo "--- $P ---"
  case "$P" in
    *lcov.info) parse_lcov "$P" ;;
    *coverage.out)
      # Go cover profile
      command -v go >/dev/null && (cd "$TARGET" && go tool cover -func "$P" 2>/dev/null | tail -10) ;;
    *coverage-final.json)
      python3 -c "
import json
d = json.load(open('$P'))
tot = {'lines':[0,0],'branches':[0,0],'functions':[0,0],'statements':[0,0]}
for f in d.values():
  for k in tot:
    s = f.get(k+'',{}) if k.endswith('s') else {}
    s = f.get(k, {}) if not s else s
    tot[k][0] += s.get('covered',0); tot[k][1] += s.get('total',0)
for k,(h,t) in tot.items():
  pct = (100.0*h/t) if t else 0
  print(f'  {k}: {h}/{t}  ({pct:.1f}%)')
" 2>/dev/null ;;
    *coverage.xml|*clover.xml|*cobertura.xml|*coverage.cobertura.xml|*coverage.opencover.xml|*jacoco.xml)
      python3 -c "
import xml.etree.ElementTree as ET
r = ET.parse('$P').getroot()
# Cobertura / clover both expose line-rate / branch-rate on the root, jacoco uses <counter>
attrs = r.attrib
if 'line-rate' in attrs:
  print(f\"  lines: {float(attrs.get('line-rate',0))*100:.1f}%   branches: {float(attrs.get('branch-rate',0))*100:.1f}%\")
else:
  for c in r.iter('counter'):
    t = c.get('type'); cov = int(c.get('covered',0)); mis = int(c.get('missed',0))
    tot = cov+mis; pct = (100.0*cov/tot) if tot else 0
    print(f'  {t.lower()}: {cov}/{tot}  ({pct:.1f}%)')
" 2>/dev/null ;;
    *tarpaulin-report.json)
      python3 -c "import json; d=json.load(open('$P')); print(f\"  lines: {d.get('coverage',0):.1f}%\")" 2>/dev/null ;;
    *.coverage)
      command -v coverage >/dev/null && (cd "$TARGET" && coverage report --skip-empty 2>/dev/null | tail -15) ;;
  esac
done

# Diff-coverage on changed lines vs main (advisory; needs git + diff_cover for full output)
GIT_ROOT=$(cd "$TARGET" 2>/dev/null && git rev-parse --show-toplevel 2>/dev/null || true)
if [ -n "$GIT_ROOT" ] && command -v diff-cover >/dev/null; then
  for P in "$TARGET/coverage.xml" "$TARGET/coverage/clover.xml" "$TARGET/coverage/lcov.info"; do
    if [ -f "$P" ]; then
      echo ""
      echo "=== diff-cover (changed lines vs origin/main) ==="
      (cd "$GIT_ROOT" && diff-cover "$P" --compare-branch origin/main --format markdown 2>&1 | head -40) || true
      break
    fi
  done
fi
```

**On-demand runners** (only when `--focus coverage` AND no artifact found):

```bash
# JS/TS — only if package.json declares a coverage script
[ -f "$TARGET/package.json" ] && grep -q '"test:cov\|coverage"' "$TARGET/package.json" && \
  (cd "$TARGET" && timeout 300 npm run -s coverage 2>&1 | tail -30) || true

# Python — only if pytest is configured
[ -f "$TARGET/pyproject.toml" ] || [ -f "$TARGET/setup.cfg" ] && command -v pytest >/dev/null && \
  (cd "$TARGET" && timeout 300 pytest --cov --cov-report=xml --cov-report=term 2>&1 | tail -30) || true

# Go
find "$TARGET" -name "*.go" -not -path "*/vendor/*" | head -1 | grep -q . && \
  (cd "$TARGET" && timeout 300 go test -cover -coverprofile=coverage.out ./... 2>&1 | tail -30) || true
```

**Returns:**
- Overall coverage by metric (lines / branches / functions / statements) per detected artifact.
- Diff-coverage for changed lines vs the merge base, if available.
- A coverage posture verdict using these gates:
  - **Hot:** overall line coverage < 60% OR changed-code coverage < 50%
  - **Warn:** overall line coverage < 80% OR changed-code coverage < 80%
  - **OK:** overall ≥ 80% AND changed-code ≥ 80%
- A note when *no* coverage artifact is present — record this as a finding (the project has no coverage signal), not as "tool skipped".

**Anti-patterns to call out** in the report when applicable:
- Single fixed global target (e.g. "80% always") with no risk-based exception for critical modules.
- Coverage measured but not enforced in CI.
- Coverage tracked at file granularity only — no changed-code or mutation signal.

---

### Group 10 — Dead Code & Unused Dependencies

**Run when:** any source detected; per-tool activation by language.

**Goal:** Identify code that is reachable but never called, exports/files that nothing imports, and dependencies declared but never used. These are maintenance load with no offsetting value.

**Tool inventory:**

| Language | Tool | What it finds |
|---|---|---|
| JS / TS | **Knip** | unused files, exports, dependencies, types |
| JS | depcheck | unused / missing dependencies |
| TS | ts-prune | unused TypeScript exports |
| JS / TS | unimported | unused files and dependencies |
| Python | vulture | dead code (unused funcs, classes, vars) |
| Python | pyflakes | unused imports / variables |
| Python | Ruff (`F401`, `F841`, `ERA`, `RUF`) | unused imports, vars, commented-out code |
| Rust | cargo-machete | unused dependencies |
| Rust | cargo-udeps (nightly) | unused dependencies |
| Go | deadcode (golang.org/x/tools) | unreachable functions |
| Go | unparam | unused function parameters |
| Go | unused (staticcheck `U1000`) | unused identifiers |
| .NET | ReSharper InspectCode CLI | unused code |
| .NET | NDepend | dead code + dep analysis |
| PHP | Rector | modernization + cleanup of dead branches |
| PHP | PHPStan / Psalm | unused / unreachable code |

**Commands:**

```bash
TARGET="<resolved-absolute-target-path>"
GIT_ROOT=$(cd "$TARGET" 2>/dev/null && git rev-parse --show-toplevel 2>/dev/null || true)

# --- JavaScript / TypeScript ---
if find "$TARGET" \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \) \
     -not -path "*/node_modules/*" -not -path "*/dist/*" -not -path "*/build/*" 2>/dev/null | head -1 | grep -q .; then

  if command -v knip >/dev/null && [ -f "$TARGET/package.json" ]; then
    echo "=== knip (unused files / exports / deps) ==="
    (cd "$TARGET" && timeout 120 knip --no-progress --reporter compact 2>&1 | head -100) || true
  fi

  if command -v depcheck >/dev/null && [ -f "$TARGET/package.json" ]; then
    echo "=== depcheck (unused / missing deps) ==="
    (cd "$TARGET" && timeout 60 depcheck --json 2>/dev/null | python3 -c "
import json, sys
d = json.load(sys.stdin)
print(f\"unused deps: {len(d.get('dependencies',[]))}\")
for x in d.get('dependencies', [])[:20]: print('  ' + x)
print(f\"unused devDeps: {len(d.get('devDependencies',[]))}\")
for x in d.get('devDependencies', [])[:20]: print('  ' + x)
print(f\"missing: {len(d.get('missing',{}))}\")
for k,v in list(d.get('missing',{}).items())[:20]: print(f'  {k} -> {v}')
" 2>/dev/null) || true
  fi

  if command -v ts-prune >/dev/null && find "$TARGET" -name "tsconfig.json" -not -path "*/node_modules/*" | head -1 | grep -q .; then
    echo "=== ts-prune (unused TS exports) ==="
    (cd "$TARGET" && timeout 60 ts-prune 2>&1 | head -80) || true
  fi
fi

# --- Python ---
if find "$TARGET" -name "*.py" -not -path "*/.venv/*" -not -path "*/venv/*" 2>/dev/null | head -1 | grep -q .; then
  if command -v vulture >/dev/null; then
    echo "=== vulture (Python dead code, min confidence 70) ==="
    vulture "$TARGET" --min-confidence 70 \
      --exclude ".venv,venv,node_modules,build,dist" 2>&1 | head -80 || true
  fi
  if command -v ruff >/dev/null; then
    echo "=== ruff (F401/F841/ERA — unused imports/vars/commented-out code) ==="
    ruff check "$TARGET" --select F401,F811,F841,ERA001 --no-fix --output-format concise 2>&1 | head -80 || true
  fi
  if command -v pyflakes >/dev/null && ! command -v ruff >/dev/null; then
    echo "=== pyflakes ==="
    pyflakes "$TARGET" 2>&1 | head -60 || true
  fi
fi

# --- Go ---
if find "$TARGET" -name "*.go" -not -path "*/vendor/*" 2>/dev/null | head -1 | grep -q .; then
  if command -v deadcode >/dev/null; then
    echo "=== deadcode (Go) ==="
    (cd "$TARGET" && timeout 60 deadcode ./... 2>&1 | head -60) || true
  fi
  if command -v unparam >/dev/null; then
    echo "=== unparam (Go) ==="
    (cd "$TARGET" && timeout 60 unparam ./... 2>&1 | head -60) || true
  fi
  if command -v staticcheck >/dev/null; then
    echo "=== staticcheck U1000 (Go unused) ==="
    (cd "$TARGET" && timeout 60 staticcheck -checks=U1000 ./... 2>&1 | head -60) || true
  fi
fi

# --- Rust ---
if find "$TARGET" -name "Cargo.toml" -not -path "*/target/*" 2>/dev/null | head -1 | grep -q .; then
  if command -v cargo-machete >/dev/null; then
    echo "=== cargo-machete (Rust unused deps) ==="
    (cd "$TARGET" && timeout 60 cargo machete 2>&1 | head -40) || true
  fi
  # cargo-udeps requires nightly; only run if explicitly available
  if command -v cargo-udeps >/dev/null && rustup toolchain list 2>/dev/null | grep -q nightly; then
    echo "=== cargo-udeps (Rust unused deps, nightly) ==="
    (cd "$TARGET" && timeout 120 cargo +nightly udeps 2>&1 | head -40) || true
  fi
fi

# --- PHP ---
if find "$TARGET" -name "*.php" -not -path "*/vendor/*" 2>/dev/null | head -1 | grep -q .; then
  if command -v phpstan >/dev/null; then
    echo "=== phpstan (level max, dead-code rules) ==="
    (cd "$TARGET" && timeout 120 phpstan analyse --level max --no-progress --error-format=raw 2>&1 | head -60) || true
  fi
  if command -v psalm >/dev/null; then
    echo "=== psalm (--find-dead-code) ==="
    (cd "$TARGET" && timeout 120 psalm --find-dead-code --no-progress 2>&1 | head -60) || true
  fi
fi
```

**Returns:**
- For each language present: counts of unused exports, unused files, unused dependencies, unreachable functions.
- Top ~30 specific unused items per category (file + symbol where applicable).
- A "load-bearing or dead?" hint: any item flagged by **two** tools (e.g. ts-prune + knip on the same export) is high-confidence dead.

**Severity:**
- **Hot:** > 50 unused-export items OR > 5 unused dependencies OR any unreachable function in a security-sensitive path (auth, payment, crypto).
- **Warn:** > 20 unused-export items OR ≥ 1 unused dependency.
- **OK:** below warn threshold.

**Caveat to record in the report:** dynamic dispatch, reflection, framework decorators (NestJS controllers, Django URL resolvers), CLI entry points declared in `package.json#bin`, and test-only utilities can show up as "unused" but are not safe to delete. Always recommend a manual confirmation pass before removal; never auto-delete.

---

## Consolidation Instructions

- Replace `<target>` / `<resolved-absolute-target-path>` with the actual absolute path in every command before running.
- Each subagent runs independently — do not wait for other agents.
- **Deduplication priority:**
  - Same function flagged by lizard and a language-specific tool → keep the language-specific number, list both tools.
  - Same duplicate block flagged by jscpd and PMD CPD → one row, both tools listed, severity raised to hot.
  - One row per file in the "Large / Low-MI Files" table, merging size + maintainability columns.
- If a tool is not installed, skip it and record it in the "Tools skipped" table.
- If a tool errors or times out, capture the error, skip, and note it.
- Do not modify any files in the target directory except writing `code-quality-report.md`.
- Never run network-active tools or anything that requires authentication.

---

## Artifact Structure

```markdown
# Code Quality Report

**Target:** <path>
**Date:** <ISO date>
**Tools run:** <comma-separated list with versions>
**Tools skipped:** <list with reason>

---

## Executive Summary

| Bucket | Hot | Warn | OK |
|---|---|---|---|
| Cyclomatic complexity (functions) | n | n | n |
| Function length | n | n | n |
| File length | n | n | n |
| Duplication blocks | n | n | n |
| Maintainability (files) | n | n | n |
| Code smells | n | n | — |
| Coverage (overall / changed-code) | n | n | n |
| Dead code & unused deps | n | n | n |

**Overall posture:** [Critical risk / High risk / Moderate risk / Healthy]

**Top 5 hot-spots:**
1. <file:function — metric — value>
2. ...

---

## Size Baseline

| Language | Files | Lines | Code | Comments | Blanks |
|---|---|---|---|---|---|

**Largest files (top 10):**
| # | File | LOC | Status |
|---|---|---|---|

---

## Changes Since Last Scan
*(only present when --diff is passed and a previous report exists)*

| Status | Finding | Was | Now |
|---|---|---|---|
| New | <function/file — metric> | — | hot |
| Resolved | <function/file — metric> | hot | ok |
| Persisting | <function/file — metric> | hot | hot |
| Regressed | <function/file — metric> | warn | hot |

---

## Complexity (Cyclomatic & Cognitive)

### Functions over threshold
| # | File | Function | CCN | NLOC | Params | Severity | Source |
|---|---|---|---|---|---|---|---|

### Per-language averages
| Language | Avg CCN | Max CCN | Hot count |
|---|---|---|---|

---

## Maintainability

### Files below threshold
| # | File | Maintainability | Avg CCN | SLOC | Severity | Source |
|---|---|---|---|---|---|---|

---

## Duplication

**Overall duplication:** n% (m duplicated lines out of N)

### Top duplicate blocks
| # | Size (lines) | File A | File B | Tool(s) | Severity |
|---|---|---|---|---|---|

---

## Code Smells

### Python (Radon / Xenon)
| # | File | Function | Issue | Severity |
|---|---|---|---|---|

### JavaScript/TypeScript (ts-complex maintainability)
| # | File | min MI | avg MI | Severity | Source |
|---|---|---|---|---|---|

### JavaScript/TypeScript (code-complexity churn × score)
| # | File | Complexity | Churn | Score |
|---|---|---|---|---|

### Java (PMD)
| # | File | Rule | Severity |
|---|---|---|---|

### PHP (PHPMD)
| # | File | Rule | Severity |
|---|---|---|---|

### Ruby (Reek)
| # | File | Smell | Severity |
|---|---|---|---|

---

## Coverage

**Overall:** lines n% · branches n% · functions n%
**Changed-code (vs main):** n% (m of N changed lines covered)
**Critical modules:** <module> n%, <module> n%
**Posture:** [Healthy / Warn / Hot / No signal]

| Artifact | Format | Lines | Branches | Functions |
|---|---|---|---|---|

**Anti-patterns observed:**
- <e.g. "single global 80% gate with no critical-module carve-out">
- <e.g. "coverage measured but not enforced in CI">

---

## Dead Code & Unused Dependencies

| Language | Unused exports | Unused files | Unused deps | Unreachable funcs | Tools |
|---|---|---|---|---|---|

**High-confidence dead** (flagged by ≥ 2 tools):
| # | File | Symbol | Tools agreeing |
|---|---|---|---|

**Caveats:** dynamic dispatch / reflection / decorator-based frameworks may produce false positives. Manually confirm before deletion.

---

## Recommended Actions

Priority 1 — Refactor immediately (hot):
1. <action — e.g. "Split `apps/backend/src/auth/auth.service.ts:login` (CCN=24, NLOC=180) into validate → resolve → issue steps">

Priority 2 — Address this sprint (warn):
1. <action>

Priority 3 — Backlog:
1. <action>

---

## Tool Inventory Used

| Tool | Version | Group | Status |
|---|---|---|---|
```

---

## Output Format

After writing the report, respond with:

1. **Path** to `code-quality-report.md`
2. **Posture summary** — one line: `Hot: n  Warn: n  Total LOC: n  Languages: <list>`
3. **Top 5 hot-spots** — file:function, metric, value
4. **Skipped tools** — tool name and reason (not installed, no applicable files, error)
5. **Recommended immediate action** — the single highest-priority refactor
6. **Delta summary** — (only if `--diff`) New: n, Resolved: n, Persisting: n, Regressed: n

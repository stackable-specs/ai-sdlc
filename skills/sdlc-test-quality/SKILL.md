---
name: sdlc:test-quality
description: Run a multi-tool test quality assessment of a project — test density, mutation score, flakiness, order-dependence, and test smells — and consolidate findings into a single report. Trigger when the user asks for a test quality scan, mutation testing report, flaky test audit, test suite health check, or wants to know how strong the existing test suite actually is.
when_to_use: Use to produce a standalone test quality posture report for a project, or as a complement to the sdlc:5-test gate when assessing whether the test suite would actually catch regressions. Detects which test frameworks are present, activates only the applicable analyzers from the installed OSS toolset, runs them in parallel, and writes a single `test-quality-report.md` to the target directory. Do not use as a substitute for the sdlc:5-test gate's functional validation (that runs the tests) or for the sdlc:code-quality gate's complexity/maintainability scan.
argument-hint: "<target-path> [--focus density|mutation|flakiness|smells|all] [--diff] [--run-mutation]"
arguments:
  - target
  - focus
  - diff
  - run-mutation
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

# AI-SDLC Test Quality Assessment

**Artifact:** Test Quality Report → `test-quality-report.md` in the target directory
**Gate question:** Would this test suite actually catch a regression if one were introduced?

Code quality and test quality are inseparable. A high coverage number means nothing if the tests have no assertions, are order-dependent, or never fail when the code is broken. This skill probes the *effectiveness* of the test suite, not just its size.

## Inputs

- `target`: Path to the directory to analyze. Default: current working directory.
- `focus`: Optional filter — `density`, `mutation`, `flakiness`, `smells`, `e2e`, or `all` (default: `all`). Maps to groups:
  - `density` → Groups 1, 2
  - `mutation` → Groups 4, 5, 6, 7, 8
  - `flakiness` → Group 3
  - `smells` → Groups 2, 9
  - `e2e` → Group 10
  - `all` → all applicable groups
- `--diff`: If passed, and a previous `test-quality-report.md` exists in the target, load it and emit a "Changes Since Last Scan" section comparing current findings against previous ones (New / Resolved / Persisting / Regressed).
- `--run-mutation`: Opt-in flag to actually invoke mutation testing tools (Stryker, mutmut, PITest, Infection, cargo-mutants). Mutation runs are slow (often 10x–100x the test suite duration) and have side effects (compile, run, mutate, re-run). Without this flag the skill only *detects* whether mutation tooling is configured and reports the config, never running it.
- All raw arguments: $ARGUMENTS

If `target` is omitted, use the current working directory. If it does not exist, stop and report the error.

## Advisory Thresholds

These thresholds drive the "weakness" lists in the report. They are **advisory only** — the skill does not fail or block on violations.

| Metric | Threshold | Source |
|---|---|---|
| Test files / source files ratio | < 0.20 warn, < 0.10 hot | file counts per language |
| Test functions / public functions ratio | < 0.50 warn, < 0.25 hot | framework collection + AST counts |
| Assertions per test (median) | < 1 warn, == 0 hot | grep + AST per framework |
| Tests with zero assertions | > 5% warn, > 15% hot | per-framework |
| Mutation score (mutants killed / total) | < 70% warn, < 50% hot | Stryker / mutmut / PITest / Infection / cargo-mutants |
| Flaky test rate (failures w/o code change) | > 1% warn, > 5% hot | BuildPulse / Trunk / rerun analysis |
| Order-dependent tests | ≥ 1 warn, ≥ 5 hot | pytest-randomly, jest-circus shuffle |
| Open handles / leaked resources | ≥ 1 warn, ≥ 5 hot | jest --detectOpenHandles, pytest-leaks |
| Tests over 1s wall-clock (unit) | > 5% warn, > 20% hot | --durations report |
| Skipped / xfail / pending tests | > 2% warn, > 10% hot | collection report |
| E2E test count (apps with browser surface) | < 5 warn, == 0 hot | Playwright / Cypress / Selenium spec files |

A finding is **hot** when it crosses the second threshold (these go in the executive summary). A finding is **warn** when it crosses the first but not the second.

## Workflow

1. **Detect project profile** — inspect the target to determine which languages and test frameworks are present (see Detection Logic below). This drives which tool groups to activate. Only activate a group if its trigger condition is met.

2. **Check for existing report (delta mode)** — if `--diff` was passed and `<target>/test-quality-report.md` exists, read it and store its weakness list for comparison in step 5.

3. **Launch parallel analysis subagents** — spawn one Agent per active tool group. Each agent runs its tools, captures output (truncated to top N findings ordered by severity), and returns a structured findings block. Run all applicable groups concurrently.

4. **Consolidate findings** — collect all agent results and apply these deduplication rules:
   - If a test is flagged by both an order-dependence detector and a flake-history tool, list once and merge the source column.
   - Group per-test rows by file, not by tool, so the report has one row per test file unless an individual test is the finding.
   - Sort each section by severity (hot → warn → ok) then by metric value descending.

5. **Delta comparison (if --diff)** — compare current weaknesses against the previous report. Classify each as: New (not previously flagged), Resolved (previously flagged, no longer weak), Persisting (still weak), Regressed (was warn, now hot OR metric worsened by ≥ 25%). Add a "Changes Since Last Scan" section.

6. **Write the report** — produce `test-quality-report.md` in the target directory using the artifact structure below.

7. **Emit the result summary** inline.

## Detection Logic

Before spawning subagents, detect the project profile by running these commands with the resolved `<target>` path:

```bash
TARGET="<resolved-absolute-target-path>"

echo "=== Source languages present ==="
find "$TARGET" -maxdepth 6 -name "*.py" -not -path "*/node_modules/*" -not -path "*/.venv/*" -not -path "*/venv/*" | head -1
find "$TARGET" -maxdepth 6 \( -name "*.js" -o -name "*.jsx" -o -name "*.ts" -o -name "*.tsx" \) -not -path "*/node_modules/*" -not -path "*/dist/*" -not -path "*/build/*" | head -1
find "$TARGET" -maxdepth 6 -name "*.go" -not -path "*/vendor/*" | head -1
find "$TARGET" -maxdepth 6 -name "*.rb" -not -path "*/vendor/*" | head -1
find "$TARGET" -maxdepth 6 -name "*.php" -not -path "*/vendor/*" | head -1
find "$TARGET" -maxdepth 6 -name "*.java" -not -path "*/target/*" | head -1
find "$TARGET" -maxdepth 6 -name "*.kt" -not -path "*/build/*" | head -1
find "$TARGET" -maxdepth 6 -name "*.rs" -not -path "*/target/*" | head -1
find "$TARGET" -maxdepth 6 \( -name "*.cpp" -o -name "*.cc" -o -name "*.h" -o -name "*.hpp" \) | head -1
find "$TARGET" -maxdepth 6 -name "*.cs" -not -path "*/bin/*" -not -path "*/obj/*" | head -1
find "$TARGET" -maxdepth 6 -name "*.ex" -o -name "*.exs" | head -1

echo "=== Test framework configs present ==="
# Python
find "$TARGET" -maxdepth 4 \( -name "pytest.ini" -o -name "tox.ini" -o -name "pyproject.toml" -o -name "setup.cfg" \) -not -path "*/.venv/*" | head -5
# JS/TS
find "$TARGET" -maxdepth 4 \( -name "jest.config.*" -o -name "vitest.config.*" -o -name ".mocharc*" -o -name "ava.config.*" -o -name "playwright.config.*" -o -name "cypress.config.*" \) -not -path "*/node_modules/*" | head -10
# Java / Kotlin
find "$TARGET" -maxdepth 4 \( -name "pom.xml" -o -name "build.gradle*" \) -not -path "*/target/*" -not -path "*/build/*" | head -5
# .NET
find "$TARGET" -maxdepth 4 -name "*.csproj" -not -path "*/bin/*" -not -path "*/obj/*" | head -5
# Rust
find "$TARGET" -maxdepth 4 -name "Cargo.toml" -not -path "*/target/*" | head -5
# Ruby
find "$TARGET" -maxdepth 4 \( -name "Gemfile" -o -name ".rspec" \) -not -path "*/vendor/*" | head -5
# PHP
find "$TARGET" -maxdepth 4 \( -name "phpunit.xml*" -o -name "composer.json" \) -not -path "*/vendor/*" | head -5
# Go
find "$TARGET" -maxdepth 4 -name "go.mod" -not -path "*/vendor/*" | head -5

echo "=== Test file counts (rough) ==="
find "$TARGET" \( -name "*_test.go" -o -name "*test*.py" -o -name "*.test.ts" -o -name "*.test.js" -o -name "*.spec.ts" -o -name "*.spec.js" -o -name "*Test.java" -o -name "*Tests.cs" -o -name "*_spec.rb" -o -name "*Test.php" \) -not -path "*/node_modules/*" -not -path "*/vendor/*" -not -path "*/.venv/*" -not -path "*/target/*" -not -path "*/dist/*" -not -path "*/build/*" 2>/dev/null | wc -l
```

Activate groups based on findings:

- **Group 1 (test inventory baseline)** — always
- **Group 2 (test smell static analysis)** — any test file found
- **Group 3 (flakiness & order dependence)** — runnable test target detected AND `--focus flakiness` OR a flake-history artifact is present
- **Group 4 (Python test quality)** — `.py` test files found
- **Group 5 (JavaScript/TypeScript test quality)** — JS/TS test files found
- **Group 6 (Java/Kotlin test quality)** — `*Test.java`, `*Tests.kt`, or JUnit/TestNG config found
- **Group 7 (PHP test quality)** — `*Test.php` or `phpunit.xml` found
- **Group 8 (Rust / Go / .NET / C++ / Ruby / Elixir test quality)** — language-specific test artifacts found; sub-tools activate per language
- **Group 9 (Mutation testing — opt-in)** — only when `--run-mutation` is set; otherwise this group only *reports configuration status*
- **Group 10 (E2E test inventory)** — Playwright / Cypress / Selenium config found

If `--focus` is set, activate only the groups mapped to that focus value (see Inputs). Group 1 always runs because the report header needs the test inventory baseline.

---

## Subagent Tool Groups

### Group 1 — Test Inventory Baseline
**Run when:** always
**Tools:** `scc`, `find`, framework-native collection commands

**Commands:**
```bash
TARGET="<resolved-absolute-target-path>"

echo "=== Test file counts by language ==="
echo "  Python:     $(find "$TARGET" \( -name "test_*.py" -o -name "*_test.py" -o -path "*/tests/*.py" \) -not -path "*/.venv/*" -not -path "*/venv/*" 2>/dev/null | wc -l)"
echo "  JS/TS:      $(find "$TARGET" \( -name "*.test.[jt]s" -o -name "*.test.[jt]sx" -o -name "*.spec.[jt]s" -o -name "*.spec.[jt]sx" \) -not -path "*/node_modules/*" -not -path "*/dist/*" 2>/dev/null | wc -l)"
echo "  Go:         $(find "$TARGET" -name "*_test.go" -not -path "*/vendor/*" 2>/dev/null | wc -l)"
echo "  Java:       $(find "$TARGET" \( -name "*Test.java" -o -name "*Tests.java" -o -name "*IT.java" \) -not -path "*/target/*" 2>/dev/null | wc -l)"
echo "  Kotlin:     $(find "$TARGET" \( -name "*Test.kt" -o -name "*Tests.kt" \) -not -path "*/build/*" 2>/dev/null | wc -l)"
echo "  Ruby:       $(find "$TARGET" \( -name "*_spec.rb" -o -name "*_test.rb" \) -not -path "*/vendor/*" 2>/dev/null | wc -l)"
echo "  PHP:        $(find "$TARGET" -name "*Test.php" -not -path "*/vendor/*" 2>/dev/null | wc -l)"
echo "  Rust:       $(grep -rl '#\[test\]\|#\[cfg(test)\]' "$TARGET" --include='*.rs' 2>/dev/null | wc -l)"
echo "  .NET:       $(find "$TARGET" \( -name "*Tests.cs" -o -name "*Test.cs" \) -not -path "*/bin/*" 2>/dev/null | wc -l)"
echo "  C++:        $(grep -rlE 'TEST(_F|_P)?\s*\(' "$TARGET" --include='*.cpp' --include='*.cc' 2>/dev/null | wc -l)"
echo "  Elixir:     $(find "$TARGET" -name "*_test.exs" 2>/dev/null | wc -l)"

echo ""
echo "=== Source-to-test ratio (per language) ==="
# Use scc to baseline; report tests vs non-test source by language
if command -v scc >/dev/null; then
  scc --by-file "$TARGET" 2>/dev/null | head -200 > /tmp/_scc.txt
fi

echo ""
echo "=== E2E surface ==="
find "$TARGET" \( -name "playwright.config.*" -o -name "cypress.config.*" -o -name ".wdio.conf.*" \) -not -path "*/node_modules/*" 2>/dev/null
find "$TARGET" \( -path "*/e2e/*" -o -path "*/tests/e2e/*" -o -path "*/cypress/e2e/*" -o -path "*/playwright/*" \) \( -name "*.spec.*" -o -name "*.test.*" \) -not -path "*/node_modules/*" 2>/dev/null | head -20
```

**Returns:** test file counts by language, source-to-test ratio per language (using non-test SLOC vs test file count), and an inventory of E2E surface. Flag languages where the ratio is < 0.20 warn, < 0.10 hot.

---

### Group 2 — Test Smell Static Analysis
**Run when:** any test file detected
**Tools:** `grep`, `ripgrep` (rg), AST-light scans per framework

**Commands:**
```bash
TARGET="<resolved-absolute-target-path>"
RG=$(command -v rg || echo grep)

echo "=== Tests with no assertions (across frameworks) ==="
# pytest: def test_* with no assert/raises/pytest.fail in the body
$RG -n --no-heading -B0 -A20 '^\s*def\s+test_' "$TARGET" --include='*.py' 2>/dev/null \
  | python3 -c "
import sys, re
cur, body, hits = None, [], []
def flush():
    if cur and body and not re.search(r'\bassert\b|pytest\.raises|pytest\.fail|self\.assert', '\n'.join(body)):
        hits.append(cur)
for line in sys.stdin:
    m = re.match(r'^(.*?):(\d+):.*def\s+(test_\w+)', line)
    if m:
        flush(); cur=(m.group(1),m.group(2),m.group(3)); body=[]
    else:
        body.append(line)
flush()
for h in hits[:40]:
    print(f'  {h[0]}:{h[1]}  {h[2]}')
print(f'total no-assert pytest tests: {len(hits)}')
" 2>/dev/null

echo ""
echo "=== Jest/Vitest tests with no expect ==="
$RG -n --no-heading -B0 -A30 "(it|test)\(['\"]" "$TARGET" --include='*.test.*' --include='*.spec.*' 2>/dev/null \
  | python3 -c "
import sys, re
records=[]; cur=None; body=[]
def flush():
    if cur and body and 'expect(' not in '\n'.join(body) and 'assert(' not in '\n'.join(body):
        records.append(cur)
for line in sys.stdin:
    m = re.match(r'^(.+?):(\d+):.*?(?:it|test)\(\s*[\"\'](.+?)[\"\']', line)
    if m:
        flush(); cur=(m.group(1),m.group(2),m.group(3)); body=[]
    else:
        body.append(line)
flush()
for r in records[:40]:
    print(f'  {r[0]}:{r[1]}  {r[2][:60]}')
print(f'total no-expect JS tests: {len(records)}')
" 2>/dev/null

echo ""
echo "=== Disabled / pending tests ==="
$RG -n --no-heading '(\.skip\(|\.only\(|@pytest\.mark\.skip|@unittest\.skip|@Disabled|xit\(|xdescribe\(|pending\b|@Ignore)' \
  "$TARGET" --include='*.py' --include='*.js' --include='*.ts' --include='*.tsx' --include='*.jsx' \
  --include='*.java' --include='*.kt' --include='*.rb' --include='*.go' --include='*.cs' 2>/dev/null | head -80

echo ""
echo "=== Conditional logic inside tests (smell) ==="
# Tests should not branch; if/for inside test body usually signals weak coverage
$RG -n --no-heading '^\s*(if|for|while)\s+' "$TARGET" --include='*.test.ts' --include='*.test.js' --include='*.spec.ts' --include='*.spec.js' --include='*_test.py' --include='test_*.py' 2>/dev/null | head -60

echo ""
echo "=== Tests with sleep / fixed wait (flaky-by-construction) ==="
$RG -n --no-heading '(time\.sleep\(|setTimeout\(.*[0-9]{3,}|Thread\.sleep|await\s+page\.waitForTimeout|cy\.wait\(\s*[0-9])' \
  "$TARGET" --include='*test*.py' --include='*.test.*' --include='*.spec.*' --include='*Test*.java' --include='*Tests.cs' 2>/dev/null | head -40

echo ""
echo "=== Assertions-per-test density (Python) ==="
$RG -c 'assert\b|self\.assert' "$TARGET" --include='*_test.py' --include='test_*.py' 2>/dev/null | head -40

echo ""
echo "=== Assertions-per-test density (JS/TS) ==="
$RG -c 'expect\(' "$TARGET" --include='*.test.[jt]s' --include='*.test.[jt]sx' --include='*.spec.[jt]s' --include='*.spec.[jt]sx' 2>/dev/null | head -40
```

**Returns:** counts and example locations for: tests with no assertions, disabled/pending tests, conditional logic in tests, hard-coded sleeps/waits, assertion-density distribution. Flag any `*` smells crossing the advisory thresholds.

---

### Group 3 — Flakiness & Order Dependence
**Run when:** runnable test target detected AND `--focus flakiness` was passed, OR a flake-history artifact (`flake-history.json`, `.flake-cache/`, BuildPulse / Trunk export) is present
**Tools:** `pytest-randomly`, `pytest-flakefinder`, `jest --detectOpenHandles`, Mocha `--shuffle`, Go `-race`

**Detection-only mode** (default — does not run tests):
```bash
TARGET="<resolved-absolute-target-path>"

echo "=== Flake / order-dependence plugins configured ==="
# Python
$RG --no-heading 'pytest-randomly|pytest-flakefinder|pytest-rerunfailures|pytest-repeat' \
  "$TARGET" --include='pyproject.toml' --include='setup.cfg' --include='requirements*.txt' --include='Pipfile*' --include='poetry.lock' 2>/dev/null | head -20

# JS/TS
$RG --no-heading 'detectOpenHandles|--shuffle|jest-circus|stryker|--randomize' \
  "$TARGET" --include='package.json' --include='jest.config.*' --include='vitest.config.*' --include='.mocharc*' --include='ava.config.*' 2>/dev/null | head -20

# Go
$RG --no-heading 'go test.*-race' "$TARGET" --include='Makefile' --include='*.mk' --include='*.yml' --include='*.yaml' 2>/dev/null | head -20

echo ""
echo "=== Flake-history artifacts ==="
for P in "$TARGET/flake-history.json" "$TARGET/.flake-cache" "$TARGET/buildpulse.json" "$TARGET/trunk-flaky.json" "$TARGET/.launchable"; do
  [ -e "$P" ] && echo "  found: $P"
done
```

**Optional-run mode** (only when `--focus flakiness` is set; one warm-up + one randomized run, with a hard timeout):
```bash
TARGET="<resolved-absolute-target-path>"

# Python — collect twice with random ordering and compare pass/fail sets
if command -v pytest >/dev/null && [ -f "$TARGET/pyproject.toml" -o -f "$TARGET/pytest.ini" -o -f "$TARGET/setup.cfg" ]; then
  echo "=== pytest run #1 (baseline) ==="
  (cd "$TARGET" && timeout 300 pytest -p no:cacheprovider --tb=no -q 2>&1 | tail -20)
  echo "=== pytest run #2 (randomized) ==="
  (cd "$TARGET" && timeout 300 pytest -p no:cacheprovider --tb=no -q -p randomly 2>&1 | tail -20) || true
fi

# JS — Jest open-handle detection
if [ -f "$TARGET/package.json" ] && grep -q '"jest"' "$TARGET/package.json"; then
  echo "=== jest --detectOpenHandles ==="
  (cd "$TARGET" && timeout 300 npx --no-install jest --detectOpenHandles --silent 2>&1 | tail -30) || true
fi

# Go — race detector
if find "$TARGET" -name "*_test.go" -not -path "*/vendor/*" | head -1 | grep -q .; then
  echo "=== go test -race (short) ==="
  (cd "$TARGET" && timeout 300 go test -race -short ./... 2>&1 | tail -30) || true
fi
```

**Returns:** count of order-dependent tests (passed in run #1, failed in run #2 with no code change between), count of open handles / leaked goroutines, list of tests over 1s wall-clock from `--durations` output. Flag ≥ 1 order-dependent test as warn, ≥ 5 as hot.

**External flake-history platforms** (reference only — these need API keys, so the skill does **not** auto-call them):
- **BuildPulse** — flaky test detection across CI runs
- **Trunk Flaky Tests** — flaky test management with quarantine
- **Launchable** — predictive test selection
- **Knapsack Pro** — test splitting for CI speed (not flake detection per se, but its data exposes order-dependent splits)

If any of these platforms' config files are detected (`buildpulse.yml`, `trunk.yaml`, `.launchable/`, `.knapsack-pro.json`), note this in the report as "external flake telemetry configured — fetch flake report from <platform> for full picture."

---

### Group 4 — Python Test Quality
**Run when:** Python test files detected
**Tools:** `pytest --collect-only`, `pytest --durations`, `coverage`, `mutmut` / `cosmic-ray` (config-only unless `--run-mutation`)

**Commands:**
```bash
TARGET="<resolved-absolute-target-path>"

if command -v pytest >/dev/null; then
  echo "=== pytest collection ==="
  (cd "$TARGET" && timeout 60 pytest --collect-only -q 2>&1 | tail -30) || true

  echo "=== pytest slowest tests ==="
  (cd "$TARGET" && timeout 60 pytest --collect-only -q --no-header 2>&1 | wc -l) || true
  # Real durations only if the user has opted into running tests
  if [ "$RUN_MUTATION_OR_TESTS" = "1" ]; then
    (cd "$TARGET" && timeout 300 pytest --durations=20 -q 2>&1 | tail -40) || true
  fi
fi

echo "=== Mutation testing config (mutmut / cosmic-ray) ==="
$RG --no-heading 'mutmut|cosmic-ray|cosmic_ray' "$TARGET" \
  --include='pyproject.toml' --include='setup.cfg' --include='.mutmut*' --include='cosmic-ray.toml' 2>/dev/null | head -10

# --run-mutation gated
if [ "$RUN_MUTATION" = "1" ] && command -v mutmut >/dev/null; then
  echo "=== mutmut run (this is slow) ==="
  (cd "$TARGET" && timeout 1800 mutmut run --no-progress 2>&1 | tail -10) || true
  (cd "$TARGET" && mutmut results 2>&1 | head -30) || true
fi
```

**Returns:** test counts (collected, deselected, skipped, xfail), slowest tests, mutation config status. If `--run-mutation`, mutation score (killed / surviving / no-tests). Flag mutation score < 70% warn, < 50% hot.

---

### Group 5 — JavaScript/TypeScript Test Quality
**Run when:** JS/TS test files detected
**Tools:** Jest / Vitest / Mocha / AVA detection, `stryker` (config-only unless `--run-mutation`), `jest --detectOpenHandles` (Group 3)

**Commands:**
```bash
TARGET="<resolved-absolute-target-path>"

echo "=== Runner detected ==="
for CFG in jest.config vitest.config .mocharc ava.config; do
  find "$TARGET" -maxdepth 4 -name "${CFG}*" -not -path "*/node_modules/*" 2>/dev/null | head -3
done
grep -E '"jest"|"vitest"|"mocha"|"ava"' "$TARGET/package.json" 2>/dev/null | head -10

echo ""
echo "=== Mutation testing config (Stryker) ==="
find "$TARGET" -maxdepth 4 \( -name "stryker.conf.*" -o -name ".stryker.conf.*" -o -name "stryker.config.*" \) -not -path "*/node_modules/*" 2>/dev/null | head -5
$RG --no-heading '@stryker-mutator' "$TARGET/package.json" 2>/dev/null

echo ""
echo "=== Test runner self-report (Jest/Vitest --listTests) ==="
if [ -f "$TARGET/package.json" ]; then
  if grep -q '"vitest"' "$TARGET/package.json"; then
    (cd "$TARGET" && timeout 60 npx --no-install vitest list 2>&1 | tail -30) || true
  elif grep -q '"jest"' "$TARGET/package.json"; then
    (cd "$TARGET" && timeout 60 npx --no-install jest --listTests 2>&1 | wc -l) || true
  fi
fi

# --run-mutation gated
if [ "$RUN_MUTATION" = "1" ] && [ -f "$TARGET/package.json" ]; then
  if find "$TARGET" -maxdepth 4 -name "stryker.conf*" -not -path "*/node_modules/*" | head -1 | grep -q .; then
    echo "=== Stryker mutation run (slow) ==="
    (cd "$TARGET" && timeout 1800 npx --no-install stryker run --reporters json,clear-text 2>&1 | tail -30) || true
  fi
fi
```

**Returns:** runner name + version, total test file count, mutation config status, and (if `--run-mutation`) Stryker mutation score with surviving-mutant hot-spots.

---

### Group 6 — Java / Kotlin Test Quality
**Run when:** `*Test.java`, `*Tests.kt`, or JUnit/TestNG config detected
**Tools:** Maven Surefire / Gradle test report parser, `PITest` (config-only unless `--run-mutation`)

**Commands:**
```bash
TARGET="<resolved-absolute-target-path>"

echo "=== JUnit / TestNG detection ==="
$RG --no-heading 'junit|org.testng|kotest' "$TARGET" --include='pom.xml' --include='build.gradle*' 2>/dev/null | head -10

echo "=== Existing Surefire / Gradle test reports ==="
find "$TARGET" -type d \( -path "*/surefire-reports" -o -path "*/test-results/test" -o -path "*/build/reports/tests/*" \) 2>/dev/null | head -10

# Parse existing JUnit XML reports if present
python3 -c "
import os, glob, xml.etree.ElementTree as ET
roots = ['$TARGET']
files = []
for r in roots:
    files += glob.glob(r + '/**/surefire-reports/TEST-*.xml', recursive=True)
    files += glob.glob(r + '/**/test-results/**/TEST-*.xml', recursive=True)
tot=fail=err=skip=0
for f in files[:500]:
    try:
        e = ET.parse(f).getroot()
        tot += int(e.attrib.get('tests',0))
        fail += int(e.attrib.get('failures',0))
        err += int(e.attrib.get('errors',0))
        skip += int(e.attrib.get('skipped',0))
    except Exception:
        pass
print(f'JUnit XML rollup: tests={tot} failures={fail} errors={err} skipped={skip}')
" 2>/dev/null

echo ""
echo "=== PITest configuration ==="
$RG --no-heading 'pitest|org.pitest' "$TARGET" --include='pom.xml' --include='build.gradle*' 2>/dev/null | head -10

# --run-mutation gated
if [ "$RUN_MUTATION" = "1" ]; then
  if [ -f "$TARGET/pom.xml" ] && grep -q pitest "$TARGET/pom.xml"; then
    echo "=== PITest run (slow) ==="
    (cd "$TARGET" && timeout 1800 mvn -B org.pitest:pitest-maven:mutationCoverage 2>&1 | tail -30) || true
  fi
fi
```

**Returns:** runner config, JUnit XML rollup (total / failed / errored / skipped), PITest config status, and (if `--run-mutation`) PITest mutation score.

---

### Group 7 — PHP Test Quality
**Run when:** `*Test.php` or `phpunit.xml` detected
**Tools:** `phpunit --list-tests`, `phpunit-coverage` artifact reader, `infection` (config-only unless `--run-mutation`)

**Commands:**
```bash
TARGET="<resolved-absolute-target-path>"

echo "=== PHPUnit config ==="
find "$TARGET" -maxdepth 3 -name "phpunit.xml*" -not -path "*/vendor/*" 2>/dev/null | head -3

echo "=== Infection config ==="
find "$TARGET" -maxdepth 3 -name "infection.json*" -not -path "*/vendor/*" 2>/dev/null | head -3
$RG --no-heading 'infection/infection' "$TARGET/composer.json" 2>/dev/null

if command -v phpunit >/dev/null && find "$TARGET" -maxdepth 3 -name "phpunit.xml*" | head -1 | grep -q .; then
  echo "=== phpunit --list-tests ==="
  (cd "$TARGET" && timeout 60 phpunit --list-tests 2>&1 | tail -30) || true
fi

if [ "$RUN_MUTATION" = "1" ] && command -v infection >/dev/null; then
  echo "=== Infection mutation run (slow) ==="
  (cd "$TARGET" && timeout 1800 infection --threads=4 --min-msi=0 2>&1 | tail -30) || true
fi
```

**Returns:** PHPUnit + Infection config status, test list, and (if `--run-mutation`) Infection Mutation Score Indicator (MSI).

---

### Group 8 — Rust / Go / .NET / C++ / Ruby / Elixir Test Quality
**Run when:** language-specific test artifacts detected; sub-tools activate per language

**Commands:**
```bash
TARGET="<resolved-absolute-target-path>"

# --- Rust ---
if find "$TARGET" -name "Cargo.toml" -not -path "*/target/*" | head -1 | grep -q .; then
  echo "=== Rust test count (#[test] markers) ==="
  grep -rc '#\[test\]' "$TARGET" --include='*.rs' 2>/dev/null | awk -F: '{s+=$2} END {print "  total #[test]: "s}'
  echo "=== cargo-mutants config ==="
  $RG --no-heading 'cargo-mutants|\[mutants\]' "$TARGET" --include='Cargo.toml' --include='.cargo/config*' 2>/dev/null | head -5
  if [ "$RUN_MUTATION" = "1" ] && command -v cargo-mutants >/dev/null; then
    echo "=== cargo-mutants run (very slow) ==="
    (cd "$TARGET" && timeout 1800 cargo mutants --no-shuffle 2>&1 | tail -30) || true
  fi
fi

# --- Go ---
if find "$TARGET" -name "*_test.go" -not -path "*/vendor/*" | head -1 | grep -q .; then
  echo "=== Go test inventory ==="
  grep -rE '^func (Test|Benchmark|Example|Fuzz)' "$TARGET" --include='*_test.go' 2>/dev/null \
    | awk -F: '{print $3}' | awk '{print $2}' | sed 's/(.*//' | sort | uniq -c | sort -rn | head -20
  echo "=== Test types ==="
  echo "  Test*       $(grep -rE '^func Test'      "$TARGET" --include='*_test.go' 2>/dev/null | wc -l)"
  echo "  Benchmark*  $(grep -rE '^func Benchmark' "$TARGET" --include='*_test.go' 2>/dev/null | wc -l)"
  echo "  Example*    $(grep -rE '^func Example'   "$TARGET" --include='*_test.go' 2>/dev/null | wc -l)"
  echo "  Fuzz*       $(grep -rE '^func Fuzz'      "$TARGET" --include='*_test.go' 2>/dev/null | wc -l)"
  # Ginkgo
  $RG --no-heading 'github\.com/onsi/ginkgo' "$TARGET/go.sum" 2>/dev/null | head -3
fi

# --- .NET ---
if find "$TARGET" -name "*.csproj" -not -path "*/bin/*" -not -path "*/obj/*" | head -1 | grep -q .; then
  echo "=== .NET test framework references ==="
  $RG --no-heading 'xunit|nunit|MSTest' "$TARGET" --include='*.csproj' 2>/dev/null | head -10
  # Stryker.NET config
  find "$TARGET" -maxdepth 4 -name "stryker-config.*" -not -path "*/bin/*" 2>/dev/null | head -3
fi

# --- C++ ---
if find "$TARGET" \( -name "*.cpp" -o -name "*.cc" \) | head -1 | grep -q .; then
  echo "=== C++ test framework signatures ==="
  echo "  GoogleTest TEST/TEST_F:  $(grep -rE 'TEST(_F|_P)?\s*\(' "$TARGET" --include='*.cpp' --include='*.cc' 2>/dev/null | wc -l)"
  echo "  Catch2 TEST_CASE:        $(grep -rE 'TEST_CASE\s*\(' "$TARGET" --include='*.cpp' --include='*.cc' 2>/dev/null | wc -l)"
fi

# --- Ruby ---
if find "$TARGET" \( -name "*_spec.rb" -o -name "*_test.rb" \) -not -path "*/vendor/*" | head -1 | grep -q .; then
  echo "=== Ruby test framework signals ==="
  echo "  RSpec describe/it: $(grep -rE '^\s*(describe|it|context)\s+' "$TARGET" --include='*_spec.rb' 2>/dev/null | wc -l)"
  echo "  Minitest tests:    $(grep -rE 'def\s+test_|class\s+\w+\s+<\s+Minitest' "$TARGET" --include='*_test.rb' 2>/dev/null | wc -l)"
fi

# --- Elixir ---
if find "$TARGET" -name "*_test.exs" 2>/dev/null | head -1 | grep -q .; then
  echo "=== ExUnit ==="
  echo "  test \"...\" blocks: $(grep -rE '^\s*test\s+\"' "$TARGET" --include='*_test.exs' 2>/dev/null | wc -l)"
fi
```

**Returns:** per-language test inventories (test counts, sub-categories like benchmarks/fuzz/examples in Go, GoogleTest vs Catch2 in C++), and mutation-tool config status per language.

---

### Group 9 — Mutation Testing (opt-in execution)
**Run when:** `--run-mutation` is set, AND at least one mutation tool's config is detected
**Tools:** `mutmut`, `cosmic-ray`, `stryker`, `pitest`, `infection`, `cargo-mutants`

**Philosophy:** Mutation testing is the most direct way to detect weak tests: introduce small code changes (mutations) and confirm that at least one test fails. A high coverage % with a low mutation score means tests execute the code but don't actually verify behavior.

**Run requirements:**
- Each tool runs with a 30-minute timeout per language.
- Run with `--no-progress` / equivalent silent flags; the report only needs the final score and the top surviving mutants.
- Never run mutation testing against production data or networked test suites.
- Skip if `--run-mutation` is not set; only emit "configured" status.

**Tool inventory:**

| Language | Tool | Score metric |
|---|---|---|
| Python | mutmut | killed / (killed + survived) |
| Python | Cosmic Ray | as above (more configurable, slower) |
| JS / TS / .NET / Scala | Stryker | mutation score (MS) % |
| Java / Kotlin | PITest | mutation score % |
| PHP | Infection | Mutation Score Indicator (MSI) % |
| Rust | cargo-mutants | caught / (caught + missed) |

**Commands** (each tool's run command is in the language-specific group above; this group is the consolidation step).

**Returns per language:** mutation score, count of surviving mutants, top 10 surviving-mutant locations (file:line, mutation operator, original → mutated). Flag MS < 70% warn, < 50% hot.

**Surviving mutants are the actionable output** — these are the exact lines where a code change would not be caught by any test. Surface them in the Recommended Actions section.

---

### Group 10 — E2E Test Inventory
**Run when:** Playwright / Cypress / Selenium / WebdriverIO config detected
**Tools:** `playwright test --list`, `cypress run --list` (if available), file-based discovery

**Commands:**
```bash
TARGET="<resolved-absolute-target-path>"

echo "=== Playwright ==="
find "$TARGET" -maxdepth 4 -name "playwright.config.*" -not -path "*/node_modules/*" 2>/dev/null | head -3
PW_SPECS=$(find "$TARGET" \( -path "*/e2e/*.spec.*" -o -path "*/playwright/*.spec.*" -o -path "*/tests/*.spec.*" \) -not -path "*/node_modules/*" 2>/dev/null | wc -l)
echo "  spec files: $PW_SPECS"
# test() / test.describe() count
PW_TESTS=$($RG --no-heading -c 'test\(' "$TARGET" --glob '*.spec.ts' --glob '*.spec.js' 2>/dev/null | awk -F: '{s+=$2} END {print s}')
echo "  test() calls: ${PW_TESTS:-0}"

echo ""
echo "=== Cypress ==="
find "$TARGET" -maxdepth 4 -name "cypress.config.*" -not -path "*/node_modules/*" 2>/dev/null | head -3
CY_SPECS=$(find "$TARGET" -path "*/cypress/e2e/*" \( -name "*.cy.*" -o -name "*.spec.*" \) -not -path "*/node_modules/*" 2>/dev/null | wc -l)
echo "  spec files: $CY_SPECS"

echo ""
echo "=== Selenium / WebdriverIO ==="
find "$TARGET" -maxdepth 4 \( -name ".wdio.conf.*" -o -name "wdio.conf.*" \) -not -path "*/node_modules/*" 2>/dev/null | head -3
$RG --no-heading 'selenium-webdriver|webdriver\.io|@wdio' "$TARGET" --include='package.json' 2>/dev/null | head -5

echo ""
echo "=== Browser surface coverage hint ==="
# How many UI routes exist vs how many E2E specs?
ROUTES=$($RG --no-heading -c 'createBrowserRouter|<Route\s|Routes>|router\.push\(|router\.replace\(' \
  "$TARGET" --include='*.tsx' --include='*.jsx' 2>/dev/null | awk -F: '{s+=$2} END {print s}')
echo "  route-like references: ${ROUTES:-0}"
echo "  E2E spec files: $((PW_SPECS + CY_SPECS))"
```

**Returns:** E2E framework presence, spec file counts, total `test()` block count, and a "browser surface coverage hint" comparing route count to spec count. Flag `0` E2E specs in a project with > 5 routes as hot.

---

## Consolidation Instructions

- Replace `<target>` / `<resolved-absolute-target-path>` with the actual absolute path in every command before running.
- Each subagent runs independently — do not wait for other agents.
- **Deduplication priority:**
  - Same test flagged by both order-dependence and flake-history → keep one row, merge tool list.
  - One row per test file in the "Test files at risk" table.
  - For mutation findings, surface per-mutant rows (file:line + mutation operator), not per-file aggregates — that is the actionable level.
- If a tool is not installed, skip it and record it in the "Tools skipped" table.
- If a tool errors or times out, capture the error, skip, and note it.
- Do not modify any files in the target directory except writing `test-quality-report.md`.
- Never run tests or mutation tooling without explicit `--run-mutation` opt-in.
- Never run network-active tools or anything that requires authentication.

---

## Artifact Structure

```markdown
# Test Quality Report

**Target:** <path>
**Date:** <ISO date>
**Tools run:** <comma-separated list with versions>
**Tools skipped:** <list with reason>
**Mutation testing:** <run / configured but not run / not configured>

---

## Executive Summary

| Bucket | Hot | Warn | OK |
|---|---|---|---|
| Test density (tests vs source) | n | n | n |
| Assertion density | n | n | n |
| Tests with zero assertions | n | n | n |
| Disabled / pending tests | n | n | n |
| Order-dependent tests | n | n | n |
| Open handles / leaks | n | n | n |
| Mutation score | n | n | n |
| E2E coverage of UI surface | n | n | n |

**Overall posture:** [Critical weakness / High risk / Moderate / Healthy]

**Top 5 weaknesses:**
1. <file:test — issue — value>
2. ...

---

## Test Inventory Baseline

| Language | Source files | Test files | Ratio | Status |
|---|---|---|---|---|

**E2E surface:**
| Framework | Config | Spec files | test() blocks |
|---|---|---|---|

---

## Changes Since Last Scan
*(only present when --diff is passed and a previous report exists)*

| Status | Finding | Was | Now |
|---|---|---|---|
| New | <test-file — metric> | — | hot |
| Resolved | <test-file — metric> | hot | ok |
| Persisting | <test-file — metric> | hot | hot |
| Regressed | <test-file — metric> | warn | hot |

---

## Test Smells

### Tests with no assertions
| # | File | Test name | Framework | Severity |
|---|---|---|---|---|

### Disabled / pending tests
| # | File | Test name | Reason | Severity |
|---|---|---|---|---|

### Conditional logic inside tests
| # | File | Test name | Construct | Severity |
|---|---|---|---|---|

### Hard-coded sleeps / waits
| # | File | Line | Construct | Severity |
|---|---|---|---|---|

### Assertion density
| Framework | Tests | Median asserts/test | Tests with 0 asserts | Severity |
|---|---|---|---|---|

---

## Flakiness & Order Dependence

**Order-dependent tests:** n (passed in run A, failed in run B; no code change)
**Open handles / leaks:** n
**Tests over 1s wall-clock:** n / N
**External flake telemetry:** <BuildPulse / Trunk / Launchable / none>

| # | File | Test | Issue | Source |
|---|---|---|---|---|

---

## Mutation Testing

| Language | Tool | Mutants | Killed | Survived | Score | Severity |
|---|---|---|---|---|---|---|

### Top surviving mutants
| # | File | Line | Operator | Original → Mutated | Test file that should have caught it |
|---|---|---|---|---|---|

---

## E2E Test Coverage

| Framework | Spec files | test() blocks | Status |
|---|---|---|---|

**Browser surface coverage hint:** <n routes> vs <m E2E specs> — <verdict>

---

## Recommended Actions

Priority 1 — Address immediately (hot):
1. <action — e.g. "Add ≥ 1 expect() to `apps/frontend/tests/TodoItem.test.tsx::renders empty state`">

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

1. **Path** to `test-quality-report.md`
2. **Posture summary** — one line: `Hot: n  Warn: n  Test files: n  Mutation score: n%  Languages: <list>`
3. **Top 5 weaknesses** — file:test, issue, value
4. **Skipped tools** — tool name and reason (not installed, no applicable files, mutation not opted in, error)
5. **Recommended immediate action** — the single highest-priority test to fix or add
6. **Delta summary** — (only if `--diff`) New: n, Resolved: n, Persisting: n, Regressed: n

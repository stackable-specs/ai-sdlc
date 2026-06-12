---
name: sdlc:secops
description: Run a comprehensive multi-agent security assessment of a project using the full DevSecOps CLI tool inventory. Trigger when the user asks for a security scan, security audit, secops assessment, or wants to understand the security posture of a project or directory.
when_to_use: Use when performing a standalone security assessment outside the normal SDLC gate flow, or as a deep-dive complement to the sdlc:6-security gate. Runs the installed tool suite (SAST, SCA, secrets, IaC, containers, SBOM, supply chain, Kubernetes) against a target directory and consolidates findings into a single report. Do not use as a substitute for code review or runtime penetration testing.
argument-hint: "<target-path> [--focus secrets|sast|sca|iac|containers|k8s|all] [--diff] [--output <path>]"
arguments:
  - target
  - focus
  - diff
  - output
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

# AI-SDLC SecOps Assessment

**Artifact:** Security Assessment Report → `secops-report.md` in the target directory by default, or at the path passed via `--output` (used by `/sdlc:6-security` to land the report under `.sdlc/runs/<slug>/`).
**Gate question:** What is the security posture of this project right now?

## Inputs

- `target`: Path to the directory to scan. Default: current working directory.
- `focus`: Optional filter — `secrets`, `sast`, `sca`, `iac`, `containers`, `k8s`, or `all` (default: `all`). Maps to groups:
  - `secrets` → Group 1
  - `sast` → Group 2
  - `sca` → Group 3
  - `iac` → Groups 4, 5, 6
  - `containers` → Groups 5, 6
  - `k8s` → Group 7
  - `all` → all groups
- `--diff`: If passed, and a previous `secops-report.md` exists in the target, load it and emit a "Changes Since Last Scan" section comparing new findings against old ones (New / Resolved / Persisting).
- `--output <path>`: Optional. Absolute or repo-relative path where the report should be written. If omitted, defaults to `<target>/secops-report.md`. When invoked from `/sdlc:6-security`, the caller passes `--output .sdlc/runs/<slug>/06-secops-report.md` so the report lives alongside the gate artifacts. Create parent directories if missing. For `--diff`, look for the previous report at this same `--output` path before falling back to `<target>/secops-report.md`.
- All raw arguments: $ARGUMENTS

If `target` is omitted, use the current working directory. If it does not exist, stop and report the error.

## Workflow

1. **Detect project profile** — inspect the target to determine tech stack, languages, Dockerfiles, IaC files, Kubernetes manifests, package manifests, GitHub Actions workflows. This drives which tool groups to activate. Only activate a group if its trigger condition is met.

2. **Check for existing report (delta mode)** — if `--diff` was passed, read the previous report at `--output` (if set) or `<target>/secops-report.md` and store its finding list for comparison in step 5.

3. **Launch parallel scanning subagents** — spawn one Agent per active tool group. Each agent runs its tools, captures output (truncated to key findings), and returns a structured findings block. Run all applicable groups concurrently.

4. **Consolidate findings** — collect all agent results. Apply these deduplication rules before assigning severity:
   - If the same file/line is flagged by two or more tools for the same issue, keep the highest-confidence instance and note which other tools corroborated.
   - If the same check type fails across multiple resources (e.g., `runAsNonRoot` missing on 4 K8s workloads), collapse into **one finding** with a resource list and count rather than N identical rows. This prevents a single class of misconfiguration from dominating the severity table.
   - Assign unified severity: Critical = exploitable, no user interaction; High = likely exploitable; Medium = exploitable under conditions; Low = defense-in-depth; Info = no direct risk.
   - Sort findings by severity descending.

5. **Delta comparison (if --diff)** — compare consolidated findings against the previous report. Classify each as: New (not in previous), Resolved (in previous, not in current), or Persisting (in both). Add a "Changes Since Last Scan" section to the report.

6. **Write the report** — write to the `--output` path if provided, otherwise `<target>/secops-report.md`. Create parent directories if they do not exist. Use the artifact structure below.

7. **Emit the result summary** inline.

## Subagent Tool Groups

### Group 1 — Secrets & Credential Scanning
**Run when:** always  
**Tools:** `gitleaks`, `trufflehog`, `detect-secrets`  
**Commands:**
```bash
TARGET="<resolved-absolute-target-path>"

gitleaks detect --source "$TARGET" --no-git --report-format json 2>/dev/null \
  | python3 -c "import sys,json; r=json.load(sys.stdin); [print(s['Description'], s['File'], s['StartLine'], s.get('Secret','')[:20]) for s in r]" 2>/dev/null \
  || echo "gitleaks: not installed"

trufflehog filesystem "$TARGET" --json --no-update 2>/dev/null | head -200 \
  || echo "trufflehog: not installed"

detect-secrets scan "$TARGET" 2>/dev/null \
  || echo "detect-secrets: not installed"

# Also check git history if .git is present at or above target
GIT_ROOT=$(git -C "$TARGET" rev-parse --show-toplevel 2>/dev/null)
if [ -n "$GIT_ROOT" ]; then
  gitleaks detect --source "$GIT_ROOT" --report-format json 2>/dev/null \
    | python3 -c "import sys,json; r=json.load(sys.stdin); print(f'git history: {len(r)} secrets')" 2>/dev/null
fi
```
**Returns:** list of detected secrets with file, line, type, verified status, and whether found in working tree vs git history.

---

### Group 2 — SAST (Static Application Security Testing)
**Run when:** source code detected (`.py`, `.js`, `.ts`, `.go`, `.rb`, `.java`, etc.)  
**Tools:** `semgrep`, language-specific (`bandit` for Python, `gosec` for Go, `brakeman` for Ruby)  
**Commands:**
```bash
TARGET="<resolved-absolute-target-path>"

semgrep scan --config auto "$TARGET" --json --quiet --timeout 120 2>/dev/null \
  | python3 -c "
import sys, json
try:
    r = json.load(sys.stdin)
    results = r.get('results', [])
    print(f'semgrep: {len(results)} findings')
    for f in results[:60]:
        print(f['check_id'], f['path'], f['start']['line'], f['extra']['severity'])
except Exception as e:
    print(f'semgrep error: {e}')
" 2>/dev/null || echo "semgrep: not installed"

# Python
bandit -r "$TARGET" -f json -q 2>/dev/null \
  | python3 -c "import sys,json; r=json.load(sys.stdin); [print(i['issue_severity'], i['filename'], i['line_number'], i['issue_text']) for i in r.get('results',[])]" 2>/dev/null

# Go
gosec -fmt json ./... 2>/dev/null | head -80
```

**Manual authorization and security pattern checks (agent must perform these in addition to tool output):**

The agent MUST grep the source tree for the following patterns and report any hits:

```bash
# Hardcoded secret fallbacks (e.g. ?? 'dev-secret', || 'default')
grep -rn --include="*.ts" --include="*.js" --include="*.py" --include="*.go" \
  -E "(\?\?|or|OrElse|default|fallback)[[:space:]]*['\"][^'\"]{4,}['\"]" \
  "$TARGET" --exclude-dir=node_modules --exclude-dir=.git | grep -i "secret\|password\|key\|token" | head -20

# Missing auth guards / ownership enforcement — queries with no user/owner filter
grep -rn --include="*.ts" --include="*.js" \
  -E "(find|findOne|findAll|query|select)\s*\(" \
  "$TARGET" --exclude-dir=node_modules | grep -v "userId\|ownerId\|user_id\|owner_id\|req\.user" | head -20

# JWT verification disabled or bypassable
grep -rn --include="*.ts" --include="*.js" \
  -E "ignoreExpiration|algorithms.*none|verify.*false|jwt\.decode" \
  "$TARGET" --exclude-dir=node_modules | head -10

# XSS sinks
grep -rn --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" \
  -E "dangerouslySetInnerHTML|innerHTML\s*=|document\.write\(|eval\(" \
  "$TARGET" --exclude-dir=node_modules | head -10

# SQL injection patterns
grep -rn --include="*.ts" --include="*.js" \
  -E "query\s*\(\s*['\"\`][^\)]*\$\{|execute\s*\(\s*['\"\`][^\)]*\$\{" \
  "$TARGET" --exclude-dir=node_modules | head -10

# Unconditional admin/debug endpoints
grep -rn --include="*.ts" --include="*.js" \
  -E "@Get\(['\"]/admin|@Post\(['\"]/admin|swagger|enableCors\(\)" \
  "$TARGET" --exclude-dir=node_modules | head -10
```

**Returns:** semgrep findings + manual pattern hits, each with: tool/method, file, line, severity, description. Flag any query that retrieves data without scoping to an authenticated user ID as a potential IDOR (High).

---

### Group 3 — SCA (Software Composition Analysis / Dependency Vulnerabilities)
**Run when:** package manifests detected (`package.json`, `requirements.txt`, `go.mod`, `Gemfile`, `Cargo.toml`, `pom.xml`, etc.)  
**Tools:** `osv-scanner`, `grype`, `pnpm audit` (pnpm workspaces), `npm audit`, `pip-audit` (Python), `cargo-audit` (Rust), `bundler-audit` (Ruby)  
**Commands:**
```bash
TARGET="<resolved-absolute-target-path>"

# Prefer pnpm audit when pnpm-lock.yaml is present (workspace-aware)
if [ -f "$TARGET/pnpm-lock.yaml" ]; then
  cd "$TARGET" && pnpm audit --json 2>/dev/null | python3 -c "
import sys, json
try:
    r = json.load(sys.stdin)
    vulns = r.get('vulnerabilities', {})
    print(f'pnpm audit: {len(vulns)} packages affected')
    for name, v in list(vulns.items())[:40]:
        print(f'{v[\"severity\"].upper()}: {name} {v.get(\"range\",\"\")} fix={v.get(\"fixAvailable\",False)}')
except Exception as e:
    print(f'pnpm audit: {e}')
  " 2>/dev/null || echo "pnpm audit: error"
else
  cd "$TARGET" && npm audit --json 2>/dev/null | python3 -c "
import sys, json
try:
    r = json.load(sys.stdin)
    vulns = r.get('vulnerabilities', {})
    for name, v in list(vulns.items())[:40]:
        print(f'{v[\"severity\"].upper()}: {name}@{v.get(\"range\",\"\")}')
except Exception as e:
    print(f'npm audit: {e}')
  " 2>/dev/null || echo "npm audit: error"
fi

osv-scanner --recursive "$TARGET" 2>/dev/null | head -100 || echo "osv-scanner: not installed"
grype dir:"$TARGET" --quiet 2>/dev/null | head -100 || echo "grype: not installed"

# Python
[ -f "$TARGET/requirements.txt" ] && pip-audit --requirement "$TARGET/requirements.txt" --format json 2>/dev/null \
  | python3 -c "import sys,json; r=json.load(sys.stdin); [print(v['id'], d['name'], d['version']) for d in r.get('dependencies',[]) for v in d.get('vulns',[])]" 2>/dev/null

# Rust
[ -f "$TARGET/Cargo.lock" ] && cargo audit --file "$TARGET/Cargo.lock" --json 2>/dev/null | head -60

# Ruby
[ -f "$TARGET/Gemfile.lock" ] && bundler-audit check --gemfile-lock "$TARGET/Gemfile.lock" 2>/dev/null
```
**Returns:** CVE/GHSA ID, package, installed version, fixed version, severity, CVSS score, dependency path.  
**Note:** `pnpm audit` is preferred over `npm audit` for pnpm workspaces. `tar`, `undici`, and similar transitive build-tool deps may not be present in the runtime Docker image — note their dep path so the caller can verify with `pnpm why <pkg>`.

---

### Group 4 — SBOM Generation
**Run when:** always (produces an artifact)  
**Tools:** `syft`, `cdxgen`  
**Commands:**
```bash
TARGET="<resolved-absolute-target-path>"
SBOM_OUT="/tmp/sbom-$(basename $TARGET).json"

syft "$TARGET" -o json 2>/dev/null | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    arts = d.get('artifacts', [])
    ecosystems = {}
    for a in arts:
        eco = a.get('type', 'unknown')
        ecosystems[eco] = ecosystems.get(eco, 0) + 1
    print(f'syft: {len(arts)} components')
    for eco, count in sorted(ecosystems.items(), key=lambda x: -x[1]):
        print(f'  {eco}: {count}')
except Exception as e:
    print(f'syft error: {e}')
" 2>/dev/null || echo "syft: not installed"

# cdxgen: try auto first; fall back to nodejs if pnpm workspace detected and result is empty
cdxgen -t auto "$TARGET" -o "$SBOM_OUT" --quiet 2>/dev/null

COMP_COUNT=$(python3 -c "
import json
try:
    d = json.load(open('$SBOM_OUT'))
    print(len(d.get('components', [])))
except:
    print(0)
" 2>/dev/null || echo "0")

if [ "$COMP_COUNT" -eq "0" ] && [ -f "$TARGET/pnpm-workspace.yaml" ]; then
  echo "cdxgen auto returned 0 components (pnpm workspace); retrying with -t nodejs"
  cdxgen -t nodejs "$TARGET" -o "$SBOM_OUT" --quiet 2>/dev/null
  COMP_COUNT=$(python3 -c "import json; print(len(json.load(open('$SBOM_OUT')).get('components', [])))" 2>/dev/null || echo "0")
fi

echo "cdxgen: $COMP_COUNT components -> $SBOM_OUT"
```
**Returns:** component count by ecosystem; path to CycloneDX SBOM file.

---

### Group 5 — Dockerfile & IaC Configuration Scanning
**Run when:** Dockerfiles, Terraform (`.tf`), Helm charts, or CloudFormation detected  
**Tools:** `hadolint`, `checkov`, `tfsec`, `trivy` (config mode), `kics`  
**Note:** Kubernetes YAML is handled exclusively in Group 7. This group owns Dockerfiles and IaC only.  
**Commands:**
```bash
TARGET="<resolved-absolute-target-path>"

# hadolint — Dockerfile best practices and misconfigurations
find "$TARGET" -name "Dockerfile*" -not -path "*/node_modules/*" | head -10 | while read df; do
  echo "=== hadolint: $df ==="
  hadolint --format json "$df" 2>/dev/null \
    | python3 -c "
import sys, json
try:
    r = json.load(sys.stdin)
    for f in r:
        print(f.get('level','?').upper(), f.get('code','?'), f.get('message','?'), 'line', f.get('line','?'))
except Exception as e:
    print(f'hadolint parse error: {e}')
  " 2>/dev/null || echo "hadolint: not installed"
done

# checkov — Dockerfiles and IaC (exclude k8s YAML to avoid overlap with Group 7)
checkov -d "$TARGET" --skip-check CKV_K8S_* --quiet --compact --output json 2>/dev/null \
  | python3 -c "
import sys, json
try:
    r = json.load(sys.stdin)
    results = r if isinstance(r, list) else [r]
    total = sum(len(res.get('results',{}).get('failed_checks',[])) for res in results)
    print(f'checkov: {total} failed checks (non-K8s)')
    for res in results:
        for c in res.get('results',{}).get('failed_checks',[])[:30]:
            print(c['check_id'], c.get('file_path','?'), c.get('resource','?'), c['check_result']['result'])
except Exception as e:
    print(f'checkov error: {e}')
" 2>/dev/null || echo "checkov: not installed"

# trivy config — Dockerfiles and IaC only
trivy config "$TARGET" --quiet --skip-files "*.yaml" --skip-files "*.yml" 2>/dev/null | head -80 \
  || echo "trivy: not installed"

# tfsec — Terraform only
find "$TARGET" -name "*.tf" -maxdepth 5 | head -1 | grep -q . && \
  tfsec "$TARGET" --format json 2>/dev/null \
    | python3 -c "
import sys, json
try:
    r = json.load(sys.stdin)
    for b in r.get('results', [])[:20]:
        print(b['rule']['id'], b['severity'], b['description'])
except: pass
  " 2>/dev/null || true
```
**Returns:** Dockerfile violations (hadolint codes + severity), IaC misconfigs (check ID, resource, severity, remediation hint).

---

### Group 6 — Container Image Scanning
**Run when:** Dockerfiles detected  
**Tools:** `trivy` (filesystem scan), `dockle`  
**Commands:**
```bash
TARGET="<resolved-absolute-target-path>"

# trivy filesystem — scan build context for vulns, secrets, and misconfig
trivy fs "$TARGET" --scanners vuln,secret,misconfig --quiet 2>/dev/null | head -120 \
  || echo "trivy: not installed"

# dockle — scan locally built images if available; otherwise scan Dockerfile statically
# First check if any project images are present in local Docker daemon
DOCKERFILES=$(find "$TARGET" -name "Dockerfile*" -not -path "*/node_modules/*" | head -5)
if command -v dockle &>/dev/null && command -v docker &>/dev/null; then
  # Try to find locally built images matching the project name
  PROJECT=$(basename "$TARGET" | tr '[:upper:]' '[:lower:]')
  LOCAL_IMAGES=$(docker images --format "{{.Repository}}:{{.Tag}}" 2>/dev/null | grep -i "$PROJECT" | head -5)
  if [ -n "$LOCAL_IMAGES" ]; then
    echo "$LOCAL_IMAGES" | while read img; do
      echo "=== dockle: $img ==="
      dockle --format json "$img" 2>/dev/null \
        | python3 -c "
import sys, json
try:
    r = json.load(sys.stdin)
    for d in r.get('details', []):
        print(d.get('level','?').upper(), d.get('code','?'), d.get('title','?'))
except Exception as e:
    print(f'dockle parse error: {e}')
      " 2>/dev/null
    done
  else
    echo "dockle: no locally built images matching '$PROJECT' found in Docker daemon"
    echo "  Build the image first (e.g. docker build -t $PROJECT .) then re-run to get dockle results"
  fi
else
  echo "dockle: not installed or Docker daemon not available"
fi
```
**Returns:** CVEs in base image layers (trivy), Dockerfile best-practice violations (dockle). Notes when dockle scan was skipped due to no local image.

---

### Group 7 — Kubernetes Manifest Security
**Run when:** `.yaml`/`.yml` files with Kubernetes `kind:` fields detected  
**Tools:** `kube-linter`, `kube-score`, `kubesec`, `polaris`  
**Commands:**
```bash
TARGET="<resolved-absolute-target-path>"
YAML_FILES=$(find "$TARGET" \( -name "*.yaml" -o -name "*.yml" \) -not -path "*/node_modules/*" | xargs grep -l "^kind:" 2>/dev/null | head -20)

if [ -z "$YAML_FILES" ]; then
  echo "No Kubernetes manifests found"
  exit 0
fi

# kube-linter
echo "$YAML_FILES" | xargs kube-linter lint --format json 2>/dev/null \
  | python3 -c "
import sys, json
try:
    r = json.load(sys.stdin)
    reports = r.get('Reports', [])
    print(f'kube-linter: {len(reports)} issues')
    for c in reports[:40]:
        print(c.get('Check','?'), '|', c.get('Object',{}).get('Name','?'), '|', c.get('Diagnostic',{}).get('Message','?'))
except Exception as e:
    print(f'kube-linter error: {e}')
" 2>/dev/null || echo "kube-linter: not installed"

# kube-score
echo "$YAML_FILES" | tr '\n' ' ' | xargs kube-score score --output-format json 2>/dev/null \
  | python3 -c "
import sys, json
try:
    r = json.load(sys.stdin)
    data = r if isinstance(r, list) else [r]
    for t in data:
        for c in t.get('checks', []):
            if c.get('grade') in ['CRITICAL', 'WARNING']:
                print(t.get('object_name','?'), '|', c.get('name','?'), '|', c.get('grade','?'))
except Exception as e:
    print(f'kube-score error: {e}')
" 2>/dev/null || echo "kube-score: not installed"

# kubesec — score each manifest individually
for f in $YAML_FILES; do
  echo "=== kubesec: $f ==="
  kubesec scan "$f" 2>/dev/null \
    | python3 -c "
import sys, json
try:
    results = json.load(sys.stdin)
    for r in (results if isinstance(results, list) else [results]):
        score = r.get('score', 0)
        print(f'  score={score}')
        for item in r.get('scoring', {}).get('critical', []):
            print(f'  CRITICAL: {item.get(\"id\",\"?\")} - {item.get(\"reason\",\"?\")}')
        for item in r.get('scoring', {}).get('advise', [])[:5]:
            print(f'  ADVISE: {item.get(\"id\",\"?\")} - {item.get(\"reason\",\"?\")}')
except Exception as e:
    print(f'  kubesec parse error: {e}')
  " 2>/dev/null
done || echo "kubesec: not installed"

# polaris
K8S_DIR=$(dirname $(echo "$YAML_FILES" | head -1))
polaris audit --audit-path "$TARGET" --format json 2>/dev/null \
  | python3 -c "
import sys, json
try:
    r = json.load(sys.stdin)
    print('polaris score:', r.get('score', 0),
          '| danger:', r.get('counts',{}).get('danger', 0),
          '| warning:', r.get('counts',{}).get('warning', 0))
    for ns, workloads in r.get('Results', {}).items():
        for wl, data in workloads.items():
            for check, result in data.get('PodResult', {}).get('Results', {}).items():
                if result.get('Success') == False:
                    print(f'  {wl}: {check} - {result.get(\"Message\",\"\")}')
except Exception as e:
    print(f'polaris error: {e}')
" 2>/dev/null || echo "polaris: not installed"
```
**Returns:** policy violations with check name, resource, severity, and remediation. kubesec score (0–10; below 4 = critical concern) per manifest.  
**Deduplication note:** if the same check (e.g., `runAsNonRoot`) fails across multiple workloads, report as one finding with a resource list rather than N rows.

---

### Group 8 — GitHub Actions Workflow Security
**Run when:** `.github/workflows/` directory exists  
**Tools:** `actionlint`, `zizmor`, `poutine`  
**Commands:**
```bash
TARGET="<resolved-absolute-target-path>"
WORKFLOWS="$TARGET/.github/workflows"

actionlint -format '{{range $e := .}}{{$e.Filepath}}:{{$e.Line}}: {{$e.Message}}\n{{end}}' \
  "$WORKFLOWS"/*.yml 2>/dev/null | head -50 || echo "actionlint: not installed"

zizmor "$WORKFLOWS/" 2>/dev/null | head -50 || echo "zizmor: not installed"

poutine analyze repo "$TARGET" 2>/dev/null | head -50 || echo "poutine: not installed"
```
**Returns:** risky workflow patterns — injection, unpinned actions, excessive permissions, secret exposure.

---

### Group 9 — Git History & Repo Posture
**Run when:** `.git/` directory detected at or above target  
**Tools:** `git-sizer`, `scorecard` (if GitHub remote found), `gitleaks` (full history mode)  
**Commands:**
```bash
TARGET="<resolved-absolute-target-path>"
GIT_ROOT=$(git -C "$TARGET" rev-parse --show-toplevel 2>/dev/null || echo "")

if [ -z "$GIT_ROOT" ]; then
  echo "No git repository found at or above $TARGET"
  exit 0
fi

cd "$GIT_ROOT"

git-sizer --verbose -j 2>/dev/null | head -40 || echo "git-sizer: not installed"

gitleaks detect --source "$GIT_ROOT" --report-format json 2>/dev/null \
  | python3 -c "
import sys, json
try:
    r = json.load(sys.stdin)
    print(f'gitleaks history: {len(r)} secrets found')
    for s in r[:10]:
        print(f'  {s.get(\"Description\",\"?\")} in {s.get(\"File\",\"?\")} at commit {s.get(\"Commit\",\"?\")[:8]}')
except Exception as e:
    print(f'gitleaks error: {e}')
" 2>/dev/null || echo "gitleaks: not installed"

# OpenSSF Scorecard if GitHub remote found
REMOTE=$(git remote get-url origin 2>/dev/null | grep "github.com" | sed 's|.*github.com[:/]\([^.]*\).*|\1|')
[ -n "$REMOTE" ] && scorecard --repo "github.com/$REMOTE" --format json 2>/dev/null \
  | python3 -c "
import sys, json
try:
    r = json.load(sys.stdin)
    print('scorecard:', r.get('score', 'n/a'))
    for c in r.get('checks', []):
        if c.get('score', 10) < 7:
            print(f'  {c[\"name\"]}: {c[\"score\"]} - {c.get(\"reason\",\"\")}')
except: pass
  " 2>/dev/null || true
```
**Returns:** repo size anomalies, history secrets count, posture score (if GitHub).

---

## Detection Logic

Before spawning subagents, detect the project profile by running these commands with the resolved `<target>` path:

```bash
TARGET="<resolved-absolute-target-path>"

echo "=== Languages ==="
find "$TARGET" -maxdepth 5 -name "*.py" -not -path "*/node_modules/*" | head -1
find "$TARGET" -maxdepth 5 -name "*.go" -not -path "*/node_modules/*" | head -1
find "$TARGET" -maxdepth 5 -name "*.rb" -not -path "*/node_modules/*" | head -1
find "$TARGET" -maxdepth 5 \( -name "*.js" -o -name "*.ts" \) -not -path "*/node_modules/*" | head -1
find "$TARGET" -maxdepth 5 -name "*.rs" -not -path "*/node_modules/*" | head -1
find "$TARGET" -maxdepth 5 -name "*.java" -not -path "*/node_modules/*" | head -1

echo "=== Infrastructure ==="
find "$TARGET" -maxdepth 5 -name "Dockerfile*" -not -path "*/node_modules/*" | head -5
find "$TARGET" -maxdepth 5 -name "*.tf" | head -1
find "$TARGET" \( -name "*.yaml" -o -name "*.yml" \) -not -path "*/node_modules/*" \
  | xargs grep -l "^kind:" 2>/dev/null | head -5

echo "=== GitHub Actions ==="
find "$TARGET" -maxdepth 6 -path "*/.github/workflows/*.yml" | head -3

echo "=== Package Manifests ==="
find "$TARGET" -maxdepth 4 -name "pnpm-lock.yaml" | head -1
find "$TARGET" -maxdepth 4 -name "package.json" -not -path "*/node_modules/*" | head -3
find "$TARGET" -maxdepth 4 -name "requirements*.txt" | head -1
find "$TARGET" -maxdepth 4 -name "go.mod" | head -1
find "$TARGET" -maxdepth 4 -name "Cargo.toml" | head -1
find "$TARGET" -maxdepth 4 -name "Gemfile.lock" | head -1

echo "=== Git ==="
git -C "$TARGET" rev-parse --show-toplevel 2>/dev/null || echo "no git root"
```

Activate groups based on findings:
- Group 1 (secrets): always
- Group 2 (SAST): any source file found
- Group 3 (SCA): any package manifest found
- Group 4 (SBOM): always
- Group 5 (Dockerfile/IaC): Dockerfile or `.tf` found
- Group 6 (container image): Dockerfile found
- Group 7 (K8s): any `kind:` YAML found
- Group 8 (GitHub Actions): `.github/workflows/` exists
- Group 9 (git posture): git root found

If `--focus` is set, activate only the groups mapped to that focus value (see Inputs).

---

## Consolidation Instructions

- Replace `<target>` / `<resolved-absolute-target-path>` with the actual absolute path in every command before running.
- Each subagent runs independently — do not wait for other agents.
- **Deduplication priority:** same file+line+rule → single finding (highest-severity tool wins). Same check class across N resources → single collapsed finding with resource list.
- If a tool is not installed, skip it and record it in the "Tools skipped" table.
- If a tool errors or times out, capture the error, skip, and note it.
- Do not modify any files in the target directory except writing `secops-report.md`.
- Never run network-active tools (nuclei, naabu, ffuf, k6) — those require explicit authorization.

---

## Artifact Structure

```markdown
# Security Assessment Report

**Target:** <path>
**Date:** <ISO date>
**Tools run:** <comma-separated list with versions>
**Tools skipped:** <list with reason>

---

## Executive Summary

| Severity | Count |
|---|---|
| Critical | n |
| High | n |
| Medium | n |
| Low | n |
| Info | n |

**Overall posture:** [Critical risk / High risk / Moderate risk / Low risk]

Top 3 issues: <brief bullets>

---

## Changes Since Last Scan
*(only present when --diff is passed and a previous report exists)*

| Status | Finding | Severity |
|---|---|---|
| New | <description> | High |
| Resolved | <description> | Medium |
| Persisting | <description> | Critical |

---

## Findings

### Secrets & Credentials
| # | File | Line | Type | Verified | Severity | Notes |
|---|---|---|---|---|---|---|

### SAST — Code Vulnerabilities
| # | Tool | Rule | File | Line | Severity | Description |
|---|---|---|---|---|---|---|

### SCA — Dependency Vulnerabilities
| # | Package | Installed | CVE/GHSA | CVSS | Severity | Fixed In | Dep Path |
|---|---|---|---|---|---|---|---|

### Dockerfile & IaC Configuration
| # | Tool | Resource | Check | Severity | Remediation |
|---|---|---|---|---|---|

### Container Image
| # | Image | CVE | Package | Severity | Fixed In |
|---|---|---|---|---|---|

### Kubernetes Manifests
*(Collapsed by check class: one row per check type, listing all affected resources)*
| # | Check | Affected Resources | Count | Severity | Remediation |
|---|---|---|---|---|---|

### GitHub Actions
| # | Workflow | Line | Issue | Severity |
|---|---|---|---|---|

### Repo Posture
<git-sizer anomalies, scorecard score, history secret count>

---

## SBOM Summary

- Total components: n
- Ecosystems: <list>
- Full SBOM: `<path>` (CycloneDX)

---

## Recommended Actions

Priority 1 — Fix immediately (Critical/High):
1. <action>

Priority 2 — Fix this sprint (Medium):
1. <action>

Priority 3 — Backlog (Low/Info):
1. <action>

---

## Quick Fixes

For mechanical findings, include ready-to-apply snippets:

### K8s securityContext patch (apply to every container spec)
```yaml
securityContext:
  runAsNonRoot: true
  runAsUser: 10001
  runAsGroup: 10001
  allowPrivilegeEscalation: false
  readOnlyRootFilesystem: true
  seccompProfile:
    type: RuntimeDefault
  capabilities:
    drop: [ALL]
```

### Dockerfile non-root user (add before CMD)
```dockerfile
RUN addgroup -S app && adduser -S app -G app
USER app
```

### pnpm dependency overrides (add to root package.json)
```json
"pnpm": {
  "overrides": {
    "lodash": ">=4.18.0",
    "undici": ">=6.24.0"
  }
}
```

*(Include only the quick fixes that apply to actual findings found in this scan.)*

---

## Tool Inventory Used

| Tool | Version | Group | Status |
|---|---|---|---|
```

---

## Output Format

After writing the report, respond with:

1. **Path** to `secops-report.md`
2. **Posture summary** — one line per severity bucket (Critical: n, High: n, Medium: n, Low: n)
3. **Top 5 findings** — severity, tool, short description
4. **Skipped tools** — tool name and reason (not installed, no applicable files, error)
5. **Recommended immediate action** — the single highest-priority fix
6. **Delta summary** — (only if `--diff`) New: n, Resolved: n, Persisting: n

#!/usr/bin/env node
// Thin CLI wrapper around `ts-complex` so the sdlc-code-quality skill can
// compute per-file Maintainability Index for .ts/.tsx (and .js/.jsx) files.
//
// Usage:
//   node ts-maintainability.js <target-dir> [--limit N] [--json]
//
// Exits 0 always. Skips files that fail to parse and reports them.

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
if (args.length < 1) {
  console.error('usage: ts-maintainability.js <target-dir> [--limit N] [--json]');
  process.exit(2);
}

const target = path.resolve(args[0]);
const asJson = args.includes('--json');
const limitIdx = args.indexOf('--limit');
const limit = limitIdx >= 0 ? parseInt(args[limitIdx + 1], 10) : 30;

let tscomplex;
try {
  tscomplex = require('ts-complex');
} catch (e) {
  // Fall back to global install path
  const globalRoot = require('child_process')
    .execSync('npm root -g', { encoding: 'utf8' })
    .trim();
  tscomplex = require(path.join(globalRoot, 'ts-complex'));
}

const EXCLUDE_DIRS = new Set([
  'node_modules',
  'dist',
  'build',
  '.next',
  'coverage',
  '.playwright-cli',
  'playwright-report',
  'test-results',
  '.git',
  'vendor',
  'target',
]);

const SOURCE_EXT = /\.(ts|tsx|js|jsx)$/;
const SKIP_FILE = /(\.min\.js|\.d\.ts)$/;

function walk(dir, out = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (e) {
    return out;
  }
  for (const ent of entries) {
    if (ent.name.startsWith('.') && ent.name !== '.') {
      // skip dotfiles but allow walking dotted target like "."
    }
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (EXCLUDE_DIRS.has(ent.name)) continue;
      walk(full, out);
    } else if (ent.isFile()) {
      if (SOURCE_EXT.test(ent.name) && !SKIP_FILE.test(ent.name)) {
        out.push(full);
      }
    }
  }
  return out;
}

const files = walk(target);
const results = [];
const errors = [];

const skipped = [];
for (const f of files) {
  try {
    const mi = tscomplex.calculateMaintainability(f);
    if (!mi || typeof mi.averageMaintainability !== 'number') {
      skipped.push(path.relative(target, f));
      continue;
    }
    // ts-complex returns -1 for files with no analyzable functions
    // (type-only files, NestJS decorator-only modules, config files).
    if (mi.averageMaintainability < 0 || mi.minMaintainability < 0) {
      skipped.push(path.relative(target, f));
      continue;
    }
    results.push({
      file: path.relative(target, f),
      avgMaintainability: Number(mi.averageMaintainability.toFixed(2)),
      minMaintainability: Number(mi.minMaintainability.toFixed(2)),
    });
  } catch (e) {
    errors.push({ file: path.relative(target, f), error: String(e.message || e) });
  }
}

// Sort by minMaintainability ascending (worst first)
results.sort((a, b) => a.minMaintainability - b.minMaintainability);

const summary = {
  filesAnalyzed: results.length,
  filesSkipped: skipped.length,
  filesErrored: errors.length,
  filesScanned: files.length,
  avgMaintainability:
    results.length === 0
      ? null
      : Number(
          (results.reduce((s, r) => s + r.avgMaintainability, 0) / results.length).toFixed(2)
        ),
  hot: results.filter(r => r.minMaintainability < 40).length,
  warn: results.filter(r => r.minMaintainability >= 40 && r.minMaintainability < 65).length,
  ok: results.filter(r => r.minMaintainability >= 65).length,
};

if (asJson) {
  console.log(
    JSON.stringify(
      {
        summary,
        results: results.slice(0, limit),
        skipped: skipped.slice(0, 20),
        errors: errors.slice(0, 20),
      },
      null,
      2
    )
  );
} else {
  console.log(`ts-complex maintainability — ${target}`);
  console.log(
    `files analyzed: ${summary.filesAnalyzed} (skipped no-fn: ${summary.filesSkipped}, errored: ${summary.filesErrored}) | ` +
      `avg MI: ${summary.avgMaintainability} | hot(<40): ${summary.hot}  warn(<65): ${summary.warn}  ok(>=65): ${summary.ok}`
  );
  console.log('');
  console.log('worst files by minMaintainability:');
  console.log('  minMI    avgMI    file');
  for (const r of results.slice(0, limit)) {
    const minStr = r.minMaintainability.toFixed(2).padStart(7);
    const avgStr = r.avgMaintainability.toFixed(2).padStart(7);
    console.log(`  ${minStr}  ${avgStr}   ${r.file}`);
  }
  if (errors.length > 0) {
    console.log('');
    console.log(`parse errors (${errors.length}):`);
    for (const e of errors.slice(0, 10)) {
      console.log(`  ${e.file}: ${e.error.slice(0, 100)}`);
    }
  }
}

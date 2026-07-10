'use strict';

/**
 * Deterministic reporter for LoveBud default-CI Node test evidence layers.
 *
 * Enumerates the same three test directories the default `npm test` script runs
 * (tests/smoke, tests/routes, tests/contracts — *.test.cjs), then resolves each
 * file against the machine-readable classification in
 * tests/test-layer-classification.json.
 *
 * It does NOT connect to any network, database, browser, or deployment target,
 * and it never prints secrets, private URLs, raw UUIDs, request IDs, or logs.
 *
 * Refs: #3429, #3425, #3427, #3428
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const INVENTORY_PATH = path.join(ROOT, 'tests', 'test-layer-classification.json');
const DEFAULT_CI_GLOBS = ['tests/smoke/*.test.cjs', 'tests/routes/*.test.cjs', 'tests/contracts/*.test.cjs'];

function loadInventory() {
  const raw = fs.readFileSync(INVENTORY_PATH, 'utf8');
  const inv = JSON.parse(raw);
  if (!Array.isArray(inv.vocabulary) || inv.vocabulary.length === 0) {
    throw new Error('Inventory vocabulary missing or empty');
  }
  if (!Array.isArray(inv.entries)) {
    throw new Error('Inventory entries missing');
  }
  return inv;
}

function enumerateDefaultCi() {
  const files = [];
  for (const glob of DEFAULT_CI_GLOBS) {
    const dir = path.join(ROOT, path.dirname(glob));
    const base = path.basename(glob);
    if (!fs.existsSync(dir)) continue;
    const matched = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith('.test.cjs'))
      .map((f) => path.join(path.dirname(glob), f).split(path.sep).join('/'));
    files.push(...matched);
  }
  files.sort();
  return files;
}

function classify(inv, enumerated) {
  const byPath = new Map();
  for (const e of inv.entries) {
    const key = e.path.split(path.sep).join('/');
    if (!byPath.has(key)) byPath.set(key, []);
    byPath.get(key).push(e);
  }

  const vocab = new Set(inv.vocabulary);
  const enumeratedSet = new Set(enumerated);
  const counts = {};
  for (const v of inv.vocabulary) counts[v] = 0;

  const unclassified = [];
  const conflicts = [];
  const invalidCategory = [];
  const emptyRationale = [];

  for (const f of enumerated) {
    const matches = byPath.get(f) || [];
    if (matches.length === 0) {
      unclassified.push(f);
      continue;
    }
    if (matches.length > 1) {
      conflicts.push(f);
      continue;
    }
    const entry = matches[0];
    if (!vocab.has(entry.layer)) {
      invalidCategory.push(f);
      continue;
    }
    if (!entry.rationale || !String(entry.rationale).trim()) {
      emptyRationale.push(f);
      continue;
    }
    counts[entry.layer] += 1;
  }

  const stale = [];
  for (const e of inv.entries) {
    const key = e.path.split(path.sep).join('/');
    if (!enumeratedSet.has(key)) stale.push(key);
  }

  return {
    counts,
    unclassified,
    conflicts,
    invalidCategory,
    emptyRationale,
    stale,
    totalClassified: enumerated.length - unclassified.length - conflicts.length - invalidCategory.length - emptyRationale.length,
  };
}

function run() {
  const inv = loadInventory();
  const enumerated = enumerateDefaultCi();
  const result = classify(inv, enumerated);

  const lines = [];
  lines.push('LoveBud default-CI test evidence-layer classification');
  lines.push('Enumerated default-CI test files: ' + enumerated.length);
  lines.push('');
  lines.push('Per-layer counts (deterministic vocabulary order):');
  for (const v of inv.vocabulary) {
    lines.push('  ' + v + ': ' + result.counts[v]);
  }
  lines.push('');
  lines.push('Total classified: ' + result.totalClassified);
  lines.push('Unclassified: ' + result.unclassified.length);
  lines.push('Conflicting: ' + result.conflicts.length);
  lines.push('Invalid category: ' + result.invalidCategory.length);
  lines.push('Empty rationale: ' + result.emptyRationale.length);
  lines.push('Stale inventory paths: ' + result.stale.length);
  lines.push('');
  // Explicitly surfaced per Issue #3429 requirements.
  lines.push('DB_ENGINE_EXECUTION: ' + result.counts.DB_ENGINE_EXECUTION);
  lines.push('PRODUCTION_SMOKE: ' + result.counts.PRODUCTION_SMOKE);
  lines.push('');
  const supplemental = Array.isArray(inv.supplemental) ? inv.supplemental.length : 0;
  lines.push('Supplemental / out-of-default-CI tests (excluded from default-CI counts): ' + supplemental);

  // eslint-disable-next-line no-console
  console.log(lines.join('\n'));

  const failed =
    result.unclassified.length > 0 ||
    result.conflicts.length > 0 ||
    result.invalidCategory.length > 0 ||
    result.emptyRationale.length > 0 ||
    result.stale.length > 0;

  if (failed) {
    if (result.unclassified.length) console.error('UNCLASSIFIED:\n  ' + result.unclassified.join('\n  '));
    if (result.conflicts.length) console.error('CONFLICTS:\n  ' + result.conflicts.join('\n  '));
    if (result.invalidCategory.length) console.error('INVALID_CATEGORY:\n  ' + result.invalidCategory.join('\n  '));
    if (result.emptyRationale.length) console.error('EMPTY_RATIONALE:\n  ' + result.emptyRationale.join('\n  '));
    if (result.stale.length) console.error('STALE:\n  ' + result.stale.join('\n  '));
    process.exitCode = 1;
  }
  return { inv, enumerated, result };
}

if (require.main === module) {
  run();
}

module.exports = { loadInventory, enumerateDefaultCi, classify, run, DEFAULT_CI_GLOBS };

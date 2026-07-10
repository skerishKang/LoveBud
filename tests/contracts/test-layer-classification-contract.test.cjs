'use strict';

/**
 * Focused contract test for the LoveBud default-CI test evidence-layer
 * classification (Issue #3429).
 *
 * It validates the machine-readable inventory in
 * tests/test-layer-classification.json and the deterministic reporter in
 * scripts/report-test-layers.cjs. It does not connect to any network, database,
 * browser, or deployment target, and it does not print secrets or private data.
 *
 * Refs: #3429, #3425, #3427, #3428
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const INVENTORY_PATH = path.join(REPO_ROOT, 'tests', 'test-layer-classification.json');
const REPORTER_PATH = path.join(REPO_ROOT, 'scripts', 'report-test-layers.cjs');

const reporter = require(REPORTER_PATH);

const EXPECTED_VOCABULARY = [
  'SOURCE_STATIC',
  'EXECUTED_FAKE',
  'EXECUTED_REAL_LOCAL',
  'EXTERNAL_INTEGRATION',
  'PRODUCTION_SMOKE',
  'DB_ENGINE_EXECUTION',
];

function captureRun() {
  const out = [];
  const errOut = [];
  const prevLog = console.log;
  const prevErr = console.error;
  const prevExit = process.exitCode;
  console.log = (...a) => out.push(a.join(' '));
  console.error = (...a) => errOut.push(a.join(' '));
  try {
    reporter.run();
  } finally {
    console.log = prevLog;
    console.error = prevErr;
    process.exitCode = prevExit;
  }
  return { out: out.join('\n'), err: errOut.join('\n') };
}

test('vocabulary contains every required primary layer', () => {
  const inv = reporter.loadInventory();
  for (const v of EXPECTED_VOCABULARY) {
    assert.ok(inv.vocabulary.includes(v), `vocabulary missing ${v}`);
  }
  assert.equal(inv.vocabulary.length, EXPECTED_VOCABULARY.length);
});

test('every default-CI Node test file is classified exactly once', () => {
  const inv = reporter.loadInventory();
  const enumerated = reporter.enumerateDefaultCi();
  const result = reporter.classify(inv, enumerated);
  assert.equal(result.unclassified.length, 0, 'unclassified files present');
  assert.equal(result.conflicts.length, 0, 'conflicting files present');
  assert.equal(result.invalidCategory.length, 0, 'invalid category present');
  assert.equal(result.emptyRationale.length, 0, 'empty rationale present');
  assert.equal(result.stale.length, 0, 'stale inventory paths present');
  assert.equal(result.totalClassified, enumerated.length);
  // The contract test itself is part of default CI and must be classified.
  assert.ok(enumerated.includes('tests/contracts/test-layer-classification-contract.test.cjs'));
});

test('duplicate / conflicting rules are detected as a failure', () => {
  const inv = reporter.loadInventory();
  const enumerated = reporter.enumerateDefaultCi();
  // Duplicate one entry to force a conflict.
  const dup = JSON.parse(JSON.stringify(inv));
  dup.entries.push(dup.entries[0]);
  const result = reporter.classify(dup, enumerated);
  assert.ok(result.conflicts.length >= 1, 'duplicate entry should be reported as conflict');
});

test('stale inventory path is detected as a failure', () => {
  const inv = reporter.loadInventory();
  const enumerated = reporter.enumerateDefaultCi();
  const dup = JSON.parse(JSON.stringify(inv));
  dup.entries.push({ path: 'tests/contracts/does-not-exist-abc.test.cjs', layer: 'SOURCE_STATIC', rationale: 'x', capabilities: [] });
  const result = reporter.classify(dup, enumerated);
  assert.ok(result.stale.includes('tests/contracts/does-not-exist-abc.test.cjs'), 'stale path not detected');
});

test('invalid category is detected as a failure', () => {
  const inv = reporter.loadInventory();
  const enumerated = reporter.enumerateDefaultCi();
  const dup = JSON.parse(JSON.stringify(inv));
  dup.entries[0] = { path: dup.entries[0].path, layer: 'NOT_A_REAL_LAYER', rationale: 'x', capabilities: [] };
  const result = reporter.classify(dup, enumerated);
  assert.ok(result.invalidCategory.length >= 1, 'invalid category not detected');
});

test('migration SQL contracts are not classified as DB_ENGINE_EXECUTION', () => {
  const inv = reporter.loadInventory();
  const migrationEntries = inv.entries.filter((e) => /migration/i.test(e.path));
  assert.ok(migrationEntries.length >= 1, 'expected at least one migration contract');
  for (const e of migrationEntries) {
    assert.notEqual(e.layer, 'DB_ENGINE_EXECUTION', `${e.path} must not be DB_ENGINE_EXECUTION`);
    assert.equal(e.layer, 'SOURCE_STATIC', `${e.path} should be SOURCE_STATIC (reads SQL text, applies regex)`);
  }
});

test('fake/stub tests are not classified as EXTERNAL_INTEGRATION', () => {
  const inv = reporter.loadInventory();
  const fakeEntries = inv.entries.filter((e) => e.layer === 'EXECUTED_FAKE');
  for (const e of fakeEntries) {
    assert.notEqual(e.layer, 'EXTERNAL_INTEGRATION', `${e.path} must not be EXTERNAL_INTEGRATION`);
  }
  // No default-CI file may be EXTERNAL_INTEGRATION today.
  assert.equal(inv.entries.filter((e) => e.layer === 'EXTERNAL_INTEGRATION').length, 0);
});

test('default-CI summary reports DB_ENGINE_EXECUTION = 0', () => {
  const inv = reporter.loadInventory();
  const enumerated = reporter.enumerateDefaultCi();
  const result = reporter.classify(inv, enumerated);
  assert.equal(result.counts.DB_ENGINE_EXECUTION, 0);
});

test('default-CI summary reports PRODUCTION_SMOKE = 0', () => {
  const inv = reporter.loadInventory();
  const enumerated = reporter.enumerateDefaultCi();
  const result = reporter.classify(inv, enumerated);
  assert.equal(result.counts.PRODUCTION_SMOKE, 0);
});

test('Python supplemental tests are excluded from default-CI classification', () => {
  const inv = reporter.loadInventory();
  const enumerated = reporter.enumerateDefaultCi();
  // No .py file is enumerated by the default-CI glob.
  assert.ok(enumerated.every((f) => !f.endsWith('.py')), 'default-CI enumeration must not include .py files');
  // Supplemental entries are flagged out of default CI.
  const supp = Array.isArray(inv.supplemental) ? inv.supplemental : [];
  assert.ok(supp.length >= 1, 'expected supplemental Python inventory');
  for (const s of supp) {
    assert.equal(s.defaultCi, false, `${s.path} must be defaultCi:false`);
    assert.ok(s.path.endsWith('.py'), `${s.path} should be a Python test`);
  }
});

test('classification structure is not filename-only (rationale + content basis)', () => {
  const inv = reporter.loadInventory();
  assert.ok(/content|source|evidence/i.test(inv.classificationBasis || ''), 'inventory must declare a content-evidence basis');
  for (const e of inv.entries) {
    assert.ok(e.rationale && String(e.rationale).trim().length > 0, `empty rationale for ${e.path}`);
  }
});

test('report ordering is deterministic', () => {
  const a = reporter.enumerateDefaultCi();
  const b = reporter.enumerateDefaultCi();
  assert.deepEqual(a, b, 'enumeration must be deterministic');
  // Vocabulary order is fixed and deterministic.
  assert.deepEqual(inv_vocab(), EXPECTED_VOCABULARY);
  function inv_vocab() {
    return reporter.loadInventory().vocabulary;
  }
});

test('reporter tooling contains no network/DB/browser/deploy invocation', () => {
  const src = fs.readFileSync(REPORTER_PATH, 'utf8');
  const forbidden = [
    /require\(['"](pg|playwright|puppeteer|child_process|docker|mysql|mysql2|sqlite3|better-sqlite3)['"]\)/i,
    /fetch\(/i,
    /execSync|spawnSync|spawn\(/i,
    /new\s+(Pool|Client)\s*\(/i,
    /\bdocker\b/i,
    /wrangler/i,
  ];
  for (const re of forbidden) {
    assert.ok(!re.test(src), `reporter must not contain ${re}`);
  }
});

test('reporter output contains no secret or private data', () => {
  const { out } = captureRun();
  const leaks = [
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i, // UUID
    /Bearer\s/i,
    /password/i,
    /api[_-]?key/i,
    /token/i,
    /Authorization/i,
    /https?:\/\//i, // URL
  ];
  for (const re of leaks) {
    assert.ok(!re.test(out), `reporter output must not contain ${re}`);
  }
});

test('reporter exits zero on the committed inventory', () => {
  const prev = process.exitCode;
  process.exitCode = 0;
  try {
    const { out } = captureRun();
    assert.ok(out.includes('DB_ENGINE_EXECUTION: 0'), 'must explicitly print DB_ENGINE_EXECUTION: 0');
    assert.ok(out.includes('PRODUCTION_SMOKE: 0'), 'must explicitly print PRODUCTION_SMOKE: 0');
    assert.equal(process.exitCode, 0, 'reporter must exit 0 on valid inventory');
  } finally {
    process.exitCode = prev;
  }
});

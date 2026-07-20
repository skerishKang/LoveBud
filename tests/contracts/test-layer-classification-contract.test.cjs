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
  assert.ok(supp.length >= 1, 'expected supplemental inventory');
  const pythonSupp = supp.filter((s) => s.layer === 'SUPPLEMENTAL_PYTHON');
  assert.ok(pythonSupp.length >= 1, 'expected supplemental Python inventory');
  for (const s of pythonSupp) {
    assert.equal(s.defaultCi, false, `${s.path} must be defaultCi:false`);
    assert.ok(s.path.endsWith('.py'), `${s.path} should be a Python test`);
  }
});

test('DB engine supplemental entries are separate from Python supplemental and default-CI', () => {
  const inv = reporter.loadInventory();
  const enumerated = reporter.enumerateDefaultCi();
  const enumeratedSet = new Set(enumerated);
  const supp = Array.isArray(inv.supplemental) ? inv.supplemental : [];
  const dbEngine = supp.filter((s) => s.layer === 'DB_ENGINE_EXECUTION');
  assert.ok(dbEngine.length >= 1, 'expected at least one DB_ENGINE_EXECUTION supplemental entry');
  for (const s of dbEngine) {
    assert.equal(s.defaultCi, false, `${s.path} must be defaultCi:false`);
    assert.equal(s.layer, 'DB_ENGINE_EXECUTION', `${s.path} must be DB_ENGINE_EXECUTION`);
    assert.ok(s.path.endsWith('.cjs'), `${s.path} must be a .cjs engine test`);
    assert.ok(s.path.startsWith('tests/db-engine/'), `${s.path} must live under tests/db-engine/`);
    assert.ok(!enumeratedSet.has(s.path), `${s.path} must not be in default-CI enumeration`);
    assert.notEqual(s.layer, 'PRODUCTION_SMOKE');
    assert.notEqual(s.layer, 'EXTERNAL_INTEGRATION');
    assert.ok(Array.isArray(s.capabilities), `${s.path} capabilities must be an array`);
    assert.ok(!s.capabilities.some((c) => /neon|production|secret|database_url/i.test(String(c))),
      `${s.path} must not declare Production/Neon credential capabilities`);
  }
  // default-CI count of DB_ENGINE_EXECUTION remains 0
  const result = reporter.classify(inv, enumerated);
  assert.equal(result.counts.DB_ENGINE_EXECUTION, 0);
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

test('synthetic unclassified file is detected (pure function)', () => {
  const inv = reporter.loadInventory();
  const enumerated = reporter.enumerateDefaultCi();
  const synthetic = [...enumerated, 'tests/contracts/__synthetic_unclassified__.test.cjs'];
  const result = reporter.classify(inv, synthetic);
  assert.deepEqual(result.unclassified, ['tests/contracts/__synthetic_unclassified__.test.cjs']);
});

test('empty rationale is detected as a failure', () => {
  const inv = reporter.loadInventory();
  const enumerated = reporter.enumerateDefaultCi();
  const dup = JSON.parse(JSON.stringify(inv));
  dup.entries[0] = { path: dup.entries[0].path, layer: dup.entries[0].layer, rationale: '   ', capabilities: [] };
  const result = reporter.classify(dup, enumerated);
  assert.ok(result.emptyRationale.length >= 1, 'empty rationale not detected');
});

test('package.json scripts.test parses to the exact three default-CI globs', () => {
  const inv = reporter.loadInventory();
  const command = reporter.readPackageTestCommand();
  const check = reporter.checkPackageTestCommand(command, inv.defaultCiGlobs);
  assert.deepEqual(check.globs, ['tests/smoke/*.test.cjs', 'tests/routes/*.test.cjs', 'tests/contracts/*.test.cjs']);
  assert.equal(check.packageGlobMismatch, false, 'unexpected glob mismatch');
  assert.equal(check.unsupportedTestCommand, false, 'unexpected unsupported command');
  assert.equal(check.duplicateGlobs, false, 'unexpected duplicate glob');
  assert.equal(check.missingGlobDirectories, false, 'unexpected missing glob directory');
});

test('package/manifest glob mismatch is detected as failure', () => {
  const inv = reporter.loadInventory();
  const check = reporter.checkPackageTestCommand('node --test tests/smoke/*.test.cjs', inv.defaultCiGlobs);
  assert.equal(check.packageGlobMismatch, true, 'package/manifest glob mismatch not detected');
});

test('unsupported package test command fails closed', () => {
  const inv = reporter.loadInventory();
  const check = reporter.checkPackageTestCommand('node --test tests/contracts/*.test.cjs && npm run something', inv.defaultCiGlobs);
  assert.equal(check.unsupportedTestCommand, true, 'unsupported package test command not detected');
});

test('duplicate glob is detected as failure', () => {
  const inv = reporter.loadInventory();
  const check = reporter.checkPackageTestCommand('node --test tests/contracts/*.test.cjs tests/contracts/*.test.cjs', inv.defaultCiGlobs);
  assert.equal(check.duplicateGlobs, true, 'duplicate glob not detected');
});

test('missing glob directory is detected as failure', () => {
  const inv = reporter.loadInventory();
  const check = reporter.checkPackageTestCommand('node --test tests/does-not-exist-xyz/*.test.cjs', inv.defaultCiGlobs);
  assert.equal(check.missingGlobDirectories, true, 'missing glob directory not detected');
});

test('exact-file token is rejected (unsupported glob shape)', () => {
  const inv = reporter.loadInventory();
  const check = reporter.checkPackageTestCommand('node --test tests/contracts/foo.test.cjs', inv.defaultCiGlobs);
  assert.equal(check.unsupportedTestCommand, true, 'exact-file token must be unsupported');
});

test('partial wildcard token is rejected (unsupported glob shape)', () => {
  const inv = reporter.loadInventory();
  const check = reporter.checkPackageTestCommand('node --test tests/contracts/foo*.test.cjs', inv.defaultCiGlobs);
  assert.equal(check.unsupportedTestCommand, true, 'partial wildcard must be unsupported');
});

test('recursive wildcard token is rejected (unsupported glob shape)', () => {
  const inv = reporter.loadInventory();
  const check = reporter.checkPackageTestCommand('node --test tests/contracts/**/*.test.cjs', inv.defaultCiGlobs);
  assert.equal(check.unsupportedTestCommand, true, 'recursive wildcard must be unsupported');
});

test('traversal and absolute glob tokens are rejected (unsupported glob shape)', () => {
  const inv = reporter.loadInventory();
  const up = reporter.checkPackageTestCommand('node --test ../tests/contracts/*.test.cjs', inv.defaultCiGlobs);
  assert.equal(up.unsupportedTestCommand, true, 'parent traversal must be unsupported');
  const abs = reporter.checkPackageTestCommand('node --test /tests/contracts/*.test.cjs', inv.defaultCiGlobs);
  assert.equal(abs.unsupportedTestCommand, true, 'absolute path must be unsupported');
});

test('current default-CI package globs parse as supported', () => {
  const inv = reporter.loadInventory();
  const check = reporter.checkPackageTestCommand('node --test tests/smoke/*.test.cjs tests/routes/*.test.cjs tests/contracts/*.test.cjs', inv.defaultCiGlobs);
  assert.equal(check.unsupportedTestCommand, false, 'supported package globs must parse');
  assert.deepEqual(check.globs, ['tests/smoke/*.test.cjs', 'tests/routes/*.test.cjs', 'tests/contracts/*.test.cjs']);
});

test('known My Trees continuation-hub media contract is SOURCE_STATIC', () => {
  const inv = reporter.loadInventory();
  const e = inv.entries.find((x) => x.path === 'tests/contracts/my-trees-continuation-hub-media-contract.test.cjs');
  assert.ok(e, 'entry missing');
  assert.equal(e.layer, 'SOURCE_STATIC', 'my-trees media contract must be SOURCE_STATIC (source read only, no execution)');
  assert.notEqual(e.layer, 'EXECUTED_REAL_LOCAL');
});

test('new tree-comments normalizer contract is SOURCE_STATIC', () => {
  const inv = reporter.loadInventory();
  const e = inv.entries.find((x) => x.path === 'tests/contracts/normalizer-tree-comments-reconcile.test.cjs');
  assert.ok(e, 'normalizer entry missing');
  assert.equal(e.layer, 'SOURCE_STATIC', 'normalizer contract must be SOURCE_STATIC (pure-JS mirror, SQL source read only)');
  assert.notEqual(e.layer, 'DB_ENGINE_EXECUTION');
});

test('every EXECUTED_REAL_LOCAL entry has a file-specific rationale (no generic phrasing)', () => {
  const inv = reporter.loadInventory();
  const GENERIC = /executes production functions in a local node process without replacing the core claimed behavior with fakes/i;
  const realLocal = inv.entries.filter((e) => e.layer === 'EXECUTED_REAL_LOCAL');
  assert.ok(realLocal.length >= 1, 'expected at least one EXECUTED_REAL_LOCAL entry');
  for (const e of realLocal) {
    assert.ok(e.rationale && e.rationale.trim().length > 0, `empty rationale for ${e.path}`);
    assert.ok(!GENERIC.test(e.rationale), `REAL_LOCAL entry ${e.path} still uses the generic rationale`);
    assert.ok(e.rationale.length > 90, `REAL_LOCAL entry ${e.path} rationale is not file-specific`);
    assert.ok(/scripts\/|js\//.test(e.rationale), `REAL_LOCAL entry ${e.path} rationale must name the executed production module`);
  }
});

test('supplemental stale (nonexistent path) is detected', () => {
  const inv = reporter.loadInventory();
  const enumerated = reporter.enumerateDefaultCi();
  const dup = JSON.parse(JSON.stringify(inv));
  dup.supplemental.push({ path: 'tests/contracts/__synthetic_missing__.py', defaultCi: false, layer: 'SUPPLEMENTAL_PYTHON', rationale: 'x', capabilities: [] });
  const result = reporter.classify(dup, enumerated);
  assert.ok(result.supplementalStale.includes('tests/contracts/__synthetic_missing__.py'), 'supplemental stale not detected');
});

test('supplemental duplicate path is detected', () => {
  const inv = reporter.loadInventory();
  const enumerated = reporter.enumerateDefaultCi();
  const dup = JSON.parse(JSON.stringify(inv));
  const first = dup.supplemental[0].path;
  dup.supplemental.push({ path: first, defaultCi: false, layer: 'SUPPLEMENTAL_PYTHON', rationale: 'x', capabilities: [] });
  const result = reporter.classify(dup, enumerated);
  assert.ok(result.supplementalDuplicates.includes(first), 'supplemental duplicate not detected');
});

test('supplemental defaultCi:true is detected as default-CI overlap', () => {
  const inv = reporter.loadInventory();
  const enumerated = reporter.enumerateDefaultCi();
  const dup = JSON.parse(JSON.stringify(inv));
  dup.supplemental.push({ path: 'tests/contracts/__synthetic_defaultci__.py', defaultCi: true, layer: 'SUPPLEMENTAL_PYTHON', rationale: 'x', capabilities: [] });
  const result = reporter.classify(dup, enumerated);
  assert.ok(result.supplementalInDefaultCi.includes('tests/contracts/__synthetic_defaultci__.py'), 'defaultCi:true not detected');
});

test('supplemental default-CI .test.cjs path overlap is detected', () => {
  const inv = reporter.loadInventory();
  const enumerated = reporter.enumerateDefaultCi();
  const dup = JSON.parse(JSON.stringify(inv));
  const ciPath = enumerated[0];
  dup.supplemental.push({ path: ciPath, defaultCi: false, layer: 'SUPPLEMENTAL_PYTHON', rationale: 'x', capabilities: [] });
  const result = reporter.classify(dup, enumerated);
  assert.ok(result.supplementalInDefaultCi.includes(ciPath), 'default-CI path in supplemental not detected');
});

test('supplemental invalid metadata (empty rationale / invalid layer / non-py) is detected', () => {
  const inv = reporter.loadInventory();
  const enumerated = reporter.enumerateDefaultCi();
  const dup = JSON.parse(JSON.stringify(inv));
  dup.supplemental.push({ path: 'tests/contracts/__synthetic_a__.py', defaultCi: false, layer: 'SUPPLEMENTAL_PYTHON', rationale: '   ', capabilities: [] });
  dup.supplemental.push({ path: 'tests/contracts/__synthetic_b__.py', defaultCi: false, layer: 'NOT_A_LAYER', rationale: 'x', capabilities: [] });
  dup.supplemental.push({ path: 'tests/contracts/__synthetic_c__.test.cjs', defaultCi: false, layer: 'SUPPLEMENTAL_PYTHON', rationale: 'x', capabilities: [] });
  // DB engine path outside tests/db-engine/ is invalid even with DB_ENGINE_EXECUTION layer.
  dup.supplemental.push({ path: 'tests/contracts/__synthetic_d__.test.cjs', defaultCi: false, layer: 'DB_ENGINE_EXECUTION', rationale: 'x', capabilities: [] });
  const result = reporter.classify(dup, enumerated);
  assert.ok(result.supplementalEmptyRationale.includes('tests/contracts/__synthetic_a__.py'), 'empty rationale not detected');
  assert.ok(result.supplementalInvalid.includes('tests/contracts/__synthetic_b__.py'), 'invalid layer not detected');
  assert.ok(result.supplementalInvalid.includes('tests/contracts/__synthetic_c__.test.cjs'), 'non-py SUPPLEMENTAL_PYTHON not detected');
  assert.ok(result.supplementalInvalid.includes('tests/contracts/__synthetic_d__.test.cjs'), 'DB engine path outside tests/db-engine not detected');
});

test('supplemental missing capabilities is detected as invalid', () => {
  const inv = reporter.loadInventory();
  const enumerated = reporter.enumerateDefaultCi();
  const dup = JSON.parse(JSON.stringify(inv));
  dup.supplemental.push({ path: 'tests/contracts/test_fork_tree.py', defaultCi: false, layer: 'SUPPLEMENTAL_PYTHON', rationale: 'x' });
  const result = reporter.classify(dup, enumerated);
  assert.ok(result.supplementalInvalidCapabilities.includes('tests/contracts/test_fork_tree.py'), 'missing capabilities not detected');
});

test('supplemental non-array capabilities (string) is detected as invalid', () => {
  const inv = reporter.loadInventory();
  const enumerated = reporter.enumerateDefaultCi();
  const dup = JSON.parse(JSON.stringify(inv));
  dup.supplemental.push({ path: 'tests/contracts/test_fork_tree.py', defaultCi: false, layer: 'SUPPLEMENTAL_PYTHON', rationale: 'x', capabilities: 'none' });
  const result = reporter.classify(dup, enumerated);
  assert.ok(result.supplementalInvalidCapabilities.includes('tests/contracts/test_fork_tree.py'), 'string capabilities not detected');
});

test('all committed supplemental entries have array capabilities (bucket is 0)', () => {
  const inv = reporter.loadInventory();
  const enumerated = reporter.enumerateDefaultCi();
  const result = reporter.classify(inv, enumerated);
  assert.equal(result.supplementalInvalidCapabilities.length, 0, 'committed supplemental capabilities must be arrays');
});

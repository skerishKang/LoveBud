'use strict';

// Canonical test-suite count authority contract (Issue #3838 / parent #3425).
// Evidence layer: SOURCE_STATIC.
//
// Proves the pure deterministic canonical count authority independently with
// synthetic fixtures and negative controls, then cross-checks the real
// repository sources against the reporter.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const AUTHORITY_PATH = path.join(ROOT, 'scripts', 'test-suite-count-authority.cjs');
const REPORTER_PATH = path.join(ROOT, 'scripts', 'report-ci-test-groups.cjs');
const CLASSIFICATION_PATH = path.join(ROOT, 'tests', 'test-layer-classification.json');
const REGISTRY_PATH = path.join(ROOT, 'tests', 'ci-test-group-registry.json');

const SELF_PATH = 'tests/contracts/test-suite-count-authority-contract.test.cjs';

assert.ok(fs.existsSync(AUTHORITY_PATH), 'authority module must exist');

const {
  CONTRACT_VERSION,
  VOCABULARY,
  SUPPLEMENTAL_VOCABULARY,
  CANONICAL_GROUP_ENUM,
  ERROR_CODES,
  parseTestGlobs,
  deriveTestSuiteCountsFromSources,
  loadCanonicalTestSuiteCounts,
} = require(AUTHORITY_PATH);

const { buildReportData } = require(REPORTER_PATH);

const ALLOWED_SOURCE_FIELDS = ['classification', 'registry', 'enumeratedDefaultCi'];
const EXPECTED_COUNT_KEYS = [
  'default_total',
  'SOURCE_STATIC',
  'EXECUTED_FAKE',
  'EXECUTED_REAL_LOCAL',
  'EXTERNAL_INTEGRATION',
  'PRODUCTION_SMOKE',
  'DB_ENGINE_EXECUTION',
  'browser_count',
  'process_count',
  'supplemental_python',
  'supplemental_db_engine',
];

function canonicalFixture(overrides) {
  const base = {
    classification: {
      schemaVersion: '1.0.0',
      vocabulary: [...VOCABULARY],
      defaultCiGlobs: [
        'tests/smoke/*.test.cjs',
        'tests/routes/*.test.cjs',
        'tests/contracts/*.test.cjs',
      ],
      entries: [
        { path: 'tests/contracts/a-source-static.test.cjs', layer: 'SOURCE_STATIC', rationale: 'r1', capabilities: [] },
        { path: 'tests/contracts/b-executed-fake.test.cjs', layer: 'EXECUTED_FAKE', rationale: 'r2', capabilities: [] },
        { path: 'tests/contracts/c-real-local-browser.test.cjs', layer: 'EXECUTED_REAL_LOCAL', rationale: 'r3', capabilities: [] },
        { path: 'tests/contracts/d-real-local-process.test.cjs', layer: 'EXECUTED_REAL_LOCAL', rationale: 'r4', capabilities: [] },
      ],
      supplemental: [
        { path: 'tests/db-engine/x-postgres.test.cjs', layer: 'DB_ENGINE_EXECUTION', defaultCi: false, rationale: 's1', capabilities: ['postgresql'] },
        { path: 'scripts/aux/test_helper.py', layer: 'SUPPLEMENTAL_PYTHON', defaultCi: false, rationale: 's2', capabilities: [] },
      ],
    },
    registry: {
      schema_version: '1.0.0',
      group_enum: [...CANONICAL_GROUP_ENUM],
      groups: [
        { group: 'BROWSER_REAL_LOCAL', explicit_paths: ['tests/contracts/c-real-local-browser.test.cjs'] },
        { group: 'PROCESS_REAL_LOCAL', explicit_paths: ['tests/contracts/d-real-local-process.test.cjs'] },
        { group: 'DB_ENGINE', explicit_paths: ['tests/db-engine/x-postgres.test.cjs'] },
        { group: 'PYTHON_SUPPLEMENTAL', explicit_paths: ['scripts/aux/test_helper.py'] },
      ],
    },
    enumeratedDefaultCi: [
      'tests/contracts/a-source-static.test.cjs',
      'tests/contracts/b-executed-fake.test.cjs',
      'tests/contracts/c-real-local-browser.test.cjs',
      'tests/contracts/d-real-local-process.test.cjs',
    ],
  };
  return { ...base, ...overrides };
}

function assertCodeThrows(fn, expectedCode) {
  try {
    fn();
  } catch (e) {
    assert.ok(
      e && e.code === expectedCode,
      'Expected code ' + expectedCode + ' but got code=' + (e && e.code) + ' msg=' + (e && e.message)
    );
    return e;
  }
  throw new Error('Expected exception with code ' + expectedCode + ' but no error thrown');
}

function serializeKeys(o) {
  return EXPECTED_COUNT_KEYS.map((k) => String(o[k])).join('|');
}

test('1. module exports the canonical public surface', () => {
  assert.equal(typeof deriveTestSuiteCountsFromSources, 'function');
  assert.equal(typeof loadCanonicalTestSuiteCounts, 'function');
  assert.equal(CONTRACT_VERSION, 1);
  assert.ok(Array.isArray(VOCABULARY));
  assert.ok(Array.isArray(SUPPLEMENTAL_VOCABULARY));
  assert.ok(Array.isArray(CANONICAL_GROUP_ENUM));
  assert.equal(typeof ERROR_CODES, 'object');
});

test('2. synthetic fixture derives exact expected counts', () => {
  const counts = deriveTestSuiteCountsFromSources(canonicalFixture());
  assert.equal(counts.default_total, 4);
  assert.equal(counts.SOURCE_STATIC, 1);
  assert.equal(counts.EXECUTED_FAKE, 1);
  assert.equal(counts.EXECUTED_REAL_LOCAL, 2);
  assert.equal(counts.browser_count, 1);
  assert.equal(counts.process_count, 1);
  assert.equal(counts.supplemental_python, 1);
  assert.equal(counts.supplemental_db_engine, 1);
  // default_total equals the sum of all layer counts.
  const layerSum =
    counts.SOURCE_STATIC +
    counts.EXECUTED_FAKE +
    counts.EXECUTED_REAL_LOCAL +
    counts.EXTERNAL_INTEGRATION +
    counts.PRODUCTION_SMOKE +
    counts.DB_ENGINE_EXECUTION;
  assert.equal(counts.default_total, layerSum);
});

test('3. result is frozen and detached', () => {
  const counts = deriveTestSuiteCountsFromSources(canonicalFixture());
  assert.ok(Object.isFrozen(counts), 'top-level result must be frozen');
  // The returned result is a detached snapshot: mutating the caller's input
  // AFTER derivation must not change the already-returned object.
  const fixture = canonicalFixture();
  const derived = deriveTestSuiteCountsFromSources(fixture);
  const before = serializeKeys(derived);
  fixture.classification.entries.push({
    path: 'tests/contracts/extra.test.cjs',
    layer: 'SOURCE_STATIC',
    rationale: 'x',
    capabilities: [],
  });
  assert.equal(
    serializeKeys(derived),
    before,
    'returned snapshot is detached from caller input mutation'
  );
  // Detached also means the returned object itself cannot be mutated.
  assert.throws(() => {
    'use strict';
    counts.default_total = 999;
  }, TypeError);
});

test('4. byte-stable and order-independent derivation', () => {
  const a = canonicalFixture();
  const b = canonicalFixture();
  b.classification.entries.reverse();
  b.registry.groups.reverse();
  b.enumeratedDefaultCi.reverse();
  const r1 = deriveTestSuiteCountsFromSources(a);
  const r2 = deriveTestSuiteCountsFromSources(b);
  assert.equal(serializeKeys(r1), serializeKeys(r2));
  assert.deepEqual(r1, r2);
});

test('5. real repository canonical counts match the reporter', () => {
  const canonical = loadCanonicalTestSuiteCounts();
  const reporter = buildReportData();
  assert.equal(canonical.default_total, reporter.default_total);
  assert.equal(canonical.SOURCE_STATIC, reporter.layer_counts.SOURCE_STATIC);
  assert.equal(canonical.EXECUTED_FAKE, reporter.layer_counts.EXECUTED_FAKE);
  assert.equal(canonical.EXECUTED_REAL_LOCAL, reporter.layer_counts.EXECUTED_REAL_LOCAL);
  assert.equal(canonical.browser_count, reporter.groups.find((g) => g.group === 'BROWSER_REAL_LOCAL').count);
  assert.equal(canonical.process_count, reporter.groups.find((g) => g.group === 'PROCESS_REAL_LOCAL').count);
  assert.equal(canonical.supplemental_python, reporter.supplemental_python);
  assert.equal(canonical.supplemental_db_engine, reporter.supplemental_db_engine);
});

test('6. real repository authority is internally consistent', () => {
  const canonical = loadCanonicalTestSuiteCounts();
  assert.ok(canonical.default_total > 0);
  const layerSum =
    canonical.SOURCE_STATIC +
    canonical.EXECUTED_FAKE +
    canonical.EXECUTED_REAL_LOCAL +
    canonical.EXTERNAL_INTEGRATION +
    canonical.PRODUCTION_SMOKE +
    canonical.DB_ENGINE_EXECUTION;
  assert.equal(canonical.default_total, layerSum);
  assert.equal(
    canonical.browser_count + canonical.process_count,
    canonical.EXECUTED_REAL_LOCAL,
    'browser + process must equal EXECUTED_REAL_LOCAL'
  );
  assert.ok(Object.isFrozen(canonical));
});

test('7. real classification and registry files are well-formed for the authority', () => {
  const classification = JSON.parse(fs.readFileSync(CLASSIFICATION_PATH, 'utf8'));
  const registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
  const canonical = deriveTestSuiteCountsFromSources({
    classification,
    registry,
    enumeratedDefaultCi: Object.keys(
      Object.fromEntries(
        classification.entries
          .filter((e) => e.defaultCi !== false)
          .map((e) => [e.path, true])
      )
    ),
  });
  assert.ok(canonical.default_total > 0);
});

// ── Negative controls ──────────────────────────────────────────────────────

test('NC1. malformed classification source fails closed', () => {
  const fixture = canonicalFixture();
  fixture.classification = null;
  assertCodeThrows(() => deriveTestSuiteCountsFromSources(fixture), ERROR_CODES.AUTHORITY_INPUT_INVALID);
  fixture.classification = { vocabulary: VOCABULARY };
  assertCodeThrows(() => deriveTestSuiteCountsFromSources(fixture), ERROR_CODES.AUTHORITY_INPUT_INVALID);
});

test('NC2. malformed registry source fails closed', () => {
  const fixture = canonicalFixture();
  fixture.registry = { group_enum: CANONICAL_GROUP_ENUM };
  assertCodeThrows(() => deriveTestSuiteCountsFromSources(fixture), ERROR_CODES.AUTHORITY_INPUT_INVALID);
  fixture.registry = { group_enum: CANONICAL_GROUP_ENUM, groups: [] };
  assertCodeThrows(() => deriveTestSuiteCountsFromSources(fixture), ERROR_CODES.REGISTRY_SCHEMA_ERROR);
});

test('NC3. duplicate classification path fails closed', () => {
  const fixture = canonicalFixture();
  fixture.classification.entries.push(fixture.classification.entries[0]);
  assertCodeThrows(() => deriveTestSuiteCountsFromSources(fixture), ERROR_CODES.DUPLICATE_PATH);
});

test('NC4. unclassified default test fails closed', () => {
  const fixture = canonicalFixture();
  fixture.enumeratedDefaultCi.push('tests/contracts/never-classified.test.cjs');
  assertCodeThrows(() => deriveTestSuiteCountsFromSources(fixture), ERROR_CODES.UNCLASSIFIED_DEFAULT_PATH);
});

test('NC5. conflicting classification fails closed', () => {
  const fixture = canonicalFixture();
  fixture.classification.entries.push({
    path: 'tests/contracts/a-source-static.test.cjs',
    layer: 'EXECUTED_FAKE',
    rationale: 'conflict',
    capabilities: [],
  });
  assertCodeThrows(() => deriveTestSuiteCountsFromSources(fixture), ERROR_CODES.DUPLICATE_PATH);
});

test('NC6. unknown layer fails closed', () => {
  const fixture = canonicalFixture();
  fixture.classification.entries[0].layer = 'NOT_A_LAYER';
  assertCodeThrows(() => deriveTestSuiteCountsFromSources(fixture), ERROR_CODES.UNKNOWN_ENUM);
});

test('NC7. unknown group fails closed', () => {
  const fixture = canonicalFixture();
  fixture.registry.groups.push({ group: 'NOT_A_GROUP', explicit_paths: [] });
  assertCodeThrows(() => deriveTestSuiteCountsFromSources(fixture), ERROR_CODES.UNKNOWN_ENUM);
});

test('NC8. stale registry path fails closed', () => {
  const fixture = canonicalFixture();
  fixture.registry.groups[0].explicit_paths.push('tests/contracts/not-real-local.test.cjs');
  assertCodeThrows(() => deriveTestSuiteCountsFromSources(fixture), ERROR_CODES.OVERLAPPING_MEMBERSHIP);
});

test('NC9. caller-selected path is rejected', () => {
  const fixture = canonicalFixture();
  fixture.path = '/arbitrary/caller/path';
  assertCodeThrows(() => deriveTestSuiteCountsFromSources(fixture), ERROR_CODES.AUTHORITY_UNKNOWN_FIELD);
});

test('NC10. count override is rejected', () => {
  const fixture = canonicalFixture();
  fixture.default_total = 999;
  assertCodeThrows(() => deriveTestSuiteCountsFromSources(fixture), ERROR_CODES.AUTHORITY_UNKNOWN_FIELD);
});

test('NC11. accessor/Proxy input is rejected', () => {
  const fixture = canonicalFixture();
  const proxy = new Proxy({ ...fixture.classification }, { get() { return undefined; } });
  fixture.classification = proxy;
  assertCodeThrows(() => deriveTestSuiteCountsFromSources(fixture), ERROR_CODES.AUTHORITY_ACCESSOR_INPUT);
});

test('NC12. mutable result is rejected', () => {
  const counts = deriveTestSuiteCountsFromSources(canonicalFixture());
  assert.ok(Object.isFrozen(counts));
  assert.throws(() => {
    'use strict';
    counts.SOURCE_STATIC = 0;
  }, TypeError);
});

test('NC13. nondeterministic ordering is impossible (byte-stable)', () => {
  const fixture = canonicalFixture();
  const r1 = deriveTestSuiteCountsFromSources(fixture);
  const r2 = deriveTestSuiteCountsFromSources(canonicalFixture());
  assert.deepEqual(r1, r2);
  assert.equal(serializeKeys(r1), serializeKeys(r2));
});

test('NC14. duplicate normalized default-CI inventory path fails closed', () => {
  const fixture = canonicalFixture();
  fixture.enumeratedDefaultCi.push(fixture.enumeratedDefaultCi[0]);
  assertCodeThrows(() => deriveTestSuiteCountsFromSources(fixture), ERROR_CODES.DUPLICATE_PATH);
  // Separator-only difference (Windows vs POSIX) is the same normalized path.
  const sepFixture = canonicalFixture();
  sepFixture.enumeratedDefaultCi.push('tests\\contracts\\a-source-static.test.cjs');
  assertCodeThrows(() => deriveTestSuiteCountsFromSources(sepFixture), ERROR_CODES.DUPLICATE_PATH);
});

test('NC15. duplicate normalized fixed test glob fails closed', () => {
  assertCodeThrows(
    () => parseTestGlobs('node --test tests/contracts/*.test.cjs tests/contracts/*.test.cjs'),
    ERROR_CODES.DUPLICATE_PATH
  );
  // Separator-only glob difference must also be rejected as a duplicate.
  assertCodeThrows(
    () => parseTestGlobs('node --test tests/contracts/*.test.cjs tests\\contracts\\*.test.cjs'),
    ERROR_CODES.DUPLICATE_PATH
  );
  // A single well-formed glob still parses.
  const single = parseTestGlobs('node --test tests/contracts/*.test.cjs');
  assert.deepEqual(single, ['tests/contracts/*.test.cjs']);
});

test('14. this contract is registered SOURCE_STATIC with no side-effect imports', () => {
  const classification = JSON.parse(fs.readFileSync(CLASSIFICATION_PATH, 'utf8'));
  const entry = classification.entries.find((e) => e.path === SELF_PATH);
  assert.ok(entry, 'classification entry must exist for this contract test');
  assert.equal(entry.layer, 'SOURCE_STATIC');
  const source = fs.readFileSync(__filename, 'utf8');
  assert.doesNotMatch(source, /require\s*\(\s*['"](?:http|node:http|https|node:https|node:net|child_process|node:child_process|node:fs\/promises)['"]/);
  assert.doesNotMatch(source, /\bfetch\s*\(/);
  assert.doesNotMatch(source, /\bsetTimeout\s*\(/);
  assert.doesNotMatch(source, /\bMath\.random\b/);
  assert.doesNotMatch(source, /\bprocess\.env\b/);
});

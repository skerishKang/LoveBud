'use strict';

/**
 * SOURCE_STATIC contract for deterministic catalog fingerprint normalizer.
 * No database, network, or shell beyond local process for CLI spawn.
 * Refs #3542, #3458, #3425
 */

const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..', '..');
const CORE = path.join(ROOT, 'scripts', 'migration-catalog-fingerprint-core.cjs');
const CLI = path.join(ROOT, 'scripts', 'build-migration-catalog-evidence.cjs');
const CONTRACT_PATH = path.join(ROOT, 'db', 'migration-provenance', 'catalog-metadata-contract.json');
const EXPECTED_SCHEMA = path.join(ROOT, 'db', 'migration-provenance', 'expected-schema-manifest.json');
const CANONICAL = path.join(ROOT, 'db', 'migration-provenance', 'canonical-migrations.json');
const FIX = path.join(ROOT, 'tests', 'contracts', 'fixtures', 'migration-provenance');
const PKG = path.join(ROOT, 'package.json');
const CLASS = path.join(ROOT, 'tests', 'test-layer-classification.json');

const core = require(CORE);

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function loadFixture(name) {
  return readJson(path.join(FIX, name));
}

function runCli(args) {
  return spawnSync(process.execPath, [CLI, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
  });
}

const contract = readJson(CONTRACT_PATH);

test('committed metadata contract is strict and complete', () => {
  assert.equal(contract.format_version, '1.0');
  assert.equal(contract.normalizer_version, '1.0');
  assert.deepEqual(contract.allowed_top_level_fields, [
    'format_version',
    'normalizer_version',
    'objects',
  ]);
  assert.deepEqual(contract.supported_object_kinds, ['TABLE', 'VIEW', 'MATERIALIZED_VIEW']);
  assert.ok(contract.limits.max_objects >= 1);
  assert.ok(Array.isArray(contract.prohibited_object_fields));
  assert.ok(contract.enums.constraint_kind.includes('FOREIGN_KEY'));
  assert.ok(contract.enums.role_scope.includes('PUBLIC'));
  assert.equal(contract.sql_definition_rules.comments_outside_quotes, 'fail_closed');
  assert.equal(core.validateCatalogMetadataContract(contract), true);
});

test('baseline generation succeeds with exact evidence shape', () => {
  const evidence = core.buildCatalogEvidence(loadFixture('catalog-baseline.json'), contract);
  assert.equal(evidence.format_version, '1.0');
  assert.equal(evidence.normalizer_version, '1.0');
  assert.equal(evidence.objects.length, 2);
  assert.equal(evidence.objects[0].name, 'table:public.example_tree');
  assert.equal(evidence.objects[1].name, 'view:public.example_tree_public');
  assert.match(evidence.objects[0].fingerprint, /^sha256:[a-f0-9]{64}$/);
  assert.match(evidence.objects[1].fingerprint, /^sha256:[a-f0-9]{64}$/);
});

test('repeated generation is byte-identical', () => {
  const a = core.buildCatalogEvidence(loadFixture('catalog-baseline.json'), contract);
  const b = core.buildCatalogEvidence(loadFixture('catalog-baseline.json'), contract);
  assert.equal(JSON.stringify(a), JSON.stringify(b));
});

test('object/component/JSON key order changes preserve fingerprints', () => {
  const baseline = core.buildCatalogEvidence(loadFixture('catalog-baseline.json'), contract);
  const reordered = core.buildCatalogEvidence(loadFixture('catalog-reordered.json'), contract);
  assert.deepEqual(baseline, reordered);
});

test('CRLF/LF equivalence for definitions', () => {
  const base = loadFixture('catalog-baseline.json');
  const crlf = JSON.parse(JSON.stringify(base));
  crlf.objects[0].constraints[1].definition =
    'CHECK ((title IS NULL)\r\n OR (char_length(title) > 0))';
  const a = core.buildCatalogEvidence(base, contract);
  const b = core.buildCatalogEvidence(crlf, contract);
  assert.deepEqual(a, b);
});

test('insignificant SQL whitespace equivalence', () => {
  const base = loadFixture('catalog-baseline.json');
  const spaced = JSON.parse(JSON.stringify(base));
  spaced.objects[0].constraints[1].definition =
    'CHECK  ((title   IS  NULL)  OR  (char_length(title) > 0))';
  assert.deepEqual(
    core.buildCatalogEvidence(base, contract),
    core.buildCatalogEvidence(spaced, contract)
  );
});

test('quoted literal internal whitespace is preserved as meaningful change', () => {
  const base = loadFixture('catalog-baseline.json');
  const left = JSON.parse(JSON.stringify(base));
  const right = JSON.parse(JSON.stringify(base));
  left.objects[0].columns[2].default_definition = "'hello world'";
  right.objects[0].columns[2].default_definition = "'hello  world'";
  const a = core.buildCatalogEvidence(left, contract);
  const b = core.buildCatalogEvidence(right, contract);
  assert.notEqual(a.objects[0].fingerprint, b.objects[0].fingerprint);
});

function assertDrift(fixtureName) {
  const base = core.buildCatalogEvidence(loadFixture('catalog-baseline.json'), contract);
  const drifted = core.buildCatalogEvidence(loadFixture(fixtureName), contract);
  assert.notEqual(
    base.objects[0].fingerprint,
    drifted.objects.find((o) => o.name === base.objects[0].name).fingerprint
  );
}

test('type drift changes fingerprint', () => assertDrift('catalog-type-drift.json'));
test('nullability drift changes fingerprint', () => assertDrift('catalog-nullability-drift.json'));
test('default drift changes fingerprint', () => assertDrift('catalog-default-drift.json'));
test('check drift changes fingerprint', () => assertDrift('catalog-check-drift.json'));
test('fk action drift changes fingerprint', () => assertDrift('catalog-fk-action-drift.json'));
test('index drift changes fingerprint', () => assertDrift('catalog-index-drift.json'));
test('trigger drift changes fingerprint', () => assertDrift('catalog-trigger-drift.json'));
test('rls drift changes fingerprint', () => assertDrift('catalog-rls-drift.json'));
test('view definition drift changes fingerprint', () => {
  const base = core.buildCatalogEvidence(loadFixture('catalog-baseline.json'), contract);
  const drifted = core.buildCatalogEvidence(loadFixture('catalog-view-drift.json'), contract);
  assert.notEqual(base.objects[1].fingerprint, drifted.objects[1].fingerprint);
});
test('grant drift changes fingerprint', () => assertDrift('catalog-grant-drift.json'));

function assertFail(fn, category) {
  let caught;
  try {
    fn();
  } catch (error) {
    caught = error;
  }
  assert.ok(caught, 'expected failure');
  assert.equal(caught.category, category);
  assert.equal(String(caught.message).includes('postgres://'), false);
  assert.equal(String(caught.message).includes('Bearer'), false);
}

test('duplicate object fails', () => {
  assertFail(
    () => core.buildCatalogEvidence(loadFixture('catalog-duplicate-object.json'), contract),
    'CATALOG_OBJECT_DUPLICATE'
  );
});

test('duplicate column fails', () => {
  assertFail(
    () => core.buildCatalogEvidence(loadFixture('catalog-duplicate-component.json'), contract),
    'CATALOG_COMPONENT_DUPLICATE'
  );
});

test('duplicate constraint fails', () => {
  const base = loadFixture('catalog-baseline.json');
  base.objects[0].constraints.push(JSON.parse(JSON.stringify(base.objects[0].constraints[0])));
  assertFail(() => core.buildCatalogEvidence(base, contract), 'CATALOG_COMPONENT_DUPLICATE');
});

test('duplicate index fails', () => {
  const base = loadFixture('catalog-baseline.json');
  base.objects[0].indexes.push(JSON.parse(JSON.stringify(base.objects[0].indexes[0])));
  assertFail(() => core.buildCatalogEvidence(base, contract), 'CATALOG_COMPONENT_DUPLICATE');
});

test('duplicate trigger fails', () => {
  const base = loadFixture('catalog-baseline.json');
  base.objects[0].triggers.push(JSON.parse(JSON.stringify(base.objects[0].triggers[0])));
  assertFail(() => core.buildCatalogEvidence(base, contract), 'CATALOG_COMPONENT_DUPLICATE');
});

test('duplicate policy fails', () => {
  const base = loadFixture('catalog-baseline.json');
  base.objects[0].row_level_security.policies.push(
    JSON.parse(JSON.stringify(base.objects[0].row_level_security.policies[0]))
  );
  assertFail(() => core.buildCatalogEvidence(base, contract), 'CATALOG_COMPONENT_DUPLICATE');
});

test('duplicate grant fails', () => {
  const base = loadFixture('catalog-baseline.json');
  base.objects[0].grants.push(JSON.parse(JSON.stringify(base.objects[0].grants[0])));
  assertFail(() => core.buildCatalogEvidence(base, contract), 'CATALOG_COMPONENT_DUPLICATE');
});

test('unknown top-level field fails', () => {
  assertFail(
    () => core.buildCatalogEvidence(loadFixture('catalog-unknown-field.json'), contract),
    'CATALOG_TOP_LEVEL_FIELD_UNKNOWN'
  );
});

test('unknown object field fails', () => {
  const base = loadFixture('catalog-baseline.json');
  base.objects[0].mystery = 1;
  assertFail(() => core.buildCatalogEvidence(base, contract), 'CATALOG_OBJECT_FIELD_UNKNOWN');
});

test('prohibited field fails', () => {
  assertFail(
    () => core.buildCatalogEvidence(loadFixture('catalog-prohibited-field.json'), contract),
    'CATALOG_FIELD_PROHIBITED'
  );
});

test('sensitive marker fails without echoing raw content', () => {
  assertFail(
    () => core.buildCatalogEvidence(loadFixture('catalog-sensitive-marker.json'), contract),
    'CATALOG_SENSITIVE_MARKER_DETECTED'
  );
});

test('bounds exceeded fails', () => {
  assertFail(
    () => core.buildCatalogEvidence(loadFixture('catalog-oversized.json'), contract),
    'CATALOG_BOUNDS_EXCEEDED'
  );
});

test('malformed types and invalid enums fail', () => {
  const base = loadFixture('catalog-baseline.json');
  base.objects[0].columns[0].nullable = 'true';
  assertFail(() => core.buildCatalogEvidence(base, contract), 'CATALOG_FIELD_TYPE_INVALID');

  const base2 = loadFixture('catalog-baseline.json');
  base2.objects[0].triggers[0].timing = 'SOMETIMES';
  assertFail(() => core.buildCatalogEvidence(base2, contract), 'CATALOG_ENUM_INVALID');
});

test('unterminated single quote fails', () => {
  assertFail(
    () => core.buildCatalogEvidence(loadFixture('catalog-unterminated-quote.json'), contract),
    'CATALOG_DEFINITION_UNTERMINATED_QUOTE'
  );
});

test('unterminated double quote fails', () => {
  const base = loadFixture('catalog-baseline.json');
  base.objects[0].indexes[1].definition = 'CREATE INDEX "open ON public.example_tree (title)';
  assertFail(() => core.buildCatalogEvidence(base, contract), 'CATALOG_DEFINITION_UNTERMINATED_QUOTE');
});

test('unterminated dollar quote fails', () => {
  const base = loadFixture('catalog-baseline.json');
  base.objects[0].constraints[1].definition = 'CHECK (title = $tag$unterminated)';
  assertFail(() => core.buildCatalogEvidence(base, contract), 'CATALOG_DEFINITION_UNTERMINATED_QUOTE');
});

test('comments outside quotes fail closed', () => {
  const base = loadFixture('catalog-baseline.json');
  base.objects[0].constraints[1].definition =
    'CHECK ((title IS NULL) OR (char_length(title) > 0)) -- comment';
  assertFail(
    () => core.buildCatalogEvidence(base, contract),
    'CATALOG_DEFINITION_COMMENT_UNSUPPORTED'
  );
  const base2 = loadFixture('catalog-baseline.json');
  base2.objects[0].constraints[1].definition =
    'CHECK ((title IS NULL) /* x */ OR (char_length(title) > 0))';
  assertFail(
    () => core.buildCatalogEvidence(base2, contract),
    'CATALOG_DEFINITION_COMMENT_UNSUPPORTED'
  );
});

test('CLI missing input / unknown flag / invalid JSON fail closed', () => {
  const missing = runCli([]);
  assert.equal(missing.status, 1);
  const body = JSON.parse(missing.stdout);
  assert.equal(body.decision, 'FAIL_CLOSED');
  assert.ok(body.blockers.length >= 1);

  const unknown = runCli(['--wat', 'x']);
  assert.equal(unknown.status, 1);
  assert.equal(JSON.parse(unknown.stdout).decision, 'FAIL_CLOSED');

  const tmp = path.join(os.tmpdir(), `catalog-bad-${process.pid}.json`);
  fs.writeFileSync(tmp, '{not-json');
  // outside repo root should fail closed without echoing path content
  const outside = runCli(['--input', tmp]);
  assert.equal(outside.status, 1);
  assert.equal(JSON.parse(outside.stdout).decision, 'FAIL_CLOSED');
  assert.equal(outside.stdout.includes(tmp), false);
  fs.unlinkSync(tmp);

  const invalidInside = path.join(FIX, '_tmp-invalid.json');
  fs.writeFileSync(invalidInside, '{not-json');
  const inv = runCli(['--input', 'tests/contracts/fixtures/migration-provenance/_tmp-invalid.json']);
  assert.equal(inv.status, 1);
  const invBody = JSON.parse(inv.stdout);
  assert.equal(invBody.decision, 'FAIL_CLOSED');
  assert.ok(invBody.blockers.includes('CATALOG_INPUT_JSON_INVALID'));
  fs.unlinkSync(invalidInside);
});

test('CLI success output exact shape', () => {
  const res = runCli([
    '--input',
    'tests/contracts/fixtures/migration-provenance/catalog-baseline.json',
  ]);
  assert.equal(res.status, 0, res.stderr);
  const body = JSON.parse(res.stdout);
  assert.equal(body.format_version, '1.0');
  assert.equal(body.normalizer_version, '1.0');
  assert.equal(body.objects.length, 2);
  assert.deepEqual(Object.keys(body.objects[0]).sort(), ['fingerprint', 'name']);
  assert.equal(res.stdout.includes('owner_class'), false);
});

test('CLI sensitive marker and duplicate and bounds fail closed without echo', () => {
  for (const [file, cat] of [
    ['catalog-sensitive-marker.json', 'CATALOG_SENSITIVE_MARKER_DETECTED'],
    ['catalog-duplicate-object.json', 'CATALOG_OBJECT_DUPLICATE'],
    ['catalog-oversized.json', 'CATALOG_BOUNDS_EXCEEDED'],
    ['catalog-unknown-field.json', 'CATALOG_TOP_LEVEL_FIELD_UNKNOWN'],
  ]) {
    const res = runCli(['--input', `tests/contracts/fixtures/migration-provenance/${file}`]);
    assert.equal(res.status, 1);
    const body = JSON.parse(res.stdout);
    assert.equal(body.decision, 'FAIL_CLOSED');
    assert.ok(body.blockers.includes(cat));
    assert.equal(res.stdout.includes('postgres://'), false);
    assert.equal(res.stdout.includes('user:pass'), false);
  }
});

test('no database/network/shell/environment dependency in new tools', () => {
  const coreSrc = fs.readFileSync(CORE, 'utf8');
  const cliSrc = fs.readFileSync(CLI, 'utf8');
  for (const src of [coreSrc, cliSrc]) {
    assert.equal(/require\(['"]pg['"]\)/.test(src), false);
    assert.equal(/DATABASE_URL/.test(src), false);
    assert.equal(/child_process/.test(src), false);
    assert.equal(/net\.|http\.|https\./.test(src), false);
  }
  const pkg = readJson(PKG);
  assert.equal(typeof pkg.scripts['build:migration-catalog-evidence'], 'string');
});

test('expected-schema and canonical manifests remain ADOPTION_REQUIRED and empty', () => {
  const expected = readJson(EXPECTED_SCHEMA);
  const canonical = readJson(CANONICAL);
  assert.equal(expected.status, 'ADOPTION_REQUIRED');
  assert.deepEqual(expected.critical_objects, []);
  assert.equal(expected.normalizer_version, '1.0');
  assert.equal(
    expected.metadata_contract_path,
    'db/migration-provenance/catalog-metadata-contract.json'
  );
  assert.equal(canonical.status, 'ADOPTION_REQUIRED');
  assert.deepEqual(canonical.migrations, []);
});

test('gate version binding rejects mismatched normalizer versions', () => {
  const expected = readJson(EXPECTED_SCHEMA);
  const bad = { ...expected, normalizer_version: '9.9' };
  const result = core.bindExpectedSchemaNormalizer(bad, contract);
  assert.equal(result.ok, false);
  assert.ok(result.errors.includes('EXPECTED_SCHEMA_NORMALIZER_CONTRACT_MISMATCH'));

  const evidence = core.buildCatalogEvidence(loadFixture('catalog-baseline.json'), contract);
  const badEv = { ...evidence, normalizer_version: '0.1' };
  const bound = core.bindCatalogEvidenceVersions(badEv, contract);
  assert.equal(bound.ok, false);
  assert.ok(bound.errors.includes('GATE_CATALOG_NORMALIZER_VERSION_MISMATCH'));
});

test('classification registers fingerprint contract as SOURCE_STATIC', () => {
  const inv = readJson(CLASS);
  const entry = inv.entries.find(
    (e) => e.path === 'tests/contracts/migration-catalog-fingerprint-contract.test.cjs'
  );
  assert.ok(entry);
  assert.equal(entry.layer, 'SOURCE_STATIC');
});

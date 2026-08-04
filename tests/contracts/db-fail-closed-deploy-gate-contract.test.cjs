'use strict';

/**
 * Source-static executed-fake contract for Issue #3872 (Step 8 Child 4 first
 * bounded implementation): source-only fail-closed deploy gate decision core.
 *
 * Executes the real pure core with bounded synthetic inputs only. No provider,
 * database, SQL, filesystem write, network, browser, or Production access.
 * Negative controls are in-memory; no tracked source file is mutated.
 *
 * Refs: #3872, #3860, #3458, #1882
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const gate = require('../../scripts/migration-fail-closed-deploy-gate-core.cjs');

const ROOT = path.resolve(__dirname, '..', '..');

function validEvidence() {
  return {
    contract_version: '1.0',
    release_sha: 'a'.repeat(40),
    canonical_manifest_status: 'ADOPTION_REQUIRED',
    canonical_manifest_checksum_posture: 'CHECKSUM_INTACT',
    expected_schema_status: 'ADOPTION_REQUIRED',
    expected_schema_critical_object_posture: 'CRITICAL_OBJECT_BOUND',
    ledger_provenance_verdict: 'LEDGER_PROVENANCE_CONFIRMED',
    target_attribution_verdict: 'TARGET_ATTRIBUTION_CONFIRMED',
    catalog_parity_verdict: 'CATALOG_PARITY_CONFIRMED',
    destructive_ddl_approval_verdict: 'DESTRUCTIVE_APPROVAL_CONFIRMED',
    recovery_gate_verdict: 'RECOVERY_GATE_CONFIRMED',
    activation_approval_verdict: 'ACTIVATION_APPROVAL_CONFIRMED',
  };
}

function evaluate(evidence) {
  return gate.evaluateDeployGate(evidence);
}

// ── 1. Exact vocabulary ──────────────────────────────────────────────────────

test('input key schema and verdict vocabulary are exact and frozen', () => {
  assert.equal(gate.CONTRACT_VERSION, '1.0');
  assert.deepEqual(gate.ALLOWED_INPUT_KEYS, [
    'contract_version',
    'release_sha',
    'canonical_manifest_status',
    'canonical_manifest_checksum_posture',
    'expected_schema_status',
    'expected_schema_critical_object_posture',
    'ledger_provenance_verdict',
    'target_attribution_verdict',
    'catalog_parity_verdict',
    'destructive_ddl_approval_verdict',
    'recovery_gate_verdict',
    'activation_approval_verdict',
  ]);
  assert.deepEqual(gate.VERDICTS, {
    DEPLOY_GATE_PRECONDITIONS_CONFIRMED: 'DEPLOY_GATE_PRECONDITIONS_CONFIRMED',
    DEPLOY_GATE_BLOCKED_INVALID_INPUT: 'DEPLOY_GATE_BLOCKED_INVALID_INPUT',
    DEPLOY_GATE_BLOCKED_MANIFEST_AUTHORITY: 'DEPLOY_GATE_BLOCKED_MANIFEST_AUTHORITY',
    DEPLOY_GATE_BLOCKED_LEDGER_PROVENANCE: 'DEPLOY_GATE_BLOCKED_LEDGER_PROVENANCE',
    DEPLOY_GATE_BLOCKED_TARGET_ATTRIBUTION: 'DEPLOY_GATE_BLOCKED_TARGET_ATTRIBUTION',
    DEPLOY_GATE_BLOCKED_CATALOG_PARITY: 'DEPLOY_GATE_BLOCKED_CATALOG_PARITY',
    DEPLOY_GATE_BLOCKED_DESTRUCTIVE_APPROVAL: 'DEPLOY_GATE_BLOCKED_DESTRUCTIVE_APPROVAL',
    DEPLOY_GATE_BLOCKED_RECOVERY_GATE: 'DEPLOY_GATE_BLOCKED_RECOVERY_GATE',
    DEPLOY_GATE_BLOCKED_ACTIVATION_APPROVAL: 'DEPLOY_GATE_BLOCKED_ACTIVATION_APPROVAL',
    DEPLOY_GATE_BLOCKED_INSUFFICIENT_EVIDENCE: 'DEPLOY_GATE_BLOCKED_INSUFFICIENT_EVIDENCE',
  });
  assert.ok(Object.isFrozen(gate.VERDICTS), 'verdict vocabulary frozen');
  assert.ok(Object.isFrozen(gate.ALLOWED_INPUT_KEYS), 'input key schema frozen');
  assert.deepEqual(gate.RECOVERY_GATE_VOCABULARY, [
    'RECOVERY_GATE_CONFIRMED',
    'RECOVERY_GATE_REQUIRED',
    'RECOVERY_GATE_INVALID',
  ]);
});

test('core source has no network/DB/SQL/filesystem/env/storage capability', () => {
  const source = fs.readFileSync(
    path.join(ROOT, 'scripts', 'migration-fail-closed-deploy-gate-core.cjs'),
    'utf8'
  );
  for (const capability of [
    'require("pg")',
    "require('pg')",
    'fetch(',
    'XMLHttpRequest',
    'WebSocket',
    'readFileSync',
    'writeFileSync',
    'process.env',
    'execSync',
    'spawn(',
    'setTimeout',
    'setInterval',
    'CREATE TABLE',
    'INSERT INTO',
    'DELETE FROM',
    'GRANT ',
    'psql',
  ]) {
    assert.ok(!source.includes(capability), 'core must not contain capability: ' + capability);
  }
});

test('committed manifests remain ADOPTION_REQUIRED in source', () => {
  const canonical = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'db/migration-provenance/canonical-migrations.json'), 'utf8')
  );
  const expected = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'db/migration-provenance/expected-schema-manifest.json'), 'utf8')
  );
  assert.equal(canonical.status, 'ADOPTION_REQUIRED');
  assert.equal(expected.status, 'ADOPTION_REQUIRED');
});

// ── 2. Positive and mutation-flag invariants ────────────────────────────────

test('valid bounded synthetic evidence confirms preconditions with zero mutation flags', () => {
  const result = evaluate(validEvidence());
  assert.equal(result.verdict, 'DEPLOY_GATE_PRECONDITIONS_CONFIRMED');
  assert.equal(result.blocked_gate, null);
  assert.equal(result.activation_performed, false);
  assert.equal(result.deployment_performed, false);
  assert.equal(result.manifest_mutated, false);
  assert.equal(result.target_mutated, false);
});

test('every verdict keeps all four mutation flags false', () => {
  const scenarios = [
    { overrides: {}, verdict: 'DEPLOY_GATE_PRECONDITIONS_CONFIRMED' },
    { overrides: { release_sha: 'bad' }, verdict: 'DEPLOY_GATE_BLOCKED_INVALID_INPUT' },
    { overrides: { extra: 1 }, verdict: 'DEPLOY_GATE_BLOCKED_INVALID_INPUT' },
    { overrides: { canonical_manifest_status: 'ACTIVE' }, verdict: 'DEPLOY_GATE_BLOCKED_MANIFEST_AUTHORITY' },
    { overrides: { ledger_provenance_verdict: 'LEDGER_PROVENANCE_EDITED' }, verdict: 'DEPLOY_GATE_BLOCKED_LEDGER_PROVENANCE' },
    { overrides: { target_attribution_verdict: 'TARGET_ATTRIBUTION_INVALID' }, verdict: 'DEPLOY_GATE_BLOCKED_TARGET_ATTRIBUTION' },
    { overrides: { catalog_parity_verdict: 'CATALOG_PARITY_MISMATCH' }, verdict: 'DEPLOY_GATE_BLOCKED_CATALOG_PARITY' },
    { overrides: { destructive_ddl_approval_verdict: 'DESTRUCTIVE_APPROVAL_MISSING' }, verdict: 'DEPLOY_GATE_BLOCKED_DESTRUCTIVE_APPROVAL' },
    { overrides: { recovery_gate_verdict: 'RECOVERY_GATE_INVALID' }, verdict: 'DEPLOY_GATE_BLOCKED_RECOVERY_GATE' },
    { overrides: { activation_approval_verdict: 'ACTIVATION_APPROVAL_MISSING' }, verdict: 'DEPLOY_GATE_BLOCKED_ACTIVATION_APPROVAL' },
    { overrides: { catalog_parity_verdict: 'CATALOG_PARITY_INSUFFICIENT' }, verdict: 'DEPLOY_GATE_BLOCKED_INSUFFICIENT_EVIDENCE' },
  ];
  for (const scenario of scenarios) {
    const result = evaluate({ ...validEvidence(), ...scenario.overrides });
    assert.equal(result.verdict, scenario.verdict, scenario.verdict);
    assert.equal(result.activation_performed, false);
    assert.equal(result.deployment_performed, false);
    assert.equal(result.manifest_mutated, false);
    assert.equal(result.target_mutated, false);
  }
});

// ── 3. Blocked scenarios ────────────────────────────────────────────────────

test('invalid release SHA blocks with invalid input', () => {
  for (const bad of ['', 'ABC'.repeat(10), 'a'.repeat(39), 'a'.repeat(41), 'nothex']) {
    const result = evaluate({ ...validEvidence(), release_sha: bad });
    assert.equal(result.verdict, 'DEPLOY_GATE_BLOCKED_INVALID_INPUT', 'bad SHA: ' + bad);
  }
});

test('unknown field or unknown enum value blocks with invalid input', () => {
  const unknownField = evaluate({ ...validEvidence(), provider: 'neon' });
  assert.equal(unknownField.verdict, 'DEPLOY_GATE_BLOCKED_INVALID_INPUT');
  const unknownValue = evaluate({ ...validEvidence(), ledger_provenance_verdict: 'WHATEVER' });
  assert.equal(unknownValue.verdict, 'DEPLOY_GATE_BLOCKED_INVALID_INPUT');
  const missingKey = Object.assign({}, validEvidence());
  delete missingKey.release_sha;
  const missing = evaluate(missingKey);
  assert.equal(missing.verdict, 'DEPLOY_GATE_BLOCKED_INVALID_INPUT');
});

test('manifest authority malformed or missing blocks', () => {
  const activeCanonical = evaluate({ ...validEvidence(), canonical_manifest_status: 'ACTIVE' });
  assert.equal(activeCanonical.verdict, 'DEPLOY_GATE_BLOCKED_MANIFEST_AUTHORITY');
  const checksumMismatch = evaluate({ ...validEvidence(), canonical_manifest_checksum_posture: 'CHECKSUM_MISMATCH' });
  assert.equal(checksumMismatch.verdict, 'DEPLOY_GATE_BLOCKED_MANIFEST_AUTHORITY');
  const activeExpected = evaluate({ ...validEvidence(), expected_schema_status: 'ACTIVE' });
  assert.equal(activeExpected.verdict, 'DEPLOY_GATE_BLOCKED_MANIFEST_AUTHORITY');
  const objectMismatch = evaluate({ ...validEvidence(), expected_schema_critical_object_posture: 'CRITICAL_OBJECT_MISMATCH' });
  assert.equal(objectMismatch.verdict, 'DEPLOY_GATE_BLOCKED_MANIFEST_AUTHORITY');
});

test('ledger missing/reordered/edited/mismatch blocks ledger provenance', () => {
  for (const ledger of ['LEDGER_PROVENANCE_MISMATCH', 'LEDGER_PROVENANCE_EDITED']) {
    const result = evaluate({ ...validEvidence(), ledger_provenance_verdict: ledger });
    assert.equal(result.verdict, 'DEPLOY_GATE_BLOCKED_LEDGER_PROVENANCE', ledger);
  }
});

test('target attribution invalid blocks', () => {
  const result = evaluate({ ...validEvidence(), target_attribution_verdict: 'TARGET_ATTRIBUTION_INVALID' });
  assert.equal(result.verdict, 'DEPLOY_GATE_BLOCKED_TARGET_ATTRIBUTION');
});

test('catalog parity mismatch and insufficient evidence block', () => {
  const mismatch = evaluate({ ...validEvidence(), catalog_parity_verdict: 'CATALOG_PARITY_MISMATCH' });
  assert.equal(mismatch.verdict, 'DEPLOY_GATE_BLOCKED_CATALOG_PARITY');
  const insufficient = evaluate({ ...validEvidence(), catalog_parity_verdict: 'CATALOG_PARITY_INSUFFICIENT' });
  assert.equal(insufficient.verdict, 'DEPLOY_GATE_BLOCKED_INSUFFICIENT_EVIDENCE');
});

test('destructive approval missing or invalid blocks', () => {
  for (const verdict of ['DESTRUCTIVE_APPROVAL_MISSING', 'DESTRUCTIVE_APPROVAL_INVALID']) {
    const result = evaluate({ ...validEvidence(), destructive_ddl_approval_verdict: verdict });
    assert.equal(result.verdict, 'DEPLOY_GATE_BLOCKED_DESTRUCTIVE_APPROVAL', verdict);
  }
});

test('recovery gate missing or invalid blocks without implementing #3460', () => {
  for (const verdict of ['RECOVERY_GATE_REQUIRED', 'RECOVERY_GATE_INVALID']) {
    const result = evaluate({ ...validEvidence(), recovery_gate_verdict: verdict });
    assert.equal(result.verdict, 'DEPLOY_GATE_BLOCKED_RECOVERY_GATE', verdict);
  }
  const missing = evaluate({ ...validEvidence(), recovery_gate_verdict: 'RECOVERY_GATE_MISSING' });
  assert.equal(missing.verdict, 'DEPLOY_GATE_BLOCKED_INSUFFICIENT_EVIDENCE');
});

test('activation approval missing or invalid blocks', () => {
  for (const verdict of ['ACTIVATION_APPROVAL_MISSING', 'ACTIVATION_APPROVAL_INVALID']) {
    const result = evaluate({ ...validEvidence(), activation_approval_verdict: verdict });
    assert.equal(result.verdict, 'DEPLOY_GATE_BLOCKED_ACTIVATION_APPROVAL', verdict);
  }
});

test('insufficient evidence variants block with insufficient evidence verdict', () => {
  for (const overrides of [
    { canonical_manifest_checksum_posture: 'CHECKSUM_MISSING' },
    { expected_schema_critical_object_posture: 'CRITICAL_OBJECT_MISSING' },
    { ledger_provenance_verdict: 'LEDGER_PROVENANCE_MISSING' },
    { target_attribution_verdict: 'TARGET_ATTRIBUTION_MISSING' },
    { catalog_parity_verdict: 'CATALOG_PARITY_INSUFFICIENT' },
    { recovery_gate_verdict: 'RECOVERY_GATE_MISSING' },
  ]) {
    const result = evaluate({ ...validEvidence(), ...overrides });
    assert.equal(result.verdict, 'DEPLOY_GATE_BLOCKED_INSUFFICIENT_EVIDENCE', JSON.stringify(overrides));
  }
});

// ── 4. Descriptor safety ────────────────────────────────────────────────────

test('nested getter in evidence is never invoked and fails closed', () => {
  let getterCalls = 0;
  const evidence = validEvidence();
  Object.defineProperty(evidence, 'release_sha', {
    enumerable: true,
    configurable: true,
    get() {
      getterCalls += 1;
      return 'a'.repeat(40);
    },
  });
  const result = evaluate(evidence);
  assert.equal(result.verdict, 'DEPLOY_GATE_BLOCKED_INVALID_INPUT');
  assert.equal(getterCalls, 0, 'nested getter never invoked');
  assert.ok(!JSON.stringify(result).includes('getter'), 'no getter detail leakage');
});

test('nested Proxy get trap is never invoked and no raw detail leaks', () => {
  let getTrapCalls = 0;
  const evidence = new Proxy(validEvidence(), {
    get(target, key, receiver) {
      getTrapCalls += 1;
      throw new Error('raw provider detail leaked');
    },
  });
  const result = evaluate(evidence);
  assert.equal(getTrapCalls, 0, 'nested Proxy get trap never invoked');
  assert.ok(!JSON.stringify(result).includes('raw provider detail leaked'), 'no trap detail leakage');
  assert.equal(result.verdict, 'DEPLOY_GATE_PRECONDITIONS_CONFIRMED', 'descriptor-safe reads resolve the evidence');
});

test('top-level getter config is never invoked and fails closed', () => {
  let getterCalls = 0;
  const evidence = {};
  Object.defineProperty(evidence, 'contract_version', {
    enumerable: true,
    configurable: true,
    get() {
      getterCalls += 1;
      return '1.0';
    },
  });
  for (const key of Object.keys(validEvidence())) {
    if (key !== 'contract_version') {
      evidence[key] = validEvidence()[key];
    }
  }
  const result = evaluate(evidence);
  assert.equal(result.verdict, 'DEPLOY_GATE_BLOCKED_INVALID_INPUT');
  assert.equal(getterCalls, 0);
});

test('raw error/provider/DB/path/URL details never leak into results', () => {
  const source = fs.readFileSync(
    path.join(ROOT, 'scripts', 'migration-fail-closed-deploy-gate-core.cjs'),
    'utf8'
  );
  for (const identifier of ['DATABASE_URL', 'connection_string', 'db.example.com', 'neon.tech', 'postgres://']) {
    assert.ok(!source.includes(identifier), 'core must not contain identifier: ' + identifier);
  }
  const result = evaluate({ ...validEvidence(), host: 'db.internal' });
  assert.ok(!JSON.stringify(result).includes('db.internal'), 'no raw host leakage');
  assert.equal(result.verdict, 'DEPLOY_GATE_BLOCKED_INVALID_INPUT');
});

// ── 5. Determinism, frozen, detached, input immutability ────────────────────

test('same bounded input produces awaited byte-stable results', () => {
  const first = gate.evaluateDeployGate(validEvidence());
  const second = gate.evaluateDeployGate(validEvidence());
  const firstJson = JSON.stringify(first);
  const secondJson = JSON.stringify(second);
  assert.notEqual(firstJson, '{}');
  assert.notEqual(secondJson, '{}');
  assert.equal(first.verdict, 'DEPLOY_GATE_PRECONDITIONS_CONFIRMED');
  assert.equal(second.verdict, 'DEPLOY_GATE_PRECONDITIONS_CONFIRMED');
  assert.equal(firstJson, secondJson, 'byte-stable serialized equality');
  assert.equal(Object.isFrozen(first), true, 'first result frozen');
  assert.equal(Object.isFrozen(second), true, 'second result frozen');
});

test('input is never mutated and result is detached', () => {
  const evidence = validEvidence();
  const before = JSON.stringify(evidence);
  const result = evaluate(evidence);
  assert.equal(JSON.stringify(evidence), before, 'input not mutated');
  assert.ok(Object.isFrozen(result));
  assert.throws(() => {
    result.verdict = 'CHANGED';
  }, TypeError);
});

test('null/undefined/primitive input fails closed', () => {
  for (const bad of [undefined, null, 42, 'text', ['array'], true]) {
    const result = evaluate(bad);
    assert.equal(result.verdict, 'DEPLOY_GATE_BLOCKED_INVALID_INPUT');
    assert.equal(result.collection_effect_count ?? undefined, undefined);
  }
});

// ── 6. Decision posture ─────────────────────────────────────────────────────

test('decision doc records Child 4 source-only core and completion review marker', () => {
  const decision = fs.readFileSync(
    path.join(ROOT, 'docs/architecture/DB_MIGRATION_PROVENANCE_NEXT_CHILD_DECISION.md'),
    'utf8'
  );
  assert.ok(decision.includes('MIGRATION_PROVENANCE_COMPLETION_REVIEW_SELECTED'), 'completion review marker');
  assert.ok(/Step 8 Child 4/i.test(decision), 'Child 4 identified');
  assert.ok(/#3458/.test(decision), '#3458 referenced');
  assert.ok(/ADOPTION_REQUIRED/.test(decision), 'manifests remain ADOPTION_REQUIRED');
});

test('classification registers the contract as EXECUTED_FAKE', () => {
  const classification = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'tests/test-layer-classification.json'), 'utf8')
  );
  const entry = classification.entries.find(
    (e) => e.path === 'tests/contracts/db-fail-closed-deploy-gate-contract.test.cjs'
  );
  assert.ok(entry, 'contract classified');
  assert.equal(entry.layer, 'EXECUTED_FAKE');
});

// ── 7. Hostile trap negative controls ────────────────────────────────────────

function makeHostileThrownObject() {
  const state = { thrownGetterCalls: 0 };
  const hostile = {};
  Object.defineProperty(hostile, 'category', {
    enumerable: true,
    configurable: true,
    get() {
      state.thrownGetterCalls += 1;
      throw new Error('raw hostile category detail');
    },
  });
  return { hostile, state };
}

function assertHostileClosed(result, state, trapCalls) {
  assert.ok(trapCalls >= 1, 'hostile trap executed');
  assert.equal(state.thrownGetterCalls, 0, 'hostile thrown category getter never invoked');
  assert.equal(result.verdict, 'DEPLOY_GATE_BLOCKED_INVALID_INPUT');
  assert.equal(result.blocked_gate, 'input');
  assert.ok(
    !JSON.stringify(result).includes('raw hostile category detail'),
    'no raw hostile category detail leakage'
  );
}

test('hostile getPrototypeOf trap throw fails closed without reading thrown detail', () => {
  const { hostile, state } = makeHostileThrownObject();
  let trapCalls = 0;
  const evidence = new Proxy(validEvidence(), {
    getPrototypeOf() {
      trapCalls += 1;
      throw hostile;
    },
  });
  const result = evaluate(evidence);
  assertHostileClosed(result, state, trapCalls);
});

test('hostile ownKeys trap throw fails closed without reading thrown detail', () => {
  const { hostile, state } = makeHostileThrownObject();
  let trapCalls = 0;
  const evidence = new Proxy(validEvidence(), {
    ownKeys() {
      trapCalls += 1;
      throw hostile;
    },
  });
  const result = evaluate(evidence);
  assertHostileClosed(result, state, trapCalls);
});

test('hostile getOwnPropertyDescriptor trap throw fails closed without reading thrown detail', () => {
  const { hostile, state } = makeHostileThrownObject();
  let trapCalls = 0;
  const evidence = new Proxy(validEvidence(), {
    getOwnPropertyDescriptor() {
      trapCalls += 1;
      throw hostile;
    },
  });
  const result = evaluate(evidence);
  assertHostileClosed(result, state, trapCalls);
});

// ── 8. Export surface immutability ───────────────────────────────────────────

test('export surface is frozen and rejects mutation with unchanged public keys', () => {
  const publicKeys = Object.keys(gate).sort();
  assert.equal(Object.isFrozen(gate), true, 'export object frozen');
  assert.throws(() => {
    gate.CONTRACT_VERSION = 'changed';
  }, TypeError, 'CONTRACT_VERSION reassignment rejected');
  assert.throws(() => {
    gate.extra = true;
  }, TypeError, 'extra export rejected');
  assert.throws(() => {
    delete gate.evaluateDeployGate;
  }, TypeError, 'export deletion rejected');
  assert.equal(gate.CONTRACT_VERSION, '1.0');
  assert.equal(typeof gate.evaluateDeployGate, 'function');
  assert.equal(gate.extra, undefined, 'extra export absent');
  assert.deepEqual(Object.keys(gate).sort(), publicKeys, 'public key set unchanged');
});

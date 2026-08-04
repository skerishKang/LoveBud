'use strict';

/**
 * Executed-fake contract for Issue #3880: source-only pre-change recovery gate
 * and stale recovery-point alert core.
 *
 * Executes the real pure core with bounded synthetic inputs only. No provider,
 * database, SQL, snapshot, branch, restore, reset, network, filesystem write,
 * browser, or Production access. Negative controls are in-memory; no tracked
 * source file is mutated.
 *
 * Refs: #3880, #3460, #3878, #1882
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const gate = require('../../scripts/database-recovery-gate-core.cjs');

const ROOT = path.resolve(__dirname, '..', '..');

function validEvidence() {
  return {
    policy_version: '1.0',
    operation_risk_class: 'TIER_3',
    provider_capability_status: 'PROVIDER_CAPABILITY_CONFIRMED',
    recovery_point_status: 'RECOVERY_POINT_VALID',
    recovery_point_age_class: 'AGE_WITHIN_RPO',
    retention_class: 'RETENTION_CONFIRMED',
    restore_drill_status: 'RESTORE_DRILL_CONFIRMED',
    restore_target_class: 'RESTORE_TARGET_ISOLATED_COPY',
    schema_verification_status: 'PRESENT',
    relational_verification_status: 'PRESENT',
    approval_status: 'PRESENT',
  };
}

function evaluate(evidence) {
  return gate.evaluateRecoveryGate(evidence);
}

const FIXED_FLAGS = [
  'provider_contacted',
  'secret_read',
  'network_performed',
  'database_connected',
  'snapshot_created',
  'branch_created',
  'restore_performed',
  'reset_performed',
  'production_mutated',
];

function assertAllFlagsFalse(result) {
  for (const flag of FIXED_FLAGS) {
    assert.equal(result[flag], false, flag + ' must be false');
  }
}

function assertBlocked(result, verdict, blockedGate) {
  assert.equal(result.verdict, verdict, verdict);
  assert.equal(result.blocked_gate, blockedGate, 'blocked gate for ' + verdict);
  assertAllFlagsFalse(result);
}

// ── 1. Exact vocabulary and export immutability ──────────────────────────────

test('input key schema and result vocabulary are exact and frozen', () => {
  assert.equal(gate.CONTRACT_VERSION, '1.0');
  assert.deepEqual(gate.ALLOWED_INPUT_KEYS, [
    'policy_version',
    'operation_risk_class',
    'provider_capability_status',
    'recovery_point_status',
    'recovery_point_age_class',
    'retention_class',
    'restore_drill_status',
    'restore_target_class',
    'schema_verification_status',
    'relational_verification_status',
    'approval_status',
  ]);
  assert.deepEqual(gate.VERDICTS, {
    RECOVERY_GATE_CONFIRMED: 'RECOVERY_GATE_CONFIRMED',
    RECOVERY_GATE_BLOCKED_PROVIDER_CAPABILITY: 'RECOVERY_GATE_BLOCKED_PROVIDER_CAPABILITY',
    RECOVERY_GATE_BLOCKED_RECOVERY_POINT_MISSING: 'RECOVERY_GATE_BLOCKED_RECOVERY_POINT_MISSING',
    RECOVERY_GATE_BLOCKED_RECOVERY_POINT_STALE: 'RECOVERY_GATE_BLOCKED_RECOVERY_POINT_STALE',
    RECOVERY_GATE_BLOCKED_RECOVERY_POINT_UNKNOWN: 'RECOVERY_GATE_BLOCKED_RECOVERY_POINT_UNKNOWN',
    RECOVERY_GATE_BLOCKED_RESTORE_DRILL_OVERDUE: 'RECOVERY_GATE_BLOCKED_RESTORE_DRILL_OVERDUE',
    RECOVERY_GATE_BLOCKED_SCHEMA_VERIFICATION: 'RECOVERY_GATE_BLOCKED_SCHEMA_VERIFICATION',
    RECOVERY_GATE_BLOCKED_RELATIONAL_VERIFICATION: 'RECOVERY_GATE_BLOCKED_RELATIONAL_VERIFICATION',
    RECOVERY_GATE_BLOCKED_APPROVAL: 'RECOVERY_GATE_BLOCKED_APPROVAL',
    RECOVERY_GATE_BLOCKED_INVALID_INPUT: 'RECOVERY_GATE_BLOCKED_INVALID_INPUT',
  });
  assert.ok(Object.isFrozen(gate.VERDICTS), 'verdict vocabulary frozen');
  assert.ok(Object.isFrozen(gate.ALLOWED_INPUT_KEYS), 'input key schema frozen');
});

test('export surface is frozen and rejects mutation with unchanged public keys', () => {
  const publicKeys = Object.keys(gate).sort();
  assert.equal(Object.isFrozen(gate), true, 'export object frozen');
  assert.throws(() => {
    gate.CONTRACT_VERSION = 'changed';
  }, TypeError);
  assert.throws(() => {
    gate.extra = true;
  }, TypeError);
  assert.throws(() => {
    delete gate.evaluateRecoveryGate;
  }, TypeError);
  assert.equal(gate.CONTRACT_VERSION, '1.0');
  assert.equal(typeof gate.evaluateRecoveryGate, 'function');
  assert.equal(gate.extra, undefined, 'extra export absent');
  assert.deepEqual(Object.keys(gate).sort(), publicKeys, 'public key set unchanged');
});

test('core source has no provider/network/DB/snapshot/restore/filesystem/env capability', () => {
  const source = fs.readFileSync(
    path.join(ROOT, 'scripts', 'database-recovery-gate-core.cjs'),
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
    'pg_dump',
    'psql',
    'backup_schedule',
    'createSnapshot',
    'restoreSnapshot',
    'neon',
    'boto3',
  ]) {
    assert.ok(!source.includes(capability), 'core must not contain capability: ' + capability);
  }
});

// ── 2. Positive and fixed capability flags ───────────────────────────────────

test('synthetic fully confirmed evidence confirms with zero mutation flags', () => {
  const result = evaluate(validEvidence());
  assert.equal(result.verdict, 'RECOVERY_GATE_CONFIRMED');
  assert.equal(result.blocked_gate, null);
  assert.equal(result.contract_version, '1.0');
  assertAllFlagsFalse(result);
});

test('every outcome keeps all nine capability flags false', () => {
  const scenarios = [
    { overrides: {}, verdict: 'RECOVERY_GATE_CONFIRMED' },
    { overrides: { provider_capability_status: 'PROVIDER_CAPABILITY_UNVERIFIED' }, verdict: 'RECOVERY_GATE_BLOCKED_PROVIDER_CAPABILITY' },
    { overrides: { recovery_point_status: 'RECOVERY_POINT_MISSING' }, verdict: 'RECOVERY_GATE_BLOCKED_RECOVERY_POINT_MISSING' },
    { overrides: { recovery_point_status: 'RECOVERY_POINT_STALE' }, verdict: 'RECOVERY_GATE_BLOCKED_RECOVERY_POINT_STALE' },
    { overrides: { recovery_point_status: 'RECOVERY_POINT_STATUS_UNKNOWN' }, verdict: 'RECOVERY_GATE_BLOCKED_RECOVERY_POINT_UNKNOWN' },
    { overrides: { recovery_point_age_class: 'AGE_EXCEEDS_RPO' }, verdict: 'RECOVERY_GATE_BLOCKED_RECOVERY_POINT_STALE' },
    { overrides: { restore_drill_status: 'RESTORE_DRILL_OVERDUE' }, verdict: 'RECOVERY_GATE_BLOCKED_RESTORE_DRILL_OVERDUE' },
    { overrides: { restore_drill_status: 'RESTORE_DRILL_NOT_CONFIRMED' }, verdict: 'RECOVERY_GATE_BLOCKED_RESTORE_DRILL_OVERDUE' },
    { overrides: { schema_verification_status: 'ABSENT' }, verdict: 'RECOVERY_GATE_BLOCKED_SCHEMA_VERIFICATION' },
    { overrides: { schema_verification_status: 'UNVERIFIED' }, verdict: 'RECOVERY_GATE_BLOCKED_SCHEMA_VERIFICATION' },
    { overrides: { relational_verification_status: 'ABSENT' }, verdict: 'RECOVERY_GATE_BLOCKED_RELATIONAL_VERIFICATION' },
    { overrides: { relational_verification_status: 'UNVERIFIED' }, verdict: 'RECOVERY_GATE_BLOCKED_RELATIONAL_VERIFICATION' },
    { overrides: { approval_status: 'ABSENT' }, verdict: 'RECOVERY_GATE_BLOCKED_APPROVAL' },
    { overrides: { approval_status: 'UNVERIFIED' }, verdict: 'RECOVERY_GATE_BLOCKED_APPROVAL' },
  ];
  for (const scenario of scenarios) {
    const result = evaluate({ ...validEvidence(), ...scenario.overrides });
    assert.equal(result.verdict, scenario.verdict, scenario.verdict);
    assertAllFlagsFalse(result);
  }
});

// ── 3. Fail-closed matrix ────────────────────────────────────────────────────

test('provider capability unverified blocks provider capability gate', () => {
  const result = evaluate({ ...validEvidence(), provider_capability_status: 'PROVIDER_CAPABILITY_UNVERIFIED' });
  assertBlocked(result, 'RECOVERY_GATE_BLOCKED_PROVIDER_CAPABILITY', 'provider_capability');
});

test('recovery point missing blocks recovery point gate', () => {
  const result = evaluate({ ...validEvidence(), recovery_point_status: 'RECOVERY_POINT_MISSING' });
  assertBlocked(result, 'RECOVERY_GATE_BLOCKED_RECOVERY_POINT_MISSING', 'recovery_point_missing');
});

test('recovery point stale blocks recovery point gate', () => {
  const result = evaluate({ ...validEvidence(), recovery_point_status: 'RECOVERY_POINT_STALE' });
  assertBlocked(result, 'RECOVERY_GATE_BLOCKED_RECOVERY_POINT_STALE', 'recovery_point_stale');
});

test('recovery point unknown blocks recovery point gate', () => {
  const result = evaluate({ ...validEvidence(), recovery_point_status: 'RECOVERY_POINT_STATUS_UNKNOWN' });
  assertBlocked(result, 'RECOVERY_GATE_BLOCKED_RECOVERY_POINT_UNKNOWN', 'recovery_point_unknown');
});

test('age exceeding RPO blocks as stale even with a valid recovery point', () => {
  const result = evaluate({ ...validEvidence(), recovery_point_age_class: 'AGE_EXCEEDS_RPO' });
  assertBlocked(result, 'RECOVERY_GATE_BLOCKED_RECOVERY_POINT_STALE', 'recovery_point_stale');
});

test('restore drill overdue blocks a Tier-3 operation', () => {
  const result = evaluate({ ...validEvidence(), restore_drill_status: 'RESTORE_DRILL_OVERDUE' });
  assertBlocked(result, 'RECOVERY_GATE_BLOCKED_RESTORE_DRILL_OVERDUE', 'restore_drill_overdue');
});

test('restore drill not confirmed blocks a Tier-3 operation per policy authority', () => {
  const result = evaluate({ ...validEvidence(), restore_drill_status: 'RESTORE_DRILL_NOT_CONFIRMED' });
  assertBlocked(result, 'RECOVERY_GATE_BLOCKED_RESTORE_DRILL_OVERDUE', 'restore_drill_overdue');
});

test('restore drill overdue does not block a low-risk operation per policy authority', () => {
  const result = evaluate({
    ...validEvidence(),
    operation_risk_class: 'TIER_1',
    restore_drill_status: 'RESTORE_DRILL_OVERDUE',
  });
  assert.equal(result.verdict, 'RECOVERY_GATE_CONFIRMED', 'drill gates Tier 3 only');
});

test('schema verification absent or unverified blocks schema gate', () => {
  for (const state of ['ABSENT', 'UNVERIFIED']) {
    const result = evaluate({ ...validEvidence(), schema_verification_status: state });
    assertBlocked(result, 'RECOVERY_GATE_BLOCKED_SCHEMA_VERIFICATION', 'schema_verification');
  }
});

test('relational verification absent or unverified blocks relational gate', () => {
  for (const state of ['ABSENT', 'UNVERIFIED']) {
    const result = evaluate({ ...validEvidence(), relational_verification_status: state });
    assertBlocked(result, 'RECOVERY_GATE_BLOCKED_RELATIONAL_VERIFICATION', 'relational_verification');
  }
});

test('approval absent or unverified blocks approval gate', () => {
  for (const state of ['ABSENT', 'UNVERIFIED']) {
    const result = evaluate({ ...validEvidence(), approval_status: state });
    assertBlocked(result, 'RECOVERY_GATE_BLOCKED_APPROVAL', 'approval');
  }
});

test('bounded context fields do not weaken any gate', () => {
  const confirmed = evaluate({
    ...validEvidence(),
    retention_class: 'RETENTION_CONFIRMED',
    restore_target_class: 'RESTORE_TARGET_ISOLATED_COPY',
  });
  assert.equal(confirmed.verdict, 'RECOVERY_GATE_CONFIRMED');
  const blocked = evaluate({
    ...validEvidence(),
    retention_class: 'RETENTION_ABSENT',
    restore_target_class: 'RESTORE_TARGET_UNVERIFIED',
  });
  assert.equal(blocked.verdict, 'RECOVERY_GATE_CONFIRMED', 'context fields are bounded but not gate conditions');
});

// ── 4. Invalid, private, and inherited input ─────────────────────────────────

test('null/undefined/primitive input fails closed', () => {
  for (const bad of [undefined, null, 42, 'text', ['array'], true]) {
    const result = evaluate(bad);
    assert.equal(result.verdict, 'RECOVERY_GATE_BLOCKED_INVALID_INPUT');
    assertAllFlagsFalse(result);
  }
});

test('unknown field or unknown enum value blocks with invalid input', () => {
  const unknownField = evaluate({ ...validEvidence(), provider: 'neon' });
  assert.equal(unknownField.verdict, 'RECOVERY_GATE_BLOCKED_INVALID_INPUT');
  const unknownValue = evaluate({ ...validEvidence(), recovery_point_status: 'WHATEVER' });
  assert.equal(unknownValue.verdict, 'RECOVERY_GATE_BLOCKED_INVALID_INPUT');
  const unknownRisk = evaluate({ ...validEvidence(), operation_risk_class: 'TIER_4' });
  assert.equal(unknownRisk.verdict, 'RECOVERY_GATE_BLOCKED_INVALID_INPUT');
  const missingKey = Object.assign({}, validEvidence());
  delete missingKey.approval_status;
  const missing = evaluate(missingKey);
  assert.equal(missing.verdict, 'RECOVERY_GATE_BLOCKED_INVALID_INPUT');
  const wrongVersion = evaluate({ ...validEvidence(), policy_version: '0.9' });
  assert.equal(wrongVersion.verdict, 'RECOVERY_GATE_BLOCKED_INVALID_INPUT');
});

test('private metadata fields are rejected and never leak', () => {
  for (const key of [
    'snapshot_timestamp',
    'snapshot_id',
    'branch_id',
    'project_id',
    'host',
    'port',
    'url',
    'connection_string',
    'credential',
    'operator_email',
    'row_data',
    'provider_response',
    'free_form_metadata',
  ]) {
    const result = evaluate({ ...validEvidence(), [key]: 'private' });
    assert.equal(result.verdict, 'RECOVERY_GATE_BLOCKED_INVALID_INPUT', key);
    assert.ok(!JSON.stringify(result).includes('private'), 'no raw leakage for ' + key);
  }
});

test('inherited key on a custom prototype fails closed', () => {
  const evidence = Object.create({ inherited_secret: 'leak' });
  for (const key of Object.keys(validEvidence())) {
    evidence[key] = validEvidence()[key];
  }
  const result = evaluate(evidence);
  assert.equal(result.verdict, 'RECOVERY_GATE_BLOCKED_INVALID_INPUT');
  assert.ok(!JSON.stringify(result).includes('leak'), 'no inherited leakage');
});

// ── 5. Descriptor safety ─────────────────────────────────────────────────────

test('nested getter in evidence is never invoked and fails closed', () => {
  let getterCalls = 0;
  const evidence = validEvidence();
  Object.defineProperty(evidence, 'approval_status', {
    enumerable: true,
    configurable: true,
    get() {
      getterCalls += 1;
      return 'PRESENT';
    },
  });
  const result = evaluate(evidence);
  assert.equal(result.verdict, 'RECOVERY_GATE_BLOCKED_INVALID_INPUT');
  assert.equal(getterCalls, 0, 'nested getter never invoked');
  assert.ok(!JSON.stringify(result).includes('PRESENT'), 'no getter detail leakage');
});

test('nested Proxy get trap is never invoked and evidence resolves', () => {
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
  assert.equal(result.verdict, 'RECOVERY_GATE_CONFIRMED', 'descriptor-safe reads resolve the evidence');
});

test('top-level getter config is never invoked and fails closed', () => {
  let getterCalls = 0;
  const evidence = {};
  Object.defineProperty(evidence, 'policy_version', {
    enumerable: true,
    configurable: true,
    get() {
      getterCalls += 1;
      return '1.0';
    },
  });
  for (const key of Object.keys(validEvidence())) {
    if (key !== 'policy_version') {
      evidence[key] = validEvidence()[key];
    }
  }
  const result = evaluate(evidence);
  assert.equal(result.verdict, 'RECOVERY_GATE_BLOCKED_INVALID_INPUT');
  assert.equal(getterCalls, 0);
});

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
  assert.equal(result.verdict, 'RECOVERY_GATE_BLOCKED_INVALID_INPUT');
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

// ── 6. Determinism, frozen, detached, input immutability ─────────────────────

test('same bounded input produces byte-stable awaited results', () => {
  const first = gate.evaluateRecoveryGate(validEvidence());
  const second = gate.evaluateRecoveryGate(validEvidence());
  const firstJson = JSON.stringify(first);
  const secondJson = JSON.stringify(second);
  assert.notEqual(firstJson, '{}');
  assert.equal(first.verdict, 'RECOVERY_GATE_CONFIRMED');
  assert.equal(second.verdict, 'RECOVERY_GATE_CONFIRMED');
  assert.equal(firstJson, secondJson, 'byte-stable serialized equality');
  assert.equal(Object.isFrozen(first), true, 'first result frozen');
  assert.equal(Object.isFrozen(second), true, 'second result frozen');
});

test('input is never mutated and result is detached and frozen', () => {
  const evidence = validEvidence();
  const before = JSON.stringify(evidence);
  const result = evaluate(evidence);
  assert.equal(JSON.stringify(evidence), before, 'input not mutated');
  assert.equal(Object.isFrozen(evidence), false, 'caller object not frozen');
  assert.ok(Object.isFrozen(result));
  assert.throws(() => {
    result.verdict = 'CHANGED';
  }, TypeError);
});

// ── 7. Decision posture ──────────────────────────────────────────────────────

test('remediation decision records Layer C and Layer D implementation markers', () => {
  const decision = fs.readFileSync(
    path.join(ROOT, 'docs/ops/DATABASE_RECOVERY_CONFIGURATION_REMEDIATION_DECISION.md'),
    'utf8'
  );
  assert.ok(/3880/.test(decision), '#3880 referenced');
  assert.ok(/RECOVERY_PRE_CHANGE_GATE/.test(decision), 'gate implementation marker');
  assert.ok(/#3461/.test(decision), 'alert delivery runtime separated to #3461');
});

test('classification registers the contract as EXECUTED_FAKE', () => {
  const classification = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'tests/test-layer-classification.json'), 'utf8')
  );
  const entry = classification.entries.find(
    (e) => e.path === 'tests/contracts/database-recovery-gate-contract.test.cjs'
  );
  assert.ok(entry, 'contract classified');
  assert.equal(entry.layer, 'EXECUTED_FAKE');
  assert.deepEqual(entry.capabilities, []);
});

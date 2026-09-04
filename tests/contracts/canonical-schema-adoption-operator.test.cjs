'use strict';

/**
 * SOURCE_STATIC policy tests for the governed canonical schema-adoption
 * operator (#4282). Pure — no DB, no Production contact, no secrets. Validates
 * fail-closed prechecks, dry-run by default, and that the one-attempt budget
 * is consumed only on a committed+verified apply.
 *
 * Refs #4282, #3458 (keep OPEN), #1882 (keep OPEN).
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const OP = require(path.join(ROOT, 'scripts/canonical-schema-adoption-operator-core.cjs'));

const CANONICAL_PACKET = OP.buildCanonicalPacket();

// ----- 1. Dry-run path: canonical packet passes readiness -----
test('canonical #4282 packet passes operator readiness (dry-run path)', () => {
  const res = OP.evaluateOperatorReadiness(CANONICAL_PACKET);
  assert.equal(res.decision, OP.DECISIONS.READINESS_PASSED);
  assert.equal(res.stops.length, 0);
  assert.equal(res.gateDecision, 'PAPER_ACTIVATION_GATE_PASSED');
  assert.equal(res.manifestStatus, 'ADOPTION_REQUIRED');
});

// ----- 2. Default execution is paper-only dry run -----
test('executeGovernedOperator returns PAPER_ONLY_DRY_RUN by default (executionEnabled=false)', async () => {
  const r = await OP.executeGovernedOperator({ packet: CANONICAL_PACKET });
  assert.equal(r.decision, OP.DECISIONS.PAPER_ONLY_DRY_RUN);
  assert.equal(r.executionAttempted, false);
  assert.equal(r.oneAttemptBudgetConsumed, false);
});

test('executeGovernedOperator returns PAPER_ONLY_DRY_RUN when only executionEnabled=true (allowExecute=false)', async () => {
  const r = await OP.executeGovernedOperator({ packet: CANONICAL_PACKET, executionEnabled: true });
  assert.equal(r.decision, OP.DECISIONS.PAPER_ONLY_DRY_RUN);
  assert.equal(r.executionAttempted, false);
  assert.equal(r.oneAttemptBudgetConsumed, false);
});

test('executeGovernedOperator fails closed with no transport (even with executionEnabled+allowExecute)', async () => {
  const r = await OP.executeGovernedOperator({
    packet: CANONICAL_PACKET,
    executionEnabled: true,
    allowExecute: true,
  });
  assert.equal(r.decision, OP.DECISIONS.EXECUTION_DISABLED_BY_DEFAULT);
  assert.ok(r.stops.includes(OP.STOP_REASONS.STOP_CREDENTIAL_OPERATOR_ABSENT));
  assert.equal(r.executionAttempted, false);
  assert.equal(r.oneAttemptBudgetConsumed, false);
});

// ----- 3. Fail-closed on every packet field variant -----
test('wrong issue fails closed', () => {
  const bad = { ...CANONICAL_PACKET, issue: 9999 };
  const r = OP.evaluateOperatorReadiness(bad);
  assert.notEqual(r.decision, OP.DECISIONS.READINESS_PASSED);
  assert.ok(r.stops.includes(OP.STOP_REASONS.STOP_PACKET_FIELD_INVALID));
});

test('missing ACTIVE comment fails closed', () => {
  const bad = { ...CANONICAL_PACKET, activeAuthorizationComment: 0 };
  const r = OP.evaluateOperatorReadiness(bad);
  assert.notEqual(r.decision, OP.DECISIONS.READINESS_PASSED);
  assert.ok(r.stops.includes(OP.STOP_REASONS.STOP_ACTIVE_COMMENT_MISSING));
});

test('wrong ACTIVE comment id fails closed', () => {
  const bad = { ...CANONICAL_PACKET, activeAuthorizationComment: 5491726185 };
  const r = OP.evaluateOperatorReadiness(bad);
  assert.notEqual(r.decision, OP.DECISIONS.READINESS_PASSED);
  assert.ok(r.stops.includes(OP.STOP_REASONS.STOP_ACTIVE_COMMENT_MISSING));
});

test('main moved fails closed', () => {
  // Use a clearly malformed main so the hex40 shape check fails (the repo
  // does not embed a network check here; the real "main moved" gate is the
  // caller's git context. We only prove the shape check rejects a non-hex40).
  const bad = { ...CANONICAL_PACKET, currentMain: 'NOT-A-HEX' };
  const r = OP.evaluateOperatorReadiness(bad);
  assert.notEqual(r.decision, OP.DECISIONS.READINESS_PASSED);
  assert.ok(r.stops.includes(OP.STOP_REASONS.STOP_MAIN_MOVED));
});

test('wrong migration path fails closed', () => {
  const bad = { ...CANONICAL_PACKET, migrationPath: 'db/migrations/other.sql' };
  const r = OP.evaluateOperatorReadiness(bad);
  assert.notEqual(r.decision, OP.DECISIONS.READINESS_PASSED);
  assert.ok(r.stops.includes(OP.STOP_REASONS.STOP_PACKET_FIELD_INVALID));
});

test('wrong migration sha256 fails closed', () => {
  const bad = { ...CANONICAL_PACKET, migrationSha256: '1'.repeat(64) };
  const r = OP.evaluateOperatorReadiness(bad);
  assert.notEqual(r.decision, OP.DECISIONS.READINESS_PASSED);
  assert.ok(r.stops.includes(OP.STOP_REASONS.STOP_CHECKSUM_MISMATCH));
});

test('wrong target relation fails closed', () => {
  const bad = { ...CANONICAL_PACKET, intendedRelation: 'public.trees' };
  const r = OP.evaluateOperatorReadiness(bad);
  assert.notEqual(r.decision, OP.DECISIONS.READINESS_PASSED);
  assert.ok(r.stops.includes(OP.STOP_REASONS.STOP_PACKET_FIELD_INVALID));
});

test('wrong target identity fails closed', () => {
  const bad = { ...CANONICAL_PACKET, targetIdentity: { product_shared: 'x', environment_class: 'production', database: 'neondb' } };
  const r = OP.evaluateOperatorReadiness(bad);
  assert.notEqual(r.decision, OP.DECISIONS.READINESS_PASSED);
  assert.ok(r.stops.includes(OP.STOP_REASONS.STOP_TARGET_IDENTITY_MISMATCH));
});

test('unrelated migration count > 0 fails closed', () => {
  const bad = { ...CANONICAL_PACKET, unrelatedMigrationCount: 1 };
  const r = OP.evaluateOperatorReadiness(bad);
  assert.notEqual(r.decision, OP.DECISIONS.READINESS_PASSED);
  assert.ok(r.stops.includes(OP.STOP_REASONS.STOP_UNRELATED_MIGRATION_PRESENT));
});

test('non-transaction apply mode fails closed', () => {
  const bad = { ...CANONICAL_PACKET, applyMode: 'AUTOCOMMIT' };
  const r = OP.evaluateOperatorReadiness(bad);
  assert.notEqual(r.decision, OP.DECISIONS.READINESS_PASSED);
  assert.ok(r.stops.includes(OP.STOP_REASONS.STOP_TRANSACTION_UNAVAILABLE));
});

test('product row read allowed=true fails closed', () => {
  const bad = { ...CANONICAL_PACKET, productRowReadAllowed: true };
  const r = OP.evaluateOperatorReadiness(bad);
  assert.notEqual(r.decision, OP.DECISIONS.READINESS_PASSED);
  assert.ok(r.stops.includes(OP.STOP_REASONS.STOP_PRODUCT_ROW_READ_FORBIDDEN));
});

test('writer grant=true fails closed', () => {
  const bad = { ...CANONICAL_PACKET, writerGrant: true };
  const r = OP.evaluateOperatorReadiness(bad);
  assert.notEqual(r.decision, OP.DECISIONS.READINESS_PASSED);
  assert.ok(r.stops.includes(OP.STOP_REASONS.STOP_WRITER_GRANT_FORBIDDEN));
});

test('runtime gate activation=true fails closed', () => {
  const bad = { ...CANONICAL_PACKET, runtimeGateActivation: true };
  const r = OP.evaluateOperatorReadiness(bad);
  assert.notEqual(r.decision, OP.DECISIONS.READINESS_PASSED);
  assert.ok(r.stops.includes(OP.STOP_REASONS.STOP_RUNTIME_GATE_FORBIDDEN));
});

test('provider reroute=true fails closed', () => {
  const bad = { ...CANONICAL_PACKET, providerReroute: true };
  const r = OP.evaluateOperatorReadiness(bad);
  assert.notEqual(r.decision, OP.DECISIONS.READINESS_PASSED);
  assert.ok(r.stops.includes(OP.STOP_REASONS.STOP_PROVIDER_REROUTE_FORBIDDEN));
});

test('ambiguous retry=true fails closed', () => {
  const bad = { ...CANONICAL_PACKET, ambiguousRetryAllowed: true };
  const r = OP.evaluateOperatorReadiness(bad);
  assert.notEqual(r.decision, OP.DECISIONS.READINESS_PASSED);
  assert.ok(r.stops.includes(OP.STOP_REASONS.STOP_AMBIGUOUS_RETRY_FORBIDDEN));
});

// ----- 4. Transport surface validation -----
test('transport with forbidden queryProductRows fails closed', () => {
  const t = makeMockTransport();
  t.queryProductRows = async () => [];
  const r = OP.validateTransport(t);
  assert.equal(r.ok, false);
  assert.equal(r.reason, OP.STOP_REASONS.STOP_ARBITRARY_SQL_FORBIDDEN);
});

test('transport with forbidden grantWriter fails closed', () => {
  const t = makeMockTransport();
  t.grantWriter = async () => ({});
  const r = OP.validateTransport(t);
  assert.equal(r.ok, false);
  assert.equal(r.reason, OP.STOP_REASONS.STOP_ARBITRARY_SQL_FORBIDDEN);
});

test('transport with forbidden dropRelation fails closed', () => {
  const t = makeMockTransport();
  t.dropRelation = async () => ({});
  const r = OP.validateTransport(t);
  assert.equal(r.ok, false);
  assert.equal(r.reason, OP.STOP_REASONS.STOP_ARBITRARY_SQL_FORBIDDEN);
});

test('transport with forbidden executeArbitrarySql fails closed', () => {
  const t = makeMockTransport();
  t.executeArbitrarySql = async () => ({});
  const r = OP.validateTransport(t);
  assert.equal(r.ok, false);
  assert.equal(r.reason, OP.STOP_REASONS.STOP_ARBITRARY_SQL_FORBIDDEN);
});

test('transport missing required method fails closed', () => {
  const t = { ...makeMockTransport() };
  delete t.withTransaction;
  const r = OP.validateTransport(t);
  assert.equal(r.ok, false);
  assert.equal(r.reason, OP.STOP_REASONS.STOP_CREDENTIAL_OPERATOR_ABSENT);
});

// ----- 5. Mock-transport apply path: full lifecycle -----
test('apply path: committed+verified consumes the one-attempt budget exactly once', async () => {
  let applyCalls = 0;
  let lockAcquire = 0;
  let lockRelease = 0;
  let ledgerWrites = 0;
  const transport = makeMockTransport({
    onAcquireLock: () => { lockAcquire += 1; },
    onReleaseLock: () => { lockRelease += 1; },
    onApply: () => { applyCalls += 1; },
    onLedger: () => { ledgerWrites += 1; },
    precheck: { present: false },
    postcheck: { matched: true },
  });
  const r = await OP.executeGovernedOperator({
    packet: CANONICAL_PACKET,
    transport,
    executionEnabled: true,
    allowExecute: true,
  });
  assert.equal(r.decision, OP.DECISIONS.APPLY_COMMITTED_AND_VERIFIED);
  assert.equal(r.executionAttempted, true);
  assert.equal(r.oneAttemptBudgetConsumed, true);
  assert.equal(applyCalls, 1);
  assert.equal(lockAcquire, 1);
  assert.equal(lockRelease, 1);
  assert.equal(ledgerWrites, 1);
});

test('apply path: relation already present fails closed (STOP_RELATION_PRESENT), no budget consumed', async () => {
  const transport = makeMockTransport({ precheck: { present: true } });
  const r = await OP.executeGovernedOperator({
    packet: CANONICAL_PACKET,
    transport,
    executionEnabled: true,
    allowExecute: true,
  });
  assert.equal(r.decision, OP.DECISIONS.APPLY_ROLLED_BACK_PRE_COMMIT);
  assert.ok(r.stops.includes(OP.STOP_REASONS.STOP_RELATION_PRESENT));
  assert.equal(r.executionAttempted, true);
  assert.equal(r.oneAttemptBudgetConsumed, false);
});

test('apply path: postcheck mismatch fails closed (STOP_POSTCHECK_MISMATCH), no budget consumed', async () => {
  const transport = makeMockTransport({ precheck: { present: false }, postcheck: { matched: false } });
  const r = await OP.executeGovernedOperator({
    packet: CANONICAL_PACKET,
    transport,
    executionEnabled: true,
    allowExecute: true,
  });
  assert.equal(r.decision, OP.DECISIONS.APPLY_ROLLED_BACK_PRE_COMMIT);
  assert.ok(r.stops.includes(OP.STOP_REASONS.STOP_POSTCHECK_MISMATCH));
  assert.equal(r.oneAttemptBudgetConsumed, false);
});

test('apply path: ledger attestation failure fails closed (STOP_LEDGER_ATTESTATION_MISMATCH), no budget consumed', async () => {
  const transport = makeMockTransport({
    precheck: { present: false },
    postcheck: { matched: true },
    ledger: { recorded: false },
  });
  const r = await OP.executeGovernedOperator({
    packet: CANONICAL_PACKET,
    transport,
    executionEnabled: true,
    allowExecute: true,
  });
  assert.equal(r.decision, OP.DECISIONS.APPLY_ROLLED_BACK_PRE_COMMIT);
  assert.ok(r.stops.includes(OP.STOP_REASONS.STOP_LEDGER_ATTESTATION_MISMATCH));
  assert.equal(r.oneAttemptBudgetConsumed, false);
});

test('apply path: advisory lock unavailable fails closed (STOP_ADVISORY_LOCK_UNAVAILABLE)', async () => {
  const transport = makeMockTransport({ lockHandle: null });
  const r = await OP.executeGovernedOperator({
    packet: CANONICAL_PACKET,
    transport,
    executionEnabled: true,
    allowExecute: true,
  });
  assert.equal(r.decision, OP.DECISIONS.EXECUTION_DISABLED_BY_DEFAULT);
  assert.ok(r.stops.includes(OP.STOP_REASONS.STOP_ADVISORY_LOCK_UNAVAILABLE));
  assert.equal(r.executionAttempted, false);
  assert.equal(r.oneAttemptBudgetConsumed, false);
});

test('apply path: thrown transport error is treated as ambiguous outcome, no retry, no budget consumed', async () => {
  const transport = makeMockTransport({ throwOnApply: new Error('connection lost') });
  const r = await OP.executeGovernedOperator({
    packet: CANONICAL_PACKET,
    transport,
    executionEnabled: true,
    allowExecute: true,
  });
  assert.equal(r.decision, OP.DECISIONS.EXECUTION_DISABLED_BY_DEFAULT);
  assert.ok(r.stops.includes(OP.STOP_REASONS.STOP_AMBIGUOUS_OUTCOME));
  assert.equal(r.ambiguous, true);
  assert.equal(r.oneAttemptBudgetConsumed, false);
});

// ----- 6. Secret boundary: no raw credential/secret field in any operator path -----
test('operator decision shape never contains a raw credential/secret field', async () => {
  const r = await OP.executeGovernedOperator({ packet: CANONICAL_PACKET });
  const s = JSON.stringify(r);
  assert.equal(/\bpassword\b/i.test(s), false, 'must not include password');
  assert.equal(/\bsecret\b/i.test(s), false, 'must not include secret');
  assert.equal(/\btoken\b/i.test(s), false, 'must not include token');
  assert.equal(/\bapi[_-]?key\b/i.test(s), false, 'must not include api key');
  assert.equal(/postgres:\/\/[^"']+@/.test(s), false, 'must not include raw DSN');
});

// ----- 7. Profile 4346 (Hub Layout) Fail-Closed Tests -----
test('Profile 4346 packet fails operator readiness due to missing active comment and provisional fingerprint', () => {
  const hubPacket = OP.buildCanonicalPacket('4346');
  assert.equal(hubPacket.issue, 4346);
  assert.equal(hubPacket.intendedRelation, 'public.tree_hub_layouts');
  assert.equal(hubPacket.activeAuthorizationComment, null);

  const r = OP.evaluateOperatorReadiness(hubPacket);
  assert.equal(r.decision, OP.DECISIONS.EXECUTION_DISABLED_BY_DEFAULT);
  assert.ok(r.stops.includes(OP.STOP_REASONS.STOP_ACTIVE_COMMENT_MISSING));
  assert.ok(r.stops.includes(OP.STOP_REASONS.STOP_PACKET_FIELD_INVALID));
  assert.ok(r.gateBlockers.includes('GATE_EXPECTED_SCHEMA_FINGERPRINT_MISSING'));
  assert.ok(r.gateBlockers.includes('GATE_TARGET_NOT_ALLOWLISTED'));
});

test('Profile 4346 with mocked active comment still fails closed on provisional fingerprint and allowlist', () => {
  const hubPacket = OP.buildCanonicalPacket('4346', {
    activeAuthorizationComment: 9999999999,
  });
  const r = OP.evaluateOperatorReadiness(hubPacket);
  assert.equal(r.decision, OP.DECISIONS.EXECUTION_DISABLED_BY_DEFAULT);
  // Still fails because active comment does not match profile's null, and gate rejects provisional fingerprint
  assert.ok(r.stops.includes(OP.STOP_REASONS.STOP_ACTIVE_COMMENT_MISSING));
  assert.ok(r.stops.includes(OP.STOP_REASONS.STOP_PACKET_FIELD_INVALID));
  assert.ok(r.gateBlockers.includes('GATE_EXPECTED_SCHEMA_FINGERPRINT_MISSING'));
  assert.ok(r.gateBlockers.includes('GATE_TARGET_NOT_ALLOWLISTED'));
});

test('Profile 4346 wrong migration path fails closed', () => {
  const hubPacket = OP.buildCanonicalPacket('4346', {
    migrationPath: 'db/migrations/other-hub.sql',
  });
  const r = OP.evaluateOperatorReadiness(hubPacket);
  assert.notEqual(r.decision, OP.DECISIONS.READINESS_PASSED);
  assert.ok(r.stops.includes(OP.STOP_REASONS.STOP_PACKET_FIELD_INVALID));
});

test('Profile 4346 wrong checksum fails closed', () => {
  const hubPacket = OP.buildCanonicalPacket('4346', {
    migrationSha256: '9'.repeat(64),
  });
  const r = OP.evaluateOperatorReadiness(hubPacket);
  assert.notEqual(r.decision, OP.DECISIONS.READINESS_PASSED);
  assert.ok(r.stops.includes(OP.STOP_REASONS.STOP_CHECKSUM_MISMATCH));
});

test('Profile 4346 product row read allowed=true fails closed', () => {
  const hubPacket = OP.buildCanonicalPacket('4346', {
    productRowReadAllowed: true,
  });
  const r = OP.evaluateOperatorReadiness(hubPacket);
  assert.notEqual(r.decision, OP.DECISIONS.READINESS_PASSED);
  assert.ok(r.stops.includes(OP.STOP_REASONS.STOP_PRODUCT_ROW_READ_FORBIDDEN));
});

test('Profile 4346 writer grant=true fails closed', () => {
  const hubPacket = OP.buildCanonicalPacket('4346', {
    writerGrant: true,
  });
  const r = OP.evaluateOperatorReadiness(hubPacket);
  assert.notEqual(r.decision, OP.DECISIONS.READINESS_PASSED);
  assert.ok(r.stops.includes(OP.STOP_REASONS.STOP_WRITER_GRANT_FORBIDDEN));
});

test('Profile 4346 runtime gate activation=true fails closed', () => {
  const hubPacket = OP.buildCanonicalPacket('4346', {
    runtimeGateActivation: true,
  });
  const r = OP.evaluateOperatorReadiness(hubPacket);
  assert.notEqual(r.decision, OP.DECISIONS.READINESS_PASSED);
  assert.ok(r.stops.includes(OP.STOP_REASONS.STOP_RUNTIME_GATE_FORBIDDEN));
});

test('Profile 4346 provider reroute=true fails closed', () => {
  const hubPacket = OP.buildCanonicalPacket('4346', {
    providerReroute: true,
  });
  const r = OP.evaluateOperatorReadiness(hubPacket);
  assert.notEqual(r.decision, OP.DECISIONS.READINESS_PASSED);
  assert.ok(r.stops.includes(OP.STOP_REASONS.STOP_PROVIDER_REROUTE_FORBIDDEN));
});

test('Profile 4346 ambiguous retry=true fails closed', () => {
  const hubPacket = OP.buildCanonicalPacket('4346', {
    ambiguousRetryAllowed: true,
  });
  const r = OP.evaluateOperatorReadiness(hubPacket);
  assert.notEqual(r.decision, OP.DECISIONS.READINESS_PASSED);
  assert.ok(r.stops.includes(OP.STOP_REASONS.STOP_AMBIGUOUS_RETRY_FORBIDDEN));
});

test('executeGovernedOperator with Profile 4346 remains PAPER_ONLY_DRY_RUN by default', async () => {
  const hubPacket = OP.buildCanonicalPacket('4346');
  const r = await OP.executeGovernedOperator({ packet: hubPacket });
  assert.equal(r.decision, OP.DECISIONS.EXECUTION_DISABLED_BY_DEFAULT);
  assert.equal(r.executionAttempted, false);
  assert.equal(r.oneAttemptBudgetConsumed, false);
});

// ----- helpers -----
function makeMockTransport(opts) {
  opts = opts || {};
  const lockHandle = opts.lockHandle === null ? null : { id: 'lock-1' };
  let precheck = opts.precheck || { present: false };
  let postcheck = opts.postcheck || { matched: true };
  let ledger = opts.ledger || { recorded: true };
  // The operator calls transport.applyMigration(tx, {path, sha256}); we route
  // it through this outer method so test hooks fire on the real call site.
  function applyMigration() {
    if (opts.throwOnApply) throw opts.throwOnApply;
    if (opts.onApply) opts.onApply();
    return { committed: true };
  }
  return {
    acquireAdvisoryLock: async () => {
      if (opts.onAcquireLock) opts.onAcquireLock();
      return lockHandle;
    },
    releaseAdvisoryLock: async () => {
      if (opts.onReleaseLock) opts.onReleaseLock();
    },
    withTransaction: async (fn) => {
      const tx = {
        catalogTableKind: async () => precheck,
        verifyCatalog: async () => postcheck,
        writeLedger: async () => {
          if (opts.onLedger) opts.onLedger();
          return ledger;
        },
      };
      return fn(tx);
    },
    applyMigration,
    verifyCatalog: async () => postcheck,
    writeLedger: async () => ledger,
  };
}

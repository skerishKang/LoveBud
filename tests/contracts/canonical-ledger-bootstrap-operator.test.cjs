'use strict';

/**
 * SOURCE_STATIC policy tests for the governed #3846 canonical ledger-bootstrap
 * operator. Pure — no DB, no Production contact, no secrets. Validates
 * fail-closed prechecks, dry-run by default, live CENTRAL execution-authority
 * separation from the SOURCE/TEST implementation provenance, exact-head
 * authority, and that the CENTRAL exactly-one DB-capable authority is consumed
 * when governed DB-capable execution begins (not on COMMIT).
 *
 * Refs #3846, #3458 (keep OPEN), #1882 (keep OPEN).
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const OP = require(path.join(ROOT, 'scripts/canonical-ledger-bootstrap-operator.cjs'));
const TRANSPORT = require(path.join(ROOT, 'scripts/canonical-ledger-bootstrap-postgres.cjs'));

const BOOT = OP.BOOTSTRAP;
const ACTUAL_HEAD = TRANSPORT.resolveTrustedLocalRepoHead(ROOT);

// A live CENTRAL Production execution authorization reference. Deliberately NOT
// the SOURCE/TEST implementation comment (5644253160), which is provenance only
// and must never satisfy the live Production execution authority.
const LIVE_AUTHORITY = '5644581826';
const SOURCE_TEST_COMMENT = 5644253160;

const CANONICAL_PACKET = OP.buildBootstrapPacket();

function makeFakeTransport(overrides = {}) {
  const calls = [];
  const behavior = {
    lockGranted: true,
    relationPresent: false,
    applyCommitted: true,
    catalogMatched: true,
    ledgerRecorded: true,
    identityOk: true,
    throwOn: null,
    throwCategory: null,
    ...overrides,
  };
  const txApi = Object.freeze({
    ledgerBootstrapTxBrand: true,
    catalogTableKind: async (relation) => {
      calls.push(['catalogTableKind', relation]);
      if (behavior.throwOn === 'catalogTableKind') throw new Error('FAKE_TX_BOOM');
      return { present: behavior.relationPresent };
    },
    verifyCatalog: async (relation, fingerprint) => {
      calls.push(['verifyCatalog', relation, fingerprint]);
      if (behavior.throwOn === 'verifyCatalog') throw new Error('FAKE_TX_BOOM');
      return { matched: behavior.catalogMatched };
    },
    writeLedger: async (payload) => {
      calls.push(['writeLedger', payload]);
      if (behavior.throwOn === 'writeLedger') throw new Error('FAKE_TX_BOOM');
      return { recorded: behavior.ledgerRecorded };
    },
  });
  const transport = {
    verifyConnectedTargetIdentity: async () => {
      calls.push(['verifyConnectedTargetIdentity']);
      if (behavior.throwOn === 'verifyConnectedTargetIdentity') {
        if (behavior.throwCategory) {
          const err = new Error(behavior.throwCategory);
          err.category = behavior.throwCategory;
          throw err;
        }
        throw new Error('FAKE_IDENTITY_BOOM');
      }
      if (!behavior.identityOk) return { ok: false };
      return {
        ok: true,
        databaseVerified: true,
        roleClassVerified: true,
        roleClass: TRANSPORT.EXPECTED_CONNECTED_ROLE_CLASS,
      };
    },
    acquireAdvisoryLock: async (key) => {
      calls.push(['acquireAdvisoryLock', key]);
      if (behavior.throwOn === 'acquireAdvisoryLock') {
        if (behavior.throwCategory) {
          const err = new Error(behavior.throwCategory);
          err.category = behavior.throwCategory;
          throw err;
        }
        throw new Error('FAKE_LOCK_BOOM');
      }
      return behavior.lockGranted ? { fakeHandle: true } : null;
    },
    releaseAdvisoryLock: async () => {
      calls.push(['releaseAdvisoryLock']);
    },
    withTransaction: async (fn) => {
      calls.push(['withTransaction']);
      if (behavior.throwOn === 'withTransaction') throw new Error('FAKE_TX_BOOM');
      try {
        const outcome = await fn(txApi);
        return outcome && outcome.ok === true
          ? { ok: true }
          : { ok: false, reason: (outcome && outcome.reason) || 'STOP_AMBIGUOUS_OUTCOME' };
      } catch {
        throw new Error('FAKE_TX_BOOM');
      }
    },
    applyMigration: async (tx, spec) => {
      calls.push(['applyMigration', spec]);
      if (behavior.throwOn === 'applyMigration') throw new Error('FAKE_APPLY_BOOM');
      return behavior.applyCommitted ? { committed: true } : { committed: false, reason: 'STOP_RELATION_PRESENT' };
    },
    verifyCatalog: txApi.verifyCatalog,
    writeLedger: txApi.writeLedger,
  };
  for (const k of OP.FORBIDDEN_TRANSPORT_METHODS) {
    if (behavior.forbidden && behavior.forbidden.includes(k)) transport[k] = async () => ({});
  }
  return { transport: Object.freeze(transport), calls, behavior };
}

function executeArgs(extra = {}) {
  return {
    packet: CANONICAL_PACKET,
    executionEnabled: true,
    allowExecute: true,
    executionHead: ACTUAL_HEAD,
    executionAuthority: LIVE_AUTHORITY,
    ...extra,
  };
}

// ----- 1. Dry-run path: canonical packet passes readiness -----

test('canonical #3846 packet passes bootstrap readiness (dry-run path)', () => {
  const res = OP.evaluateBootstrapReadiness(CANONICAL_PACKET);
  assert.equal(res.decision, OP.DECISIONS.READINESS_PASSED);
  assert.deepEqual(res.stops, []);
});

test('packet binding is exact and carries provenance only', () => {
  assert.equal(CANONICAL_PACKET.issue, 3846);
  assert.equal(CANONICAL_PACKET.migrationId, '20260802094500_bootstrap-migration-ledger');
  assert.equal(CANONICAL_PACKET.migrationPath, 'db/migrations/20260802094500_bootstrap-migration-ledger.sql');
  assert.equal(CANONICAL_PACKET.migrationSha256, 'c04d6e8cf074514e1835cd837f6ae72ccd96b775a507a12d2b394733977918cc');
  assert.equal(CANONICAL_PACKET.intendedRelation, 'public.schema_migration_ledger');
  assert.equal(CANONICAL_PACKET.expectedSchemaFingerprint, '961d195776eaa245e4e63620a35f19a4de2dbe2f00dbd8b94faffb70ce2332d1');
  assert.equal(CANONICAL_PACKET.riskClass, 'ADDITIVE');
  assert.deepEqual(CANONICAL_PACKET.targetIdentity, {
    product_shared: '133-relovetree',
    environment_class: 'production',
    database: 'neondb',
  });
  assert.equal(CANONICAL_PACKET.applyMode, 'TRANSACTION_REQUIRED');
  assert.equal(CANONICAL_PACKET.unrelatedMigrationCount, 0);
  // The frozen packet must NOT carry any execution authority: the SOURCE/TEST
  // implementation comment is provenance, and the live authority is supplied
  // separately at execution time.
  assert.equal(
    Object.prototype.hasOwnProperty.call(CANONICAL_PACKET, 'activeAuthorizationComment'),
    false,
    'packet must not embed a mutation-authority comment'
  );
  assert.equal(
    Object.prototype.hasOwnProperty.call(CANONICAL_PACKET, 'executionAuthority'),
    false,
    'packet must not embed the live execution authority'
  );
  assert.equal(
    JSON.stringify(CANONICAL_PACKET).includes(String(SOURCE_TEST_COMMENT)),
    false,
    'packet must not embed the SOURCE/TEST implementation comment'
  );
});

test('canonical packet has zero provenance stops', () => {
  assert.deepEqual(OP.__pure.provenanceStops(CANONICAL_PACKET), []);
});

// ----- 2. Default execution is paper-only dry run -----

test('executeGovernedBootstrap returns PAPER_ONLY_DRY_RUN by default', async () => {
  const r = await OP.executeGovernedBootstrap({ packet: CANONICAL_PACKET });
  assert.equal(r.decision, OP.DECISIONS.PAPER_ONLY_DRY_RUN);
  assert.equal(r.executionAttempted, false);
  assert.equal(r.oneAttemptBudgetConsumed, false);
});

test('executeGovernedBootstrap stays paper-only with only executionEnabled', async () => {
  const r = await OP.executeGovernedBootstrap({ packet: CANONICAL_PACKET, executionEnabled: true });
  assert.equal(r.decision, OP.DECISIONS.PAPER_ONLY_DRY_RUN);
  assert.equal(r.executionAttempted, false);
});

test('executeGovernedBootstrap fails closed with no transport', async () => {
  const r = await OP.executeGovernedBootstrap(executeArgs({ transport: undefined }));
  assert.equal(r.decision, OP.DECISIONS.EXECUTION_DISABLED_BY_DEFAULT);
  assert.ok(r.stops.includes(OP.STOP_REASONS.STOP_CREDENTIAL_OPERATOR_ABSENT));
  assert.equal(r.executionAttempted, false);
});

// ----- 3. Fail-closed on every packet field variant -----

const packetVariants = [
  ['wrong issue', { issue: 9999 }, OP.STOP_REASONS.STOP_PACKET_FIELD_INVALID],
  ['wrong risk class', { riskClass: 'DESTRUCTIVE' }, OP.STOP_REASONS.STOP_PACKET_FIELD_INVALID],
  ['malformed currentMain', { currentMain: 'NOT-A-HEX' }, OP.STOP_REASONS.STOP_MAIN_MOVED],
  ['wrong migration id', { migrationId: 'other' }, OP.STOP_REASONS.STOP_PACKET_FIELD_INVALID],
  ['wrong migration path', { migrationPath: 'db/migrations/other.sql' }, OP.STOP_REASONS.STOP_PACKET_FIELD_INVALID],
  ['wrong migration sha256', { migrationSha256: '1'.repeat(64) }, OP.STOP_REASONS.STOP_CHECKSUM_MISMATCH],
  ['wrong relation', { intendedRelation: 'public.other' }, OP.STOP_REASONS.STOP_PACKET_FIELD_INVALID],
  ['wrong fingerprint', { expectedSchemaFingerprint: 'a'.repeat(64) }, OP.STOP_REASONS.STOP_PACKET_FIELD_INVALID],
  ['wrong target identity', { targetIdentity: { product_shared: 'x', environment_class: 'preview', database: 'neondb' } }, OP.STOP_REASONS.STOP_TARGET_IDENTITY_MISMATCH],
  ['unrelated migration present', { unrelatedMigrationCount: 1 }, OP.STOP_REASONS.STOP_UNRELATED_MIGRATION_PRESENT],
  ['non-transaction apply mode', { applyMode: 'AUTOCOMMIT' }, OP.STOP_REASONS.STOP_TRANSACTION_UNAVAILABLE],
  ['product row read allowed', { productRowReadAllowed: true }, OP.STOP_REASONS.STOP_PRODUCT_ROW_READ_FORBIDDEN],
  ['writer grant allowed', { writerGrant: true }, OP.STOP_REASONS.STOP_WRITER_GRANT_FORBIDDEN],
  ['runtime gate allowed', { runtimeGateActivation: true }, OP.STOP_REASONS.STOP_RUNTIME_GATE_FORBIDDEN],
  ['provider reroute allowed', { providerReroute: true }, OP.STOP_REASONS.STOP_PROVIDER_REROUTE_FORBIDDEN],
  ['ambiguous retry allowed', { ambiguousRetryAllowed: true }, OP.STOP_REASONS.STOP_AMBIGUOUS_RETRY_FORBIDDEN],
];

for (const [label, patch, expectedStop] of packetVariants) {
  test(`readiness fails closed: ${label}`, () => {
    const bad = { ...CANONICAL_PACKET, ...patch };
    const r = OP.evaluateBootstrapReadiness(bad);
    assert.notEqual(r.decision, OP.DECISIONS.READINESS_PASSED);
    assert.ok(r.stops.includes(expectedStop), `expected ${expectedStop}, got ${r.stops.join(',')}`);
  });
}

test('readiness fails closed on a non-object packet', () => {
  const r = OP.evaluateBootstrapReadiness(null);
  assert.equal(r.decision, OP.DECISIONS.EXECUTION_DISABLED_BY_DEFAULT);
  assert.deepEqual(r.stops, [OP.STOP_REASONS.STOP_PACKET_FIELD_INVALID]);
});

// ----- 4. Provenance cross-check -----

test('provenance cross-check fails closed on a tampered binding path', () => {
  const stops = OP.__pure.provenanceStops({ ...CANONICAL_PACKET, migrationPath: 'db/migrations/other.sql' });
  assert.ok(stops.includes(OP.STOP_REASONS.STOP_PROVENANCE_MISMATCH));
});

test('provenance cross-check fails closed on a tampered checksum', () => {
  const stops = OP.__pure.provenanceStops({ ...CANONICAL_PACKET, migrationSha256: '1'.repeat(64) });
  assert.ok(stops.includes(OP.STOP_REASONS.STOP_PROVENANCE_MISMATCH));
});

// ----- 5. Transport validation -----

test('the default repository transport module passes structural validation', () => {
  const r = OP.validateLedgerBootstrapTransport(TRANSPORT);
  assert.equal(r.ok, true);
});

test('transport validation fails closed on missing methods', () => {
  const { writeLedger, ...rest } = TRANSPORT;
  const r = OP.validateLedgerBootstrapTransport(Object.freeze(rest));
  assert.equal(r.ok, false);
  assert.equal(r.reason, OP.STOP_REASONS.STOP_CREDENTIAL_OPERATOR_ABSENT);
});

test('transport validation fails closed on any forbidden capability', () => {
  const bad = { ...makeFakeTransport().transport, dropRelation: async () => ({}) };
  const r = OP.validateLedgerBootstrapTransport(Object.freeze(bad));
  assert.equal(r.ok, false);
  assert.equal(r.reason, OP.STOP_REASONS.STOP_ARBITRARY_SQL_FORBIDDEN);
});

// ----- 6. Exact-head authority gate -----

test('head authority fails closed when central head is missing', () => {
  const r = OP.verifyLedgerBootstrapExecutionHead({}, ROOT, {});
  assert.equal(r.ok, false);
  assert.equal(r.reason, OP.STOP_REASONS.STOP_EXECUTION_HEAD_AUTHORITY_MISMATCH);
});

test('head authority fails closed on mismatch', () => {
  const r = OP.verifyLedgerBootstrapExecutionHead({ executionHead: 'f'.repeat(40) }, ROOT, {});
  assert.equal(r.ok, false);
  assert.equal(r.reason, OP.STOP_REASONS.STOP_EXECUTION_HEAD_AUTHORITY_MISMATCH);
});

test('head authority passes on exact match and resolves from env', () => {
  const direct = OP.verifyLedgerBootstrapExecutionHead({ executionHead: ACTUAL_HEAD }, ROOT, {});
  assert.equal(direct.ok, true);
  assert.equal(direct.actualExecutionHead, ACTUAL_HEAD);
  const viaEnv = OP.verifyLedgerBootstrapExecutionHead({}, ROOT, {
    [OP.ENV_EXECUTION_HEAD]: ACTUAL_HEAD.toUpperCase(),
  });
  assert.equal(viaEnv.ok, true);
});

test('execution stops before any transport call when head authority is unverified', async () => {
  const fake = makeFakeTransport();
  const r = await OP.executeGovernedBootstrap(executeArgs({ transport: fake.transport, executionHead: 'f'.repeat(40) }));
  assert.equal(r.decision, OP.DECISIONS.EXECUTION_DISABLED_BY_DEFAULT);
  assert.ok(r.stops.includes(OP.STOP_REASONS.STOP_EXECUTION_HEAD_AUTHORITY_MISMATCH));
  assert.equal(r.executionAttempted, false);
  assert.deepEqual(fake.calls, []);
});

// ----- 6b. Live CENTRAL execution-authority gate -----

test('execution authority is required: absent, empty, and env-absent all fail closed', () => {
  for (const options of [{}, { executionAuthority: '' }, { executionAuthority: '   ' }, { executionAuthority: null }]) {
    const r = OP.verifyLedgerBootstrapExecutionAuthority(options, {});
    assert.equal(r.ok, false);
    assert.equal(r.reason, OP.STOP_REASONS.STOP_EXECUTION_AUTHORITY_MISSING);
    assert.equal(r.executionAuthorityReference, null);
  }
});

test('the SOURCE/TEST implementation comment can never satisfy the live authority', () => {
  for (const value of [SOURCE_TEST_COMMENT, String(SOURCE_TEST_COMMENT), `comment:${SOURCE_TEST_COMMENT}`]) {
    const r = OP.verifyLedgerBootstrapExecutionAuthority({ executionAuthority: value }, {});
    assert.equal(r.ok, false);
    assert.equal(r.reason, OP.STOP_REASONS.STOP_EXECUTION_AUTHORITY_SOURCE_TEST_ONLY);
    assert.equal(r.executionAuthorityReference, null);
  }
});

test('a malformed execution authority reference fails closed', () => {
  for (const value of ['not-a-comment', 'abc', '12345', 'x'.repeat(40), '5644581826x']) {
    const r = OP.verifyLedgerBootstrapExecutionAuthority({ executionAuthority: value }, {});
    assert.equal(r.ok, false);
    assert.equal(r.reason, OP.STOP_REASONS.STOP_EXECUTION_AUTHORITY_INVALID);
  }
});

test('a live execution authority passes and resolves from env', () => {
  const direct = OP.verifyLedgerBootstrapExecutionAuthority({ executionAuthority: LIVE_AUTHORITY }, {});
  assert.equal(direct.ok, true);
  assert.equal(direct.executionAuthorityReference, LIVE_AUTHORITY);
  const viaEnv = OP.verifyLedgerBootstrapExecutionAuthority({}, {
    [OP.ENV_EXECUTION_AUTHORITY]: `comment:${LIVE_AUTHORITY}`,
  });
  assert.equal(viaEnv.ok, true);
  assert.equal(viaEnv.executionAuthorityReference, LIVE_AUTHORITY);
});

test('missing live execution authority stops before any transport call and stays unconsumed', async () => {
  const fake = makeFakeTransport();
  const r = await OP.executeGovernedBootstrap(
    executeArgs({ transport: fake.transport, executionAuthority: null, env: {} })
  );
  assert.equal(r.decision, OP.DECISIONS.EXECUTION_DISABLED_BY_DEFAULT);
  assert.ok(r.stops.includes(OP.STOP_REASONS.STOP_EXECUTION_AUTHORITY_MISSING));
  assert.equal(r.executionAttempted, false);
  assert.equal(r.oneAttemptBudgetConsumed, false);
  assert.equal(r.retryPermitted, true);
  assert.deepEqual(fake.calls, []);
});

test('the SOURCE/TEST comment as live authority stops before any transport call', async () => {
  const fake = makeFakeTransport();
  const r = await OP.executeGovernedBootstrap(
    executeArgs({ transport: fake.transport, executionAuthority: String(SOURCE_TEST_COMMENT) })
  );
  assert.equal(r.decision, OP.DECISIONS.EXECUTION_DISABLED_BY_DEFAULT);
  assert.ok(r.stops.includes(OP.STOP_REASONS.STOP_EXECUTION_AUTHORITY_SOURCE_TEST_ONLY));
  assert.equal(r.executionAttempted, false);
  assert.equal(r.oneAttemptBudgetConsumed, false);
  assert.equal(r.retryPermitted, true);
  assert.deepEqual(fake.calls, []);
});

test('missing/malformed credential is a preconnect failure: zero DB calls, unconsumed', async () => {
  for (const category of [
    TRANSPORT.TRANSPORT_FAILURE.SECRET_UNAVAILABLE,
    TRANSPORT.TRANSPORT_FAILURE.SECRET_MALFORMED,
  ]) {
    const fake = makeFakeTransport({ throwOn: 'acquireAdvisoryLock', throwCategory: category });
    const r = await OP.executeGovernedBootstrap(executeArgs({ transport: fake.transport }));
    assert.equal(r.preconnectFailure, true);
    assert.equal(r.reason, 'PRECONNECT_CREDENTIAL_UNAVAILABLE');
    assert.equal(r.executionAttempted, false);
    assert.equal(r.oneAttemptBudgetConsumed, false);
    assert.equal(r.retryPermitted, true);
    assert.equal(fake.calls.filter((c) => c[0] === 'withTransaction').length, 0);
  }
});

// ----- 7. Governed execution flow (mock transport only) -----

test('happy path commits+verifies and consumes the CENTRAL authority', async () => {
  const fake = makeFakeTransport();
  const r = await OP.executeGovernedBootstrap(executeArgs({ transport: fake.transport }));
  assert.equal(r.decision, OP.DECISIONS.APPLY_COMMITTED_AND_VERIFIED);
  assert.equal(r.executionAttempted, true);
  assert.equal(r.dbCapableExecutionStarted, true);
  assert.equal(r.oneAttemptBudgetConsumed, true);
  assert.equal(r.committedAndVerified, true);
  assert.equal(r.retryPermitted, false);
  assert.equal(r.executionAuthorityReference, LIVE_AUTHORITY);
  const names = fake.calls.map((c) => c[0]);
  assert.deepEqual(names, [
    'verifyConnectedTargetIdentity',
    'acquireAdvisoryLock',
    'withTransaction',
    'catalogTableKind',
    'applyMigration',
    'verifyCatalog',
    'writeLedger',
    'releaseAdvisoryLock',
  ]);
  assert.equal(fake.calls[1][1].length, 16);
});

test('target already present after a DB-capable start stays consumed', async () => {
  const fake = makeFakeTransport({ relationPresent: true });
  const r = await OP.executeGovernedBootstrap(executeArgs({ transport: fake.transport }));
  assert.equal(r.decision, OP.DECISIONS.APPLY_ROLLED_BACK_PRE_COMMIT);
  assert.ok(r.stops.includes(OP.STOP_REASONS.STOP_RELATION_PRESENT));
  assert.equal(r.dbCapableExecutionStarted, true);
  assert.equal(r.oneAttemptBudgetConsumed, true);
  assert.equal(r.committedAndVerified, false);
  assert.equal(r.retryPermitted, false);
});

test('advisory lock unavailable after connect stays consumed', async () => {
  const fake = makeFakeTransport({ lockGranted: false });
  const r = await OP.executeGovernedBootstrap(executeArgs({ transport: fake.transport }));
  assert.equal(r.decision, OP.DECISIONS.EXECUTION_DISABLED_BY_DEFAULT);
  assert.ok(r.stops.includes(OP.STOP_REASONS.STOP_ADVISORY_LOCK_UNAVAILABLE));
  assert.equal(r.executionAttempted, true);
  assert.equal(r.oneAttemptBudgetConsumed, true);
  assert.equal(r.retryPermitted, false);
  assert.equal(fake.calls.filter((c) => c[0] === 'withTransaction').length, 0);
});

test('an untyped lock-path throw is treated as DB-capable and stays consumed', async () => {
  const fake = makeFakeTransport({ throwOn: 'acquireAdvisoryLock' });
  const r = await OP.executeGovernedBootstrap(executeArgs({ transport: fake.transport }));
  assert.equal(r.decision, OP.DECISIONS.EXECUTION_DISABLED_BY_DEFAULT);
  assert.ok(r.stops.includes(OP.STOP_REASONS.STOP_ADVISORY_LOCK_UNAVAILABLE));
  assert.equal(r.executionAttempted, true);
  assert.equal(r.oneAttemptBudgetConsumed, true);
  assert.equal(r.retryPermitted, false);
});

test('a connection failure after the preconnect boundary stays consumed', async () => {
  const fake = makeFakeTransport({
    throwOn: 'acquireAdvisoryLock',
    throwCategory: TRANSPORT.TRANSPORT_FAILURE.CONNECT_UNAVAILABLE,
  });
  const r = await OP.executeGovernedBootstrap(executeArgs({ transport: fake.transport }));
  assert.equal(r.preconnectFailure, false);
  assert.equal(r.executionAttempted, true);
  assert.equal(r.oneAttemptBudgetConsumed, true);
  assert.equal(r.retryPermitted, false);
});

test('postcheck (catalog) mismatch rolls back and stays consumed', async () => {
  const fake = makeFakeTransport({ catalogMatched: false });
  const r = await OP.executeGovernedBootstrap(executeArgs({ transport: fake.transport }));
  assert.equal(r.decision, OP.DECISIONS.APPLY_ROLLED_BACK_PRE_COMMIT);
  assert.ok(r.stops.includes(OP.STOP_REASONS.STOP_POSTCHECK_MISMATCH));
  assert.equal(r.oneAttemptBudgetConsumed, true);
  assert.equal(r.committedAndVerified, false);
  assert.equal(r.retryPermitted, false);
});

test('ledger attestation mismatch rolls back and stays consumed', async () => {
  const fake = makeFakeTransport({ ledgerRecorded: false });
  const r = await OP.executeGovernedBootstrap(executeArgs({ transport: fake.transport }));
  assert.equal(r.decision, OP.DECISIONS.APPLY_ROLLED_BACK_PRE_COMMIT);
  assert.ok(r.stops.includes(OP.STOP_REASONS.STOP_LEDGER_ATTESTATION_MISMATCH));
  assert.equal(r.oneAttemptBudgetConsumed, true);
  assert.equal(r.committedAndVerified, false);
  assert.equal(r.retryPermitted, false);
});

test('apply failure reason is surfaced, rolled back, and stays consumed', async () => {
  const fake = makeFakeTransport({ applyCommitted: false });
  const r = await OP.executeGovernedBootstrap(executeArgs({ transport: fake.transport }));
  assert.equal(r.decision, OP.DECISIONS.APPLY_ROLLED_BACK_PRE_COMMIT);
  assert.equal(r.oneAttemptBudgetConsumed, true);
  assert.equal(r.committedAndVerified, false);
  assert.equal(r.retryPermitted, false);
});

test('a thrown transaction is ambiguous: consumed, no retry permitted', async () => {
  const fake = makeFakeTransport({ throwOn: 'withTransaction' });
  const r = await OP.executeGovernedBootstrap(executeArgs({ transport: fake.transport }));
  assert.equal(r.decision, OP.DECISIONS.EXECUTION_DISABLED_BY_DEFAULT);
  assert.ok(r.stops.includes(OP.STOP_REASONS.STOP_AMBIGUOUS_OUTCOME));
  assert.equal(r.ambiguous, true);
  assert.equal(r.retryPermitted, false);
  assert.equal(r.executionAttempted, true);
  assert.equal(r.oneAttemptBudgetConsumed, true);
  assert.equal(r.committedAndVerified, false);
  assert.ok(fake.calls.some((c) => c[0] === 'releaseAdvisoryLock'), 'lock must be released even on ambiguity');
});

test('committedAndVerified is never used as authority-consumption state', async () => {
  const fake = makeFakeTransport({ catalogMatched: false });
  const r = await OP.executeGovernedBootstrap(executeArgs({ transport: fake.transport }));
  assert.equal(r.committedAndVerified, false);
  assert.equal(r.oneAttemptBudgetConsumed, true);
});

test('no second attempt is permitted under the same execution authority', async () => {
  const scenarios = [
    {},
    { relationPresent: true },
    { catalogMatched: false },
    { ledgerRecorded: false },
    { applyCommitted: false },
    { lockGranted: false },
    { throwOn: 'withTransaction' },
    { throwOn: 'acquireAdvisoryLock', throwCategory: TRANSPORT.TRANSPORT_FAILURE.CONNECT_UNAVAILABLE },
  ];
  for (const scenario of scenarios) {
    const fake = makeFakeTransport(scenario);
    const r = await OP.executeGovernedBootstrap(executeArgs({ transport: fake.transport }));
    assert.equal(
      r.oneAttemptBudgetConsumed,
      true,
      `scenario ${JSON.stringify(scenario)} must leave the authority consumed`
    );
    assert.equal(r.retryPermitted, false, `scenario ${JSON.stringify(scenario)} must forbid retry`);
    assert.equal(r.executionAuthorityReference, LIVE_AUTHORITY);
  }
});

test('writeLedger payload binds the live authority reference and the exact execution head', async () => {
  const fake = makeFakeTransport();
  await OP.executeGovernedBootstrap(executeArgs({ transport: fake.transport }));
  const call = fake.calls.find((c) => c[0] === 'writeLedger');
  assert.equal(call[1].issue, 3846);
  assert.equal(call[1].executionAuthorityReference, LIVE_AUTHORITY);
  assert.notEqual(call[1].executionAuthorityReference, String(SOURCE_TEST_COMMENT));
  assert.equal(call[1].executionHead, ACTUAL_HEAD);
  assert.equal(call[1].migrationId, BOOT.migrationId);
  assert.equal(call[1].migrationSha256, BOOT.migrationSha256);
  assert.equal(call[1].relation, BOOT.relation);
  assert.equal(call[1].fingerprint, BOOT.expectedSchemaFingerprint);
  assert.equal(
    Object.prototype.hasOwnProperty.call(call[1], 'activeAuthorizationComment'),
    false,
    'the SOURCE/TEST comment must never be written as the mutation authority'
  );
});

// ----- 7b. Connected-target identity gate -----

test('transport validation fails closed when the identity gate method is missing', () => {
  const fake = makeFakeTransport();
  const partial = { ...fake.transport };
  delete partial.verifyConnectedTargetIdentity;
  const check = OP.validateLedgerBootstrapTransport(partial);
  assert.equal(check.ok, false);
  assert.equal(check.reason, OP.STOP_REASONS.STOP_CREDENTIAL_OPERATOR_ABSENT);
});

test('the identity gate always precedes the advisory lock', async () => {
  const fake = makeFakeTransport();
  await OP.executeGovernedBootstrap(executeArgs({ transport: fake.transport }));
  const names = fake.calls.map((c) => c[0]);
  assert.ok(names.includes('verifyConnectedTargetIdentity'));
  assert.ok(names.includes('acquireAdvisoryLock'));
  assert.ok(
    names.indexOf('verifyConnectedTargetIdentity') < names.indexOf('acquireAdvisoryLock'),
    'identity must be verified before the advisory lock'
  );
});

test('a connected-target mismatch after connect consumes the authority and forbids retry', async () => {
  const fake = makeFakeTransport({
    throwOn: 'verifyConnectedTargetIdentity',
    throwCategory: TRANSPORT.TRANSPORT_FAILURE.CONNECTED_TARGET_IDENTITY_MISMATCH,
  });
  const r = await OP.executeGovernedBootstrap(executeArgs({ transport: fake.transport }));
  assert.ok(r.stops.includes(OP.STOP_REASONS.STOP_CONNECTED_TARGET_IDENTITY_MISMATCH));
  assert.equal(r.reason, 'CONNECTED_TARGET_IDENTITY_MISMATCH');
  assert.equal(r.preconnectFailure, false);
  assert.equal(r.executionAttempted, true);
  assert.equal(r.dbCapableExecutionStarted, true);
  assert.equal(r.oneAttemptBudgetConsumed, true);
  assert.equal(r.retryPermitted, false);
  assert.equal(r.committedAndVerified, false);
});

test('a connected-target mismatch performs zero lock/BEGIN/apply/ledger calls', async () => {
  const fake = makeFakeTransport({
    throwOn: 'verifyConnectedTargetIdentity',
    throwCategory: TRANSPORT.TRANSPORT_FAILURE.CONNECTED_TARGET_IDENTITY_MISMATCH,
  });
  await OP.executeGovernedBootstrap(executeArgs({ transport: fake.transport }));
  const names = fake.calls.map((c) => c[0]);
  assert.deepEqual(names, ['verifyConnectedTargetIdentity']);
  for (const forbidden of [
    'acquireAdvisoryLock',
    'releaseAdvisoryLock',
    'withTransaction',
    'catalogTableKind',
    'applyMigration',
    'verifyCatalog',
    'writeLedger',
  ]) {
    assert.equal(names.includes(forbidden), false, `${forbidden} must not be called`);
  }
});

test('an identity probe that throws unexpectedly is DB-capable and consumes', async () => {
  const fake = makeFakeTransport({ throwOn: 'verifyConnectedTargetIdentity' });
  const r = await OP.executeGovernedBootstrap(executeArgs({ transport: fake.transport }));
  assert.equal(r.oneAttemptBudgetConsumed, true);
  assert.equal(r.retryPermitted, false);
  assert.equal(r.dbCapableExecutionStarted, true);
  assert.ok(r.stops.includes(OP.STOP_REASONS.STOP_CONNECTED_TARGET_IDENTITY_MISMATCH));
});

test('a non-ok identity envelope is fail-closed and consumes', async () => {
  const fake = makeFakeTransport({ identityOk: false });
  const r = await OP.executeGovernedBootstrap(executeArgs({ transport: fake.transport }));
  assert.equal(r.oneAttemptBudgetConsumed, true);
  assert.equal(r.retryPermitted, false);
  assert.ok(r.stops.includes(OP.STOP_REASONS.STOP_CONNECTED_TARGET_IDENTITY_MISMATCH));
});

test('a wrong Neon endpoint is a PRECONNECT stop that leaves the authority unconsumed', async () => {
  const fake = makeFakeTransport({
    throwOn: 'verifyConnectedTargetIdentity',
    throwCategory: TRANSPORT.TRANSPORT_FAILURE.ENDPOINT_IDENTITY_MISMATCH,
  });
  const r = await OP.executeGovernedBootstrap(executeArgs({ transport: fake.transport }));
  assert.ok(r.stops.includes(OP.STOP_REASONS.STOP_PRECONNECT_ENDPOINT_IDENTITY));
  assert.equal(r.reason, 'PRECONNECT_ENDPOINT_IDENTITY_MISMATCH');
  assert.equal(r.preconnectFailure, true);
  assert.equal(r.executionAttempted, false);
  assert.equal(r.dbCapableExecutionStarted, false);
  assert.equal(r.oneAttemptBudgetConsumed, false);
  assert.equal(r.retryPermitted, true);
});

test('an unavailable role mapping is a PRECONNECT stop that leaves the authority unconsumed', async () => {
  const fake = makeFakeTransport({
    throwOn: 'verifyConnectedTargetIdentity',
    throwCategory: TRANSPORT.TRANSPORT_FAILURE.ROLE_MAPPING_UNAVAILABLE,
  });
  const r = await OP.executeGovernedBootstrap(executeArgs({ transport: fake.transport }));
  assert.equal(r.preconnectFailure, true);
  assert.equal(r.oneAttemptBudgetConsumed, false);
  assert.equal(r.retryPermitted, true);
});

test('the preconnect category set binds the endpoint and role-mapping categories', () => {
  assert.ok(OP.PRECONNECT_FAILURE_CATEGORIES.has(TRANSPORT.TRANSPORT_FAILURE.ENDPOINT_IDENTITY_MISMATCH));
  assert.ok(OP.PRECONNECT_FAILURE_CATEGORIES.has(TRANSPORT.TRANSPORT_FAILURE.ROLE_MAPPING_UNAVAILABLE));
  // Post-connect identity failures must NOT be preconnect: they consume.
  assert.equal(
    OP.PRECONNECT_FAILURE_CATEGORIES.has(TRANSPORT.TRANSPORT_FAILURE.CONNECTED_TARGET_IDENTITY_MISMATCH),
    false
  );
  assert.equal(
    OP.PRECONNECT_FAILURE_CATEGORIES.has(TRANSPORT.TRANSPORT_FAILURE.CONNECTED_TARGET_IDENTITY_UNAVAILABLE),
    false
  );
  assert.equal(OP.PRECONNECT_FAILURE_CATEGORIES.has(TRANSPORT.TRANSPORT_FAILURE.IDENTITY_NOT_VERIFIED), false);
});

// ----- 8. CLI argument strictness (pure parser) -----

test('CLI parser: default mode is dry run', () => {
  assert.deepEqual(OP.parseOperatorCliArgs([]), {
    isExecute: false, isDryRun: true, executionHead: null, executionAuthority: null,
  });
});

test('CLI parser: accepts --execute with --execution-head in both forms', () => {
  assert.deepEqual(OP.parseOperatorCliArgs(['--execute', '--execution-head', 'a'.repeat(40)]), {
    isExecute: true, isDryRun: false, executionHead: 'a'.repeat(40), executionAuthority: null,
  });
  assert.deepEqual(OP.parseOperatorCliArgs(['--execute', `--execution-head=${'b'.repeat(40)}`]), {
    isExecute: true, isDryRun: false, executionHead: 'b'.repeat(40), executionAuthority: null,
  });
});

test('CLI parser: accepts --execution-authority in both forms', () => {
  assert.deepEqual(OP.parseOperatorCliArgs(['--execute', '--execution-authority', LIVE_AUTHORITY]), {
    isExecute: true, isDryRun: false, executionHead: null, executionAuthority: LIVE_AUTHORITY,
  });
  assert.deepEqual(OP.parseOperatorCliArgs(['--execute', `--execution-authority=${LIVE_AUTHORITY}`]), {
    isExecute: true, isDryRun: false, executionHead: null, executionAuthority: LIVE_AUTHORITY,
  });
});

const parserRejections = [
  ['positional', ['extra'], 'POSITIONAL_ARGUMENT_REJECTED'],
  ['unknown flag', ['--profile', '4282'], 'UNKNOWN_FLAG_REJECTED'],
  ['duplicate flag', ['--execute', '--execute'], 'DUPLICATE_FLAG_REJECTED'],
  ['conflicting modes', ['--execute', '--dry-run'], 'CONFLICTING_FLAGS_REJECTED'],
  ['value on boolean', ['--execute=yes'], 'FLAG_VALUE_UNEXPECTED'],
  ['missing head value', ['--execution-head'], 'FLAG_VALUE_MISSING'],
  ['missing authority value', ['--execution-authority'], 'FLAG_VALUE_MISSING'],
];

for (const [label, argv, message] of parserRejections) {
  test(`CLI parser rejects ${label}`, () => {
    assert.throws(() => OP.parseOperatorCliArgs(argv), (err) => err.message === message);
  });
}

// ----- 9. CLI process-level strictness (spawned, credential-free) -----

function spawnCli(args, env = {}) {
  const cleanEnv = { ...process.env };
  delete cleanEnv[TRANSPORT.CREDENTIAL_ENV_KEY];
  delete cleanEnv[TRANSPORT.ROLE_MAPPING_ENV_KEY];
  delete cleanEnv[OP.ENV_ALLOW_EXECUTE];
  delete cleanEnv[OP.ENV_EXECUTION_HEAD];
  delete cleanEnv[OP.ENV_EXECUTION_AUTHORITY];
  Object.assign(cleanEnv, env);
  return spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'canonical-ledger-bootstrap-operator.cjs'), ...args], {
    encoding: 'utf8',
    env: cleanEnv,
  });
}

test('CLI: unknown flags exit 2 without executing anything', () => {
  const r = spawnCli(['--transport-path', 'ANYTHING']);
  assert.equal(r.status, 2);
  const parsed = JSON.parse(r.stderr);
  assert.equal(parsed.mode, 'INITIALIZATION_FAILED');
  assert.equal(parsed.reason, 'UNKNOWN_FLAG_REJECTED');
  assert.equal(parsed.executionAttempted, false);
});

test('CLI: dry run exits 0 with READINESS_PASSED and zero execution', () => {
  const r = spawnCli(['--dry-run']);
  assert.equal(r.status, 0, r.stderr);
  const parsed = JSON.parse(r.stdout);
  assert.equal(parsed.mode, 'DRY_RUN');
  assert.equal(parsed.decision, OP.DECISIONS.READINESS_PASSED);
  assert.equal(parsed.executionAttempted, false);
  assert.equal(parsed.oneAttemptBudgetConsumed, false);
  assert.equal(parsed.retryPermitted, true);
  assert.equal(parsed.binding.issue, 3846);
  // Provenance metadata only — the SOURCE/TEST comment is not presented as the
  // Production mutation authority.
  assert.equal(parsed.binding.sourceTestImplementationComment, SOURCE_TEST_COMMENT);
  assert.equal(parsed.binding.liveExecutionAuthority, 'SUPPLIED_SEPARATELY_AT_EXECUTION_TIME');
});

test('CLI: --execute without the allow-execute env fails closed', () => {
  const r = spawnCli(['--execute', '--execution-head', ACTUAL_HEAD, '--execution-authority', LIVE_AUTHORITY]);
  assert.equal(r.status, 2);
  const parsed = JSON.parse(r.stderr);
  assert.equal(parsed.mode, 'EXECUTE_REQUESTED');
  assert.equal(parsed.decision, OP.DECISIONS.EXECUTION_DISABLED_BY_DEFAULT);
  assert.ok(parsed.reason.includes('LOVEBUD_LEDGER_BOOTSTRAP_ALLOW_EXECUTE'));
  assert.equal(parsed.executionAttempted, false);
});

test('CLI: --execute without a live execution authority fails closed before credential contact', () => {
  const r = spawnCli(['--execute', '--execution-head', ACTUAL_HEAD], { [OP.ENV_ALLOW_EXECUTE]: '1' });
  assert.equal(r.status, 2);
  const parsed = JSON.parse(r.stderr);
  assert.equal(parsed.mode, 'EXECUTE_REQUESTED');
  assert.equal(parsed.reason, OP.STOP_REASONS.STOP_EXECUTION_AUTHORITY_MISSING);
  assert.equal(parsed.executionAttempted, false);
  assert.equal(parsed.oneAttemptBudgetConsumed, false);
  assert.equal(parsed.retryPermitted, true);
});

test('CLI: the SOURCE/TEST implementation comment as --execution-authority fails closed', () => {
  const r = spawnCli(
    ['--execute', '--execution-head', ACTUAL_HEAD, '--execution-authority', String(SOURCE_TEST_COMMENT)],
    { [OP.ENV_ALLOW_EXECUTE]: '1' }
  );
  assert.equal(r.status, 2);
  const parsed = JSON.parse(r.stderr);
  assert.equal(parsed.reason, OP.STOP_REASONS.STOP_EXECUTION_AUTHORITY_SOURCE_TEST_ONLY);
  assert.equal(parsed.executionAttempted, false);
  assert.equal(parsed.oneAttemptBudgetConsumed, false);
});

test('CLI: exact-head mismatch prevents transport use', () => {
  const r = spawnCli(['--execute', '--execution-head', 'f'.repeat(40), '--execution-authority', LIVE_AUTHORITY], {
    [OP.ENV_ALLOW_EXECUTE]: '1',
  });
  assert.equal(r.status, 2);
  const parsed = JSON.parse(r.stderr);
  assert.equal(parsed.reason, OP.STOP_REASONS.STOP_EXECUTION_HEAD_AUTHORITY_MISMATCH);
  assert.equal(parsed.executionAttempted, false);
  assert.equal(parsed.oneAttemptBudgetConsumed, false);
});

test('CLI: valid authority and head with no credential fails closed before any connect', () => {
  const r = spawnCli(['--execute', '--execution-head', ACTUAL_HEAD, '--execution-authority', LIVE_AUTHORITY], {
    [OP.ENV_ALLOW_EXECUTE]: '1',
  });
  assert.equal(r.status, 2);
  const parsed = JSON.parse(r.stdout || r.stderr);
  assert.equal(parsed.mode, 'EXECUTE');
  assert.equal(parsed.decision, OP.DECISIONS.EXECUTION_DISABLED_BY_DEFAULT);
  // The credential now resolves at the connected-target identity gate, which is
  // still preconnect: the failure surfaces before the advisory lock is reached.
  assert.ok(parsed.stops.includes(OP.STOP_REASONS.STOP_CREDENTIAL_OPERATOR_ABSENT));
  assert.equal(parsed.reason, 'PRECONNECT_CREDENTIAL_UNAVAILABLE');
  assert.equal(parsed.preconnectFailure, true);
  assert.equal(parsed.executionAttempted, false);
  assert.equal(parsed.oneAttemptBudgetConsumed, false);
  assert.equal(parsed.retryPermitted, true);
});

test('CLI: execution authority also resolves from the dedicated env key', () => {
  const r = spawnCli(['--execute', '--execution-head', 'f'.repeat(40)], {
    [OP.ENV_ALLOW_EXECUTE]: '1',
    [OP.ENV_EXECUTION_AUTHORITY]: LIVE_AUTHORITY,
  });
  assert.equal(r.status, 2);
  const parsed = JSON.parse(r.stderr);
  // The authority was accepted (env-resolved); the stop is the head mismatch,
  // not a missing authority.
  assert.equal(parsed.reason, OP.STOP_REASONS.STOP_EXECUTION_HEAD_AUTHORITY_MISMATCH);
});

test('CLI source never embeds credential material or DSN-shaped literals', () => {
  const fs = require('node:fs');
  const src = fs.readFileSync(path.join(ROOT, 'scripts', 'canonical-ledger-bootstrap-operator.cjs'), 'utf8');
  const transportSrc = fs.readFileSync(path.join(ROOT, 'scripts', 'canonical-ledger-bootstrap-postgres.cjs'), 'utf8');
  for (const text of [src, transportSrc]) {
    assert.equal(/postgres(ql)?:\/\/[^\s'"]+:[^\s'"]+@/.test(text), false, 'DSN-shaped literal forbidden');
  }
});

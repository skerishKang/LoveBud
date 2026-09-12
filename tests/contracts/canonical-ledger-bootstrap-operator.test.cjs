'use strict';

/**
 * SOURCE_STATIC policy tests for the governed #3846 canonical ledger-bootstrap
 * operator. Pure — no DB, no Production contact, no secrets. Validates
 * fail-closed prechecks, dry-run by default, exact-head authority, and that the
 * one-attempt budget is consumed only on a committed+verified apply.
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

const CANONICAL_PACKET = OP.buildBootstrapPacket();

function makeFakeTransport(overrides = {}) {
  const calls = [];
  const behavior = {
    lockGranted: true,
    relationPresent: false,
    applyCommitted: true,
    catalogMatched: true,
    ledgerRecorded: true,
    throwOn: null,
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
    acquireAdvisoryLock: async (key) => {
      calls.push(['acquireAdvisoryLock', key]);
      if (behavior.throwOn === 'acquireAdvisoryLock') throw new Error('FAKE_LOCK_BOOM');
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
    ...extra,
  };
}

// ----- 1. Dry-run path: canonical packet passes readiness -----

test('canonical #3846 packet passes bootstrap readiness (dry-run path)', () => {
  const res = OP.evaluateBootstrapReadiness(CANONICAL_PACKET);
  assert.equal(res.decision, OP.DECISIONS.READINESS_PASSED);
  assert.deepEqual(res.stops, []);
});

test('packet binding is exact', () => {
  assert.equal(CANONICAL_PACKET.issue, 3846);
  assert.equal(CANONICAL_PACKET.activeAuthorizationComment, 5644253160);
  assert.equal(CANONICAL_PACKET.migrationId, '20260802094500_bootstrap-migration-ledger');
  assert.equal(CANONICAL_PACKET.migrationPath, 'db/migrations/20260802094500_bootstrap-migration-ledger.sql');
  assert.equal(CANONICAL_PACKET.migrationSha256, 'c04d6e8cf074514e1835cd837f6ae72ccd96b775a507a12d2b394733977918cc');
  assert.equal(CANONICAL_PACKET.intendedRelation, 'public.schema_migration_ledger');
  assert.equal(CANONICAL_PACKET.expectedSchemaFingerprint, '961d195776eaa245e4e63620a35f19a4de2dbe2f00dbd8b94faffb70ce2332d1');
  assert.deepEqual(CANONICAL_PACKET.targetIdentity, {
    product_shared: '133-relovetree',
    environment_class: 'production',
    database: 'neondb',
  });
  assert.equal(CANONICAL_PACKET.applyMode, 'TRANSACTION_REQUIRED');
  assert.equal(CANONICAL_PACKET.unrelatedMigrationCount, 0);
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
  ['wrong ACTIVE comment', { activeAuthorizationComment: 5641029190 }, OP.STOP_REASONS.STOP_ACTIVE_COMMENT_MISSING],
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

// ----- 7. Governed execution flow (mock transport only) -----

test('happy path commits+verifies and consumes the one-attempt budget', async () => {
  const fake = makeFakeTransport();
  const r = await OP.executeGovernedBootstrap(executeArgs({ transport: fake.transport }));
  assert.equal(r.decision, OP.DECISIONS.APPLY_COMMITTED_AND_VERIFIED);
  assert.equal(r.executionAttempted, true);
  assert.equal(r.oneAttemptBudgetConsumed, true);
  const names = fake.calls.map((c) => c[0]);
  assert.deepEqual(names, [
    'acquireAdvisoryLock',
    'withTransaction',
    'catalogTableKind',
    'applyMigration',
    'verifyCatalog',
    'writeLedger',
    'releaseAdvisoryLock',
  ]);
  assert.equal(fake.calls[0][1].length, 16);
});

test('relation already present rolls back pre-commit without consuming the budget', async () => {
  const fake = makeFakeTransport({ relationPresent: true });
  const r = await OP.executeGovernedBootstrap(executeArgs({ transport: fake.transport }));
  assert.equal(r.decision, OP.DECISIONS.APPLY_ROLLED_BACK_PRE_COMMIT);
  assert.ok(r.stops.includes(OP.STOP_REASONS.STOP_RELATION_PRESENT));
  assert.equal(r.oneAttemptBudgetConsumed, false);
});

test('lock unavailable stops before the transaction', async () => {
  const fake = makeFakeTransport({ lockGranted: false });
  const r = await OP.executeGovernedBootstrap(executeArgs({ transport: fake.transport }));
  assert.equal(r.decision, OP.DECISIONS.EXECUTION_DISABLED_BY_DEFAULT);
  assert.ok(r.stops.includes(OP.STOP_REASONS.STOP_ADVISORY_LOCK_UNAVAILABLE));
  assert.equal(r.executionAttempted, false);
  assert.equal(fake.calls.filter((c) => c[0] === 'withTransaction').length, 0);
});

test('lock acquisition throw stops before the transaction', async () => {
  const fake = makeFakeTransport({ throwOn: 'acquireAdvisoryLock' });
  const r = await OP.executeGovernedBootstrap(executeArgs({ transport: fake.transport }));
  assert.equal(r.decision, OP.DECISIONS.EXECUTION_DISABLED_BY_DEFAULT);
  assert.ok(r.stops.includes(OP.STOP_REASONS.STOP_ADVISORY_LOCK_UNAVAILABLE));
  assert.equal(r.executionAttempted, false);
});

test('postcheck mismatch rolls back pre-commit', async () => {
  const fake = makeFakeTransport({ catalogMatched: false });
  const r = await OP.executeGovernedBootstrap(executeArgs({ transport: fake.transport }));
  assert.equal(r.decision, OP.DECISIONS.APPLY_ROLLED_BACK_PRE_COMMIT);
  assert.ok(r.stops.includes(OP.STOP_REASONS.STOP_POSTCHECK_MISMATCH));
  assert.equal(r.oneAttemptBudgetConsumed, false);
});

test('ledger attestation mismatch rolls back pre-commit', async () => {
  const fake = makeFakeTransport({ ledgerRecorded: false });
  const r = await OP.executeGovernedBootstrap(executeArgs({ transport: fake.transport }));
  assert.equal(r.decision, OP.DECISIONS.APPLY_ROLLED_BACK_PRE_COMMIT);
  assert.ok(r.stops.includes(OP.STOP_REASONS.STOP_LEDGER_ATTESTATION_MISMATCH));
});

test('apply failure reason is surfaced and stays pre-commit', async () => {
  const fake = makeFakeTransport({ applyCommitted: false });
  const r = await OP.executeGovernedBootstrap(executeArgs({ transport: fake.transport }));
  assert.equal(r.decision, OP.DECISIONS.APPLY_ROLLED_BACK_PRE_COMMIT);
  assert.equal(r.oneAttemptBudgetConsumed, false);
});

test('a thrown transaction is an ambiguous outcome: no retry, budget not consumed', async () => {
  const fake = makeFakeTransport({ throwOn: 'withTransaction' });
  const r = await OP.executeGovernedBootstrap(executeArgs({ transport: fake.transport }));
  assert.equal(r.decision, OP.DECISIONS.EXECUTION_DISABLED_BY_DEFAULT);
  assert.ok(r.stops.includes(OP.STOP_REASONS.STOP_AMBIGUOUS_OUTCOME));
  assert.equal(r.ambiguous, true);
  assert.equal(r.retryPermitted, false);
  assert.equal(r.executionAttempted, true);
  assert.equal(r.oneAttemptBudgetConsumed, false);
  assert.ok(fake.calls.some((c) => c[0] === 'releaseAdvisoryLock'), 'lock must be released even on ambiguity');
});

test('writeLedger payload binds the exact packet facts', async () => {
  const fake = makeFakeTransport();
  await OP.executeGovernedBootstrap(executeArgs({ transport: fake.transport }));
  const call = fake.calls.find((c) => c[0] === 'writeLedger');
  assert.equal(call[1].issue, 3846);
  assert.equal(call[1].activeAuthorizationComment, 5644253160);
  assert.equal(call[1].migrationId, BOOT.migrationId);
  assert.equal(call[1].migrationSha256, BOOT.migrationSha256);
  assert.equal(call[1].relation, BOOT.relation);
  assert.equal(call[1].fingerprint, BOOT.expectedSchemaFingerprint);
});

// ----- 8. CLI argument strictness (pure parser) -----

test('CLI parser: default mode is dry run', () => {
  assert.deepEqual(OP.parseOperatorCliArgs([]), { isExecute: false, isDryRun: true, executionHead: null });
});

test('CLI parser: accepts --execute with --execution-head in both forms', () => {
  assert.deepEqual(OP.parseOperatorCliArgs(['--execute', '--execution-head', 'a'.repeat(40)]), {
    isExecute: true, isDryRun: false, executionHead: 'a'.repeat(40),
  });
  assert.deepEqual(OP.parseOperatorCliArgs(['--execute', `--execution-head=${'b'.repeat(40)}`]), {
    isExecute: true, isDryRun: false, executionHead: 'b'.repeat(40),
  });
});

const parserRejections = [
  ['positional', ['extra'], 'POSITIONAL_ARGUMENT_REJECTED'],
  ['unknown flag', ['--profile', '4282'], 'UNKNOWN_FLAG_REJECTED'],
  ['duplicate flag', ['--execute', '--execute'], 'DUPLICATE_FLAG_REJECTED'],
  ['conflicting modes', ['--execute', '--dry-run'], 'CONFLICTING_FLAGS_REJECTED'],
  ['value on boolean', ['--execute=yes'], 'FLAG_VALUE_UNEXPECTED'],
  ['missing head value', ['--execution-head'], 'FLAG_VALUE_MISSING'],
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
  assert.equal(parsed.binding.issue, 3846);
});

test('CLI: --execute without the allow-execute env fails closed', () => {
  const r = spawnCli(['--execute', '--execution-head', ACTUAL_HEAD]);
  assert.equal(r.status, 2);
  const parsed = JSON.parse(r.stderr);
  assert.equal(parsed.mode, 'EXECUTE_REQUESTED');
  assert.equal(parsed.decision, OP.DECISIONS.EXECUTION_DISABLED_BY_DEFAULT);
  assert.ok(parsed.reason.includes('LOVEBUD_LEDGER_BOOTSTRAP_ALLOW_EXECUTE'));
  assert.equal(parsed.executionAttempted, false);
});

test('CLI: exact-head mismatch prevents transport use', () => {
  const r = spawnCli(['--execute', '--execution-head', 'f'.repeat(40)], { [OP.ENV_ALLOW_EXECUTE]: '1' });
  assert.equal(r.status, 2);
  const parsed = JSON.parse(r.stderr);
  assert.equal(parsed.reason, OP.STOP_REASONS.STOP_EXECUTION_HEAD_AUTHORITY_MISMATCH);
  assert.equal(parsed.executionAttempted, false);
  assert.equal(parsed.oneAttemptBudgetConsumed, false);
});

test('CLI: valid head with no credential fails closed before any connect', () => {
  const r = spawnCli(['--execute', '--execution-head', ACTUAL_HEAD], { [OP.ENV_ALLOW_EXECUTE]: '1' });
  assert.equal(r.status, 2);
  const parsed = JSON.parse(r.stdout || r.stderr);
  assert.equal(parsed.mode, 'EXECUTE');
  assert.equal(parsed.decision, OP.DECISIONS.EXECUTION_DISABLED_BY_DEFAULT);
  assert.ok(parsed.stops.includes(OP.STOP_REASONS.STOP_ADVISORY_LOCK_UNAVAILABLE));
  assert.equal(parsed.reason, 'ADVISORY_LOCK_QUERY_FAILED');
  assert.equal(parsed.executionAttempted, false);
  assert.equal(parsed.oneAttemptBudgetConsumed, false);
});

test('CLI source never embeds credential material or DSN-shaped literals', () => {
  const fs = require('node:fs');
  const src = fs.readFileSync(path.join(ROOT, 'scripts', 'canonical-ledger-bootstrap-operator.cjs'), 'utf8');
  const transportSrc = fs.readFileSync(path.join(ROOT, 'scripts', 'canonical-ledger-bootstrap-postgres.cjs'), 'utf8');
  for (const text of [src, transportSrc]) {
    assert.equal(/postgres(ql)?:\/\/[^\s'"]+:[^\s'"]+@/.test(text), false, 'DSN-shaped literal forbidden');
  }
});

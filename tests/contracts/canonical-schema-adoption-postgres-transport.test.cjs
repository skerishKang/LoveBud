'use strict';

/**
 * Network-free contract tests for the repository-owned schema-adoption
 * Postgres transport (#4371). The fake client is deliberately keyed by the
 * repository-owned query constants and never accepts caller SQL.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const TRANSPORT_PATH = path.join(ROOT, 'scripts', 'canonical-schema-adoption-postgres-transport.cjs');
const TRANSPORT = require(TRANSPORT_PATH);
const ADAPTER = require(path.join(ROOT, 'scripts', 'migration-catalog-postgres-adapter-core.cjs'));
const LEDGER = require(path.join(ROOT, 'scripts', 'migration-postgres-ledger-adapter-core.cjs'));
const OP = require(path.join(ROOT, 'scripts', 'canonical-schema-adoption-operator-core.cjs'));

// The synthetic credential is assembled only at runtime from separate
// non-contiguous components so that no credential-shaped connection string is
// ever committed. The resulting value is byte-identical to the prior fixture.
const CRED_SCHEME = 'postgresql';
const CRED_USER = 'svc' + '_ro';
const CRED_PASSWORD = ['Synthetic', 'P4ss', 'w0rd', '%21'].join('');
const CRED_HOST = 'db.example' + '.invalid';
const CRED_PORT = '5432';
const CRED_DATABASE = 'neon' + 'db';
const CRED_QUERY = 'ssl' + 'mode=require';

function syntheticDsn(overrides = {}) {
  const parts = {
    scheme: CRED_SCHEME,
    user: CRED_USER,
    password: CRED_PASSWORD,
    host: CRED_HOST,
    port: CRED_PORT,
    database: CRED_DATABASE,
    query: CRED_QUERY,
    ...overrides,
  };
  return [
    parts.scheme, '://', parts.user, ':', parts.password, '@',
    parts.host, ':', parts.port, '/', parts.database, '?', parts.query,
  ].join('');
}

const SECRET = syntheticDsn();
const ROLE_MAPPING = Object.freeze({ postgres: 'OWNER_CLASS', service_role: 'SERVICE' });

function envWithSecret(overrides = {}) {
  return { [TRANSPORT.CREDENTIAL_ENV_KEY]: SECRET, ...overrides };
}

function sha256File(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function fixtureRows(profile) {
  return {
    relation: [{ oid: '16900', relkind: 'r', rls_enabled: false, rls_forced: false }],
    columns: [
      { name: 'id', type_identity: 'uuid', nullable: false, default_definition: 'gen_random_uuid()', attgenerated: '', attidentity: '' },
      { name: 'user_id', type_identity: 'uuid', nullable: false, default_definition: null, attgenerated: '', attidentity: '' },
      { name: 'created_at', type_identity: 'timestamptz', nullable: false, default_definition: 'now()', attgenerated: '', attidentity: '' },
    ],
    constraints: [
      { name: 'pk_fixture', contype: 'p', validated: true, definition: 'PRIMARY KEY (id)', confupdtype: '', confdeltype: '' },
      { name: 'uq_fixture', contype: 'u', validated: true, definition: 'UNIQUE (user_id)', confupdtype: '', confdeltype: '' },
    ],
    indexes: [
      {
        name: 'pk_fixture_idx',
        is_primary: true,
        is_unique: true,
        is_valid: true,
        definition: `CREATE UNIQUE INDEX pk_fixture_idx ON ${profile.intendedRelation} USING btree (id)`,
      },
    ],
    triggers: [],
    policies: [],
    grants: [
      { grantee: 'postgres', privilege_type: 'INSERT', is_grantable: false },
      { grantee: 'service_role', privilege_type: 'SELECT', is_grantable: false },
    ],
  };
}

function catalogRowsClient(rows) {
  const queryKey = {
    relation: 'RELATION',
    columns: 'COLUMNS',
    constraints: 'CONSTRAINTS',
    indexes: 'INDEXES',
    triggers: 'TRIGGERS',
    policies: 'POLICIES',
    grants: 'GRANTS',
  };
  return {
    async query(text) {
      const key = Object.keys(rows).find((candidate) => ADAPTER.Q[queryKey[candidate]] === text);
      if (!key) throw new Error('UNEXPECTED_CATALOG_QUERY');
      return { rows: rows[key] };
    },
  };
}

async function fixtureFingerprint(profile, rows = fixtureRows(profile)) {
  const roleMap = ADAPTER.validateRoleMapping(ROLE_MAPPING);
  const raw = await ADAPTER.fetchRawObject(
    catalogRowsClient(rows),
    {
      schema: profile.intendedRelation.split('.')[0],
      object_name: profile.intendedRelation.split('.')[1],
      object_kind: 'TABLE',
    },
    roleMap,
  );
  const contract = ADAPTER.loadContract(ROOT);
  const metadata = ADAPTER.toCanonicalMetadata([raw], contract);
  return ADAPTER.buildCatalogEvidence(metadata, contract).objects[0].fingerprint.slice('sha256:'.length);
}

function makeFakeClient(profile, options = {}) {
  const rows = options.rows || fixtureRows(profile);
  const migrationSql = fs.readFileSync(path.join(ROOT, profile.migrationPath), 'utf8');
  const state = {
    calls: [],
    sql: [],
    params: [],
    connectAttempts: 0,
    closes: 0,
    tablePresent: options.tablePresent === true,
    applyCreatesTable: options.applyCreatesTable === true,
    failOn: options.failOn || null,
    lockGranted: options.lockGranted !== false,
    txOpen: false,
    committed: false,
    rolledBack: false,
    lockHeld: false,
  };

  const relation = profile.intendedRelation;
  const ledgerText = LEDGER.POSTGRES_MIGRATION_LEDGER_QUERIES.append.text;
  const client = {
    async connect() {
      state.connectAttempts += 1;
      if (state.failOn === 'connect') throw new Error('FAKE_CONNECT_DENIED');
    },
    async end() {
      state.closes += 1;
    },
    async query(text, params = []) {
      state.calls.push({ text, params });
      state.sql.push(text);
      state.params.push(params);

      if (text === 'SELECT pg_try_advisory_lock($1::integer, $2::integer) AS locked') {
        if (state.failOn === 'lock') throw new Error('FAKE_LOCK_DENIED');
        if (state.lockGranted) state.lockHeld = true;
        return { rows: [{ locked: state.lockGranted }] };
      }
      if (text === 'SELECT pg_advisory_unlock($1::integer, $2::integer)') {
        if (state.failOn === 'unlock') throw new Error('FAKE_UNLOCK_DENIED');
        state.lockHeld = false;
        return { rows: [{ unlocked: true }] };
      }
      if (text === 'BEGIN') {
        if (state.failOn === 'begin') throw new Error('FAKE_BEGIN_DENIED');
        state.txOpen = true;
        return { rows: [] };
      }
      if (text === 'COMMIT') {
        if (state.failOn === 'commit') throw new Error('FAKE_COMMIT_DENIED');
        state.txOpen = false;
        state.committed = true;
        return { rows: [] };
      }
      if (text === 'ROLLBACK') {
        if (state.failOn === 'rollback') throw new Error('FAKE_ROLLBACK_DENIED');
        state.txOpen = false;
        state.rolledBack = true;
        return { rows: [] };
      }
      if (text === migrationSql) {
        if (state.failOn === 'apply') throw new Error('FAKE_APPLY_DENIED');
        if (state.applyCreatesTable) state.tablePresent = true;
        return { rows: [] };
      }
      if (
        state.failOn === 'catalog' &&
        (text === ADAPTER.Q.RELATION || Object.values(ADAPTER.Q).includes(text))
      ) {
        throw new Error('FAKE_CATALOG_DENIED');
      }
      if (text === ledgerText) {
        if (state.failOn === 'ledger') throw new Error('FAKE_LEDGER_DENIED');
        if (options.ledgerRows) return { rows: options.ledgerRows };
        if (options.ledgerEcho === false) return { rows: [] };
        return { rows: [{ migration_id: params[0], content_checksum: params[1] }] };
      }
      if (text === ADAPTER.Q.RELATION) {
        return { rows: state.tablePresent ? rows.relation : [] };
      }
      const queryKey = {
        columns: 'COLUMNS',
        constraints: 'CONSTRAINTS',
        indexes: 'INDEXES',
        triggers: 'TRIGGERS',
        policies: 'POLICIES',
        grants: 'GRANTS',
      };
      const key = Object.keys(rows).find((candidate) => ADAPTER.Q[queryKey[candidate]] === text);
      if (key) return { rows: rows[key] };
      throw new Error(`UNEXPECTED_QUERY:${String(text).slice(0, 80)}`);
    },
  };
  return { client, state, migrationSql, rows };
}

function makeTransport(profile, options = {}) {
  const fake = makeFakeClient(profile, options);
  const transport = TRANSPORT.createSchemaAdoptionTransport({
    createClient: () => fake.client,
    env: envWithSecret(options.env),
    roleMapping: ROLE_MAPPING,
    resolveDeployedCommit: () => 'd'.repeat(40),
    now: () => '2026-09-11T12:34:56.789Z',
    repoRoot: ROOT,
  });
  return { transport, ...fake };
}

async function openTransport(profile, options = {}) {
  const setup = makeTransport(profile, options);
  const handle = await setup.transport.acquireAdvisoryLock('0123456789abcdef');
  return { ...setup, handle };
}

function expectCode(error, code) {
  assert.equal(error && error.message, code);
  assert.equal(error && error.category, code);
}

test('IMPORT_NETWORK_INERT: transport import does not load pg or catalog adapter', () => {
  const script = [
    'const Module = require("node:module");',
    'const original = Module._load;',
    'const loaded = [];',
    'Module._load = function(request, parent, isMain) { loaded.push(request); return original.call(this, request, parent, isMain); };',
    'const transport = require(process.argv[1]);',
    'if (typeof transport.createSchemaAdoptionTransport !== "function") throw new Error("EXPORT_MISSING");',
    'if (loaded.some((request) => request === "pg" || String(request).includes("migration-catalog-postgres-adapter-core"))) throw new Error("EAGER_HEAVY_MODULE");',
  ].join('\n');
  const result = spawnSync(process.execPath, ['-e', script, TRANSPORT_PATH], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
});

test('bounded export is frozen and passes operator validation', () => {
  assert.equal(Object.isFrozen(TRANSPORT), true);
  assert.equal(OP.validateTransport(TRANSPORT).ok, true);
  assert.deepEqual(
    TRANSPORT.ALLOWED_MIGRATIONS.map((entry) => entry.migrationPath),
    Object.values(OP.PROFILES).map((profile) => profile.migrationPath),
  );
});

test('MISSING_SECRET_FAILS_PRECONNECT and MALFORMED_SECRET_FAILS_PRECONNECT', async () => {
  let createCalls = 0;
  const missing = TRANSPORT.createSchemaAdoptionTransport({
    createClient: () => { createCalls += 1; return {}; },
    env: {},
  });
  await assert.rejects(() => missing.acquireAdvisoryLock('0123456789abcdef'), (error) => {
    expectCode(error, TRANSPORT.TRANSPORT_FAILURE.SECRET_UNAVAILABLE);
    return true;
  });
  assert.equal(createCalls, 0);

  const malformed = TRANSPORT.createSchemaAdoptionTransport({
    createClient: () => { createCalls += 1; return {}; },
    env: { [TRANSPORT.CREDENTIAL_ENV_KEY]: 'postgresql://example.invalid/db' },
  });
  await assert.rejects(() => malformed.acquireAdvisoryLock('0123456789abcdef'), (error) => {
    expectCode(error, TRANSPORT.TRANSPORT_FAILURE.SECRET_MALFORMED);
    return true;
  });
  assert.equal(createCalls, 0);
});

test('SECRET_VALUE_OUTPUT=NO: credential values never appear in fixed errors', async () => {
  const password = ['NoEcho', 'Synthetic', 'Password'].join('');
  const dsn = syntheticDsn({ password });
  const transport = TRANSPORT.createSchemaAdoptionTransport({
    createClient: () => ({
      async connect() { throw new Error(`driver leaked ${password}`); },
      async end() {},
    }),
    env: { [TRANSPORT.CREDENTIAL_ENV_KEY]: dsn },
  });
  await assert.rejects(() => transport.acquireAdvisoryLock('0123456789abcdef'), (error) => {
    assert.equal(error.message, TRANSPORT.TRANSPORT_FAILURE.CONNECT_UNAVAILABLE);
    assert.equal(JSON.stringify(error).includes(password), false);
    assert.equal(error.message.includes(dsn), false);
    return true;
  });
});

test('ONE_CONNECT_ATTEMPT: connection failure is not retried', async () => {
  const setup = makeTransport(OP.PROFILES['4282'], { failOn: 'connect' });
  await assert.rejects(() => setup.transport.acquireAdvisoryLock('0123456789abcdef'));
  assert.equal(setup.state.connectAttempts, 1);
  assert.equal(setup.state.closes, 1);
  await assert.rejects(() => setup.transport.acquireAdvisoryLock('fedcba9876543210'), (error) => {
    expectCode(error, TRANSPORT.TRANSPORT_FAILURE.CONNECT_UNAVAILABLE);
    return true;
  });
  assert.equal(setup.state.connectAttempts, 1);
});

test('ADVISORY_LOCK_FAILURE_NO_RETRY and lock-key validation', async () => {
  const setup = makeTransport(OP.PROFILES['4282'], { failOn: 'lock' });
  await assert.rejects(() => setup.transport.acquireAdvisoryLock('0123456789abcdef'), (error) => {
    expectCode(error, TRANSPORT.TRANSPORT_FAILURE.LOCK_QUERY_FAILED);
    return true;
  });
  assert.equal(setup.state.sql.filter((sql) => sql.includes('pg_try_advisory_lock')).length, 1);
  assert.equal(setup.state.closes, 1);

  const invalid = makeTransport(OP.PROFILES['4282']);
  await assert.rejects(() => invalid.transport.acquireAdvisoryLock('not-a-lock-key'), (error) => {
    expectCode(error, TRANSPORT.TRANSPORT_FAILURE.LOCK_KEY_INVALID);
    return true;
  });
  assert.equal(invalid.state.connectAttempts, 0);

  const unavailable = makeTransport(OP.PROFILES['4282'], { lockGranted: false });
  assert.equal(await unavailable.transport.acquireAdvisoryLock('0123456789abcdef'), null);
  assert.equal(unavailable.state.sql.filter((sql) => sql.includes('pg_try_advisory_lock')).length, 1);
  assert.equal(unavailable.state.closes, 1);
});

test('lock key is parameterized into two signed int32 values', async () => {
  const setup = makeTransport(OP.PROFILES['4282']);
  await setup.transport.acquireAdvisoryLock('ffffffff00000001');
  const lockCall = setup.state.calls.find((call) => call.text.includes('pg_try_advisory_lock'));
  assert.equal(lockCall.params.length, 2);
  assert.equal(lockCall.params[0], -1);
  assert.equal(lockCall.params[1], 1);
});

test('transaction lifecycle classifies begin, callback, commit, and rollback failures', async () => {
  const beginFailure = await openTransport(OP.PROFILES['4282'], { failOn: 'begin' });
  await assert.rejects(() => beginFailure.transport.withTransaction(async () => ({ ok: true })), (error) => {
    expectCode(error, TRANSPORT.TRANSPORT_FAILURE.TX_BEGIN_FAILED);
    return true;
  });
  assert.equal(beginFailure.state.sql.includes('ROLLBACK'), false);

  const callbackFailure = await openTransport(OP.PROFILES['4282']);
  const callbackResult = await callbackFailure.transport.withTransaction(async () => {
    throw new Error('callback failure');
  });
  assert.deepEqual(callbackResult, { ok: false, reason: TRANSPORT.TRANSPORT_FAILURE.APPLY_FAILED });
  assert.equal(callbackFailure.state.rolledBack, true);
  assert.equal(callbackFailure.state.committed, false);

  const commitFailure = await openTransport(OP.PROFILES['4282'], { failOn: 'commit' });
  await assert.rejects(() => commitFailure.transport.withTransaction(async () => ({ ok: true })), (error) => {
    expectCode(error, TRANSPORT.TRANSPORT_FAILURE.APPLY_AMBIGUOUS);
    return true;
  });
  assert.equal(commitFailure.state.rolledBack, false);

  const rollbackFailure = await openTransport(OP.PROFILES['4282'], { failOn: 'rollback' });
  await assert.rejects(() => rollbackFailure.transport.withTransaction(async () => { throw new Error('precommit'); }), (error) => {
    expectCode(error, TRANSPORT.TRANSPORT_FAILURE.APPLY_AMBIGUOUS);
    return true;
  });
});

test('applyMigration is allowlist/checksum/transaction bounded and sends exact file bytes', async () => {
  const profile = OP.PROFILES['4282'];
  assert.equal(sha256File(path.join(ROOT, profile.migrationPath)), profile.migrationSha256);
  const setup = await openTransport(profile);
  const result = await setup.transport.withTransaction(async (tx) => {
    const applied = await setup.transport.applyMigration(tx, { path: profile.migrationPath, sha256: profile.migrationSha256 });
    assert.deepEqual(applied, { committed: true });
    assert.deepEqual(setup.state.calls.at(-1).params, []);
    return { ok: true };
  });
  assert.deepEqual(result, { ok: true });
  assert.equal(setup.state.sql.filter((sql) => sql === setup.migrationSql).length, 1);

  for (const spec of [
    { path: 'db/migrations/not-allowlisted.sql', sha256: 'a'.repeat(64), code: TRANSPORT.TRANSPORT_FAILURE.MIGRATION_NOT_ALLOWLISTED },
    { path: profile.migrationPath, sha256: 'b'.repeat(64), code: TRANSPORT.TRANSPORT_FAILURE.CHECKSUM_MISMATCH },
    { path: '../../etc/passwd', sha256: 'c'.repeat(64), code: TRANSPORT.TRANSPORT_FAILURE.MIGRATION_NOT_ALLOWLISTED },
  ]) {
    const failed = await openTransport(profile);
    await failed.transport.withTransaction(async (tx) => {
      await assert.rejects(() => failed.transport.applyMigration(tx, spec), (error) => {
        expectCode(error, spec.code);
        return true;
      });
      throw new Error('force rollback');
    });
    assert.equal(failed.state.sql.filter((sql) => sql === failed.migrationSql).length, 0);
  }
});

test('applyMigration requires the exact transaction capability', async () => {
  const setup = await openTransport(OP.PROFILES['4282']);
  await assert.rejects(
    () => setup.transport.applyMigration({ schemaAdoptionTxBrand: true, query() {} }, { path: OP.PROFILES['4282'].migrationPath, sha256: OP.PROFILES['4282'].migrationSha256 }),
    (error) => {
      expectCode(error, TRANSPORT.TRANSPORT_FAILURE.TX_REQUIRED);
      return true;
    },
  );
  await setup.transport.releaseAdvisoryLock(setup.handle);
});

test('verifyCatalog handles absent, matched fixture, and catalog failures without row bodies', async () => {
  const profile = OP.PROFILES['4282'];
  const fixture = await fixtureFingerprint(profile);

  const absent = await openTransport(profile, { tablePresent: false });
  const absentResult = await absent.transport.verifyCatalog(profile.intendedRelation, fixture);
  assert.deepEqual(absentResult, { matched: false, reason: 'TARGET_NOT_FOUND' });
  assert.equal(absent.state.sql.includes(ADAPTER.Q.COLUMNS), false);
  await absent.transport.releaseAdvisoryLock(absent.handle);

  const matched = await openTransport(profile, { tablePresent: true });
  assert.deepEqual(await matched.transport.verifyCatalog(profile.intendedRelation, fixture), { matched: true });
  await matched.transport.releaseAdvisoryLock(matched.handle);

  const denied = await openTransport(profile, { tablePresent: true, failOn: 'catalog' });
  await assert.rejects(() => denied.transport.verifyCatalog(profile.intendedRelation, fixture), (error) => {
    expectCode(error, TRANSPORT.TRANSPORT_FAILURE.CATALOG_QUERY_FAILED);
    return true;
  });
});

test('verifyCatalog converts plain role mapping to the adapter Map and rejects invalid mappings', async () => {
  const profile = OP.PROFILES['4282'];
  const fixture = await fixtureFingerprint(profile);
  const missing = makeTransport(profile, { tablePresent: true, roleMapping: undefined });
  const transport = TRANSPORT.createSchemaAdoptionTransport({
    createClient: () => missing.client,
    env: envWithSecret(),
    roleMapping: {},
    repoRoot: ROOT,
  });
  const handle = await transport.acquireAdvisoryLock('0123456789abcdef');
  await assert.rejects(() => transport.verifyCatalog(profile.intendedRelation, fixture), (error) => {
    expectCode(error, TRANSPORT.TRANSPORT_FAILURE.ROLE_MAPPING_UNAVAILABLE);
    return true;
  });
  await transport.releaseAdvisoryLock(handle);
});

test('writeLedger binds the seven-field payload and exact two-key append evidence', async () => {
  const profile = OP.PROFILES['4282'];
  const setup = await openTransport(profile);
  const payload = {
    issue: profile.issue,
    activeAuthorizationComment: profile.activeAuthorizationComment,
    migrationId: profile.migrationId,
    migrationSha256: profile.migrationSha256,
    targetIdentity: { ...OP.CANONICAL_TARGET_IDENTITY },
    relation: profile.intendedRelation,
    fingerprint: profile.expectedSchemaFingerprint,
  };
  const result = await setup.transport.withTransaction(async (tx) => {
    assert.deepEqual(await tx.writeLedger(payload), { recorded: true });
    const ledgerCall = setup.state.calls.find((call) => call.text === LEDGER.POSTGRES_MIGRATION_LEDGER_QUERIES.append.text);
    assert.equal(ledgerCall.params[0], profile.migrationId);
    assert.equal(ledgerCall.params[1], `sha256:${profile.migrationSha256}`);
    assert.equal(ledgerCall.params[2], '2026-09-11T12:34:56.789Z');
    assert.equal(ledgerCall.params[3], TRANSPORT.RUNNER_VERSION);
    assert.equal(ledgerCall.params[4], 'production');
    assert.equal(ledgerCall.params[5], 'd'.repeat(40));
    assert.equal(ledgerCall.params[6], 'COMMITTED');
    return { ok: true };
  });
  assert.deepEqual(result, { ok: true });

  const invalid = await openTransport(profile);
  await invalid.transport.withTransaction(async (tx) => {
    await assert.rejects(() => tx.writeLedger({ ...payload, issue: 9999 }), (error) => {
      expectCode(error, TRANSPORT.TRANSPORT_FAILURE.LEDGER_PAYLOAD_INVALID);
      return true;
    });
    return { ok: false, reason: 'invalid' };
  });

  const noEvidence = await openTransport(profile, { ledgerEcho: false });
  const noEvidenceResult = await noEvidence.transport.withTransaction(async (tx) => {
    return tx.writeLedger(payload);
  });
  assert.deepEqual(noEvidenceResult, { ok: false, reason: TRANSPORT.TRANSPORT_FAILURE.APPLY_FAILED });
});

test('writeLedger requires transaction state and rejects extra or missing payload keys', async () => {
  const profile = OP.PROFILES['4282'];
  const setup = await openTransport(profile);
  const payload = {
    issue: profile.issue,
    activeAuthorizationComment: profile.activeAuthorizationComment,
    migrationId: profile.migrationId,
    migrationSha256: profile.migrationSha256,
    targetIdentity: { ...OP.CANONICAL_TARGET_IDENTITY },
    relation: profile.intendedRelation,
    fingerprint: profile.expectedSchemaFingerprint,
  };
  await assert.rejects(() => setup.transport.writeLedger(payload), (error) => {
    expectCode(error, TRANSPORT.TRANSPORT_FAILURE.TX_REQUIRED);
    return true;
  });
  const extraKeyResult = await setup.transport.withTransaction(async (tx) => tx.writeLedger({ ...payload, extra: true }));
  assert.deepEqual(extraKeyResult, { ok: false, reason: TRANSPORT.TRANSPORT_FAILURE.APPLY_FAILED });
  assert.equal(setup.state.sql.filter((sql) => sql === LEDGER.POSTGRES_MIGRATION_LEDGER_QUERIES.append.text).length, 0);

  const missingKeyResult = await setup.transport.withTransaction(async (tx) => {
    const { fingerprint, ...missingFingerprint } = payload;
    return tx.writeLedger(missingFingerprint);
  });
  assert.deepEqual(missingKeyResult, { ok: false, reason: TRANSPORT.TRANSPORT_FAILURE.APPLY_FAILED });
});

test('POST_APPLY_MISMATCH_NO_AUTODROP: core reaches bounded rollback with no ledger or DROP', async () => {
  const profile = OP.PROFILES['4282'];
  const packet = OP.buildCanonicalPacket('4282');
  const setup = makeTransport(profile, { tablePresent: false, applyCreatesTable: false });
  const transport = setup.transport;
  const result = await OP.executeGovernedOperator({
    packet,
    transport,
    executionEnabled: true,
    allowExecute: true,
    executionHead: OP.resolveTrustedLocalRepoHead(),
  });
  assert.equal(result.decision, OP.DECISIONS.APPLY_ROLLED_BACK_PRE_COMMIT);
  assert.ok(result.stops.includes(OP.STOP_REASONS.STOP_POSTCHECK_MISMATCH));
  assert.equal(setup.state.sql.some((sql) => /\bDROP\b/i.test(sql)), false);
  assert.equal(setup.state.sql.filter((sql) => sql === LEDGER.POSTGRES_MIGRATION_LEDGER_QUERIES.append.text).length, 0);
  assert.equal(setup.state.connectAttempts, 1);
  assert.equal(setup.state.closes, 1);
});

test('4282/4346_COMPAT: both profile migrations are allowlisted and execute through the same bounded sequence', async () => {
  for (const profile of Object.values(OP.PROFILES)) {
    assert.equal(sha256File(path.join(ROOT, profile.migrationPath)), profile.migrationSha256);
    const setup = await openTransport(profile, { tablePresent: false });
    const handle = setup.handle;
    const fixture = await fixtureFingerprint(profile);
    const result = await setup.transport.withTransaction(async (tx) => {
      assert.deepEqual(await tx.catalogTableKind(profile.intendedRelation), { present: false });
      assert.deepEqual(await setup.transport.applyMigration(tx, { path: profile.migrationPath, sha256: profile.migrationSha256 }), { committed: true });
      assert.deepEqual(await tx.verifyCatalog(profile.intendedRelation, fixture), { matched: false, reason: 'TARGET_NOT_FOUND' });
      return { ok: false, reason: 'POSTCHECK_MISMATCH' };
    });
    assert.deepEqual(result, { ok: false, reason: 'POSTCHECK_MISMATCH' });
    await setup.transport.releaseAdvisoryLock(handle);
  }
});

test('MISSING/MISMATCHED_EXECUTION_HEAD_ZERO_TRANSPORT_CALLS', async () => {
  for (const executionHead of [undefined, 'a'.repeat(40)]) {
    let createCalls = 0;
    const transport = TRANSPORT.createSchemaAdoptionTransport({
      createClient: () => { createCalls += 1; return {}; },
      env: envWithSecret(),
      roleMapping: ROLE_MAPPING,
      repoRoot: ROOT,
    });
    const options = {
      packet: OP.buildCanonicalPacket('4282'),
      transport,
      executionEnabled: true,
      allowExecute: true,
    };
    if (executionHead !== undefined) options.executionHead = executionHead;
    const result = await OP.executeGovernedOperator(options);
    assert.equal(result.reason, OP.STOP_REASONS.STOP_EXECUTION_HEAD_AUTHORITY_MISMATCH);
    assert.equal(createCalls, 0);
  }
});

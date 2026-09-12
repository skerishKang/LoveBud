'use strict';

/**
 * Network-free contract tests for the repository-owned bounded Production
 * ledger-bootstrap Postgres transport (#3846). The fake client is deliberately
 * keyed by the repository-owned query constants and never accepts caller SQL.
 *
 * SOURCE_STATIC: no DB, no network, no Production contact, no secrets.
 * Refs #3846, #3458 (keep OPEN), #1882 (keep OPEN).
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const TRANSPORT_PATH = path.join(ROOT, 'scripts', 'canonical-ledger-bootstrap-postgres.cjs');
const TRANSPORT = require(TRANSPORT_PATH);
const ADAPTER = require(path.join(ROOT, 'scripts', 'migration-catalog-postgres-adapter-core.cjs'));
const LEDGER = require(path.join(ROOT, 'scripts', 'migration-postgres-ledger-adapter-core.cjs'));

const BOOT = TRANSPORT.BOOTSTRAP;
const F = TRANSPORT.TRANSPORT_FAILURE;

// Synthetic credential assembled at runtime from separate non-contiguous
// components so that no credential-shaped connection string is ever committed.
const CRED_SCHEME = 'postgresql';
const CRED_USER = 'svc' + '_ro';
const CRED_PASSWORD = ['Synthetic', 'P4ss', 'w0rd', '%21'].join('');
// Canonical Neon endpoint host, assembled from labels for the same reason.
const NEON_ENDPOINT_ID = 'ep-little-poetry-a1vjyiim';
const NEON_REGION_LABELS = ['us-east-2', 'aws'];
const NEON_DOMAIN = 'neon' + '.tech';
const CRED_HOST = [NEON_ENDPOINT_ID, ...NEON_REGION_LABELS, NEON_DOMAIN].join('.');
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

function fixtureRows() {
  return {
    relation: [{ oid: '16900', relkind: 'r', rls_enabled: false, rls_forced: false }],
    columns: [
      { name: 'migration_id', type_identity: 'text', nullable: false, default_definition: null, attgenerated: '', attidentity: '' },
      { name: 'content_checksum', type_identity: 'text', nullable: false, default_definition: null, attgenerated: '', attidentity: '' },
      { name: 'applied_at', type_identity: 'timestamptz', nullable: false, default_definition: 'now()', attgenerated: '', attidentity: '' },
      { name: 'runner_version', type_identity: 'text', nullable: false, default_definition: null, attgenerated: '', attidentity: '' },
      { name: 'environment_class', type_identity: 'text', nullable: false, default_definition: null, attgenerated: '', attidentity: '' },
      { name: 'deployed_commit', type_identity: 'text', nullable: false, default_definition: null, attgenerated: '', attidentity: '' },
      { name: 'transaction_outcome', type_identity: 'text', nullable: false, default_definition: null, attgenerated: '', attidentity: '' },
    ],
    constraints: [
      { name: 'pk_fixture', contype: 'p', validated: true, definition: 'PRIMARY KEY (migration_id)', confupdtype: '', confdeltype: '' },
      { name: 'uq_fixture', contype: 'u', validated: true, definition: 'UNIQUE (migration_id)', confupdtype: '', confdeltype: '' },
    ],
    indexes: [
      {
        name: 'pk_fixture_idx',
        is_primary: true,
        is_unique: true,
        is_valid: true,
        definition: 'CREATE UNIQUE INDEX pk_fixture_idx ON public.schema_migration_ledger USING btree (migration_id)',
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

const QUERY_KEY_BY_FIXTURE = {
  relation: 'RELATION',
  columns: 'COLUMNS',
  constraints: 'CONSTRAINTS',
  indexes: 'INDEXES',
  triggers: 'TRIGGERS',
  policies: 'POLICIES',
  grants: 'GRANTS',
};

function catalogRowsClient(rows) {
  return {
    async query(text) {
      const key = Object.keys(rows).find((c) => ADAPTER.Q[QUERY_KEY_BY_FIXTURE[c]] === text);
      if (!key) throw new Error('UNEXPECTED_CATALOG_QUERY');
      return { rows: rows[key] };
    },
  };
}

// Round-trip fixture fingerprint: computed from the fixture rows through the
// SAME repository fingerprint pipeline the transport uses. Never asserted to
// equal the Production expected fingerprint.
async function fixtureFingerprint(rows = fixtureRows()) {
  const roleMap = ADAPTER.validateRoleMapping(ROLE_MAPPING);
  const raw = await ADAPTER.fetchRawObject(
    catalogRowsClient(rows),
    { schema: BOOT.schema, object_name: BOOT.relationName, object_kind: 'TABLE' },
    roleMap
  );
  const contract = ADAPTER.loadContract(ROOT);
  const metadata = ADAPTER.toCanonicalMetadata([raw], contract);
  return ADAPTER.buildCatalogEvidence(metadata, contract).objects[0].fingerprint.slice('sha256:'.length);
}

// Stand-in for the node-postgres `Result` class: an INSTANCE whose prototype is
// not `Object.prototype`, carrying `rows` as an own data property plus extra
// top-level driver metadata. Used to prove the transport path no longer depends
// on the top-level result being a plain object literal. (#4346)
class ResultLikeContainer {
  constructor(rows) {
    this.rows = rows;
    this.command = 'INSERT';
    this.rowCount = Array.isArray(rows) ? rows.length : null;
    this.oid = null;
    this.fields = [];
  }
}

function makeFakeClient(options = {}) {
  const rows = options.rows || fixtureRows();
  const migrationSql = fs.readFileSync(path.join(ROOT, BOOT.migrationPath), 'utf8');
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
    // Connected-identity probe surface. Defaults describe the canonical target.
    databaseName: options.databaseName === undefined ? CRED_DATABASE : options.databaseName,
    roleName: options.roleName === undefined ? 'postgres' : options.roleName,
    identityRows: options.identityRows === undefined ? null : options.identityRows,
    identityCalls: 0,
  };
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
      if (text === TRANSPORT.CONNECTED_IDENTITY_QUERY) {
        state.identityCalls += 1;
        if (state.failOn === 'identity') throw new Error('FAKE_IDENTITY_DENIED');
        if (state.identityRows !== null) return { rows: state.identityRows };
        return { rows: [{ database_name: state.databaseName, role_name: state.roleName }] };
      }
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
        if (options.ledgerEcho === false) return { rows: [] };
        const echoRows = [{ migration_id: params[0], content_checksum: params[1] }];
        // Driver-shaped echo: a non-plain container instance instead of a plain
        // object literal. (#4346)
        if (options.ledgerEchoDriverShaped === true) return new ResultLikeContainer(echoRows);
        return { rows: echoRows };
      }
      if (text === ADAPTER.Q.RELATION) {
        return { rows: state.tablePresent ? rows.relation : [] };
      }
      const key = Object.keys(rows).find((c) => ADAPTER.Q[QUERY_KEY_BY_FIXTURE[c]] === text);
      if (key) return { rows: rows[key] };
      throw new Error(`UNEXPECTED_QUERY:${String(text).slice(0, 80)}`);
    },
  };
  return { client, state, migrationSql, rows };
}

function makeTransport(options = {}) {
  const fake = makeFakeClient(options);
  const transport = TRANSPORT.createLedgerBootstrapTransport({
    createClient: () => fake.client,
    env: options.env === null ? {} : envWithSecret(options.env),
    roleMapping: options.roleMapping === null ? undefined : ROLE_MAPPING,
    resolveDeployedCommit: options.resolveDeployedCommit || (() => 'd'.repeat(40)),
    now: () => '2026-09-12T07:00:00.000Z',
    repoRoot: options.repoRoot || ROOT,
  });
  return { transport, ...fake };
}

async function openTransport(options = {}) {
  const setup = makeTransport(options);
  // The connected-target identity gate is a prerequisite for the advisory lock.
  await setup.transport.verifyConnectedTargetIdentity();
  const handle = await setup.transport.acquireAdvisoryLock('0123456789abcdef');
  return { ...setup, handle };
}

function expectCode(error, code) {
  assert.equal(error && error.message, code);
  assert.equal(error && error.category, code);
}

// A live CENTRAL Production execution authorization reference. Deliberately NOT
// the SOURCE/TEST implementation comment (5644253160), which is provenance only.
const LIVE_EXECUTION_AUTHORITY = '5644581826';
const SOURCE_TEST_COMMENT = 5644253160;
const DEPLOYED_COMMIT = 'd'.repeat(40);

function validLedgerPayload(overrides = {}) {
  return {
    issue: BOOT.issue,
    executionAuthorityReference: LIVE_EXECUTION_AUTHORITY,
    executionHead: DEPLOYED_COMMIT,
    migrationId: BOOT.migrationId,
    migrationSha256: BOOT.migrationSha256,
    targetIdentity: { ...TRANSPORT.CANONICAL_TARGET_IDENTITY },
    relation: BOOT.relation,
    fingerprint: BOOT.expectedSchemaFingerprint,
    ...overrides,
  };
}

// ----- 1. Import is network-inert -----

test('IMPORT_NETWORK_INERT: transport import does not load pg or catalog adapter', () => {
  const script = [
    'const Module = require("node:module");',
    'const original = Module._load;',
    'const loaded = [];',
    'Module._load = function(request, parent, isMain) { loaded.push(request); return original.call(this, request, parent, isMain); };',
    'const transport = require(process.argv[1]);',
    'if (typeof transport.createLedgerBootstrapTransport !== "function") throw new Error("EXPORT_MISSING");',
    'if (loaded.some((request) => request === "pg" || String(request).includes("migration-catalog-postgres-adapter-core"))) throw new Error("EAGER_HEAVY_MODULE");',
  ].join('\n');
  const result = spawnSync(process.execPath, ['-e', script, TRANSPORT_PATH], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
});

// ----- 2. Bounded surface and frozen binding -----

test('module exposes exactly the bounded seven-method transport surface plus inert metadata', () => {
  for (const m of ['verifyConnectedTargetIdentity', 'acquireAdvisoryLock', 'releaseAdvisoryLock', 'withTransaction', 'applyMigration', 'verifyCatalog', 'writeLedger']) {
    assert.equal(typeof TRANSPORT[m], 'function', `${m} must be a function`);
  }
  for (const forbidden of ['queryProductRows', 'grantWriter', 'activateRuntimeGate', 'rerouteProvider', 'dropRelation', 'executeArbitrarySql', 'retryAmbiguous', 'exposeRawCredential']) {
    assert.ok(!(forbidden in TRANSPORT), `forbidden method ${forbidden} must not exist`);
  }
});

test('BOOTSTRAP binding is frozen, carries provenance only, and matches the committed repository provenance', () => {
  assert.ok(Object.isFrozen(BOOT));
  assert.equal(BOOT.issue, 3846);
  // The SOURCE/TEST implementation comment is retained as inert PROVENANCE
  // metadata only. BOOTSTRAP exposes no mutation-authority comment field.
  assert.equal(BOOT.sourceTestImplementationComment, TRANSPORT.SOURCE_TEST_IMPLEMENTATION_COMMENT);
  assert.equal(BOOT.sourceTestImplementationComment, 5644253160);
  assert.equal(
    Object.prototype.hasOwnProperty.call(BOOT, 'activeAuthorizationComment'),
    false,
    'BOOTSTRAP must not expose a Production mutation-authority comment field'
  );
  assert.equal(BOOT.migrationId, '20260802094500_bootstrap-migration-ledger');
  assert.equal(BOOT.migrationPath, 'db/migrations/20260802094500_bootstrap-migration-ledger.sql');
  assert.equal(BOOT.migrationSha256, 'c04d6e8cf074514e1835cd837f6ae72ccd96b775a507a12d2b394733977918cc');
  assert.equal(BOOT.expectedSchemaFingerprint, '961d195776eaa245e4e63620a35f19a4de2dbe2f00dbd8b94faffb70ce2332d1');
  assert.equal(BOOT.relation, 'public.schema_migration_ledger');
  assert.equal(BOOT.approvalReference, 'issue:3846');
  assert.equal(BOOT.riskClass, 'ADDITIVE');
  assert.equal(BOOT.transactionMode, 'REQUIRED');

  const canonical = JSON.parse(fs.readFileSync(path.join(ROOT, 'db/migration-provenance/canonical-migrations.json'), 'utf8'));
  const entry = canonical.migrations.find((m) => m.id === BOOT.migrationId);
  assert.ok(entry, 'bootstrap migration must exist in canonical-migrations.json');
  assert.equal(entry.path, BOOT.migrationPath);
  assert.equal(entry.checksum, `sha256:${BOOT.migrationSha256}`);
  assert.equal(entry.approval_reference, BOOT.approvalReference);
  assert.equal(entry.risk_class, BOOT.riskClass);
  assert.equal(entry.transaction_mode, BOOT.transactionMode);

  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'db/migration-provenance/expected-schema-manifest.json'), 'utf8'));
  const critical = manifest.critical_objects.find((o) => o.name === `table:${BOOT.relation}`);
  assert.ok(critical, 'critical object must exist in expected-schema-manifest.json');
  assert.equal(critical.fingerprint, `sha256:${BOOT.expectedSchemaFingerprint}`);

  const contract = JSON.parse(fs.readFileSync(path.join(ROOT, 'db/migration-provenance/ledger-contract.json'), 'utf8'));
  assert.equal(contract.relation_name, BOOT.relationName);
});

test('the bound migration file bytes still hash to the bound checksum', () => {
  assert.equal(sha256File(path.join(ROOT, BOOT.migrationPath)), BOOT.migrationSha256);
});

// ----- 3. Credential boundary -----

test('missing dedicated credential fails closed before any client is created', async () => {
  const setup = makeTransport({ env: null });
  await assert.rejects(
    () => setup.transport.verifyConnectedTargetIdentity(),
    (err) => { expectCode(err, F.SECRET_UNAVAILABLE); return true; }
  );
  assert.equal(setup.state.connectAttempts, 0);
});

test('malformed credential fails closed before connect with a fixed category', async () => {
  const setup = makeTransport({ env: { [TRANSPORT.CREDENTIAL_ENV_KEY]: 'not-a-dsn-at-all' } });
  await assert.rejects(
    () => setup.transport.verifyConnectedTargetIdentity(),
    (err) => { expectCode(err, F.SECRET_MALFORMED); return true; }
  );
  assert.equal(setup.state.connectAttempts, 0);
});

test('generic DATABASE_URL is never used as a fallback', async () => {
  const setup = makeTransport({ env: null });
  const transport = TRANSPORT.createLedgerBootstrapTransport({
    createClient: () => setup.client,
    env: { DATABASE_URL: SECRET, NETLIFY_DATABASE_URL: SECRET, NEON_DATABASE_URL: SECRET },
    roleMapping: ROLE_MAPPING,
    repoRoot: ROOT,
  });
  await assert.rejects(
    () => transport.verifyConnectedTargetIdentity(),
    (err) => { expectCode(err, F.SECRET_UNAVAILABLE); return true; }
  );
  assert.equal(setup.state.connectAttempts, 0);
});

// ----- 4. Advisory lock -----

test('lock key must be exactly 16 lowercase hex chars', async () => {
  const setup = makeTransport();
  for (const bad of ['short', 'ZZZZZZZZZZZZZZZZ', '0123456789abcdeg', 42, null]) {
    await assert.rejects(
      () => setup.transport.acquireAdvisoryLock(bad),
      (err) => { expectCode(err, F.LOCK_KEY_INVALID); return true; }
    );
  }
  assert.equal(setup.state.connectAttempts, 0);
});

test('lock not granted returns null with no retry and closes the connection', async () => {
  const setup = makeTransport({ lockGranted: false });
  await setup.transport.verifyConnectedTargetIdentity();
  const handle = await setup.transport.acquireAdvisoryLock('0123456789abcdef');
  assert.equal(handle, null);
  assert.equal(setup.state.connectAttempts, 1);
  assert.equal(setup.state.closes, 1);
});

test('lock query failure throws a fixed sanitized category', async () => {
  const setup = makeTransport({ failOn: 'lock' });
  await setup.transport.verifyConnectedTargetIdentity();
  await assert.rejects(
    () => setup.transport.acquireAdvisoryLock('0123456789abcdef'),
    (err) => { expectCode(err, F.LOCK_QUERY_FAILED); return true; }
  );
});

test('ONE connect attempt per transport instance: a failed connect is never retried', async () => {
  const setup = makeTransport({ failOn: 'connect' });
  await assert.rejects(
    () => setup.transport.verifyConnectedTargetIdentity(),
    (err) => { expectCode(err, F.CONNECT_UNAVAILABLE); return true; }
  );
  await assert.rejects(
    () => setup.transport.verifyConnectedTargetIdentity(),
    (err) => { expectCode(err, F.CONNECT_UNAVAILABLE); return true; }
  );
  assert.equal(setup.state.connectAttempts, 1);
});

test('releaseAdvisoryLock is best-effort and always closes the connection', async () => {
  const setup = makeTransport({ failOn: 'unlock' });
  await setup.transport.verifyConnectedTargetIdentity();
  const handle = await setup.transport.acquireAdvisoryLock('0123456789abcdef');
  await setup.transport.releaseAdvisoryLock(handle);
  // A failed unlock is swallowed: ending the connection is what releases the
  // session lock, so the connection MUST be closed regardless.
  assert.equal(setup.state.closes, 1);
});

// ----- 5. Transaction discipline -----

test('withTransaction without an active lock handle fails closed', async () => {
  const setup = makeTransport();
  await assert.rejects(
    () => setup.transport.withTransaction(async () => ({ ok: true })),
    (err) => { expectCode(err, F.TX_REQUIRED); return true; }
  );
});

test('nested transactions fail closed (ONE transaction attempt per lock session)', async () => {
  const setup = await openTransport();
  const outer = await setup.transport.withTransaction(async () => {
    await assert.rejects(
      () => setup.transport.withTransaction(async () => ({ ok: true })),
      (err) => { expectCode(err, F.TX_REQUIRED); return true; }
    );
    return { ok: false };
  });
  assert.equal(outer.ok, false);
});

test('BEGIN failure throws a fixed category', async () => {
  const setup = await openTransport({ failOn: 'begin' });
  await assert.rejects(
    () => setup.transport.withTransaction(async () => ({ ok: true })),
    (err) => { expectCode(err, F.TX_BEGIN_FAILED); return true; }
  );
});

test('callback failure rolls back and reports a pre-commit failure', async () => {
  const setup = await openTransport();
  const res = await setup.transport.withTransaction(async () => {
    throw new Error('INNER_BOOM');
  });
  assert.equal(res.ok, false);
  assert.equal(res.reason, F.APPLY_FAILED);
  assert.equal(setup.state.rolledBack, true);
  assert.equal(setup.state.committed, false);
});

test('callback failure with failed rollback is ambiguous (never inferred)', async () => {
  const setup = await openTransport({ failOn: 'rollback' });
  await assert.rejects(
    () => setup.transport.withTransaction(async () => {
      throw new Error('INNER_BOOM');
    }),
    (err) => { expectCode(err, F.APPLY_AMBIGUOUS); return true; }
  );
});

test('COMMIT failure is ambiguous and never retried', async () => {
  const setup = await openTransport({ failOn: 'commit' });
  await assert.rejects(
    () => setup.transport.withTransaction(async () => ({ ok: true })),
    (err) => { expectCode(err, F.APPLY_AMBIGUOUS); return true; }
  );
});

// ----- 6. Migration apply binding -----

test('applyMigration rejects foreign paths and non-bootstrap checksums', async () => {
  const setup = await openTransport();
  await setup.transport.withTransaction(async (tx) => {
    await assert.rejects(
      () => setup.transport.applyMigration(tx, { path: 'db/migrations/other.sql', sha256: BOOT.migrationSha256 }),
      (err) => { expectCode(err, F.MIGRATION_NOT_ALLOWLISTED); return true; }
    );
    await assert.rejects(
      () => setup.transport.applyMigration(tx, { path: BOOT.migrationPath, sha256: 'f'.repeat(64) }),
      (err) => { expectCode(err, F.CHECKSUM_MISMATCH); return true; }
    );
    return { ok: false };
  });
});

test('applyMigration rejects an unbranded tx and only runs inside the open transaction', async () => {
  const setup = await openTransport();
  await assert.rejects(
    () => setup.transport.applyMigration({ ledgerBootstrapTxBrand: false }, { path: BOOT.migrationPath, sha256: BOOT.migrationSha256 }),
    (err) => { expectCode(err, F.TX_REQUIRED); return true; }
  );
  const closed = await setup.transport.withTransaction(async (tx) => {
    const out = await setup.transport.applyMigration(tx, { path: BOOT.migrationPath, sha256: BOOT.migrationSha256 });
    assert.equal(out.committed, true);
    return { ok: false };
  });
  assert.equal(closed.ok, false);
});

test('tampered local migration bytes fail closed with zero SQL sent', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ledger-bootstrap-tamper-'));
  try {
    const target = path.join(tmp, ...BOOT.migrationPath.split('/'));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, 'SELECT 1; -- tampered bytes\n', 'utf8');
    const setup = await openTransport({ repoRoot: tmp });
    await setup.transport.withTransaction(async (tx) => {
      await assert.rejects(
        () => setup.transport.applyMigration(tx, { path: BOOT.migrationPath, sha256: BOOT.migrationSha256 }),
        (err) => { expectCode(err, F.CHECKSUM_MISMATCH); return true; }
      );
      return { ok: false };
    });
    const migrationSql = fs.readFileSync(path.join(ROOT, BOOT.migrationPath), 'utf8');
    assert.equal(setup.state.sql.includes(migrationSql), false, 'no SQL may be sent when bytes mismatch');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 3 });
  }
});

test('a failing apply statement is a pre-commit failure, not ambiguous', async () => {
  const setup = await openTransport({ failOn: 'apply' });
  const res = await setup.transport.withTransaction(async (tx) => {
    const out = await setup.transport.applyMigration(tx, { path: BOOT.migrationPath, sha256: BOOT.migrationSha256 });
    assert.equal(out.committed, false);
    assert.equal(out.reason, F.APPLY_FAILED);
    return { ok: false, reason: out.reason };
  });
  assert.equal(res.ok, false);
  assert.equal(res.reason, F.APPLY_FAILED);
  assert.equal(setup.state.rolledBack, true);
});

// ----- 7. Catalog verification -----

test('verifyCatalog rejects foreign relations and malformed fingerprints', async () => {
  const setup = await openTransport();
  await assert.rejects(
    () => setup.transport.verifyCatalog('public.some_other_table', BOOT.expectedSchemaFingerprint),
    (err) => { expectCode(err, F.RELATION_INVALID); return true; }
  );
  await assert.rejects(
    () => setup.transport.verifyCatalog(BOOT.relation, 'nothex'),
    (err) => { expectCode(err, F.FINGERPRINT_INVALID); return true; }
  );
});

test('verifyCatalog reports an absent relation as unmatched without throwing', async () => {
  const setup = await openTransport();
  const res = await setup.transport.verifyCatalog(BOOT.relation, BOOT.expectedSchemaFingerprint);
  assert.equal(res.matched, false);
  assert.equal(res.reason, 'TARGET_NOT_FOUND');
});

test('verifyCatalog round-trips the fixture fingerprint through the repository pipeline', async () => {
  const fp = await fixtureFingerprint();
  assert.match(fp, /^[0-9a-f]{64}$/);
  const setup = await openTransport({ tablePresent: true });
  const matched = await setup.transport.verifyCatalog(BOOT.relation, fp);
  assert.equal(matched.matched, true);
  // The Production expected fingerprint is NOT hardcoded into the comparison:
  // the same fixture catalog cannot match it.
  assert.notEqual(fp, BOOT.expectedSchemaFingerprint);
  const mismatch = await setup.transport.verifyCatalog(BOOT.relation, BOOT.expectedSchemaFingerprint);
  assert.equal(mismatch.matched, false);
});

test('verifyCatalog fails closed when the catalog query fails', async () => {
  const setup = await openTransport({ tablePresent: true, failOn: 'catalog' });
  await assert.rejects(
    () => setup.transport.verifyCatalog(BOOT.relation, BOOT.expectedSchemaFingerprint),
    (err) => { expectCode(err, F.CATALOG_QUERY_FAILED); return true; }
  );
});

test('verifyCatalog fails closed when no role mapping is available', async () => {
  // The role mapping is resolved at the identity gate, which is PRECONNECT:
  // an unavailable mapping therefore fails before the connection opens.
  const setup = makeTransport({ tablePresent: true, roleMapping: null });
  await assert.rejects(
    () => setup.transport.verifyConnectedTargetIdentity(),
    (err) => { expectCode(err, F.ROLE_MAPPING_UNAVAILABLE); return true; }
  );
  assert.equal(setup.state.connectAttempts, 0, 'no connection may open without a role mapping');
});

// ----- 8. Ledger append binding -----

test('writeLedger outside the open transaction fails closed', async () => {
  const setup = await openTransport();
  await assert.rejects(
    () => setup.transport.writeLedger(validLedgerPayload()),
    (err) => { expectCode(err, F.TX_REQUIRED); return true; }
  );
});

test('writeLedger rejects any payload that deviates from the frozen binding', async () => {
  const setup = await openTransport();
  const badPayloads = [
    { extra: 1 },
    validLedgerPayload({ issue: 9999 }),
    validLedgerPayload({ migrationId: 'other-migration' }),
    validLedgerPayload({ migrationSha256: 'f'.repeat(64) }),
    validLedgerPayload({ relation: 'public.other_relation' }),
    validLedgerPayload({ fingerprint: 'a'.repeat(64) }),
    validLedgerPayload({ targetIdentity: { product_shared: 'x', environment_class: 'production', database: 'neondb' } }),
    validLedgerPayload({ credential: SECRET }),
  ];
  await setup.transport.withTransaction(async () => {
    for (const payload of badPayloads) {
      await assert.rejects(
        () => setup.transport.writeLedger(payload),
        (err) => { expectCode(err, F.LEDGER_PAYLOAD_INVALID); return true; }
      );
    }
    return { ok: false };
  });
});

test('writeLedger fails closed when the deployed commit cannot be resolved', async () => {
  const setup = await openTransport({ resolveDeployedCommit: () => null });
  await setup.transport.withTransaction(async () => {
    await assert.rejects(
      () => setup.transport.writeLedger(validLedgerPayload()),
      (err) => { expectCode(err, F.DEPLOYED_COMMIT_UNAVAILABLE); return true; }
    );
    return { ok: false };
  });
});

test('writeLedger appends the fixed seven-field COMMITTED record inside the transaction', async () => {
  const setup = await openTransport();
  let ledgerOut = null;
  await setup.transport.withTransaction(async (tx) => {
    assert.equal(tx.ledgerBootstrapTxBrand, true);
    ledgerOut = await tx.writeLedger(validLedgerPayload());
    return { ok: false };
  });
  assert.equal(ledgerOut.recorded, true);
  const ledgerText = LEDGER.POSTGRES_MIGRATION_LEDGER_QUERIES.append.text;
  const idx = setup.state.sql.indexOf(ledgerText);
  assert.ok(idx >= 0, 'the fixed ledger append query must be the only ledger SQL');
  const params = setup.state.params[idx];
  assert.equal(params[0], BOOT.migrationId);
  assert.equal(params[1], `sha256:${BOOT.migrationSha256}`);
  assert.equal(params[3], TRANSPORT.RUNNER_VERSION);
  assert.equal(params[4], 'production');
  assert.equal(params[5], 'd'.repeat(40));
  assert.equal(params[6], 'COMMITTED');
});

test('writeLedger reports recorded=false when the append echo is empty', async () => {
  const setup = await openTransport({ ledgerEcho: false });
  let out = null;
  await setup.transport.withTransaction(async (tx) => {
    out = await tx.writeLedger(validLedgerPayload());
    return { ok: false };
  });
  assert.equal(out.recorded, false);
});

// ----- 8c. Bounded ledger-append status diagnostics (#4346) -----
//
// The adapter is total and returns APPENDED | FAILED | UNKNOWN. The transport
// previously collapsed all three into recorded:true|false, which made the real
// Production failure (a driver `Result` rejected as a non-plain record) look
// identical to an empty ON CONFLICT echo. These tests pin the bounded diagnostic
// AND pin that non-APPENDED still fails closed.

const APPEND_STATUSES = LEDGER.POSTGRES_LEDGER_APPEND_STATUSES;

test('writeLedger surfaces the bounded APPENDED diagnostic when the append echo matches', async () => {
  const setup = await openTransport();
  let out = null;
  await setup.transport.withTransaction(async (tx) => {
    out = await tx.writeLedger(validLedgerPayload());
    return { ok: false };
  });
  assert.equal(out.recorded, true);
  assert.equal(out.ledgerAppendStatus, APPEND_STATUSES.APPENDED);
});

test('writeLedger accepts a driver-shaped (non-plain) append echo container (#4346)', async () => {
  // The exact Production regression: node-postgres returns a `Result` INSTANCE,
  // whose prototype is not Object.prototype. Rejecting it mapped a successful
  // INSERT ... RETURNING to UNKNOWN and forced a pre-commit rollback.
  const setup = await openTransport({ ledgerEchoDriverShaped: true });
  let out = null;
  await setup.transport.withTransaction(async (tx) => {
    out = await tx.writeLedger(validLedgerPayload());
    return { ok: false };
  });
  assert.equal(out.recorded, true);
  assert.equal(out.ledgerAppendStatus, APPEND_STATUSES.APPENDED);
});

test('writeLedger surfaces FAILED and still fails closed', async () => {
  const setup = await openTransport({ ledgerEcho: false });
  let out = null;
  await setup.transport.withTransaction(async (tx) => {
    out = await tx.writeLedger(validLedgerPayload());
    return { ok: false };
  });
  assert.equal(out.recorded, false);
  assert.equal(out.ledgerAppendStatus, APPEND_STATUSES.FAILED);
});

test('writeLedger surfaces UNKNOWN and still fails closed', async () => {
  const setup = await openTransport({ failOn: 'ledger' });
  let out = null;
  await setup.transport.withTransaction(async (tx) => {
    out = await tx.writeLedger(validLedgerPayload());
    return { ok: false };
  });
  assert.equal(out.recorded, false);
  assert.equal(out.ledgerAppendStatus, APPEND_STATUSES.UNKNOWN);
});

test('FAILED and UNKNOWN are distinguishable in transport evidence', async () => {
  const failedSetup = await openTransport({ ledgerEcho: false });
  let failedOut = null;
  await failedSetup.transport.withTransaction(async (tx) => {
    failedOut = await tx.writeLedger(validLedgerPayload());
    return { ok: false };
  });

  const unknownSetup = await openTransport({ failOn: 'ledger' });
  let unknownOut = null;
  await unknownSetup.transport.withTransaction(async (tx) => {
    unknownOut = await tx.writeLedger(validLedgerPayload());
    return { ok: false };
  });

  assert.notEqual(failedOut.ledgerAppendStatus, unknownOut.ledgerAppendStatus);
  assert.deepEqual(
    [failedOut.recorded, unknownOut.recorded],
    [false, false],
    'both non-APPENDED statuses must remain fail closed'
  );
  for (const out of [failedOut, unknownOut]) {
    assert.ok(
      Object.values(APPEND_STATUSES).includes(out.ledgerAppendStatus),
      'the diagnostic must stay inside the fixed bounded enum'
    );
  }
});

test('writeLedger never retries: exactly one ledger append query is issued', async () => {
  const setup = await openTransport({ ledgerEcho: false });
  await setup.transport.withTransaction(async (tx) => {
    await tx.writeLedger(validLedgerPayload());
    return { ok: false };
  });
  const ledgerText = LEDGER.POSTGRES_MIGRATION_LEDGER_QUERIES.append.text;
  assert.equal(setup.state.sql.filter((t) => t === ledgerText).length, 1);
});

test('the ledger append path issues no arbitrary SQL, no Product read, no GRANT/REVOKE', async () => {
  const setup = await openTransport();
  await setup.transport.withTransaction(async (tx) => {
    await tx.writeLedger(validLedgerPayload());
    return { ok: false };
  });
  const ledgerText = LEDGER.POSTGRES_MIGRATION_LEDGER_QUERIES.append.text;
  const allowed = new Set([
    TRANSPORT.CONNECTED_IDENTITY_QUERY,
    'SELECT pg_try_advisory_lock($1::integer, $2::integer) AS locked',
    'BEGIN',
    'ROLLBACK',
    ledgerText,
  ]);
  for (const sql of setup.state.sql) {
    assert.ok(allowed.has(sql), `unexpected SQL on the ledger path: ${String(sql).slice(0, 60)}`);
    assert.doesNotMatch(sql, /\bGRANT\b|\bREVOKE\b/i);
  }
});

// ----- 8b. Live Production execution authority separation -----

test('the SOURCE/TEST implementation comment can never be a live execution authority reference', () => {
  assert.equal(TRANSPORT.isValidExecutionAuthorityReference(SOURCE_TEST_COMMENT), false);
  assert.equal(TRANSPORT.isValidExecutionAuthorityReference(String(SOURCE_TEST_COMMENT)), false);
  assert.equal(TRANSPORT.isValidExecutionAuthorityReference(`comment:${SOURCE_TEST_COMMENT}`), false);
  assert.equal(TRANSPORT.isValidExecutionAuthorityReference(LIVE_EXECUTION_AUTHORITY), true);
  assert.equal(TRANSPORT.isValidExecutionAuthorityReference(`comment:${LIVE_EXECUTION_AUTHORITY}`), true);
  assert.equal(
    TRANSPORT.normalizeExecutionAuthorityReference(`comment:${LIVE_EXECUTION_AUTHORITY}`),
    LIVE_EXECUTION_AUTHORITY
  );
  for (const bad of ['', null, undefined, 'not-a-comment', 'abc', '12345', 0, -1, {}]) {
    assert.equal(TRANSPORT.isValidExecutionAuthorityReference(bad), false, `must reject ${String(bad)}`);
  }
});

test('writeLedger refuses the SOURCE/TEST comment and any non-live authority reference', async () => {
  const setup = await openTransport();
  const badAuthorities = [
    String(SOURCE_TEST_COMMENT), // SOURCE/TEST provenance is never live authority
    SOURCE_TEST_COMMENT,
    `comment:${SOURCE_TEST_COMMENT}`,
    '',
    null,
    undefined,
    'not-a-comment',
    'abc',
    42,
  ];
  await setup.transport.withTransaction(async () => {
    for (const value of badAuthorities) {
      await assert.rejects(
        () => setup.transport.writeLedger(validLedgerPayload({ executionAuthorityReference: value })),
        (err) => { expectCode(err, F.EXECUTION_AUTHORITY_INVALID); return true; }
      );
    }
    return { ok: false };
  });
  // No ledger SQL may be sent for any rejected authority reference.
  assert.equal(setup.state.sql.includes(LEDGER.POSTGRES_MIGRATION_LEDGER_QUERIES.append.text), false);
});

test('writeLedger requires the attestation to be bound to the exact authorized execution head', async () => {
  const setup = await openTransport();
  const badHeads = ['f'.repeat(40), '', null, undefined, 'nope', 12345];
  await setup.transport.withTransaction(async () => {
    for (const value of badHeads) {
      await assert.rejects(
        () => setup.transport.writeLedger(validLedgerPayload({ executionHead: value })),
        (err) => { expectCode(err, F.EXECUTION_HEAD_UNBOUND); return true; }
      );
    }
    return { ok: false };
  });
  assert.equal(setup.state.sql.includes(LEDGER.POSTGRES_MIGRATION_LEDGER_QUERIES.append.text), false);
});

test('a released transport instance cannot begin a second DB-capable attempt', async () => {
  const setup = await openTransport();
  await setup.transport.releaseAdvisoryLock(setup.handle);
  assert.equal(setup.state.connectAttempts, 1);
  await assert.rejects(
    () => setup.transport.verifyConnectedTargetIdentity(),
    (err) => { expectCode(err, F.CONNECT_UNAVAILABLE); return true; }
  );
  assert.equal(setup.state.connectAttempts, 1, 'no second connect attempt may ever begin');
});

// ----- 9. Fixed SQL allowlist -----

test('the full happy-path flow only ever sends allowlisted fixed SQL', async () => {
  const fp = await fixtureFingerprint();
  const setup = await openTransport({ applyCreatesTable: true });
  assert.equal(setup.state.lockHeld, true);
  const res = await setup.transport.withTransaction(async (tx) => {
    const pre = await tx.catalogTableKind(BOOT.relation);
    assert.equal(pre.present, false);
    const apply = await setup.transport.applyMigration(tx, { path: BOOT.migrationPath, sha256: BOOT.migrationSha256 });
    assert.equal(apply.committed, true);
    const post = await tx.verifyCatalog(BOOT.relation, fp);
    assert.equal(post.matched, true);
    const ledger = await tx.writeLedger(validLedgerPayload());
    assert.equal(ledger.recorded, true);
    return { ok: true };
  });
  assert.equal(res.ok, true);
  assert.equal(setup.state.committed, true);
  await setup.transport.releaseAdvisoryLock(setup.handle);
  const migrationSql = fs.readFileSync(path.join(ROOT, BOOT.migrationPath), 'utf8');
  const allowed = new Set([
    TRANSPORT.CONNECTED_IDENTITY_QUERY,
    'SELECT pg_try_advisory_lock($1::integer, $2::integer) AS locked',
    'SELECT pg_advisory_unlock($1::integer, $2::integer)',
    'BEGIN',
    'COMMIT',
    'ROLLBACK',
    migrationSql,
    LEDGER.POSTGRES_MIGRATION_LEDGER_QUERIES.append.text,
    ...Object.values(ADAPTER.Q),
  ]);
  for (const text of setup.state.sql) {
    assert.ok(allowed.has(text), `non-allowlisted SQL sent: ${String(text).slice(0, 60)}`);
  }
});

// ----- 10. Connected-target identity gate -----

const POOLED_CANONICAL_HOST = [NEON_ENDPOINT_ID + '-pooler', ...NEON_REGION_LABELS, NEON_DOMAIN].join('.');

function transportForHost(host, options = {}) {
  const box = { created: 0 };
  const transport = TRANSPORT.createLedgerBootstrapTransport({
    createClient: () => {
      box.created += 1;
      return makeFakeClient(options).client;
    },
    env: { [TRANSPORT.CREDENTIAL_ENV_KEY]: syntheticDsn({ host }) },
    roleMapping: ROLE_MAPPING,
    repoRoot: ROOT,
  });
  return { transport, box };
}

test('connected-target: the host classifier binds the canonical endpoint exactly', () => {
  assert.equal(TRANSPORT.isCanonicalNeonEndpointHost(CRED_HOST), true);
  assert.equal(TRANSPORT.isCanonicalNeonEndpointHost(POOLED_CANONICAL_HOST), true);
  for (const bad of [
    'ep-other-endpoint.us-east-2.aws.neon.tech',
    'db.example.invalid',
    'neon.tech',
    'some.host.neon.tech',
    `${CRED_HOST}.evil.invalid`,
    '',
    null,
    undefined,
    42,
  ]) {
    assert.equal(TRANSPORT.isCanonicalNeonEndpointHost(bad), false, `must reject ${String(bad)}`);
  }
});

test('connected-target A: a wrong Neon endpoint is rejected before any client is created', async () => {
  const { transport, box } = transportForHost('ep-not-the-canonical-endpoint.us-east-2.aws.neon.tech');
  await assert.rejects(
    () => transport.verifyConnectedTargetIdentity(),
    (err) => { expectCode(err, F.ENDPOINT_IDENTITY_MISMATCH); return true; }
  );
  assert.equal(box.created, 0, 'no client may be constructed for a wrong endpoint');
});

test('connected-target A: a generic *.neon.tech host is rejected before any client is created', async () => {
  for (const host of ['some.host.neon.tech', 'db.shared.neon.tech']) {
    const { transport, box } = transportForHost(host);
    await assert.rejects(
      () => transport.verifyConnectedTargetIdentity(),
      (err) => { expectCode(err, F.ENDPOINT_IDENTITY_MISMATCH); return true; }
    );
    assert.equal(box.created, 0, `no client may be constructed for ${host}`);
  }
});

test('connected-target A: a malformed or non-Neon endpoint is rejected', async () => {
  for (const host of ['neon.tech', 'not-neon.example.invalid', `${CRED_HOST}.evil.invalid`, 'ep-.us-east-2.aws.neon.tech']) {
    const { transport, box } = transportForHost(host);
    await assert.rejects(
      () => transport.verifyConnectedTargetIdentity(),
      (err) => { expectCode(err, F.ENDPOINT_IDENTITY_MISMATCH); return true; }
    );
    assert.equal(box.created, 0, `no client may be constructed for ${host}`);
  }
});

test('connected-target A: the canonical endpoint host is accepted (direct and pooled)', async () => {
  for (const host of [CRED_HOST, POOLED_CANONICAL_HOST]) {
    const { transport, box } = transportForHost(host);
    const result = await transport.verifyConnectedTargetIdentity();
    assert.equal(result.ok, true);
    assert.equal(box.created, 1);
  }
});

test('connected-target B: a wrong connected database fails after connect, before any lock', async () => {
  const setup = makeTransport({ databaseName: 'some_other_database' });
  await assert.rejects(
    () => setup.transport.verifyConnectedTargetIdentity(),
    (err) => { expectCode(err, F.CONNECTED_TARGET_IDENTITY_MISMATCH); return true; }
  );
  assert.equal(setup.state.connectAttempts, 1, 'the connection did open');
  assert.equal(setup.state.sql.some((t) => t.includes('pg_try_advisory_lock')), false);
  assert.equal(setup.state.sql.includes('BEGIN'), false);
});

test('connected-target C: a role not mapped to OWNER_CLASS fails before any lock', async () => {
  // service_role is deliberately mapped to SERVICE in the fixture mapping.
  const setup = makeTransport({ roleName: 'service_role' });
  await assert.rejects(
    () => setup.transport.verifyConnectedTargetIdentity(),
    (err) => { expectCode(err, F.CONNECTED_TARGET_IDENTITY_MISMATCH); return true; }
  );
  assert.equal(setup.state.sql.some((t) => t.includes('pg_try_advisory_lock')), false);
});

test('connected-target C: an unmapped connected role fails closed', async () => {
  const setup = makeTransport({ roleName: 'totally_unknown_role' });
  await assert.rejects(
    () => setup.transport.verifyConnectedTargetIdentity(),
    (err) => { expectCode(err, F.CONNECTED_TARGET_IDENTITY_MISMATCH); return true; }
  );
  assert.equal(setup.state.sql.some((t) => t.includes('pg_try_advisory_lock')), false);
});

test('connected-target B/C: neondb + OWNER_CLASS passes with bounded facts only', async () => {
  const setup = makeTransport();
  const result = await setup.transport.verifyConnectedTargetIdentity();
  assert.deepEqual(Object.keys(result).sort(), ['databaseVerified', 'ok', 'roleClass', 'roleClassVerified']);
  assert.equal(result.ok, true);
  assert.equal(result.databaseVerified, true);
  assert.equal(result.roleClassVerified, true);
  assert.equal(result.roleClass, TRANSPORT.EXPECTED_CONNECTED_ROLE_CLASS);
  assert.equal(setup.state.connectAttempts, 1);
  assert.equal(setup.state.identityCalls, 1);
});

test('connected-target: an identity-query failure fails closed', async () => {
  const setup = makeTransport({ failOn: 'identity' });
  await assert.rejects(
    () => setup.transport.verifyConnectedTargetIdentity(),
    (err) => { expectCode(err, F.CONNECTED_TARGET_IDENTITY_UNAVAILABLE); return true; }
  );
  assert.equal(setup.state.sql.some((t) => t.includes('pg_try_advisory_lock')), false);
});

test('connected-target: a malformed identity result fails closed', async () => {
  const malformed = [
    [],
    [{ database_name: 'neondb' }],
    [{ role_name: 'postgres' }],
    [{ database_name: '', role_name: 'postgres' }],
    [{ database_name: 'neondb', role_name: '' }],
    [{ database_name: 7, role_name: 'postgres' }],
    [
      { database_name: 'neondb', role_name: 'postgres' },
      { database_name: 'neondb', role_name: 'postgres' },
    ],
  ];
  for (const identityRows of malformed) {
    const setup = makeTransport({ identityRows });
    await assert.rejects(
      () => setup.transport.verifyConnectedTargetIdentity(),
      (err) => { expectCode(err, F.CONNECTED_TARGET_IDENTITY_UNAVAILABLE); return true; }
    );
    assert.equal(setup.state.sql.some((t) => t.includes('pg_try_advisory_lock')), false);
  }
});

test('connected-target: raw host/database/role values never appear in error or result', async () => {
  const setup = makeTransport({ databaseName: 'leaky_database_name', roleName: 'leaky_role_name' });
  let error = null;
  try {
    await setup.transport.verifyConnectedTargetIdentity();
  } catch (err) {
    error = err;
  }
  assert.ok(error, 'a mismatch must be raised');
  const errorBlob = JSON.stringify({
    message: error.message,
    category: error.category,
    stack: String(error.stack || ''),
  });
  // NOTE: the module filename itself contains "postgres", so the stack is only
  // checked for the values that must never leak.
  for (const secretish of ['leaky_database_name', 'leaky_role_name', CRED_HOST, NEON_ENDPOINT_ID, CRED_PASSWORD]) {
    assert.equal(errorBlob.includes(secretish), false, `error must not leak ${secretish}`);
  }

  const okSetup = makeTransport();
  const ok = await okSetup.transport.verifyConnectedTargetIdentity();
  const okBlob = JSON.stringify(ok);
  for (const secretish of [CRED_HOST, NEON_ENDPOINT_ID, 'postgres', 'leaky_']) {
    assert.equal(okBlob.includes(secretish), false, `result must not leak ${secretish}`);
  }
});

test('connected-target: zero lock/BEGIN/apply/ledger calls on identity mismatch', async () => {
  const setup = makeTransport({ databaseName: 'wrong_database' });
  await assert.rejects(() => setup.transport.verifyConnectedTargetIdentity(), () => true);
  const migrationSql = fs.readFileSync(path.join(ROOT, BOOT.migrationPath), 'utf8');
  assert.deepEqual(setup.state.sql, [TRANSPORT.CONNECTED_IDENTITY_QUERY]);
  assert.equal(setup.state.sql.includes('BEGIN'), false);
  assert.equal(setup.state.sql.includes('COMMIT'), false);
  assert.equal(setup.state.sql.includes(migrationSql), false);
  assert.equal(setup.state.sql.includes(LEDGER.POSTGRES_MIGRATION_LEDGER_QUERIES.append.text), false);
});

test('connected-target: the advisory lock is structurally unreachable before identity passes', async () => {
  const setup = makeTransport();
  await assert.rejects(
    () => setup.transport.acquireAdvisoryLock('0123456789abcdef'),
    (err) => { expectCode(err, F.IDENTITY_NOT_VERIFIED); return true; }
  );
  assert.equal(setup.state.connectAttempts, 0);
  assert.equal(setup.state.sql.length, 0);
});

test('connected-target: losing the connection invalidates a prior identity pass', async () => {
  const setup = makeTransport();
  await setup.transport.verifyConnectedTargetIdentity();
  await setup.transport.acquireAdvisoryLock('0123456789abcdef');
  await setup.transport.releaseAdvisoryLock(setup.handle);
  await assert.rejects(
    () => setup.transport.acquireAdvisoryLock('0123456789abcdef'),
    (err) => { expectCode(err, F.IDENTITY_NOT_VERIFIED); return true; }
  );
});

test('connected-target: one connection maximum and no retry are preserved', async () => {
  const setup = makeTransport({ databaseName: 'wrong_database' });
  await assert.rejects(() => setup.transport.verifyConnectedTargetIdentity(), () => true);
  assert.equal(setup.state.connectAttempts, 1);
  await assert.rejects(
    () => setup.transport.verifyConnectedTargetIdentity(),
    (err) => { expectCode(err, F.CONNECT_UNAVAILABLE); return true; }
  );
  assert.equal(setup.state.connectAttempts, 1, 'no second connect attempt may ever begin');
});

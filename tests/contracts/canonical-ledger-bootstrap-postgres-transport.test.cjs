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
        return { rows: [{ migration_id: params[0], content_checksum: params[1] }] };
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
  const handle = await setup.transport.acquireAdvisoryLock('0123456789abcdef');
  return { ...setup, handle };
}

function expectCode(error, code) {
  assert.equal(error && error.message, code);
  assert.equal(error && error.category, code);
}

function validLedgerPayload(overrides = {}) {
  return {
    issue: BOOT.issue,
    activeAuthorizationComment: BOOT.activeAuthorizationComment,
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

test('module exposes exactly the bounded six-method transport surface plus inert metadata', () => {
  for (const m of ['acquireAdvisoryLock', 'releaseAdvisoryLock', 'withTransaction', 'applyMigration', 'verifyCatalog', 'writeLedger']) {
    assert.equal(typeof TRANSPORT[m], 'function', `${m} must be a function`);
  }
  for (const forbidden of ['queryProductRows', 'grantWriter', 'activateRuntimeGate', 'rerouteProvider', 'dropRelation', 'executeArbitrarySql', 'retryAmbiguous', 'exposeRawCredential']) {
    assert.ok(!(forbidden in TRANSPORT), `forbidden method ${forbidden} must not exist`);
  }
});

test('BOOTSTRAP binding is frozen and matches the committed repository provenance', () => {
  assert.ok(Object.isFrozen(BOOT));
  assert.equal(BOOT.issue, 3846);
  assert.equal(BOOT.activeAuthorizationComment, 5644253160);
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
    () => setup.transport.acquireAdvisoryLock('0123456789abcdef'),
    (err) => { expectCode(err, F.SECRET_UNAVAILABLE); return true; }
  );
  assert.equal(setup.state.connectAttempts, 0);
});

test('malformed credential fails closed before connect with a fixed category', async () => {
  const setup = makeTransport({ env: { [TRANSPORT.CREDENTIAL_ENV_KEY]: 'not-a-dsn-at-all' } });
  await assert.rejects(
    () => setup.transport.acquireAdvisoryLock('0123456789abcdef'),
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
    () => transport.acquireAdvisoryLock('0123456789abcdef'),
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
  const handle = await setup.transport.acquireAdvisoryLock('0123456789abcdef');
  assert.equal(handle, null);
  assert.equal(setup.state.connectAttempts, 1);
  assert.equal(setup.state.closes, 1);
});

test('lock query failure throws a fixed sanitized category', async () => {
  const setup = makeTransport({ failOn: 'lock' });
  await assert.rejects(
    () => setup.transport.acquireAdvisoryLock('0123456789abcdef'),
    (err) => { expectCode(err, F.LOCK_QUERY_FAILED); return true; }
  );
});

test('ONE connect attempt per transport instance: a failed connect is never retried', async () => {
  const setup = makeTransport({ failOn: 'connect' });
  await assert.rejects(
    () => setup.transport.acquireAdvisoryLock('0123456789abcdef'),
    (err) => { expectCode(err, F.CONNECT_UNAVAILABLE); return true; }
  );
  await assert.rejects(
    () => setup.transport.acquireAdvisoryLock('0123456789abcdef'),
    (err) => { expectCode(err, F.CONNECT_UNAVAILABLE); return true; }
  );
  assert.equal(setup.state.connectAttempts, 1);
});

test('releaseAdvisoryLock is best-effort and always closes the connection', async () => {
  const setup = makeTransport({ failOn: 'unlock' });
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
  const setup = await openTransport({ tablePresent: true, roleMapping: null });
  await assert.rejects(
    () => setup.transport.verifyCatalog(BOOT.relation, BOOT.expectedSchemaFingerprint),
    (err) => { expectCode(err, F.ROLE_MAPPING_UNAVAILABLE); return true; }
  );
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
    validLedgerPayload({ activeAuthorizationComment: 5641029190 }),
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

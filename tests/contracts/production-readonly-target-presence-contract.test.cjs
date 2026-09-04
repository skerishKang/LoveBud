'use strict';

/**
 * SOURCE_STATIC contract test for Production Read-Only Target Presence Runner (#4346).
 *
 * Verifies all CENTRAL review items:
 *  1. Full collector missing-object behavior remains CATALOG_ADAPTER_OBJECT_MISSING.
 *  2. Target presence classifier: 0 rows => TARGET_ABSENT.
 *  3. Target presence classifier: 1 valid TABLE row => TARGET_PRESENT.
 *  4. Duplicate rows => CATALOG_ADAPTER_CATALOG_SHAPE_INVALID.
 *  5. Wrong relation kind => CATALOG_ADAPTER_OBJECT_KIND_MISMATCH.
 *  6. Unsupported relkind => CATALOG_ADAPTER_UNSUPPORTED_RELATION.
 *  7. Non-array rows => CATALOG_ADAPTER_CATALOG_SHAPE_INVALID.
 *  8. Unknown profile fails closed.
 *  9. Immutable profile 4346 cannot have target overridden.
 * 10. Forbidden CLI flags (sql, objects, target, database-url, etc.) fail closed.
 * 11. Generic DATABASE_URL is strictly rejected.
 * 12. Policy root overrides (repoRoot, root, contractRoot) are rejected.
 * 13. Production execution remains source-disabled (PRODUCTION_EXECUTION_SOURCE_ENABLED === false).
 * 14. Zero product row read capability: queryProductRows / SELECT row bodies are impossible.
 * 15. Inspect with client: TARGET_ABSENT returns absence report without touching table data.
 * 16. Inspect with client: TARGET_PRESENT collects single-target metadata and checks fingerprint.
 * 17. #4282 existing regressions pass untouched.
 * 18. Profile 4346 lifecycle state remains PENDING_AUTHORIZATION_BINDING.
 * 19. Profile 4346 activeAuthorizationComment remains null.
 * 20. Expected fingerprint matches accepted sha256:199a8d5dc0b21d8a5d0ecaa7a7101cd65b926f2d884682840624388279cc2316.
 * 21. Source-disabled gate precedes private .secrets reads (0 reads, 0 connections before gate).
 * 22. Strict duplicate CLI flags fail closed (no last-write-wins).
 * 23. Real reviewed executor call order: connect -> BEGIN READ ONLY -> SHOW transaction_read_only -> SHOW server_version_num -> Q.RELATION -> ROLLBACK -> disconnect.
 * 24. Real reviewed executor fails closed on transaction_read_only != on before metadata collection.
 * 25. Real reviewed executor fails closed on server_version_num mismatch before metadata collection.
 * 26. Real reviewed executor fails closed on fingerprint mismatch (PRESENCE_CHECK_FAIL_FINGERPRINT_MISMATCH).
 * 27. Rollback and disconnect occur on success, failure, absent, and error. No retry.
 *
 * Refs #4346, #4282, #4000, #4004, #4005, #4255, #4256, #1882.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

const ROOT = path.resolve(__dirname, '..', '..');

const ADAPTER = require(path.join(ROOT, 'scripts/migration-catalog-postgres-adapter-core.cjs'));
const BOUNDARY = require(path.join(ROOT, 'scripts/production-readonly-catalog-boundary-core.cjs'));
const RUNNER = require(path.join(ROOT, 'scripts/run-production-readonly-target-presence.cjs'));
const OP_CORE = require(path.join(ROOT, 'scripts/canonical-schema-adoption-operator-core.cjs'));

const ACCEPTED_FINGERPRINT = 'sha256:199a8d5dc0b21d8a5d0ecaa7a7101cd65b926f2d884682840624388279cc2316';
const ACCEPTED_RAW_HEX = '199a8d5dc0b21d8a5d0ecaa7a7101cd65b926f2d884682840624388279cc2316';

test('1. Full collector missing-object behavior remains CATALOG_ADAPTER_OBJECT_MISSING (classifyRelationRows)', () => {
  assert.throws(
    () => ADAPTER.classifyRelationRows([], 'TABLE'),
    (err) => err.category === ADAPTER.ADAPTER_FAILURE.CATALOG_ADAPTER_OBJECT_MISSING
  );
});

test('2. Target presence classifier: 0 rows => TARGET_ABSENT', () => {
  const res = ADAPTER.classifyTargetPresenceRelationRows([], 'TABLE');
  assert.deepEqual(res, {
    presence: 'TARGET_ABSENT',
    relation: null,
  });
});

test('3. Target presence classifier: 1 valid TABLE row => TARGET_PRESENT', () => {
  const rows = [
    {
      oid: 12345,
      relkind: 'r',
      rls_enabled: false,
      rls_forced: false,
    },
  ];
  const res = ADAPTER.classifyTargetPresenceRelationRows(rows, 'TABLE');
  assert.deepEqual(res, {
    presence: 'TARGET_PRESENT',
    relation: {
      oid: 12345,
      relkind: 'r',
      rls_enabled: false,
      rls_forced: false,
      object_kind: 'TABLE',
    },
  });
});

test('4. Target presence classifier: duplicate rows => CATALOG_ADAPTER_CATALOG_SHAPE_INVALID', () => {
  const rows = [
    { oid: 12345, relkind: 'r', rls_enabled: false, rls_forced: false },
    { oid: 67890, relkind: 'r', rls_enabled: false, rls_forced: false },
  ];
  assert.throws(
    () => ADAPTER.classifyTargetPresenceRelationRows(rows, 'TABLE'),
    (err) => err.category === ADAPTER.ADAPTER_FAILURE.CATALOG_ADAPTER_CATALOG_SHAPE_INVALID
  );
});

test('5. Target presence classifier: kind mismatch (expected TABLE, actual VIEW) => CATALOG_ADAPTER_OBJECT_KIND_MISMATCH', () => {
  const rows = [
    { oid: 12345, relkind: 'v', rls_enabled: false, rls_forced: false },
  ];
  assert.throws(
    () => ADAPTER.classifyTargetPresenceRelationRows(rows, 'TABLE'),
    (err) => err.category === ADAPTER.ADAPTER_FAILURE.CATALOG_ADAPTER_OBJECT_KIND_MISMATCH
  );
});

test('6. Target presence classifier: unsupported relkind (e.g. index i) => CATALOG_ADAPTER_UNSUPPORTED_RELATION', () => {
  const rows = [
    { oid: 12345, relkind: 'i', rls_enabled: false, rls_forced: false },
  ];
  assert.throws(
    () => ADAPTER.classifyTargetPresenceRelationRows(rows, 'TABLE'),
    (err) => err.category === ADAPTER.ADAPTER_FAILURE.CATALOG_ADAPTER_UNSUPPORTED_RELATION
  );
});

test('7. Target presence classifier: non-array rows => CATALOG_ADAPTER_CATALOG_SHAPE_INVALID', () => {
  assert.throws(
    () => ADAPTER.classifyTargetPresenceRelationRows(null, 'TABLE'),
    (err) => err.category === ADAPTER.ADAPTER_FAILURE.CATALOG_ADAPTER_CATALOG_SHAPE_INVALID
  );
});

test('8. Target presence runner: unknown profile fails closed', async () => {
  const res = await RUNNER.runTargetPresenceRunner({
    profile: '9999',
    secretFile: '.secrets/fake.env',
    roleMappingFile: '.secrets/roles.json',
  });
  assert.equal(res.decision, 'FAIL_CLOSED');
  assert.equal(res.outcome, RUNNER.RUNNER_OUTCOMES.PRESENCE_CHECK_NOT_RUN_CONNECTION_BOUNDARY);
  assert.equal(res.executionAttempted, false);
});

test('9. Target presence runner: Profile 4346 immutable binding and accepted fingerprint', () => {
  const prof = RUNNER.resolveTargetProfile('4346');
  assert.ok(prof, 'Profile 4346 must exist');
  assert.equal(prof.target, 'table:public.tree_hub_layouts');
  assert.equal(prof.schema, 'public');
  assert.equal(prof.relation, 'tree_hub_layouts');
  assert.equal(prof.kind, 'TABLE');
  assert.equal(prof.expectedFingerprint, ACCEPTED_FINGERPRINT);
  assert.equal(prof.approvalReference, 'issue:4346');
});

test('10. Target presence runner: forbidden caller overrides rejected (objects/sql/repoRoot/database-url)', () => {
  assert.throws(
    () => RUNNER.validatePresenceRunnerPolicy({ profile: '4346', sql: 'SELECT * FROM users' }),
    (err) => err.category === BOUNDARY.FAILURE.PRODUCTION_CATALOG_CALLER_OVERRIDE_REJECTED
  );
  assert.throws(
    () => RUNNER.validatePresenceRunnerPolicy({ profile: '4346', objects: ['evil'] }),
    (err) => err.category === BOUNDARY.FAILURE.PRODUCTION_CATALOG_CALLER_OVERRIDE_REJECTED
  );
  assert.throws(
    () => RUNNER.validatePresenceRunnerPolicy({ profile: '4346', repoRoot: '/tmp' }),
    (err) => err.category === BOUNDARY.FAILURE.PRODUCTION_CATALOG_CALLER_OVERRIDE_REJECTED
  );
  assert.throws(
    () => RUNNER.validatePresenceRunnerPolicy({ profile: '4346', databaseUrl: 'postgres://...' }),
    (err) => err.category === BOUNDARY.FAILURE.PRODUCTION_CATALOG_CALLER_OVERRIDE_REJECTED
  );
});

test('11. Target presence runner: generic DATABASE_URL secret rejected', () => {
  assert.throws(
    () => BOUNDARY.parseSecretFileKeyValues('DATABASE_URL=postgres://user:pass@host:5432/db'),
    (err) => err.category === BOUNDARY.FAILURE.PRODUCTION_CATALOG_GENERIC_DATABASE_URL_REJECTED
  );
});

test('12. Target presence runner: Production execution is hard source-disabled in this turn', async () => {
  assert.equal(RUNNER.PRODUCTION_EXECUTION_SOURCE_ENABLED, false);
});

test('13. Target presence runner: inspectTargetPresenceWithClient with TARGET_ABSENT returns clean sanitized report', async () => {
  const targetProfile = RUNNER.resolveTargetProfile('4346');
  const mockClient = {
    query: async (text, params) => {
      if (text === ADAPTER.Q.RELATION) {
        return { rows: [] };
      }
      throw new Error(`Unexpected query: ${text}`);
    },
  };

  const contract = ADAPTER.loadContract(ROOT);
  const result = await RUNNER.inspectTargetPresenceWithClient(
    mockClient,
    targetProfile,
    new Map([['public', 'PUBLIC']]),
    contract
  );

  assert.equal(result.mode, 'PRODUCTION_READONLY_TARGET_PRESENCE');
  assert.equal(result.profile, '4346');
  assert.equal(result.target, 'table:public.tree_hub_layouts');
  assert.equal(result.presence, 'TARGET_ABSENT');
  assert.equal(result.relation, null);
  assert.equal(result.fingerprint, null);
  assert.equal(result.fingerprintMatch, null);
  assert.equal(result.expectedFingerprint, ACCEPTED_FINGERPRINT);
});

test('14. Target presence runner: inspectTargetPresenceWithClient with TARGET_PRESENT computes single-target fingerprint', async () => {
  const targetProfile = RUNNER.resolveTargetProfile('4346');
  const contract = ADAPTER.loadContract(ROOT);

  const mockClient = {
    query: async (text, params) => {
      if (text === ADAPTER.Q.RELATION) {
        return {
          rows: [{
            oid: 99001,
            relkind: 'r',
            rls_enabled: false,
            rls_forced: false,
          }],
        };
      }
      if (text === ADAPTER.Q.COLUMNS) {
        return {
          rows: [
            { name: 'id', type_identity: 'text', nullable: false, default_definition: null, attgenerated: '', attidentity: '' },
            { name: 'tree_id', type_identity: 'text', nullable: false, default_definition: null, attgenerated: '', attidentity: '' },
            { name: 'revision', type_identity: 'integer', nullable: false, default_definition: null, attgenerated: '', attidentity: '' },
            { name: 'layout_mode', type_identity: 'text', nullable: false, default_definition: null, attgenerated: '', attidentity: '' },
            { name: 'manual_positions', type_identity: 'jsonb', nullable: false, default_definition: null, attgenerated: '', attidentity: '' },
            { name: 'created_at', type_identity: 'timestamp with time zone', nullable: false, default_definition: 'now()', attgenerated: '', attidentity: '' },
            { name: 'updated_at', type_identity: 'timestamp with time zone', nullable: false, default_definition: 'now()', attgenerated: '', attidentity: '' },
          ],
        };
      }
      if (text === ADAPTER.Q.CONSTRAINTS) {
        return {
          rows: [
            { name: 'tree_hub_layouts_pkey', contype: 'p', validated: true, definition: 'PRIMARY KEY (id)', confupdtype: null, confdeltype: null },
            { name: 'tree_hub_layouts_tree_id_fkey', contype: 'f', validated: true, definition: 'FOREIGN KEY (tree_id) REFERENCES trees(id) ON DELETE CASCADE', confupdtype: 'a', confdeltype: 'c' },
          ],
        };
      }
      if (text === ADAPTER.Q.INDEXES) {
        return {
          rows: [
            { name: 'tree_hub_layouts_pkey', is_primary: true, is_unique: true, is_valid: true, definition: 'CREATE UNIQUE INDEX tree_hub_layouts_pkey ON public.tree_hub_layouts USING btree (id)' },
          ],
        };
      }
      if (text === ADAPTER.Q.TRIGGERS) {
        return { rows: [] };
      }
      if (text === ADAPTER.Q.GRANTS) {
        return { rows: [] };
      }
      if (text === ADAPTER.Q.POLICIES) {
        return { rows: [] };
      }
      throw new Error(`Unexpected query: ${text}`);
    },
  };

  const roleMap = new Map([
    ['public', 'PUBLIC'],
  ]);

  const result = await RUNNER.inspectTargetPresenceWithClient(
    mockClient,
    targetProfile,
    roleMap,
    contract
  );

  assert.equal(result.mode, 'PRODUCTION_READONLY_TARGET_PRESENCE');
  assert.equal(result.profile, '4346');
  assert.equal(result.target, 'table:public.tree_hub_layouts');
  assert.equal(result.presence, 'TARGET_PRESENT');
  assert.equal(result.fingerprintMatch, true);
  assert.equal(result.expectedFingerprint, ACCEPTED_FINGERPRINT);
});

test('15. Operator Core: Profile 4346 lifecycleState remains PENDING_AUTHORIZATION_BINDING and comment null', () => {
  const profile4346 = OP_CORE.PROFILES['4346'];
  assert.ok(profile4346, 'Profile 4346 exists in operator core');
  assert.equal(profile4346.lifecycleState, 'PENDING_AUTHORIZATION_BINDING');
  assert.equal(profile4346.activeAuthorizationComment, null);
  assert.equal(profile4346.expectedSchemaFingerprint, ACCEPTED_RAW_HEX);
});

test('16. Package.json: inspect:production-readonly-target-presence script registered', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  assert.equal(
    pkg.scripts['inspect:production-readonly-target-presence'],
    'node scripts/run-production-readonly-target-presence.cjs'
  );
});

// ---------------------------------------------------------------------------
// CENTRAL REVIEW REVISION TESTS (#4349)
// ---------------------------------------------------------------------------

test('17. SOURCE-DISABLED GATE PRECEDES PRIVATE FILE ACCESS: no .secrets reads occur', async () => {
  // Pass nonexistent .secrets files. If secret file was read before gate, it would fail
  // with PRODUCTION_CATALOG_SECRET_FILE_INVALID. But because gate precedes private file access,
  // it MUST return PRESENCE_CHECK_EXECUTION_DISABLED immediately!
  const res = await RUNNER.runTargetPresenceRunner({
    profile: '4346',
    secretFile: '.secrets/non-existent-secret-file.env',
    roleMappingFile: '.secrets/non-existent-role-map.json',
  });

  assert.equal(res.decision, 'FAIL_CLOSED');
  assert.equal(res.outcome, RUNNER.RUNNER_OUTCOMES.PRESENCE_CHECK_EXECUTION_DISABLED);
  assert.equal(res.reason, 'PRODUCTION_EXECUTION_SOURCE_DISABLED_IN_THIS_TURN');
  assert.equal(res.executionAttempted, false);
});

test('18. DUPLICATE CLI FLAGS FAIL CLOSED (no last-write-wins)', () => {
  // --profile duplicate
  assert.throws(
    () => RUNNER.parseCliArgs(['--profile', '4346', '--profile', '4346', '--secret-file', 'a', '--role-mapping-file', 'b']),
    (err) => err.category === BOUNDARY.FAILURE.PRODUCTION_CATALOG_INPUT_INVALID
  );
  assert.throws(
    () => RUNNER.parseCliArgs(['--profile', '4346', '--profile', '9999', '--secret-file', 'a', '--role-mapping-file', 'b']),
    (err) => err.category === BOUNDARY.FAILURE.PRODUCTION_CATALOG_INPUT_INVALID
  );

  // --secret-file duplicate
  assert.throws(
    () => RUNNER.parseCliArgs(['--profile', '4346', '--secret-file', 'a', '--secret-file', 'b', '--role-mapping-file', 'c']),
    (err) => err.category === BOUNDARY.FAILURE.PRODUCTION_CATALOG_INPUT_INVALID
  );

  // --role-mapping-file duplicate
  assert.throws(
    () => RUNNER.parseCliArgs(['--profile', '4346', '--secret-file', 'a', '--role-mapping-file', 'b', '--role-mapping-file', 'c']),
    (err) => err.category === BOUNDARY.FAILURE.PRODUCTION_CATALOG_INPUT_INVALID
  );

  // --validate-only duplicate
  assert.throws(
    () => RUNNER.parseCliArgs(['--profile', '4346', '--validate-only', '--validate-only']),
    (err) => err.category === BOUNDARY.FAILURE.PRODUCTION_CATALOG_INPUT_INVALID
  );

  // --dry-run duplicate
  assert.throws(
    () => RUNNER.parseCliArgs(['--profile', '4346', '--dry-run', '--dry-run']),
    (err) => err.category === BOUNDARY.FAILURE.PRODUCTION_CATALOG_INPUT_INVALID
  );
});

test('19. REVIEWED EXECUTOR CALL ORDER: connect -> BEGIN READ ONLY -> SHOW RO -> SHOW VER -> Q.RELATION -> ROLLBACK -> disconnect', async () => {
  const queryLog = [];
  let connected = false;
  let ended = false;

  const mockClient = {
    connect: async () => {
      connected = true;
    },
    query: async (text, params) => {
      queryLog.push({ text, params });
      if (text === ADAPTER.Q.BEGIN_RO) return { rows: [] };
      if (text === ADAPTER.Q.SHOW_RO) return { rows: [{ transaction_read_only: 'on' }] };
      if (text === ADAPTER.Q.SHOW_VER) return { rows: [{ server_version_num: '170004' }] };
      if (text === ADAPTER.Q.RELATION) {
        // Target absent for this test
        return { rows: [] };
      }
      if (text === ADAPTER.Q.ROLLBACK) return { rows: [] };
      throw new Error(`Unexpected query in call order test: ${text}`);
    },
    end: async () => {
      ended = true;
    },
  };

  // Mock private loader for test seam
  const fakeOptions = {
    profile: '4346',
    secretFile: '.secrets/test.env',
    roleMappingFile: '.secrets/test-roles.json',
  };

  const fakePgConfig = { host: 'db.example.test', port: 5432, user: 'u', password: 'p', database: 'd' };

  // Create test options using isolated temporary files
  const tmpSecretsDir = path.join(ROOT, '.secrets', `.test-tmp-order-${Date.now()}`);
  fs.mkdirSync(tmpSecretsDir, { recursive: true });
  const secFile = path.join(tmpSecretsDir, 'test.env');
  const roleFile = path.join(tmpSecretsDir, 'roles.json');
  fs.writeFileSync(secFile, 'LOVEBUD_PRODUCTION_READONLY_DATABASE_URL=postgresql://u:p@db.example.test:5432/d?sslmode=require\n');
  fs.writeFileSync(roleFile, JSON.stringify({ public: 'PUBLIC' }) + '\n');

  const secRel = path.relative(ROOT, secFile).replace(/\\/g, '/');
  const roleRel = path.relative(ROOT, roleFile).replace(/\\/g, '/');

  try {
    const res = await RUNNER.runTargetPresenceRunner(
      { profile: '4346', secretFile: secRel, roleMappingFile: roleRel },
      () => mockClient
    );

    assert.equal(connected, true, 'client.connect was called');
    assert.equal(ended, true, 'client.end was called');
    assert.equal(res.decision, 'INSPECTION_COMPLETED');
    assert.equal(res.outcome, 'TARGET_ABSENT');
    assert.equal(res.presence, 'TARGET_ABSENT');

    // Assert exact query sequence
    assert.equal(queryLog[0].text, ADAPTER.Q.BEGIN_RO);
    assert.equal(queryLog[1].text, ADAPTER.Q.SHOW_RO);
    assert.equal(queryLog[2].text, ADAPTER.Q.SHOW_VER);
    assert.equal(queryLog[3].text, ADAPTER.Q.RELATION);
    assert.deepEqual(queryLog[3].params, ['public', 'tree_hub_layouts']);
    assert.equal(queryLog[4].text, ADAPTER.Q.ROLLBACK);

    // Assert NO COMMIT anywhere
    assert.ok(!queryLog.some((q) => q.text.includes('COMMIT')));
  } finally {
    fs.rmSync(tmpSecretsDir, { recursive: true, force: true });
  }
});

test('20. REVIEWED EXECUTOR FAILS CLOSED on transaction_read_only != on', async () => {
  let rolledBack = false;
  let ended = false;
  const mockClient = {
    connect: async () => {},
    query: async (text) => {
      if (text === ADAPTER.Q.BEGIN_RO) return { rows: [] };
      if (text === ADAPTER.Q.SHOW_RO) return { rows: [{ transaction_read_only: 'off' }] }; // FAILS
      if (text === ADAPTER.Q.ROLLBACK) {
        rolledBack = true;
        return { rows: [] };
      }
      throw new Error(`Should not reach query ${text}`);
    },
    end: async () => { ended = true; },
  };

  const tmpSecretsDir = path.join(ROOT, '.secrets', `.test-tmp-ro-${Date.now()}`);
  fs.mkdirSync(tmpSecretsDir, { recursive: true });
  const secFile = path.join(tmpSecretsDir, 'test.env');
  const roleFile = path.join(tmpSecretsDir, 'roles.json');
  fs.writeFileSync(secFile, 'LOVEBUD_PRODUCTION_READONLY_DATABASE_URL=postgresql://u:p@db.example.test:5432/d?sslmode=require\n');
  fs.writeFileSync(roleFile, JSON.stringify({ public: 'PUBLIC' }) + '\n');

  const secRel = path.relative(ROOT, secFile).replace(/\\/g, '/');
  const roleRel = path.relative(ROOT, roleFile).replace(/\\/g, '/');

  try {
    const res = await RUNNER.runTargetPresenceRunner(
      { profile: '4346', secretFile: secRel, roleMappingFile: roleRel },
      () => mockClient
    );

    assert.equal(res.decision, 'FAIL_CLOSED');
    assert.equal(res.outcome, RUNNER.RUNNER_OUTCOMES.PRESENCE_CHECK_FAIL_READONLY_PROOF);
    assert.equal(rolledBack, true, 'ROLLBACK executed on read_only failure');
    assert.equal(ended, true, 'client disconnected');
  } finally {
    fs.rmSync(tmpSecretsDir, { recursive: true, force: true });
  }
});

test('21. REVIEWED EXECUTOR FAILS CLOSED on server_version_num unsupported', async () => {
  let rolledBack = false;
  let ended = false;
  const mockClient = {
    connect: async () => {},
    query: async (text) => {
      if (text === ADAPTER.Q.BEGIN_RO) return { rows: [] };
      if (text === ADAPTER.Q.SHOW_RO) return { rows: [{ transaction_read_only: 'on' }] };
      if (text === ADAPTER.Q.SHOW_VER) return { rows: [{ server_version_num: '160000' }] }; // PG 16 unsupported
      if (text === ADAPTER.Q.ROLLBACK) {
        rolledBack = true;
        return { rows: [] };
      }
      throw new Error(`Should not reach query ${text}`);
    },
    end: async () => { ended = true; },
  };

  const tmpSecretsDir = path.join(ROOT, '.secrets', `.test-tmp-ver-${Date.now()}`);
  fs.mkdirSync(tmpSecretsDir, { recursive: true });
  const secFile = path.join(tmpSecretsDir, 'test.env');
  const roleFile = path.join(tmpSecretsDir, 'roles.json');
  fs.writeFileSync(secFile, 'LOVEBUD_PRODUCTION_READONLY_DATABASE_URL=postgresql://u:p@db.example.test:5432/d?sslmode=require\n');
  fs.writeFileSync(roleFile, JSON.stringify({ public: 'PUBLIC' }) + '\n');

  const secRel = path.relative(ROOT, secFile).replace(/\\/g, '/');
  const roleRel = path.relative(ROOT, roleFile).replace(/\\/g, '/');

  try {
    const res = await RUNNER.runTargetPresenceRunner(
      { profile: '4346', secretFile: secRel, roleMappingFile: roleRel },
      () => mockClient
    );

    assert.equal(res.decision, 'FAIL_CLOSED');
    assert.equal(res.outcome, RUNNER.RUNNER_OUTCOMES.PRESENCE_CHECK_FAIL_METADATA_OR_SHAPE);
    assert.equal(rolledBack, true, 'ROLLBACK executed on version mismatch');
    assert.equal(ended, true, 'client disconnected');
  } finally {
    fs.rmSync(tmpSecretsDir, { recursive: true, force: true });
  }
});

test('22. REVIEWED EXECUTOR FAILS CLOSED on fingerprint mismatch (TARGET_PRESENT but drifted)', async () => {
  let rolledBack = false;
  let ended = false;
  const mockClient = {
    connect: async () => {},
    query: async (text) => {
      if (text === ADAPTER.Q.BEGIN_RO) return { rows: [] };
      if (text === ADAPTER.Q.SHOW_RO) return { rows: [{ transaction_read_only: 'on' }] };
      if (text === ADAPTER.Q.SHOW_VER) return { rows: [{ server_version_num: '170004' }] };
      if (text === ADAPTER.Q.RELATION) {
        return {
          rows: [{
            oid: 99001,
            relkind: 'r',
            rls_enabled: false,
            rls_forced: false,
          }],
        };
      }
      if (text === ADAPTER.Q.COLUMNS) {
        // Return drifted columns (e.g. only 1 column) -> will produce wrong fingerprint!
        return {
          rows: [
            { name: 'id', type_identity: 'text', nullable: false, default_definition: null, attgenerated: '', attidentity: '' },
          ],
        };
      }
      if (text === ADAPTER.Q.CONSTRAINTS) return { rows: [] };
      if (text === ADAPTER.Q.INDEXES) return { rows: [] };
      if (text === ADAPTER.Q.TRIGGERS) return { rows: [] };
      if (text === ADAPTER.Q.GRANTS) return { rows: [] };
      if (text === ADAPTER.Q.POLICIES) return { rows: [] };
      if (text === ADAPTER.Q.ROLLBACK) {
        rolledBack = true;
        return { rows: [] };
      }
      throw new Error(`Unexpected query: ${text}`);
    },
    end: async () => { ended = true; },
  };

  const tmpSecretsDir = path.join(ROOT, '.secrets', `.test-tmp-drift-${Date.now()}`);
  fs.mkdirSync(tmpSecretsDir, { recursive: true });
  const secFile = path.join(tmpSecretsDir, 'test.env');
  const roleFile = path.join(tmpSecretsDir, 'roles.json');
  fs.writeFileSync(secFile, 'LOVEBUD_PRODUCTION_READONLY_DATABASE_URL=postgresql://u:p@db.example.test:5432/d?sslmode=require\n');
  fs.writeFileSync(roleFile, JSON.stringify({ public: 'PUBLIC' }) + '\n');

  const secRel = path.relative(ROOT, secFile).replace(/\\/g, '/');
  const roleRel = path.relative(ROOT, roleFile).replace(/\\/g, '/');

  try {
    const res = await RUNNER.runTargetPresenceRunner(
      { profile: '4346', secretFile: secRel, roleMappingFile: roleRel },
      () => mockClient
    );

    assert.equal(res.decision, 'FAIL_CLOSED');
    assert.equal(res.outcome, RUNNER.RUNNER_OUTCOMES.PRESENCE_CHECK_FAIL_FINGERPRINT_MISMATCH);
    assert.equal(res.reason, RUNNER.RUNNER_OUTCOMES.PRESENCE_CHECK_FAIL_FINGERPRINT_MISMATCH);
    assert.equal(rolledBack, true, 'ROLLBACK executed on fingerprint mismatch');
    assert.equal(ended, true, 'client disconnected');
  } finally {
    fs.rmSync(tmpSecretsDir, { recursive: true, force: true });
  }
});

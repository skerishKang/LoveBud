'use strict';

/**
 * SOURCE_STATIC contract for disposable pg_catalog fingerprint adapter.
 * No live PostgreSQL. Pure helpers only — no client injection path.
 * Local DB engine: NOT_RUN.
 *
 * Refs #3544, #3542, #3458, #3425
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const CORE = path.join(ROOT, 'scripts', 'migration-catalog-postgres-adapter-core.cjs');
const CLI = path.join(ROOT, 'scripts', 'build-migration-catalog-evidence-from-postgres.cjs');
const FP_CORE = path.join(ROOT, 'scripts', 'migration-catalog-fingerprint-core.cjs');
const CONTRACT_PATH = path.join(
  ROOT,
  'db',
  'migration-provenance',
  'catalog-metadata-contract.json'
);
const EXPECTED_SCHEMA = path.join(
  ROOT,
  'db',
  'migration-provenance',
  'expected-schema-manifest.json'
);
const CANONICAL = path.join(ROOT, 'db', 'migration-provenance', 'canonical-migrations.json');
const PKG = path.join(ROOT, 'package.json');
const CI = path.join(ROOT, '.github', 'workflows', 'ci.yml');
const CLASS = path.join(ROOT, 'tests', 'test-layer-classification.json');
const ENGINE = path.join(
  ROOT,
  'tests',
  'db-engine',
  'migration-catalog-postgres-adapter-engine.test.cjs'
);
const FIX_SQL = path.join(
  ROOT,
  'tests',
  'db-engine',
  'fixtures',
  'migration-catalog-postgres-adapter',
  'synthetic-baseline.sql'
);
const EXPECTED_MOCK = path.join(
  ROOT,
  'tests',
  'contracts',
  'fixtures',
  'migration-catalog-postgres-adapter',
  'expected-mock-metadata.json'
);
const DOCS = path.join(ROOT, 'docs', 'architecture', 'DB_MIGRATION_PROVENANCE_GATE.md');

const adapter = require(CORE);
const fingerprint = require(FP_CORE);

function read(p) {
  return fs.readFileSync(p, 'utf8');
}
function readJson(p) {
  return JSON.parse(read(p));
}

const contract = readJson(CONTRACT_PATH);

test('package/CI/scripts wired without default-CI engine inclusion', () => {
  const pkg = readJson(PKG);
  assert.equal(typeof pkg.scripts['test:db-engine:migration-catalog-adapter'], 'string');
  assert.equal(typeof pkg.scripts['build:migration-catalog-evidence-from-postgres'], 'string');
  assert.equal(pkg.scripts.test.includes('db-engine'), false);
  const ci = read(CI);
  assert.match(ci, /db-engine-migration-catalog-adapter\s*:/);
  assert.match(ci, /postgres:17\.4-bookworm/);
  assert.match(ci, /170004/);
  assert.equal(/DATABASE_URL/i.test(ci), false);
  assert.equal(/secrets\./i.test(ci), false);
});

test('public API has no client or manageTransaction bypass path', () => {
  const src = read(CORE);
  // Reject bypass fields; do not accept injected clients or txn opt-out.
  assert.match(src, /hasOwnProperty\.call\(options, 'client'\)/);
  assert.match(src, /hasOwnProperty\.call\(options, 'manageTransaction'\)/);
  assert.equal(/options\.client\s*=/.test(src), false);
  assert.equal(/manageTransaction\s*!==\s*false/.test(src), false);
  assert.equal(/manageTransaction\s*===\s*false/.test(src), false);
  assert.match(src, /BEGIN READ ONLY/);
  assert.match(src, /isTransactionReadOnlyOn/);
  assert.match(src, /new Client\(/);
  assert.match(src, /aclexplode/);
  assert.equal(/role_table_grants/i.test(src), false);

  return Promise.all([
    assert.rejects(
      () =>
        adapter.collectCatalogMetadata({
          client: {},
          connection: {
            host: '127.0.0.1',
            port: 5432,
            user: 'u',
            password: 'p',
            database: 'lovebud_ci_x',
          },
          objects: [{ schema: 's', object_name: 't', object_kind: 'TABLE' }],
          roleMapping: { synthetic_owner_role: 'OWNER_CLASS' },
          contract,
        }),
      (e) => e.category === 'CATALOG_ADAPTER_INPUT_INVALID'
    ),
    assert.rejects(
      () =>
        adapter.collectCatalogMetadata({
          manageTransaction: false,
          connection: {
            host: '127.0.0.1',
            port: 5432,
            user: 'u',
            password: 'p',
            database: 'lovebud_ci_x',
          },
          objects: [{ schema: 's', object_name: 't', object_kind: 'TABLE' }],
          roleMapping: { synthetic_owner_role: 'OWNER_CLASS' },
          contract,
        }),
      (e) => e.category === 'CATALOG_ADAPTER_INPUT_INVALID'
    ),
    assert.rejects(
      () =>
        adapter.collectCatalogMetadata({
          objects: [{ schema: 's', object_name: 't', object_kind: 'TABLE' }],
          roleMapping: { synthetic_owner_role: 'OWNER_CLASS' },
          contract,
        }),
      (e) => e.category === 'CATALOG_ADAPTER_CONNECTION_CONFIG_INVALID'
    ),
  ]);
});

test('pure classifiers: relation missing / unsupported / kind mismatch', () => {
  assert.throws(
    () => adapter.classifyRelationRows([], 'TABLE'),
    (e) => e.category === 'CATALOG_ADAPTER_OBJECT_MISSING'
  );
  assert.throws(
    () =>
      adapter.classifyRelationRows(
        [
          { oid: 1, relkind: 'S', rls_enabled: false, rls_forced: false },
        ],
        'TABLE'
      ),
    (e) => e.category === 'CATALOG_ADAPTER_UNSUPPORTED_RELATION'
  );
  assert.throws(
    () =>
      adapter.classifyRelationRows(
        [
          { oid: 1, relkind: 'v', rls_enabled: false, rls_forced: false },
        ],
        'TABLE'
      ),
    (e) => e.category === 'CATALOG_ADAPTER_OBJECT_KIND_MISMATCH'
  );
  const ok = adapter.classifyRelationRows(
    [{ oid: 9, relkind: 'r', rls_enabled: true, rls_forced: false }],
    'TABLE'
  );
  assert.equal(ok.object_kind, 'TABLE');
  assert.equal(adapter.objectKindFromRelkind('p'), null);
  assert.equal(adapter.isTransactionReadOnlyOn('on'), true);
  assert.equal(adapter.isTransactionReadOnlyOn('off'), false);
  assert.equal(adapter.parseServerVersionNum('170004'), 170004);
});

test('pure grant mapper: PUBLIC, unmapped, unknown privilege', () => {
  const roleMap = adapter.validateRoleMapping({
    synthetic_authenticated_role: 'AUTHENTICATED',
    synthetic_owner_role: 'OWNER_CLASS',
  });
  const grants = adapter.mapGrantRows(
    [
      { grantee: 'PUBLIC', privilege_type: 'SELECT', is_grantable: false },
      { grantee: 'synthetic_authenticated_role', privilege_type: 'UPDATE', is_grantable: false },
      { grantee: 'PUBLIC', privilege_type: 'SELECT', is_grantable: false },
    ],
    roleMap
  );
  assert.ok(grants.some((g) => g.grantee_class === 'PUBLIC' && g.privileges.includes('SELECT')));
  assert.ok(
    grants.some((g) => g.grantee_class === 'AUTHENTICATED' && g.privileges.includes('UPDATE'))
  );

  assert.throws(
    () =>
      adapter.mapGrantRows(
        [{ grantee: 'unknown_role', privilege_type: 'SELECT', is_grantable: false }],
        roleMap
      ),
    (e) => e.category === 'CATALOG_ADAPTER_GRANTEE_UNMAPPED'
  );

  assert.throws(
    () =>
      adapter.mapGrantRows(
        [{ grantee: 'PUBLIC', privilege_type: 'EXECUTE', is_grantable: false }],
        roleMap
      ),
    (e) => e.category === 'CATALOG_ADAPTER_CATALOG_SHAPE_INVALID'
  );

  // PG17 MAINTAIN is known non-fingerprint; must not fail and must not appear.
  const withMaintain = adapter.mapGrantRows(
    [
      { grantee: 'PUBLIC', privilege_type: 'SELECT', is_grantable: false },
      { grantee: 'PUBLIC', privilege_type: 'MAINTAIN', is_grantable: false },
    ],
    roleMap
  );
  assert.deepEqual(withMaintain, [
    { grantee_class: 'PUBLIC', privileges: ['SELECT'], grantable: false },
  ]);
});

test('shuffled catalog rows produce identical canonical metadata', () => {
  const roleMap = adapter.validateRoleMapping({
    synthetic_authenticated_role: 'AUTHENTICATED',
    synthetic_owner_role: 'OWNER_CLASS',
  });
  const target = {
    schema: 'synthetic_catalog',
    object_name: 't',
    object_kind: 'TABLE',
  };
  const rel = { rls_enabled: true, rls_forced: false };
  const baseCols = [
    {
      name: 'id',
      type_identity: 'uuid',
      nullable: false,
      default_definition: null,
      attgenerated: '',
      attidentity: '',
    },
    {
      name: 'title',
      type_identity: 'text',
      nullable: true,
      default_definition: null,
      attgenerated: '',
      attidentity: '',
    },
  ];
  const baseCons = [
    {
      name: 't_pkey',
      contype: 'p',
      validated: true,
      definition: 'PRIMARY KEY (id)',
      confupdtype: null,
      confdeltype: null,
    },
    {
      name: 't_check',
      contype: 'c',
      validated: true,
      definition: 'CHECK (true)',
      confupdtype: null,
      confdeltype: null,
    },
  ];
  const baseIdx = [
    {
      name: 't_pkey',
      is_primary: true,
      is_unique: true,
      is_valid: true,
      definition: 'CREATE UNIQUE INDEX t_pkey ON synthetic_catalog.t USING btree (id)',
    },
    {
      name: 't_title_idx',
      is_primary: false,
      is_unique: false,
      is_valid: true,
      definition: 'CREATE INDEX t_title_idx ON synthetic_catalog.t USING btree (title)',
    },
  ];
  const baseTg = [
    {
      name: 'trg_b',
      tgtype: 17,
      tgenabled: 'O',
      definition: 'CREATE TRIGGER trg_b ...',
      fn_schema: 'synthetic_catalog',
      fn_name: 'fn',
      fn_args: '',
    },
    {
      name: 'trg_a',
      tgtype: 17,
      tgenabled: 'O',
      definition: 'CREATE TRIGGER trg_a ...',
      fn_schema: 'synthetic_catalog',
      fn_name: 'fn',
      fn_args: '',
    },
  ];
  const baseGrants = [
    { grantee: 'synthetic_authenticated_role', privilege_type: 'UPDATE', is_grantable: false },
    { grantee: 'PUBLIC', privilege_type: 'SELECT', is_grantable: false },
  ];

  const rawA = adapter.assembleRawCatalogObject(target, rel, {
    columns: adapter.mapColumnRows(baseCols),
    constraints: adapter.mapConstraintRows(baseCons),
    indexes: adapter.mapIndexRows(baseIdx),
    triggers: adapter.mapTriggerRows(baseTg),
    policies: [
      {
        name: 'p_b',
        command: 'SELECT',
        permissive: true,
        role_scope: 'PUBLIC',
        using_expression: 'true',
        check_expression: null,
      },
      {
        name: 'p_a',
        command: 'SELECT',
        permissive: true,
        role_scope: 'PUBLIC',
        using_expression: 'true',
        check_expression: null,
      },
    ],
    grants: adapter.mapGrantRows(baseGrants, roleMap),
    viewDefinition: null,
  });

  const rawB = adapter.assembleRawCatalogObject(target, rel, {
    columns: adapter.mapColumnRows([...baseCols].reverse()),
    constraints: adapter.mapConstraintRows([...baseCons].reverse()),
    indexes: adapter.mapIndexRows([...baseIdx].reverse()),
    triggers: adapter.mapTriggerRows([...baseTg].reverse()),
    policies: [
      {
        name: 'p_a',
        command: 'SELECT',
        permissive: true,
        role_scope: 'PUBLIC',
        using_expression: 'true',
        check_expression: null,
      },
      {
        name: 'p_b',
        command: 'SELECT',
        permissive: true,
        role_scope: 'PUBLIC',
        using_expression: 'true',
        check_expression: null,
      },
    ],
    grants: adapter.mapGrantRows([...baseGrants].reverse(), roleMap),
    viewDefinition: null,
  });

  const metaA = adapter.toCanonicalMetadata([rawA], contract);
  const metaB = adapter.toCanonicalMetadata([rawB], contract);
  assert.equal(JSON.stringify(metaA), JSON.stringify(metaB));
  assert.equal(
    JSON.stringify(fingerprint.buildCatalogEvidence(metaA, contract)),
    JSON.stringify(fingerprint.buildCatalogEvidence(metaB, contract))
  );
});

test('hand-written expected mock metadata equality via pure assembly', () => {
  const expected = readJson(EXPECTED_MOCK);
  const roleMap = adapter.validateRoleMapping({
    synthetic_authenticated_role: 'AUTHENTICATED',
    synthetic_owner_role: 'OWNER_CLASS',
  });
  const raw = adapter.assembleRawCatalogObject(
    { schema: 'synthetic_catalog', object_name: 't', object_kind: 'TABLE' },
    { rls_enabled: true, rls_forced: false },
    {
      columns: adapter.mapColumnRows([
        {
          name: 'id',
          type_identity: 'uuid',
          nullable: false,
          default_definition: null,
          attgenerated: '',
          attidentity: '',
        },
        {
          name: 'title',
          type_identity: 'text',
          nullable: true,
          default_definition: null,
          attgenerated: '',
          attidentity: '',
        },
      ]),
      constraints: adapter.mapConstraintRows([
        {
          name: 't_pkey',
          contype: 'p',
          validated: true,
          definition: 'PRIMARY KEY (id)',
          confupdtype: null,
          confdeltype: null,
        },
      ]),
      indexes: adapter.mapIndexRows([
        {
          name: 't_pkey',
          is_primary: true,
          is_unique: true,
          is_valid: true,
          definition: 'CREATE UNIQUE INDEX t_pkey ON synthetic_catalog.t USING btree (id)',
        },
      ]),
      triggers: [],
      policies: [
        {
          name: 't_select',
          command: 'SELECT',
          permissive: true,
          role_scope: 'PUBLIC',
          using_expression: 'true',
          check_expression: null,
        },
      ],
      grants: adapter.mapGrantRows(
        [
          {
            grantee: 'synthetic_authenticated_role',
            privilege_type: 'SELECT',
            is_grantable: false,
          },
        ],
        roleMap
      ),
      viewDefinition: null,
    }
  );
  const meta = adapter.toCanonicalMetadata([raw], contract);
  // Compare evidence fingerprints (canonical object field order may include normalizer sorts).
  assert.equal(
    JSON.stringify(fingerprint.buildCatalogEvidence(meta, contract)),
    JSON.stringify(fingerprint.buildCatalogEvidence(expected, contract))
  );
});

test('CLI fail-closed uses CATALOG_POSTGRES_ADAPTER without secrets', () => {
  const res = spawnSync(process.execPath, [CLI], { cwd: ROOT, encoding: 'utf8' });
  assert.equal(res.status, 1);
  const body = JSON.parse(res.stdout);
  assert.equal(body.mode, 'CATALOG_POSTGRES_ADAPTER');
  assert.equal(body.decision, 'FAIL_CLOSED');
  assert.ok(body.blockers.includes('CATALOG_ADAPTER_INPUT_INVALID'));
  assert.equal(res.stdout.includes('password'), false);
});

test('manifests remain ADOPTION_REQUIRED populated', () => {
  const expected = readJson(EXPECTED_SCHEMA);
  const canonical = readJson(CANONICAL);
  assert.equal(expected.status, 'ADOPTION_REQUIRED');
  assert.equal(expected.critical_objects.length, 1);
  assert.equal(expected.critical_objects[0].name, 'table:public.schema_migration_ledger');
  assert.equal(canonical.status, 'ADOPTION_REQUIRED');
  assert.equal(canonical.migrations.length, 1);
  assert.equal(canonical.migrations[0].id, '20260802094500_bootstrap-migration-ledger');
});

test('classification + fixture markers', () => {
  const inv = readJson(CLASS);
  assert.ok(
    inv.entries.find(
      (e) => e.path === 'tests/contracts/migration-catalog-postgres-adapter-contract.test.cjs'
    )
  );
  assert.ok(
    inv.supplemental.find(
      (e) => e.path === 'tests/db-engine/migration-catalog-postgres-adapter-engine.test.cjs'
    )
  );
  assert.ok(fs.existsSync(ENGINE));
  assert.ok(fs.existsSync(FIX_SQL));
  const sql = read(FIX_SQL);
  assert.match(sql, /GRANT SELECT ON TABLE synthetic_catalog\.example_tree TO PUBLIC/);
  assert.match(sql, /CREATE SEQUENCE/);
  assert.match(sql, /PARTITION BY/);
  assert.match(sql, /drift_pad/);
  assert.equal(process.env.LB_TEST_PGHOST ? 'ENV_PRESENT' : 'LOCAL_DB_ENGINE_NOT_RUN', 'LOCAL_DB_ENGINE_NOT_RUN');
});

test('docs mention disposable adapter', () => {
  assert.match(read(DOCS), /#3544|disposable/i);
});

test('allowlist rejects fingerprint/name and bounds', () => {
  assert.throws(
    () =>
      adapter.validateObjectAllowlist(
        [{ schema: 's', object_name: 't', object_kind: 'TABLE', fingerprint: 'x' }],
        10
      ),
    (e) => e.category === 'CATALOG_ADAPTER_INPUT_INVALID'
  );
  const over = [];
  for (let i = 0; i < 5; i += 1) {
    over.push({ schema: 's', object_name: `t${i}`, object_kind: 'TABLE' });
  }
  assert.throws(
    () => adapter.validateObjectAllowlist(over, 3),
    (e) => e.category === 'CATALOG_ADAPTER_BOUNDS_EXCEEDED'
  );
});

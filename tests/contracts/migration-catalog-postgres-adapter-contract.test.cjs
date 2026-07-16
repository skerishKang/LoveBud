'use strict';

/**
 * SOURCE_STATIC contract for the disposable pg_catalog fingerprint adapter.
 * No live PostgreSQL connection. Mock client only where needed.
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

test('package exposes adapter engine and CLI scripts without default-CI inclusion', () => {
  const pkg = readJson(PKG);
  assert.equal(typeof pkg.scripts['test:db-engine:migration-catalog-adapter'], 'string');
  assert.match(
    pkg.scripts['test:db-engine:migration-catalog-adapter'],
    /migration-catalog-postgres-adapter-engine\.test\.cjs/
  );
  assert.match(pkg.scripts['test:db-engine:migration-catalog-adapter'], /--test-concurrency=1/);
  assert.equal(typeof pkg.scripts['build:migration-catalog-evidence-from-postgres'], 'string');
  assert.equal(pkg.scripts.test.includes('db-engine'), false);
  assert.equal(pkg.scripts.ci.includes('test:db-engine'), false);
});

test('CI adds dedicated disposable postgres 17.4 adapter job only', () => {
  const ci = read(CI);
  assert.match(ci, /db-engine-migration-catalog-adapter\s*:/);
  assert.match(ci, /image:\s*postgres:17\.4-bookworm/);
  assert.match(ci, /npm run test:db-engine:migration-catalog-adapter/);
  assert.match(ci, /LB_TEST_PGHOST:\s*127\.0\.0\.1/);
  assert.match(ci, /server_version_num/);
  assert.match(ci, /170004/);
  assert.equal(/DATABASE_URL/i.test(ci), false);
  assert.equal(/secrets\./i.test(ci), false);
  assert.equal(/NEON_API_KEY/i.test(ci), false);
});

test('adapter source is fail-closed and has no env/database_url fallback', () => {
  const src = read(CORE);
  const cli = read(CLI);
  for (const text of [src, cli]) {
    assert.equal(/process\.env\.DATABASE_URL/i.test(text), false);
    assert.equal(/process\.env\.LB_TEST_PG/i.test(text), false);
    assert.equal(/child_process/.test(text), false);
  }
  assert.match(src, /CATALOG_ADAPTER_CONNECTION_CONFIG_INVALID/);
  assert.match(src, /CATALOG_ADAPTER_READ_ONLY_REQUIRED/);
  assert.match(src, /BEGIN READ ONLY/);
  assert.match(src, /REQUIRED_SERVER_VERSION_NUM/);
  assert.match(src, /170004/);
  assert.match(src, /validateRoleMapping/);
  assert.match(src, /buildCatalogEvidence/);
  assert.match(cli, /validateConnectionConfig/);
  assert.match(cli, /Explicit flags only/);
});

test('connection validation rejects unsafe hosts and non-synthetic database names', () => {
  assert.throws(
    () =>
      adapter.validateConnectionConfig({
        host: 'neon.example',
        port: 5432,
        user: 'u',
        password: 'p',
        database: 'lovebud_ci_x',
      }),
    (e) => e.category === 'CATALOG_ADAPTER_CONNECTION_CONFIG_INVALID'
  );
  assert.throws(
    () =>
      adapter.validateConnectionConfig({
        host: '127.0.0.1',
        port: 5432,
        user: 'u',
        password: 'p',
        database: 'postgres',
      }),
    (e) => e.category === 'CATALOG_ADAPTER_CONNECTION_CONFIG_INVALID'
  );
  const ok = adapter.validateConnectionConfig({
    host: '127.0.0.1',
    port: 5432,
    user: 'lovebud_ci',
    password: 'synthetic',
    database: 'lovebud_ci_adapter_1',
  });
  assert.equal(ok.host, '127.0.0.1');
  assert.equal(ok.port, 5432);
});

test('object allowlist validation is strict', () => {
  assert.throws(
    () =>
      adapter.validateObjectAllowlist(
        [{ schema: 'pg_catalog', object_name: 'pg_class', object_kind: 'TABLE' }],
        10
      ),
    (e) => e.category === 'CATALOG_ADAPTER_SCHEMA_PROHIBITED'
  );
  assert.throws(
    () =>
      adapter.validateObjectAllowlist(
        [
          { schema: 'public', object_name: 't', object_kind: 'TABLE' },
          { schema: 'public', object_name: 't', object_kind: 'TABLE' },
        ],
        10
      ),
    (e) => e.category === 'CATALOG_ADAPTER_OBJECT_DUPLICATE'
  );
  assert.throws(
    () =>
      adapter.validateObjectAllowlist(
        [{ schema: 'public', object_name: 't', object_kind: 'TABLE', fingerprint: 'x' }],
        10
      ),
    (e) => e.category === 'CATALOG_ADAPTER_INPUT_INVALID'
  );
});

test('role mapping validation is explicit and bounded', () => {
  assert.throws(
    () => adapter.validateRoleMapping({}),
    (e) => e.category === 'CATALOG_ADAPTER_ROLE_MAPPING_INVALID'
  );
  assert.throws(
    () => adapter.validateRoleMapping({ synthetic_x: 'NOT_A_CLASS' }),
    (e) => e.category === 'CATALOG_ADAPTER_ROLE_MAPPING_INVALID'
  );
  const map = adapter.validateRoleMapping({
    synthetic_authenticated_role: 'AUTHENTICATED',
    synthetic_owner_role: 'OWNER_CLASS',
  });
  assert.equal(map.get('synthetic_authenticated_role'), 'AUTHENTICATED');
  assert.equal(map.get('public'), 'PUBLIC');
});

test('mock client path produces gate-compatible evidence equal to normalizer fixture path', async () => {
  // Deterministic synthetic catalog rows (no live DB).
  const oid = 4242;
  const responses = {
    begin: { rows: [] },
    ro: { rows: [{ transaction_read_only: 'on' }] },
    ver: { rows: [{ server_version_num: '170004' }] },
    rel: {
      rows: [
        {
          oid,
          relkind: 'r',
          rls_enabled: true,
          rls_forced: false,
        },
      ],
    },
    cols: {
      rows: [
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
      ],
    },
    cons: {
      rows: [
        {
          name: 't_pkey',
          contype: 'p',
          validated: true,
          definition: 'PRIMARY KEY (id)',
          confupdtype: null,
          confdeltype: null,
        },
      ],
    },
    idxs: {
      rows: [
        {
          name: 't_pkey',
          is_primary: true,
          is_unique: true,
          is_valid: true,
          definition: 'CREATE UNIQUE INDEX t_pkey ON synthetic_catalog.t USING btree (id)',
        },
      ],
    },
    tgs: { rows: [] },
    pols: {
      rows: [
        {
          name: 't_select',
          polcmd: 'r',
          permissive: true,
          polroles: [0],
          using_expression: 'true',
          check_expression: null,
        },
      ],
    },
    grants: {
      rows: [
        {
          grantee: 'synthetic_authenticated_role',
          privilege_type: 'SELECT',
          is_grantable: 'NO',
        },
      ],
    },
    rollback: { rows: [] },
  };

  const client = {
    async query(sql) {
      const s = String(sql);
      if (/^BEGIN/i.test(s)) return responses.begin;
      if (/transaction_read_only/i.test(s)) return responses.ro;
      if (/server_version_num/i.test(s)) return responses.ver;
      if (/FROM pg_class/i.test(s)) return responses.rel;
      if (/FROM pg_attribute/i.test(s)) return responses.cols;
      if (/FROM pg_constraint/i.test(s)) return responses.cons;
      if (/FROM pg_index/i.test(s)) return responses.idxs;
      if (/FROM pg_trigger/i.test(s)) return responses.tgs;
      if (/FROM pg_policy/i.test(s)) return responses.pols;
      if (/role_table_grants/i.test(s)) return responses.grants;
      if (/ROLLBACK/i.test(s)) return responses.rollback;
      throw new Error('unexpected query in mock');
    },
  };

  const roleMapping = {
    synthetic_authenticated_role: 'AUTHENTICATED',
    synthetic_owner_role: 'OWNER_CLASS',
  };
  const objects = [
    { schema: 'synthetic_catalog', object_name: 't', object_kind: 'TABLE' },
  ];

  const metadata = await adapter.collectCatalogMetadata({
    client,
    objects,
    roleMapping,
    contract,
    manageTransaction: true,
  });

  const expectedMetadata = {
    format_version: '1.0',
    normalizer_version: '1.0',
    objects: [
      {
        schema: 'synthetic_catalog',
        object_name: 't',
        object_kind: 'TABLE',
        relation_kind: 'r',
        columns: [
          {
            name: 'id',
            type_identity: 'uuid',
            nullable: false,
            default_definition: null,
            generated_kind: 'NONE',
            identity_kind: 'NONE',
          },
          {
            name: 'title',
            type_identity: 'text',
            nullable: true,
            default_definition: null,
            generated_kind: 'NONE',
            identity_kind: 'NONE',
          },
        ],
        constraints: [
          {
            name: 't_pkey',
            constraint_kind: 'PRIMARY_KEY',
            validated: true,
            definition: 'PRIMARY KEY (id)',
            fk_on_update: null,
            fk_on_delete: null,
          },
        ],
        indexes: [
          {
            name: 't_pkey',
            primary: true,
            unique: true,
            valid: true,
            definition: 'CREATE UNIQUE INDEX t_pkey ON synthetic_catalog.t USING btree (id)',
          },
        ],
        triggers: [],
        row_level_security: {
          enabled: true,
          forced: false,
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
        },
        grants: [
          {
            grantee_class: 'AUTHENTICATED',
            privileges: ['SELECT'],
            grantable: false,
          },
        ],
        view_definition: null,
      },
    ],
  };

  assert.equal(JSON.stringify(metadata), JSON.stringify(expectedMetadata));
  const fromAdapter = fingerprint.buildCatalogEvidence(metadata, contract);
  const fromFixture = fingerprint.buildCatalogEvidence(expectedMetadata, contract);
  assert.equal(JSON.stringify(fromAdapter), JSON.stringify(fromFixture));
  assert.match(fromAdapter.objects[0].fingerprint, /^sha256:[a-f0-9]{64}$/);
});

test('CLI requires explicit flags and never prints secrets', () => {
  const res = spawnSync(process.execPath, [CLI], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  assert.equal(res.status, 1);
  const body = JSON.parse(res.stdout);
  assert.equal(body.decision, 'FAIL_CLOSED');
  assert.ok(body.blockers.includes('CATALOG_ADAPTER_INPUT_INVALID'));
  assert.equal(res.stdout.includes('password'), false);
});

test('manifests remain ADOPTION_REQUIRED and empty', () => {
  const expected = readJson(EXPECTED_SCHEMA);
  const canonical = readJson(CANONICAL);
  assert.equal(expected.status, 'ADOPTION_REQUIRED');
  assert.deepEqual(expected.critical_objects, []);
  assert.equal(canonical.status, 'ADOPTION_REQUIRED');
  assert.deepEqual(canonical.migrations, []);
});

test('classification registers source contract and supplemental engine test', () => {
  const inv = readJson(CLASS);
  const entry = inv.entries.find(
    (e) => e.path === 'tests/contracts/migration-catalog-postgres-adapter-contract.test.cjs'
  );
  assert.ok(entry);
  assert.equal(entry.layer, 'SOURCE_STATIC');
  const eng = inv.supplemental.find(
    (e) => e.path === 'tests/db-engine/migration-catalog-postgres-adapter-engine.test.cjs'
  );
  assert.ok(eng);
  assert.equal(eng.layer, 'DB_ENGINE_EXECUTION');
  assert.equal(eng.defaultCi, false);
});

test('engine harness and synthetic fixture are present and static-safe', () => {
  assert.ok(fs.existsSync(ENGINE));
  assert.ok(fs.existsSync(FIX_SQL));
  const eng = read(ENGINE);
  const sql = read(FIX_SQL);
  assert.match(eng, /withDisposableDb/);
  assert.match(eng, /collectCatalogEvidence/);
  assert.equal(/process\.env\.DATABASE_URL/i.test(eng), false);
  assert.match(sql, /synthetic_catalog/);
  assert.match(sql, /synthetic_authenticated_role/);
  assert.match(sql, /Not a Production migration/i);
});

test('architecture doc mentions disposable catalog adapter boundary', () => {
  const docs = read(DOCS);
  assert.match(docs, /catalog adapter/i);
  assert.match(docs, /#3544|#3542|disposable/i);
});

test('executeArbitrarySql is non-capability', () => {
  assert.throws(() => adapter.executeArbitrarySql(), (e) => {
    assert.equal(e.category, 'CATALOG_ADAPTER_READ_ONLY_REQUIRED');
    return true;
  });
});

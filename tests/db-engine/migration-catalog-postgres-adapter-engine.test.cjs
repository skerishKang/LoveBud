'use strict';

/**
 * DB_ENGINE_EXECUTION: disposable PostgreSQL 17.4 catalog adapter.
 *
 * Synthetic schemas only via LB_TEST_PG* loopback harness.
 * Never reads DATABASE_URL. Never contacts Production/Neon/staging.
 *
 * Refs #3544, #3542, #3458, #3425, #1882
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const harness = require('./helpers/postgres-disposable-harness.cjs');
const adapter = require('../../scripts/migration-catalog-postgres-adapter-core.cjs');
const {
  buildCatalogEvidence,
  loadJson,
  defaultContractPath,
} = require('../../scripts/migration-catalog-fingerprint-core.cjs');

const ROOT = path.resolve(__dirname, '..', '..');
const FIX_DIR = path.join(
  __dirname,
  'fixtures',
  'migration-catalog-postgres-adapter'
);
const FIXTURE_SQL = path.join(FIX_DIR, 'synthetic-baseline.sql');
const OBJECTS = loadJson(path.join(FIX_DIR, 'objects-allowlist.json')).objects;
const ROLE_MAPPING = loadJson(path.join(FIX_DIR, 'role-mapping.json')).role_mapping;
const CONTRACT = loadJson(defaultContractPath(ROOT));

const { withDisposableDb } = harness;

function connectionFromCtx(ctx) {
  return {
    host: ctx.cfg.host,
    port: ctx.cfg.port,
    user: ctx.cfg.user,
    password: ctx.cfg.password,
    database: ctx.dbName,
  };
}

function assertFail(fn, category) {
  let caught;
  return Promise.resolve()
    .then(fn)
    .then(() => {
      assert.fail('expected failure');
    })
    .catch((error) => {
      caught = error;
      assert.equal(caught.category, category);
      const msg = String(caught.message || '');
      assert.equal(msg.includes('postgres://'), false);
      assert.equal(msg.includes('PASSWORD'), false);
      assert.equal(/127\.0\.0\.1/.test(msg) && msg.includes('password'), false);
    });
}

test('adapter collects stable evidence on synthetic schema', { concurrency: false }, async () => {
  await withDisposableDb('catalog_adapter_stable', FIXTURE_SQL, async (ctx) => {
    const connection = connectionFromCtx(ctx);
    const before = await adapter.collectSchemaStateFingerprint(ctx.client);

    const metaA = await adapter.collectCatalogMetadata({
      connection,
      objects: OBJECTS,
      roleMapping: ROLE_MAPPING,
      contract: CONTRACT,
    });
    const metaB = await adapter.collectCatalogMetadata({
      connection,
      objects: [...OBJECTS].reverse(),
      roleMapping: ROLE_MAPPING,
      contract: CONTRACT,
    });

    const evidenceA = buildCatalogEvidence(metaA, CONTRACT);
    const evidenceB = buildCatalogEvidence(metaB, CONTRACT);
    assert.equal(JSON.stringify(evidenceA), JSON.stringify(evidenceB));

    const evidenceDirect = await adapter.collectCatalogEvidence({
      connection,
      objects: OBJECTS,
      roleMapping: ROLE_MAPPING,
      contract: CONTRACT,
    });
    assert.equal(JSON.stringify(evidenceDirect), JSON.stringify(evidenceA));

    // Structural expectations for synthetic baseline.
    const table = metaA.objects.find((o) => o.object_name === 'example_tree');
    assert.ok(table);
    assert.equal(table.object_kind, 'TABLE');
    assert.equal(table.relation_kind, 'r');
    assert.ok(table.columns.some((c) => c.name === 'id' && c.type_identity === 'uuid'));
    assert.ok(table.columns.some((c) => c.name === 'score' && c.generated_kind === 'STORED'));
    assert.ok(table.constraints.some((c) => c.constraint_kind === 'PRIMARY_KEY'));
    assert.ok(table.constraints.some((c) => c.constraint_kind === 'FOREIGN_KEY'));
    assert.ok(table.indexes.length >= 2);
    assert.ok(table.triggers.some((t) => t.name === 'trg_example_tree_touch'));
    assert.equal(table.row_level_security.enabled, true);
    assert.equal(table.row_level_security.forced, true);
    assert.ok(table.row_level_security.policies.some((p) => p.name === 'example_tree_select'));
    assert.ok(table.grants.some((g) => g.grantee_class === 'AUTHENTICATED'));
    assert.equal(table.view_definition, null);

    const view = metaA.objects.find((o) => o.object_name === 'example_tree_public');
    assert.equal(view.object_kind, 'VIEW');
    assert.ok(typeof view.view_definition === 'string' && view.view_definition.length > 0);

    const mv = metaA.objects.find((o) => o.object_name === 'example_tree_public_mv');
    assert.equal(mv.object_kind, 'MATERIALIZED_VIEW');
    assert.ok(typeof mv.view_definition === 'string' && mv.view_definition.length > 0);

    // Evidence shape
    for (const item of evidenceA.objects) {
      assert.match(item.fingerprint, /^sha256:[a-f0-9]{64}$/);
      assert.equal(Object.keys(item).sort().join(','), 'fingerprint,name');
    }

    // No mutation during collection
    const after = await adapter.collectSchemaStateFingerprint(ctx.client);
    assert.equal(before, after);

    // No sensitive echo in evidence
    const dump = JSON.stringify(evidenceA);
    assert.equal(dump.includes('synthetic_authenticated_role'), false);
    assert.equal(dump.includes('password'), false);
    assert.equal(dump.includes(ctx.dbName), false);
  });
});

test('semantic catalog drift changes fingerprints', { concurrency: false }, async () => {
  await withDisposableDb('catalog_adapter_drift', FIXTURE_SQL, async (ctx) => {
    const connection = connectionFromCtx(ctx);
    const base = await adapter.collectCatalogEvidence({
      connection,
      objects: OBJECTS,
      roleMapping: ROLE_MAPPING,
      contract: CONTRACT,
    });

    await ctx.client.query(
      `ALTER TABLE synthetic_catalog.example_tree ALTER COLUMN title TYPE character varying(201)`
    );

    const drifted = await adapter.collectCatalogEvidence({
      connection,
      objects: OBJECTS,
      roleMapping: ROLE_MAPPING,
      contract: CONTRACT,
    });

    const baseTable = base.objects.find((o) => o.name === 'table:synthetic_catalog.example_tree');
    const driftTable = drifted.objects.find(
      (o) => o.name === 'table:synthetic_catalog.example_tree'
    );
    assert.notEqual(baseTable.fingerprint, driftTable.fingerprint);
  });
});

test('missing / kind-mismatch / unmapped role / prohibited schema fail closed', {
  concurrency: false,
}, async () => {
  await withDisposableDb('catalog_adapter_fail', FIXTURE_SQL, async (ctx) => {
    const connection = connectionFromCtx(ctx);

    await assertFail(
      () =>
        adapter.collectCatalogMetadata({
          connection,
          objects: [
            {
              schema: 'synthetic_catalog',
              object_name: 'does_not_exist',
              object_kind: 'TABLE',
            },
          ],
          roleMapping: ROLE_MAPPING,
          contract: CONTRACT,
        }),
      'CATALOG_ADAPTER_OBJECT_MISSING'
    );

    await assertFail(
      () =>
        adapter.collectCatalogMetadata({
          connection,
          objects: [
            {
              schema: 'synthetic_catalog',
              object_name: 'example_tree',
              object_kind: 'VIEW',
            },
          ],
          roleMapping: ROLE_MAPPING,
          contract: CONTRACT,
        }),
      'CATALOG_ADAPTER_OBJECT_KIND_MISMATCH'
    );

    await assertFail(
      () =>
        adapter.collectCatalogMetadata({
          connection,
          objects: OBJECTS,
          roleMapping: {
            synthetic_public_role: 'PUBLIC',
            // omit authenticated + owner so grants fail closed
          },
          contract: CONTRACT,
        }),
      'CATALOG_ADAPTER_GRANTEE_UNMAPPED'
    );

    await assertFail(
      () =>
        adapter.collectCatalogMetadata({
          connection,
          objects: [
            { schema: 'pg_catalog', object_name: 'pg_class', object_kind: 'TABLE' },
          ],
          roleMapping: ROLE_MAPPING,
          contract: CONTRACT,
        }),
      'CATALOG_ADAPTER_SCHEMA_PROHIBITED'
    );

    await assertFail(
      () =>
        adapter.collectCatalogMetadata({
          connection,
          objects: [
            {
              schema: 'synthetic_catalog',
              object_name: 'example_tree',
              object_kind: 'TABLE',
            },
            {
              schema: 'synthetic_catalog',
              object_name: 'example_tree',
              object_kind: 'TABLE',
            },
          ],
          roleMapping: ROLE_MAPPING,
          contract: CONTRACT,
        }),
      'CATALOG_ADAPTER_OBJECT_DUPLICATE'
    );
  });
});

test('connection config rejects non-loopback and env-free boundary holds', {
  concurrency: false,
}, async () => {
  await assertFail(
    () =>
      Promise.resolve(
        adapter.validateConnectionConfig({
          host: 'db.example.com',
          port: 5432,
          user: 'lovebud_ci',
          password: 'x',
          database: 'lovebud_ci_admin',
        })
      ),
    'CATALOG_ADAPTER_CONNECTION_CONFIG_INVALID'
  );

  await assertFail(
    () =>
      Promise.resolve(
        adapter.validateConnectionConfig({
          host: '127.0.0.1',
          port: 5432,
          user: 'lovebud_ci',
          password: 'x',
          database: 'production_main',
        })
      ),
    'CATALOG_ADAPTER_CONNECTION_CONFIG_INVALID'
  );

  assert.throws(() => adapter.executeArbitrarySql('DROP TABLE x'), (err) => {
    assert.equal(err.category, 'CATALOG_ADAPTER_READ_ONLY_REQUIRED');
    return true;
  });
});

test('server version mismatch fails closed when injected client lies', {
  concurrency: false,
}, async () => {
  const fake = {
    async query(sql) {
      if (/BEGIN/i.test(sql)) return { rows: [] };
      if (/transaction_read_only/i.test(sql)) {
        return { rows: [{ transaction_read_only: 'on' }] };
      }
      if (/server_version_num/i.test(sql)) {
        return { rows: [{ server_version_num: '160001' }] };
      }
      if (/ROLLBACK/i.test(sql)) return { rows: [] };
      return { rows: [] };
    },
  };
  await assertFail(
    () =>
      adapter.collectCatalogMetadata({
        client: fake,
        manageTransaction: true,
        objects: OBJECTS.slice(0, 1),
        roleMapping: ROLE_MAPPING,
        contract: CONTRACT,
      }),
    'CATALOG_ADAPTER_SERVER_VERSION_MISMATCH'
  );
});

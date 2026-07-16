'use strict';

/**
 * DB_ENGINE_EXECUTION: disposable PostgreSQL 17.4 catalog adapter.
 * Synthetic schemas only via LB_TEST_PG* loopback harness.
 * Never reads DATABASE_URL. Never contacts Production/Neon/staging.
 *
 * Refs #3544, #3542, #3458, #3425, #1882
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const harness = require('./helpers/postgres-disposable-harness.cjs');
const adapter = require('../../scripts/migration-catalog-postgres-adapter-core.cjs');
const {
  buildCatalogEvidence,
  loadJson,
  defaultContractPath,
} = require('../../scripts/migration-catalog-fingerprint-core.cjs');

const ROOT = path.resolve(__dirname, '..', '..');
const FIX_DIR = path.join(__dirname, 'fixtures', 'migration-catalog-postgres-adapter');
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
  return Promise.resolve()
    .then(fn)
    .then(() => {
      assert.fail('expected failure');
    })
    .catch((error) => {
      assert.equal(error.category, category);
      const msg = String(error.message || '');
      assert.equal(msg.includes('postgres://'), false);
      assert.equal(/password/i.test(msg) && msg.length > 40, false);
      assert.equal(msg.includes('synthetic_authenticated_role'), false);
    });
}

test('adapter equality: repeated collection and input reorder', { concurrency: false }, async () => {
  await withDisposableDb('cat_adapter_eq', FIXTURE_SQL, async (ctx) => {
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

    // Expected fixture equality path: adapter metadata round-trips through normalizer only.
    const viaNormalizer = buildCatalogEvidence(metaA, CONTRACT);
    assert.equal(JSON.stringify(viaNormalizer), JSON.stringify(evidenceA));

    const table = metaA.objects.find((o) => o.object_name === 'example_tree');
    assert.equal(table.object_kind, 'TABLE');
    assert.ok(table.columns.some((c) => c.name === 'id' && c.type_identity === 'uuid'));
    assert.ok(table.columns.some((c) => c.name === 'score' && c.generated_kind === 'STORED'));
    assert.ok(table.columns.some((c) => c.name === 'seq' && c.identity_kind === 'BY_DEFAULT'));
    assert.ok(table.constraints.some((c) => c.constraint_kind === 'PRIMARY_KEY'));
    assert.ok(table.constraints.some((c) => c.constraint_kind === 'FOREIGN_KEY'));
    assert.ok(table.constraints.some((c) => c.constraint_kind === 'EXCLUSION'));
    assert.ok(table.indexes.some((i) => /lower/i.test(i.definition)));
    assert.ok(table.triggers.some((t) => t.level === 'ROW'));
    assert.ok(table.triggers.some((t) => t.level === 'STATEMENT'));
    assert.equal(table.row_level_security.enabled, true);
    assert.equal(table.row_level_security.forced, true);
    assert.ok(table.grants.some((g) => g.grantee_class === 'AUTHENTICATED'));

    const view = metaA.objects.find((o) => o.object_name === 'example_tree_public');
    assert.equal(view.object_kind, 'VIEW');
    assert.ok(view.view_definition && view.view_definition.length > 0);

    const mv = metaA.objects.find((o) => o.object_name === 'example_tree_public_mv');
    assert.equal(mv.object_kind, 'MATERIALIZED_VIEW');
    assert.ok(mv.view_definition && mv.view_definition.length > 0);

    for (const item of evidenceA.objects) {
      assert.match(item.fingerprint, /^sha256:[a-f0-9]{64}$/);
      assert.deepEqual(Object.keys(item).sort(), ['fingerprint', 'name']);
    }

    const after = await adapter.collectSchemaStateFingerprint(ctx.client);
    assert.equal(before, after, 'read-only collection must not mutate schema');

    const dump = JSON.stringify(evidenceA);
    assert.equal(dump.includes('synthetic_authenticated_role'), false);
    assert.equal(dump.includes(ctx.dbName), false);
    assert.equal(dump.includes('password'), false);
  });
});

test('adapter inequality: semantic catalog drift changes fingerprints', {
  concurrency: false,
}, async () => {
  await withDisposableDb('cat_adapter_drift', FIXTURE_SQL, async (ctx) => {
    const connection = connectionFromCtx(ctx);
    const base = await adapter.collectCatalogEvidence({
      connection,
      objects: OBJECTS,
      roleMapping: ROLE_MAPPING,
      contract: CONTRACT,
    });

    await ctx.client.query(
      `CREATE INDEX example_tree_drift_idx ON synthetic_catalog.example_tree (owner_class)`
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

test('adapter rejection matrix fail closed', { concurrency: false }, async () => {
  await withDisposableDb('cat_adapter_rej', FIXTURE_SQL, async (ctx) => {
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

    await assertFail(
      () =>
        adapter.collectCatalogMetadata({
          connection,
          objects: [{ schema: 'pg_catalog', object_name: 'pg_class', object_kind: 'TABLE' }],
          roleMapping: ROLE_MAPPING,
          contract: CONTRACT,
        }),
      'CATALOG_ADAPTER_SCHEMA_PROHIBITED'
    );

    await assertFail(
      () =>
        adapter.collectCatalogMetadata({
          connection,
          objects: OBJECTS,
          roleMapping: { synthetic_public_role: 'PUBLIC' },
          contract: CONTRACT,
        }),
      'CATALOG_ADAPTER_GRANTEE_UNMAPPED'
    );
  });
});

test('connection and version and arbitrary SQL boundaries', { concurrency: false }, async () => {
  await assertFail(
    () =>
      Promise.resolve(
        adapter.validateConnectionConfig({
          host: 'db.neon.example',
          port: 5432,
          user: 'lovebud_ci',
          password: 'x',
          database: 'lovebud_ci_admin',
        })
      ),
    'CATALOG_ADAPTER_CONNECTION_CONFIG_INVALID'
  );

  assert.throws(() => adapter.executeArbitrarySql('DROP TABLE x'), (err) => {
    assert.equal(err.category, 'CATALOG_ADAPTER_READ_ONLY_REQUIRED');
    return true;
  });

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

  const nonRo = {
    async query(sql) {
      if (/BEGIN/i.test(sql)) return { rows: [] };
      if (/transaction_read_only/i.test(sql)) {
        return { rows: [{ transaction_read_only: 'off' }] };
      }
      if (/ROLLBACK/i.test(sql)) return { rows: [] };
      return { rows: [] };
    },
  };
  await assertFail(
    () =>
      adapter.collectCatalogMetadata({
        client: nonRo,
        manageTransaction: true,
        objects: OBJECTS.slice(0, 1),
        roleMapping: ROLE_MAPPING,
        contract: CONTRACT,
      }),
    'CATALOG_ADAPTER_READ_ONLY_REQUIRED'
  );
});

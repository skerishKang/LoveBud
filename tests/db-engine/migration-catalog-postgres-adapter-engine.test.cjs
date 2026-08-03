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

function opts(ctx, objects = OBJECTS) {
  return {
    connection: connectionFromCtx(ctx),
    objects,
    roleMapping: ROLE_MAPPING,
    contract: CONTRACT,
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
      assert.equal(msg.includes('synthetic_authenticated_role'), false);
    });
}

function fp(evidence, name) {
  const item = evidence.objects.find((o) => o.name === name);
  assert.ok(item, `missing evidence object ${name}`);
  return item.fingerprint;
}

test('equality: metadata and evidence independent of allowlist order', {
  concurrency: false,
}, async () => {
  await withDisposableDb('eq_order', FIXTURE_SQL, async (ctx) => {
    const metaA = await adapter.collectCatalogMetadata(opts(ctx, OBJECTS));
    const metaB = await adapter.collectCatalogMetadata(opts(ctx, [...OBJECTS].reverse()));
    assert.equal(JSON.stringify(metaA), JSON.stringify(metaB));

    const evA = buildCatalogEvidence(metaA, CONTRACT);
    const evB = buildCatalogEvidence(metaB, CONTRACT);
    assert.equal(JSON.stringify(evA), JSON.stringify(evB));

    const table = metaA.objects.find((o) => o.object_name === 'example_tree');
    assert.ok(table.grants.some((g) => g.grantee_class === 'PUBLIC' && g.privileges.includes('SELECT')));
    assert.ok(table.grants.some((g) => g.grantee_class === 'AUTHENTICATED'));
    assert.ok(table.constraints.some((c) => c.constraint_kind === 'EXCLUSION'));
    assert.ok(table.triggers.some((t) => t.level === 'STATEMENT'));

    // Full-scope no-mutation via dual independent collections.
    await adapter.assertNoCatalogMutation(opts(ctx));
  });
});

async function driftCase(name, ddl, targetName) {
  await withDisposableDb(name, FIXTURE_SQL, async (ctx) => {
    const base = await adapter.collectCatalogEvidence(opts(ctx));
    await ctx.client.query(ddl);
    const drifted = await adapter.collectCatalogEvidence(opts(ctx));
    assert.notEqual(fp(base, targetName), fp(drifted, targetName));
  });
}

test('drift: type', { concurrency: false }, async () => {
  await driftCase(
    'drift_type',
    `ALTER TABLE synthetic_catalog.drift_pad ALTER COLUMN flag DROP DEFAULT;
     ALTER TABLE synthetic_catalog.drift_pad
       ALTER COLUMN flag TYPE integer USING (CASE WHEN flag THEN 1 ELSE 0 END)`,
    'table:synthetic_catalog.drift_pad'
  );
});

test('drift: nullability', { concurrency: false }, async () => {
  await driftCase(
    'drift_null',
    `ALTER TABLE synthetic_catalog.drift_pad ALTER COLUMN note SET NOT NULL`,
    'table:synthetic_catalog.drift_pad'
  );
});

test('drift: default', { concurrency: false }, async () => {
  await driftCase(
    'drift_default',
    `ALTER TABLE synthetic_catalog.drift_pad ALTER COLUMN flag SET DEFAULT true`,
    'table:synthetic_catalog.drift_pad'
  );
});

test('drift: constraint', { concurrency: false }, async () => {
  await driftCase(
    'drift_check',
    `ALTER TABLE synthetic_catalog.drift_pad DROP CONSTRAINT drift_pad_note_check;
     ALTER TABLE synthetic_catalog.drift_pad ADD CONSTRAINT drift_pad_note_check
       CHECK ((note IS NULL) OR (char_length(note) > 1))`,
    'table:synthetic_catalog.drift_pad'
  );
});

test('drift: fk action', { concurrency: false }, async () => {
  await driftCase(
    'drift_fk',
    `ALTER TABLE synthetic_catalog.drift_pad DROP CONSTRAINT drift_pad_owner_fk;
     ALTER TABLE synthetic_catalog.drift_pad ADD CONSTRAINT drift_pad_owner_fk
       FOREIGN KEY (ref_code) REFERENCES synthetic_catalog.owner_classes(code)
       ON UPDATE CASCADE ON DELETE CASCADE`,
    'table:synthetic_catalog.drift_pad'
  );
});

test('drift: index', { concurrency: false }, async () => {
  await driftCase(
    'drift_idx',
    `CREATE INDEX example_tree_drift_idx ON synthetic_catalog.example_tree (owner_class)`,
    'table:synthetic_catalog.example_tree'
  );
});

test('drift: trigger', { concurrency: false }, async () => {
  await driftCase(
    'drift_tg',
    `ALTER TABLE synthetic_catalog.example_tree DISABLE TRIGGER trg_example_tree_touch`,
    'table:synthetic_catalog.example_tree'
  );
});

test('drift: rls forced', { concurrency: false }, async () => {
  await driftCase(
    'drift_rls',
    `ALTER TABLE synthetic_catalog.example_tree NO FORCE ROW LEVEL SECURITY`,
    'table:synthetic_catalog.example_tree'
  );
});

test('drift: policy', { concurrency: false }, async () => {
  await driftCase(
    'drift_pol',
    `DROP POLICY example_tree_select ON synthetic_catalog.example_tree;
     CREATE POLICY example_tree_select ON synthetic_catalog.example_tree
       AS PERMISSIVE FOR ALL TO synthetic_authenticated_role USING (true)`,
    'table:synthetic_catalog.example_tree'
  );
});

test('drift: view definition', { concurrency: false }, async () => {
  await driftCase(
    'drift_view',
    `CREATE OR REPLACE VIEW synthetic_catalog.example_tree_public AS
       SELECT id, title FROM synthetic_catalog.example_tree WHERE title IS NULL`,
    'view:synthetic_catalog.example_tree_public'
  );
});

test('drift: materialized view definition', { concurrency: false }, async () => {
  await withDisposableDb('drift_mv', FIXTURE_SQL, async (ctx) => {
    const base = await adapter.collectCatalogEvidence(opts(ctx));
    await ctx.client.query(`
      DROP MATERIALIZED VIEW synthetic_catalog.example_tree_public_mv;
      CREATE MATERIALIZED VIEW synthetic_catalog.example_tree_public_mv AS
        SELECT id, title FROM synthetic_catalog.example_tree WHERE title IS NULL;
      ALTER MATERIALIZED VIEW synthetic_catalog.example_tree_public_mv OWNER TO synthetic_owner_role;
      GRANT SELECT ON TABLE synthetic_catalog.example_tree_public_mv TO synthetic_application_role;
    `);
    const drifted = await adapter.collectCatalogEvidence(opts(ctx));
    assert.notEqual(
      fp(base, 'materialized_view:synthetic_catalog.example_tree_public_mv'),
      fp(drifted, 'materialized_view:synthetic_catalog.example_tree_public_mv')
    );
  });
});

test('drift: grant', { concurrency: false }, async () => {
  await driftCase(
    'drift_grant',
    `GRANT INSERT ON TABLE synthetic_catalog.example_tree TO synthetic_authenticated_role`,
    'table:synthetic_catalog.example_tree'
  );
});

test('rejection: unsupported relation (sequence + partitioned)', {
  concurrency: false,
}, async () => {
  await withDisposableDb('rej_unsup', FIXTURE_SQL, async (ctx) => {
    await assertFail(
      () =>
        adapter.collectCatalogMetadata(
          opts(ctx, [
            {
              schema: 'synthetic_catalog',
              object_name: 'example_seq',
              object_kind: 'TABLE',
            },
          ])
        ),
      'CATALOG_ADAPTER_UNSUPPORTED_RELATION'
    );
    await assertFail(
      () =>
        adapter.collectCatalogMetadata(
          opts(ctx, [
            {
              schema: 'synthetic_catalog',
              object_name: 'part_parent',
              object_kind: 'TABLE',
            },
          ])
        ),
      'CATALOG_ADAPTER_UNSUPPORTED_RELATION'
    );
  });
});

test('rejection matrix', { concurrency: false }, async () => {
  await withDisposableDb('rej_matrix', FIXTURE_SQL, async (ctx) => {
    await assertFail(
      () =>
        adapter.collectCatalogMetadata(
          opts(ctx, [
            {
              schema: 'synthetic_catalog',
              object_name: 'missing_obj',
              object_kind: 'TABLE',
            },
          ])
        ),
      'CATALOG_ADAPTER_OBJECT_MISSING'
    );

    await assertFail(
      () =>
        adapter.collectCatalogMetadata(
          opts(ctx, [
            {
              schema: 'synthetic_catalog',
              object_name: 'example_tree',
              object_kind: 'VIEW',
            },
          ])
        ),
      'CATALOG_ADAPTER_OBJECT_KIND_MISMATCH'
    );

    await assertFail(
      () =>
        adapter.collectCatalogMetadata(
          opts(ctx, [
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
          ])
        ),
      'CATALOG_ADAPTER_OBJECT_DUPLICATE'
    );

    await assertFail(
      () =>
        adapter.collectCatalogMetadata(
          opts(ctx, [{ schema: 'pg_catalog', object_name: 'pg_class', object_kind: 'TABLE' }])
        ),
      'CATALOG_ADAPTER_SCHEMA_PROHIBITED'
    );

    await assertFail(
      () =>
        adapter.collectCatalogMetadata({
          connection: connectionFromCtx(ctx),
          objects: OBJECTS,
          roleMapping: { synthetic_public_role: 'PUBLIC' },
          contract: CONTRACT,
        }),
      'CATALOG_ADAPTER_GRANTEE_UNMAPPED'
    );

    const over = [];
    for (let i = 0; i < CONTRACT.limits.max_objects + 1; i += 1) {
      over.push({
        schema: 'synthetic_catalog',
        object_name: `x${i}`,
        object_kind: 'TABLE',
      });
    }
    await assertFail(
      () => adapter.collectCatalogMetadata(opts(ctx, over)),
      'CATALOG_ADAPTER_BOUNDS_EXCEEDED'
    );
  });
});

test('connection config rejects non-loopback and bypass fields', {
  concurrency: false,
}, async () => {
  assert.throws(
    () =>
      adapter.validateConnectionConfig({
        host: 'db.example.com',
        port: 5432,
        user: 'lovebud_ci',
        password: 'x',
        database: 'lovebud_ci_admin',
      }),
    (e) => e.category === 'CATALOG_ADAPTER_CONNECTION_CONFIG_INVALID'
  );

  await assertFail(
    () =>
      adapter.collectCatalogMetadata({
        client: {},
        connection: {
          host: '127.0.0.1',
          port: 5432,
          user: 'lovebud_ci',
          password: 'x',
          database: 'lovebud_ci_admin',
        },
        objects: OBJECTS.slice(0, 1),
        roleMapping: ROLE_MAPPING,
        contract: CONTRACT,
      }),
    'CATALOG_ADAPTER_INPUT_INVALID'
  );

  await assertFail(
    () =>
      adapter.collectCatalogMetadata({
        manageTransaction: false,
        connection: {
          host: '127.0.0.1',
          port: 5432,
          user: 'lovebud_ci',
          password: 'x',
          database: 'lovebud_ci_admin',
        },
        objects: OBJECTS.slice(0, 1),
        roleMapping: ROLE_MAPPING,
        contract: CONTRACT,
      }),
    'CATALOG_ADAPTER_INPUT_INVALID'
  );

  await assertFail(
    () =>
      adapter.collectCatalogMetadata({
        objects: OBJECTS.slice(0, 1),
        roleMapping: ROLE_MAPPING,
        contract: CONTRACT,
      }),
    'CATALOG_ADAPTER_CONNECTION_CONFIG_INVALID'
  );

  assert.throws(() => adapter.executeArbitrarySql('DROP TABLE x'), (err) => {
    assert.equal(err.category, 'CATALOG_ADAPTER_READ_ONLY_REQUIRED');
    return true;
  });
});

// ─── Issue #3549: inactive expected-schema candidate pipeline on disposable PG ───
const candidateCore = require('../../scripts/expected-schema-candidate-core.cjs');
const provenanceCore = require('../../scripts/migration-provenance-core.cjs');
const EXPECTED_SCHEMA_PATH = path.join(
  ROOT,
  'db',
  'migration-provenance',
  'expected-schema-manifest.json'
);
const CANONICAL_PATH = path.join(ROOT, 'db', 'migration-provenance', 'canonical-migrations.json');

test('pipeline: adapter evidence → inactive candidate → same-evidence match → drift mismatch (committed manifest populated but inactive)', {
  concurrency: false,
}, async () => {
  await withDisposableDb('cand_pipe', FIXTURE_SQL, async (ctx) => {
    const version = await ctx.client.query('SHOW server_version_num');
    assert.equal(String(version.rows[0].server_version_num), '170004');

    const evidence = await adapter.collectCatalogEvidence(opts(ctx));
    assert.ok(Array.isArray(evidence.objects));
    assert.ok(evidence.objects.length >= 1);

    const template = candidateCore.loadCommittedInactiveTemplate(ROOT);
    const candidate = candidateCore.buildExpectedSchemaCandidate(evidence, template);
    assert.equal(candidate.status, 'ADOPTION_REQUIRED');
    assert.notEqual(candidate.status, 'ACTIVE');
    assert.equal(candidate.critical_objects.length, evidence.objects.length);

    const validated = provenanceCore.validateExpectedSchemaManifest(candidate);
    assert.equal(validated.ok, true);

    const sameBlockers = provenanceCore.compareSchema(candidate, evidence);
    assert.deepEqual(sameBlockers, []);

    const gate = provenanceCore.evaluateProvenance({
      migrationManifest: loadJson(CANONICAL_PATH),
      expectedSchemaManifest: candidate,
      ledgerEvidence: null,
      catalogEvidence: evidence,
    });
    assert.equal(gate.decision, 'FAIL_CLOSED');
    assert.ok(gate.blockers.includes('GATE_ADOPTION_BASELINE_REQUIRED'));
    assert.ok(gate.blockers.includes('GATE_ADOPTION_EVIDENCE_UNAVAILABLE'));
    assert.equal(
      gate.blockers.some((b) => b.startsWith('GATE_SCHEMA_FINGERPRINT_MISMATCH:')),
      false
    );

    // Meaningful synthetic drift (column default) then re-collect evidence.
    await ctx.client.query(
      `ALTER TABLE synthetic_catalog.drift_pad ALTER COLUMN flag SET DEFAULT true`
    );
    const driftedEvidence = await adapter.collectCatalogEvidence(opts(ctx));
    const driftBlockers = provenanceCore.compareSchema(candidate, driftedEvidence);
    assert.ok(
      driftBlockers.some((b) => b.startsWith('GATE_SCHEMA_FINGERPRINT_MISMATCH:')),
      'expected fingerprint mismatch after drift'
    );
    assert.equal(candidate.status, 'ADOPTION_REQUIRED');

    const gateAfterDrift = provenanceCore.evaluateProvenance({
      migrationManifest: loadJson(CANONICAL_PATH),
      expectedSchemaManifest: candidate,
      ledgerEvidence: null,
      catalogEvidence: driftedEvidence,
    });
    assert.equal(gateAfterDrift.decision, 'FAIL_CLOSED');
    assert.ok(gateAfterDrift.blockers.includes('GATE_ADOPTION_BASELINE_REQUIRED'));

    // Adapter/candidate builder no-mutation of committed manifests: the
    // committed manifests remain exactly the populated-but-inactive committed
    // authority (ADOPTION_REQUIRED; one critical object; one bootstrap
    // migration; no unauthorized bootstrap field; no ACTIVE activation).
    const expected = loadJson(EXPECTED_SCHEMA_PATH);
    const canonical = loadJson(CANONICAL_PATH);
    assert.equal(expected.status, 'ADOPTION_REQUIRED');
    assert.equal(expected.bootstrap, undefined, 'no unauthorized bootstrap field');
    assert.equal(expected.critical_objects.length, 1, 'exactly one committed critical object (populated but inactive)');
    assert.equal(
      expected.critical_objects[0].name,
      'table:public.schema_migration_ledger',
      'committed critical object name'
    );
    assert.equal(canonical.status, 'ADOPTION_REQUIRED');
    assert.equal(canonical.bootstrap, undefined, 'no unauthorized bootstrap field');
    assert.equal(canonical.migrations.length, 1, 'exactly one committed migration (populated but inactive)');
    assert.equal(
      canonical.migrations[0].id,
      '20260802094500_bootstrap-migration-ledger',
      'committed bootstrap migration id'
    );

    await adapter.assertNoCatalogMutation(opts(ctx));
  });
});

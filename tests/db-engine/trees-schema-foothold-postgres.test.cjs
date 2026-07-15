'use strict';

/**
 * DB_ENGINE_EXECUTION: trees schema foothold migration on disposable PostgreSQL.
 *
 * Executes exact scripts/migration-repair-trees-schema-3435.sql via
 * psql -X -v ON_ERROR_STOP=1 -f against synthetic loopback databases only.
 *
 * Does not invent rollback SQL. Does not contact Production/Neon/staging.
 *
 * Refs: #3532, #3531, #3459, #3458, #3435, #3433, #1882
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const harness = require('./helpers/postgres-disposable-harness.cjs');
const catalog = require('./helpers/trees-schema-catalog-assertions.cjs');

const ROOT = path.resolve(__dirname, '..', '..');
const MIGRATION_SQL = path.join(ROOT, 'scripts/migration-repair-trees-schema-3435.sql');
const DAMAGED_FIXTURE = path.join(__dirname, 'fixtures/trees-schema-damaged.sql');

const { TARGET_COLUMNS, TARGET_NAMES } = catalog;
const { boundedFail, withDisposableDb, combinedOutput } = harness;

function pass(name) {
  process.stdout.write(`${name}: PASS\n`);
}

function failMutation() {
  const err = new Error('EXPECTED_PRESTATE_PRESERVED_ACTUAL_MUTATED');
  err.code = 'EXPECTED_PRESTATE_PRESERVED_ACTUAL_MUTATED';
  throw err;
}

async function assertNoMutation(client, beforeFp) {
  const after = await catalog.getCatalogFingerprint(client);
  if (!catalog.fingerprintEqual(beforeFp, after)) {
    failMutation();
  }
}

function expectFail(res, scenario, phase) {
  if (res.status === 0) {
    boundedFail(scenario, phase, 'EXPECTED_NONZERO_EXIT', 0, 'nonzero', '0');
  }
}

function expectOk(res, scenario, phase) {
  if (res.status !== 0) {
    boundedFail(
      scenario,
      phase,
      classifyMigrationError(combinedOutput(res)),
      res.status,
      'exit_0',
      `exit_${res.status}`
    );
  }
}

function classifyMigrationError(out) {
  if (/PRECONDITION_FAILED/i.test(out)) return 'MIGRATION_PRECONDITION_FAILED';
  if (/TYPE_MISMATCH/i.test(out)) return 'MIGRATION_TYPE_MISMATCH';
  if (/POSTCONDITION_FAILED/i.test(out)) return 'MIGRATION_POSTCONDITION_FAILED';
  if (/syntax error/i.test(out)) return 'MIGRATION_SYNTAX_ERROR';
  return 'MIGRATION_ENGINE_ERROR';
}

async function seedSentinels(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS public.lb_sentinel_dependent (
      id text NOT NULL PRIMARY KEY,
      tree_id text NOT NULL,
      body text NULL
    );
    CREATE TABLE IF NOT EXISTS public.lb_unrelated_marker (
      id text NOT NULL PRIMARY KEY,
      v text NOT NULL
    );
  `);
  await client.query(
    `INSERT INTO public.lb_sentinel_dependent (id, tree_id, body)
     VALUES ('dep_syn_1', 'tree_syn_a', 'sentinel-body')
     ON CONFLICT DO NOTHING`
  );
  await client.query(
    `INSERT INTO public.lb_unrelated_marker (id, v)
     VALUES ('unrel_1', 'keep')
     ON CONFLICT DO NOTHING`
  );
}

// ─── Happy path: damaged → apply → verify → second apply no-op ───────────────

test('trees-schema happy path apply and idempotent second apply', { concurrency: false }, async () => {
  await withDisposableDb('happy', DAMAGED_FIXTURE, async ({ client, runSql }) => {
    await catalog.assertDamagedCatalog(client);
    const beforeCols = await catalog.getTreesColumnNames(client);
    const beforeRows = await catalog.getTreesRowFingerprint(client);
    const beforeSentinel = await catalog.getSentinelFingerprint(client);
    const beforeUnrelated = await catalog.getUnrelatedFingerprint(client);
    pass('trees-schema happy damaged preflight');

    const apply1 = runSql(MIGRATION_SQL);
    expectOk(apply1, 'happy', 'migration_apply');
    pass('trees-schema happy apply');

    await catalog.assertRepairedCatalog(client);
    // Full-row values of pre-migration columns preserved (new null cols excluded via projection).
    const afterBase = await catalog.getTreesRowFingerprint(client, { columns: beforeCols });
    assert.equal(afterBase.count, beforeRows.count);
    assert.equal(afterBase.rowFp, beforeRows.rowFp);
    // Exact damaged start → all seven foothold fields NULL on pre-existing rows.
    assert.equal(await catalog.getNonNullTargetCount(client), 0);
    assert.deepEqual(await catalog.getSentinelFingerprint(client), beforeSentinel);
    assert.deepEqual(await catalog.getUnrelatedFingerprint(client), beforeUnrelated);
    pass('trees-schema happy catalog+row verify');

    const repairedFp = await catalog.getCatalogFingerprint(client);
    const apply2 = runSql(MIGRATION_SQL);
    expectOk(apply2, 'happy', 'second_apply');
    await catalog.assertRepairedCatalog(client);
    await assertNoMutation(client, repairedFp);
    pass('trees-schema second apply no-op');
  });
});

// ─── Compatible partial states ───────────────────────────────────────────────

test('trees-schema compatible partial columns converge', { concurrency: false }, async () => {
  for (const col of TARGET_COLUMNS) {
    await withDisposableDb(`partial_${col.name}`, null, async ({ client, runSql }) => {
      await client.query(`
        CREATE TABLE public.trees (
          id text NOT NULL PRIMARY KEY
        );
        INSERT INTO public.trees (id) VALUES ('tree_syn_a');
      `);
      // Pre-present exactly one approved column with synthetic non-NULL value.
      if (col.name === 'keywords') {
        await client.query(`ALTER TABLE public.trees ADD COLUMN keywords text[]`);
        await client.query(
          `UPDATE public.trees SET keywords = ARRAY['syn_kw']::text[] WHERE id = 'tree_syn_a'`
        );
      } else if (col.udt === 'timestamptz') {
        await client.query(
          `ALTER TABLE public.trees ADD COLUMN ${col.name} timestamptz`
        );
        await client.query(
          `UPDATE public.trees SET ${col.name} = TIMESTAMPTZ '2020-01-02T03:04:05Z' WHERE id = 'tree_syn_a'`
        );
      } else {
        await client.query(`ALTER TABLE public.trees ADD COLUMN ${col.name} text`);
        await client.query(
          `UPDATE public.trees SET ${col.name} = 'syn_partial_val' WHERE id = 'tree_syn_a'`
        );
      }
      await seedSentinels(client);
      const beforeCols = await catalog.getTreesColumnNames(client);
      const beforeRows = await catalog.getTreesRowFingerprint(client);
      const beforeSentinel = await catalog.getSentinelFingerprint(client);

      const res = runSql(MIGRATION_SQL);
      expectOk(res, `partial_${col.name}`, 'migration_apply');
      await catalog.assertRepairedCatalog(client);
      const afterBase = await catalog.getTreesRowFingerprint(client, { columns: beforeCols });
      assert.equal(afterBase.count, beforeRows.count);
      assert.equal(afterBase.rowFp, beforeRows.rowFp, 'pre-existing full-row values preserved');
      assert.deepEqual(await catalog.getSentinelFingerprint(client), beforeSentinel);
      pass(`trees-schema partial ${col.name}`);
    });
  }
});

test('trees-schema fully repaired state is no-op', { concurrency: false }, async () => {
  await withDisposableDb('fullok', DAMAGED_FIXTURE, async ({ client, runSql }) => {
    expectOk(runSql(MIGRATION_SQL), 'fullok', 'first_apply');
    const fp = await catalog.getCatalogFingerprint(client);
    expectOk(runSql(MIGRATION_SQL), 'fullok', 'noop_apply');
    await assertNoMutation(client, fp);
    pass('trees-schema fully repaired no-op');
  });
});

test('trees-schema multi partial owner_id+title+visibility converges', { concurrency: false }, async () => {
  await withDisposableDb('multi_partial', null, async ({ client, runSql }) => {
    await client.query(`
      CREATE TABLE public.trees (
        id text NOT NULL PRIMARY KEY
      );
      INSERT INTO public.trees (id) VALUES ('tree_syn_a');
      ALTER TABLE public.trees ADD COLUMN owner_id text;
      ALTER TABLE public.trees ADD COLUMN title text;
      ALTER TABLE public.trees ADD COLUMN visibility text;
      UPDATE public.trees
         SET owner_id = 'syn_owner',
             title = 'syn_title',
             visibility = 'public'
       WHERE id = 'tree_syn_a';
    `);
    await seedSentinels(client);
    const beforeCols = await catalog.getTreesColumnNames(client);
    const beforeRows = await catalog.getTreesRowFingerprint(client);
    const beforeOwnerAcl = await catalog.getTreesOwnerAclFingerprint(client);
    const beforeSentinel = await catalog.getSentinelFingerprint(client);
    expectOk(runSql(MIGRATION_SQL), 'multi_partial', 'migration_apply');
    await catalog.assertRepairedCatalog(client);
    const afterBase = await catalog.getTreesRowFingerprint(client, { columns: beforeCols });
    assert.equal(afterBase.rowFp, beforeRows.rowFp);
    assert.deepEqual(await catalog.getTreesOwnerAclFingerprint(client), beforeOwnerAcl);
    assert.deepEqual(await catalog.getSentinelFingerprint(client), beforeSentinel);
    pass('trees-schema multi partial converge');
  });
});

// ─── Fingerprint sensitivity (helper contract; not migration behavior) ───────

test('trees non-ID value mutation changes rowFp', { concurrency: false }, async () => {
  await withDisposableDb('fp_trees_mut', null, async ({ client }) => {
    await client.query(`
      CREATE TABLE public.trees (
        id text NOT NULL PRIMARY KEY,
        owner_id text NULL
      );
      INSERT INTO public.trees (id, owner_id) VALUES ('tree_syn_a', 'before_val');
    `);
    const a = await catalog.getTreesRowFingerprint(client);
    await client.query(
      `UPDATE public.trees SET owner_id = 'after_val' WHERE id = 'tree_syn_a'`
    );
    const b = await catalog.getTreesRowFingerprint(client);
    assert.equal(a.count, b.count);
    assert.notEqual(a.rowFp, b.rowFp, 'non-id value change must alter full-row fingerprint');
    pass('trees-schema fingerprint sensitivity trees');
  });
});

test('sentinel body mutation changes rowFp', { concurrency: false }, async () => {
  await withDisposableDb('fp_sent_mut', null, async ({ client }) => {
    await seedSentinels(client);
    // Ensure base trees table exists for unrelated schema noise only.
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.trees (id text NOT NULL PRIMARY KEY);
    `);
    const a = await catalog.getSentinelFingerprint(client);
    await client.query(
      `UPDATE public.lb_sentinel_dependent SET body = 'mutated-sentinel-body' WHERE id = 'dep_syn_1'`
    );
    const b = await catalog.getSentinelFingerprint(client);
    assert.equal(a.count, b.count);
    assert.notEqual(a.rowFp, b.rowFp, 'sentinel body change must alter full-row fingerprint');
    pass('trees-schema fingerprint sensitivity sentinel');
  });
});

// ─── Fail-closed fixtures ────────────────────────────────────────────────────

test('trees-schema missing table fail closed', { concurrency: false }, async () => {
  await withDisposableDb('miss_table', null, async ({ client, runSql }) => {
    await seedSentinels(client);
    const before = await catalog.getCatalogFingerprint(client);
    const res = runSql(MIGRATION_SQL);
    expectFail(res, 'miss_table', 'migration');
    await assertNoMutation(client, before);
    pass('trees-schema missing table');
  });
});

test('trees-schema non-table fail closed', { concurrency: false }, async () => {
  await withDisposableDb('view_trees', null, async ({ client, runSql }) => {
    await client.query(`CREATE VIEW public.trees AS SELECT 'x'::text AS id`);
    await seedSentinels(client);
    const before = await catalog.getCatalogFingerprint(client);
    const res = runSql(MIGRATION_SQL);
    expectFail(res, 'view_trees', 'migration');
    await assertNoMutation(client, before);
    pass('trees-schema non-table');
  });
});

test('trees-schema id missing fail closed', { concurrency: false }, async () => {
  await withDisposableDb('no_id', null, async ({ client, runSql }) => {
    await client.query(`CREATE TABLE public.trees (other text NOT NULL PRIMARY KEY)`);
    await seedSentinels(client);
    const before = await catalog.getCatalogFingerprint(client);
    const res = runSql(MIGRATION_SQL);
    expectFail(res, 'no_id', 'migration');
    await assertNoMutation(client, before);
    pass('trees-schema id missing');
  });
});

test('trees-schema id non-text uuid fail closed', { concurrency: false }, async () => {
  await withDisposableDb('id_uuid', null, async ({ client, runSql }) => {
    await client.query(
      `CREATE TABLE public.trees (id uuid NOT NULL PRIMARY KEY DEFAULT gen_random_uuid())`
    );
    await seedSentinels(client);
    const before = await catalog.getCatalogFingerprint(client);
    const res = runSql(MIGRATION_SQL);
    expectFail(res, 'id_uuid', 'migration');
    await assertNoMutation(client, before);
    pass('trees-schema id non-text uuid');
  });
});

test('trees-schema id non-text integer fail closed', { concurrency: false }, async () => {
  await withDisposableDb('id_int', null, async ({ client, runSql }) => {
    await client.query(`CREATE TABLE public.trees (id integer NOT NULL PRIMARY KEY)`);
    await seedSentinels(client);
    const before = await catalog.getCatalogFingerprint(client);
    const res = runSql(MIGRATION_SQL);
    expectFail(res, 'id_int', 'migration');
    await assertNoMutation(client, before);
    pass('trees-schema id non-text integer');
  });
});

test('trees-schema no primary key fail closed', { concurrency: false }, async () => {
  await withDisposableDb('no_pk', null, async ({ client, runSql }) => {
    await client.query(`CREATE TABLE public.trees (id text NOT NULL)`);
    await seedSentinels(client);
    const before = await catalog.getCatalogFingerprint(client);
    const res = runSql(MIGRATION_SQL);
    expectFail(res, 'no_pk', 'migration');
    await assertNoMutation(client, before);
    pass('trees-schema no primary key');
  });
});

test('trees-schema other-column-only PK fail closed', { concurrency: false }, async () => {
  await withDisposableDb('other_pk', null, async ({ client, runSql }) => {
    await client.query(`
      CREATE TABLE public.trees (
        sid text NOT NULL PRIMARY KEY,
        id text NOT NULL
      );
    `);
    await seedSentinels(client);
    const before = await catalog.getCatalogFingerprint(client);
    const res = runSql(MIGRATION_SQL);
    expectFail(res, 'other_pk', 'migration');
    await assertNoMutation(client, before);
    pass('trees-schema other-column-only PK');
  });
});

test('trees-schema materialized view fail closed', { concurrency: false }, async () => {
  await withDisposableDb('matview_trees', null, async ({ client, runSql }) => {
    await client.query(
      `CREATE MATERIALIZED VIEW public.trees AS SELECT 'x'::text AS id`
    );
    await seedSentinels(client);
    const before = await catalog.getCatalogFingerprint(client);
    const res = runSql(MIGRATION_SQL);
    expectFail(res, 'matview_trees', 'migration');
    await assertNoMutation(client, before);
    pass('trees-schema matview non-ordinary');
  });
});

test('trees-schema id nullable fail closed', { concurrency: false }, async () => {
  await withDisposableDb('id_null', null, async ({ client, runSql }) => {
    // Unique partial stand-in without NOT NULL; no PK on nullable id alone easily —
    // use table without sole PK id: create id nullable without PK first fails sole-PK
    // check after nullable check. Use: id text NULL unique + no PK triggers sole PK fail.
    // Required case is nullable id: table with id text NULL and separate PK.
    await client.query(`
      CREATE TABLE public.trees (
        sid text NOT NULL PRIMARY KEY,
        id text NULL
      );
    `);
    await seedSentinels(client);
    const before = await catalog.getCatalogFingerprint(client);
    const res = runSql(MIGRATION_SQL);
    expectFail(res, 'id_null', 'migration');
    await assertNoMutation(client, before);
    pass('trees-schema id nullable');
  });
});

test('trees-schema id not sole PK fail closed', { concurrency: false }, async () => {
  await withDisposableDb('comp_pk', null, async ({ client, runSql }) => {
    await client.query(`
      CREATE TABLE public.trees (
        id text NOT NULL,
        other text NOT NULL,
        PRIMARY KEY (id, other)
      );
      INSERT INTO public.trees (id, other) VALUES ('tree_syn_a', 'x');
    `);
    await seedSentinels(client);
    const before = await catalog.getCatalogFingerprint(client);
    const res = runSql(MIGRATION_SQL);
    expectFail(res, 'comp_pk', 'migration');
    await assertNoMutation(client, before);
    pass('trees-schema id not sole PK');
  });
});

test('trees-schema incompatible target type fail closed', { concurrency: false }, async () => {
  // Exact UDT-contract mismatches (similar types also fail).
  const typeFixtures = [
    { name: 'owner_id', ddl: 'owner_id uuid' },
    { name: 'title', ddl: 'title integer' },
    { name: 'visibility', ddl: 'visibility boolean' },
    { name: 'group_name', ddl: 'group_name jsonb' },
    { name: 'keywords', ddl: 'keywords text' }, // must be text[], not text
    { name: 'created_at', ddl: 'created_at timestamp without time zone' },
    { name: 'updated_at', ddl: 'updated_at date' },
  ];
  for (const col of typeFixtures) {
    await withDisposableDb(`badtype_${col.name}`, null, async ({ client, runSql }) => {
      await client.query(`
        CREATE TABLE public.trees (
          id text NOT NULL PRIMARY KEY,
          ${col.ddl}
        );
        INSERT INTO public.trees (id) VALUES ('tree_syn_a');
      `);
      await seedSentinels(client);
      const before = await catalog.getCatalogFingerprint(client);
      const res = runSql(MIGRATION_SQL);
      expectFail(res, `badtype_${col.name}`, 'migration');
      // No other target columns should appear.
      const names = await catalog.getTreesColumnNames(client);
      for (const n of TARGET_NAMES) {
        if (n === col.name) continue;
        if (names.includes(n)) failMutation();
      }
      await assertNoMutation(client, before);
      pass(`trees-schema bad type ${col.name}`);
    });
  }
});

test('trees-schema target NOT NULL fail closed', { concurrency: false }, async () => {
  for (const col of TARGET_COLUMNS) {
    await withDisposableDb(`nn_${col.name}`, null, async ({ client, runSql }) => {
      await client.query(`
        CREATE TABLE public.trees (
          id text NOT NULL PRIMARY KEY
        );
      `);
      if (col.name === 'keywords') {
        await client.query(`ALTER TABLE public.trees ADD COLUMN keywords text[]`);
        await client.query(
          `INSERT INTO public.trees (id, keywords) VALUES ('tree_syn_a', '{}'::text[])`
        );
        await client.query(`ALTER TABLE public.trees ALTER COLUMN keywords SET NOT NULL`);
      } else if (col.udt === 'timestamptz') {
        await client.query(`ALTER TABLE public.trees ADD COLUMN ${col.name} timestamptz`);
        await client.query(
          `INSERT INTO public.trees (id, ${col.name}) VALUES ('tree_syn_a', now())`
        );
        await client.query(
          `ALTER TABLE public.trees ALTER COLUMN ${col.name} SET NOT NULL`
        );
      } else {
        await client.query(`ALTER TABLE public.trees ADD COLUMN ${col.name} text`);
        await client.query(
          `INSERT INTO public.trees (id, ${col.name}) VALUES ('tree_syn_a', 'x')`
        );
        await client.query(
          `ALTER TABLE public.trees ALTER COLUMN ${col.name} SET NOT NULL`
        );
      }
      await seedSentinels(client);
      const before = await catalog.getCatalogFingerprint(client);
      const res = runSql(MIGRATION_SQL);
      expectFail(res, `nn_${col.name}`, 'migration');
      await assertNoMutation(client, before);
      pass(`trees-schema not null ${col.name}`);
    });
  }
});

test('trees-schema target with default fail closed', { concurrency: false }, async () => {
  for (const col of TARGET_COLUMNS) {
    await withDisposableDb(`dflt_${col.name}`, null, async ({ client, runSql }) => {
      await client.query(`
        CREATE TABLE public.trees (
          id text NOT NULL PRIMARY KEY
        );
        INSERT INTO public.trees (id) VALUES ('tree_syn_a');
      `);
      if (col.name === 'keywords') {
        await client.query(
          `ALTER TABLE public.trees ADD COLUMN keywords text[] DEFAULT '{}'::text[]`
        );
      } else if (col.udt === 'timestamptz') {
        await client.query(
          `ALTER TABLE public.trees ADD COLUMN ${col.name} timestamptz DEFAULT now()`
        );
      } else {
        await client.query(
          `ALTER TABLE public.trees ADD COLUMN ${col.name} text DEFAULT 'x'`
        );
      }
      await seedSentinels(client);
      const before = await catalog.getCatalogFingerprint(client);
      const res = runSql(MIGRATION_SQL);
      expectFail(res, `dflt_${col.name}`, 'migration');
      await assertNoMutation(client, before);
      pass(`trees-schema default ${col.name}`);
    });
  }
});

test('trees-schema mixed early-absent later-incompatible preserves pre-state', { concurrency: false }, async () => {
  await withDisposableDb('mixed_partial', null, async ({ client, runSql }) => {
    // owner_id absent (would be added), title present as integer (incompatible).
    // Type checks run before any ADD — no owner_id should appear after failure.
    await client.query(`
      CREATE TABLE public.trees (
        id text NOT NULL PRIMARY KEY,
        title integer NULL
      );
      INSERT INTO public.trees (id, title) VALUES ('tree_syn_a', 1);
    `);
    await seedSentinels(client);
    const before = await catalog.getCatalogFingerprint(client);
    const res = runSql(MIGRATION_SQL);
    expectFail(res, 'mixed_partial', 'migration');
    const names = await catalog.getTreesColumnNames(client);
    if (names.includes('owner_id')) failMutation();
    if (names.includes('visibility')) failMutation();
    if (names.includes('group_name')) failMutation();
    if (names.includes('keywords')) failMutation();
    if (names.includes('created_at')) failMutation();
    if (names.includes('updated_at')) failMutation();
    await assertNoMutation(client, before);
    pass('trees-schema mixed partial fail closed');
  });
});

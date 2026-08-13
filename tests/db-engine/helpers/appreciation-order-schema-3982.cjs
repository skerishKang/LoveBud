'use strict';

/**
 * Disposable PostgreSQL 17.4 proof helpers for Issue #3982.
 *
 * Synthetic loopback databases only through the shared LB_TEST_PG* harness.
 * Never reads DATABASE_URL, never contacts Production/Preview/Neon, and never
 * mutates any non-disposable target.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const adapter = require('../../../scripts/migration-catalog-postgres-adapter-core.cjs');
const { loadJson, defaultContractPath } = require('../../../scripts/migration-catalog-fingerprint-core.cjs');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const MIGRATION_PATH = path.join(
  ROOT,
  'db',
  'migrations',
  '20260812213000_add-tree-appreciation-orders.sql'
);
const EXPECTED_SCHEMA_PATH = path.join(
  ROOT,
  'db',
  'migration-provenance',
  'expected-schema-manifest.json'
);

const APPRECIATION_OBJECT = Object.freeze({
  schema: 'public',
  object_name: 'tree_appreciation_orders',
  object_kind: 'TABLE',
});
const APPRECIATION_OBJECT_NAME = 'table:public.tree_appreciation_orders';

function assertSqlSuccess(result, label) {
  assert.equal(
    result && result.status,
    0,
    `${label} failed: ${(result && (result.stderr || result.stdout)) || '<no output>'}`
  );
}

async function ensureSyntheticParent(ctx) {
  await ctx.client.query(`
    CREATE TABLE IF NOT EXISTS public.trees (
      id TEXT PRIMARY KEY,
      owner_uid TEXT NOT NULL DEFAULT 'synthetic-owner'
    )
  `);
}

async function prepareCanonicalAppreciationTarget(ctx) {
  await ensureSyntheticParent(ctx);
  assertSqlSuccess(ctx.runSql(MIGRATION_PATH), 'appreciation-order migration');
}

function connectionFromCtx(ctx) {
  return {
    host: ctx.cfg.host,
    port: ctx.cfg.port,
    user: ctx.cfg.user,
    password: ctx.cfg.password,
    database: ctx.dbName,
  };
}

async function collectAppreciationEvidence(ctx) {
  return adapter.collectCatalogEvidence({
    connection: connectionFromCtx(ctx),
    objects: [APPRECIATION_OBJECT],
    roleMapping: { lovebud_ci: 'APPLICATION' },
    contract: adapter.loadContract(ROOT),
  });
}

async function unrelatedSchemaSignature(client) {
  const columns = await client.query(`
    SELECT table_name, ordinal_position, column_name, data_type, is_nullable,
           COALESCE(column_default, '') AS column_default
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name IN ('trees', 'memories', 'tree_likes')
    ORDER BY table_name, ordinal_position
  `);
  const constraints = await client.query(`
    SELECT c.relname AS table_name, con.conname, con.contype,
           pg_get_constraintdef(con.oid, true) AS definition
    FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname IN ('trees', 'memories', 'tree_likes')
    ORDER BY c.relname, con.conname
  `);
  return JSON.stringify({ columns: columns.rows, constraints: constraints.rows });
}

async function expectPgCode(promise, code, label) {
  await assert.rejects(
    promise,
    (error) => {
      assert.equal(error && error.code, code, `${label}: expected PostgreSQL ${code}`);
      return true;
    },
    label
  );
}

async function runAppreciationOrderSchemaProof(ctx) {
  await ctx.client.query(`
    CREATE TABLE public.trees (
      id TEXT PRIMARY KEY,
      owner_uid TEXT NOT NULL DEFAULT 'synthetic-owner'
    );
    CREATE TABLE public.memories (
      id TEXT PRIMARY KEY,
      tree_id TEXT NOT NULL REFERENCES public.trees(id),
      title TEXT
    );
    CREATE TABLE public.tree_likes (
      tree_id TEXT NOT NULL REFERENCES public.trees(id),
      actor_id TEXT NOT NULL,
      PRIMARY KEY (tree_id, actor_id)
    );
  `);

  const beforeUnrelated = await unrelatedSchemaSignature(ctx.client);

  assertSqlSuccess(ctx.runSql(MIGRATION_PATH), 'first appreciation-order migration');
  assertSqlSuccess(ctx.runSql(MIGRATION_PATH), 'idempotent appreciation-order rerun');

  const columns = await ctx.client.query(`
    SELECT ordinal_position, column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tree_appreciation_orders'
    ORDER BY ordinal_position
  `);
  assert.deepEqual(
    columns.rows.map((row) => ({
      name: row.column_name,
      type: row.data_type,
      nullable: row.is_nullable,
      default: row.column_default,
    })),
    [
      { name: 'tree_id', type: 'text', nullable: 'NO', default: null },
      { name: 'ordered_ids', type: 'jsonb', nullable: 'NO', default: null },
      { name: 'updated_at', type: 'timestamp with time zone', nullable: 'NO', default: 'now()' },
    ]
  );

  const constraints = await ctx.client.query(`
    SELECT con.conname, con.contype, con.confupdtype, con.confdeltype,
           pg_get_constraintdef(con.oid, true) AS definition
    FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'tree_appreciation_orders'
    ORDER BY con.conname
  `);
  const byName = new Map(constraints.rows.map((row) => [row.conname, row]));
  assert.equal(byName.get('tree_appreciation_orders_pkey').contype, 'p');
  assert.equal(byName.get('tree_appreciation_orders_pkey').definition, 'PRIMARY KEY (tree_id)');
  assert.equal(byName.get('tree_appreciation_orders_tree_id_fkey').contype, 'f');
  assert.equal(byName.get('tree_appreciation_orders_tree_id_fkey').confupdtype, 'a');
  assert.equal(byName.get('tree_appreciation_orders_tree_id_fkey').confdeltype, 'c');
  assert.equal(
    byName.get('tree_appreciation_orders_tree_id_fkey').definition,
    'FOREIGN KEY (tree_id) REFERENCES trees(id) ON DELETE CASCADE'
  );
  assert.equal(byName.get('tree_appreciation_orders_array_check').contype, 'c');
  assert.equal(
    byName.get('tree_appreciation_orders_array_check').definition,
    "CHECK (jsonb_typeof(ordered_ids) = 'array'::text)"
  );

  await ctx.client.query('INSERT INTO public.trees(id) VALUES ($1)', ['tree-valid']);
  await ctx.client.query(
    'INSERT INTO public.tree_appreciation_orders(tree_id, ordered_ids) VALUES ($1, $2::jsonb)',
    ['tree-valid', JSON.stringify(['mem-a', 'mem-b'])]
  );
  const valid = await ctx.client.query(
    'SELECT ordered_ids FROM public.tree_appreciation_orders WHERE tree_id = $1',
    ['tree-valid']
  );
  assert.deepEqual(valid.rows[0].ordered_ids, ['mem-a', 'mem-b']);

  await expectPgCode(
    ctx.client.query(
      'INSERT INTO public.tree_appreciation_orders(tree_id, ordered_ids) VALUES ($1, $2::jsonb)',
      ['tree-valid', JSON.stringify([])]
    ),
    '23505',
    'duplicate Tree appreciation order'
  );

  await expectPgCode(
    ctx.client.query(
      'INSERT INTO public.tree_appreciation_orders(tree_id, ordered_ids) VALUES ($1, $2::jsonb)',
      ['tree-missing', JSON.stringify([])]
    ),
    '23503',
    'nonexistent Tree FK'
  );

  await ctx.client.query('INSERT INTO public.trees(id) VALUES ($1)', ['tree-invalid']);
  for (const value of [{ bad: true }, 'string', 7, null]) {
    await expectPgCode(
      ctx.client.query(
        'INSERT INTO public.tree_appreciation_orders(tree_id, ordered_ids) VALUES ($1, $2::jsonb)',
        ['tree-invalid', JSON.stringify(value)]
      ),
      '23514',
      `non-array ordered_ids ${JSON.stringify(value)}`
    );
  }

  await ctx.client.query('INSERT INTO public.trees(id) VALUES ($1)', ['tree-array']);
  await ctx.client.query(
    'INSERT INTO public.tree_appreciation_orders(tree_id, ordered_ids) VALUES ($1, $2::jsonb)',
    ['tree-array', JSON.stringify([])]
  );

  await ctx.client.query('INSERT INTO public.trees(id) VALUES ($1)', ['tree-cascade']);
  await ctx.client.query(
    'INSERT INTO public.tree_appreciation_orders(tree_id, ordered_ids) VALUES ($1, $2::jsonb)',
    ['tree-cascade', JSON.stringify(['mem-z'])]
  );
  await ctx.client.query('DELETE FROM public.trees WHERE id = $1', ['tree-cascade']);
  const cascade = await ctx.client.query(
    'SELECT COUNT(*)::int AS c FROM public.tree_appreciation_orders WHERE tree_id = $1',
    ['tree-cascade']
  );
  assert.equal(Number(cascade.rows[0].c), 0, 'parent Tree deletion cascades only the child order row');

  const afterUnrelated = await unrelatedSchemaSignature(ctx.client);
  assert.equal(afterUnrelated, beforeUnrelated, 'Tree/Memory/social schema remains structurally unchanged');

  const evidence = await collectAppreciationEvidence(ctx);
  assert.equal(evidence.objects.length, 1);
  assert.equal(evidence.objects[0].name, APPRECIATION_OBJECT_NAME);

  const expectedManifest = loadJson(EXPECTED_SCHEMA_PATH);
  const expected = expectedManifest.critical_objects.find(
    (item) => item.name === APPRECIATION_OBJECT_NAME
  );
  assert.ok(expected, 'committed expected-schema contains appreciation-order table');
  assert.equal(
    evidence.objects[0].fingerprint,
    expected.fingerprint,
    'disposable PostgreSQL catalog fingerprint matches committed expected-schema authority'
  );

  return {
    fingerprint: evidence.objects[0].fingerprint,
    unrelatedSchemaSignature: afterUnrelated,
  };
}

module.exports = {
  MIGRATION_PATH,
  APPRECIATION_OBJECT,
  APPRECIATION_OBJECT_NAME,
  ensureSyntheticParent,
  prepareCanonicalAppreciationTarget,
  collectAppreciationEvidence,
  runAppreciationOrderSchemaProof,
};

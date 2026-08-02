'use strict';

// Issue #3842 — Read-only structural sentinel: disposable PostgreSQL rehearsal
// (Reliability & Observability child of parent #3461).
//
// DB_ENGINE_EXECUTION rehearsal on disposable PostgreSQL 17.4 only, via
// tests/db-engine/helpers/postgres-disposable-harness.cjs. It proves the
// semantic contract of the two executable structural-sentinel aggregate
// queries against a minimal synthetic schema:
//
//   MEMORY_TREE_PARENT_ORPHAN_COUNT:
//     memories.tree_id IS NOT NULL and no matching trees.id exists
//   MEMORY_PARENT_ORPHAN_COUNT:
//     memories.parent_id IS NOT NULL and no matching parent memory exists
//
// Proves:
//   - root memory (parent_id IS NULL) is NOT an orphan;
//   - valid child memory (parent_id matches a parent memory) is NOT an orphan;
//   - missing parent memory increments only the parent-memory orphan aggregate;
//   - memory referencing a missing tree increments only the tree-parent orphan
//     aggregate;
//   - restoring the missing parents returns both aggregates to zero;
//   - the sentinel query is read-only and leaves fixture row counts/contents
//     unchanged;
//   - a read-only transaction/session can carry sentinel execution where
//     supported.
//
// LOCAL EXECUTION IS PROHIBITED BY POLICY. This test is authored as source for
// authoritative execution only through fresh exact-head GitHub Actions with a
// PostgreSQL 17.4 service and the LB_TEST_PG* loopback variables. It never
// contacts Production/Neon/Modal/staging and never reads DATABASE_URL.
//
// Classification: supplemental DB_ENGINE_EXECUTION (defaultCi:false).
//
// Refs #3842.
// Refs #3461 — Keep OPEN.
// Refs #1882 — Keep OPEN.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const harness = require('./helpers/postgres-disposable-harness.cjs');

const ROOT = path.resolve(__dirname, '..', '..');
const CATALOG_PATH = path.join(ROOT, 'js', 'observability', 'reliability-structural-sentinel-query-catalog.js');

const { withDisposableDb } = harness;

function loadCatalog() {
  const fs = require('node:fs');
  const source = fs.readFileSync(CATALOG_PATH, 'utf8');
  const sandbox = { window: {} };
  new Function('window', source)(sandbox.window);
  if (!sandbox.window.LoveBudStructuralSentinelQueryCatalog) {
    throw new Error('QUERY_CATALOG_NOT_EXPOSED');
  }
  return sandbox.window.LoveBudStructuralSentinelQueryCatalog;
}

function makeExecutor(client) {
  return {
    async execute(descriptor) {
      const res = await client.query(descriptor.query);
      return res;
    },
  };
}

const SCHEMA_SQL = `
  CREATE TABLE public.trees (
    id text NOT NULL PRIMARY KEY
  );
  CREATE TABLE public.memories (
    id text NOT NULL PRIMARY KEY,
    tree_id text NOT NULL,
    parent_id text NULL
  );
`;

// Fixture state:
//   trees:  t_root
//   memories:
//     m_root    -> tree t_root, parent NULL            (valid root)
//     m_child   -> tree t_root, parent m_root          (valid child)
//     m_orph_p  -> tree t_root, parent MISSING_PARENT  (parent orphan)
//     m_orph_t  -> tree MISSING_TREE, parent NULL      (tree orphan)
async function seedFixture(client) {
  await client.query(SCHEMA_SQL);
  await client.query(`INSERT INTO public.trees (id) VALUES ('t_root')`);
  await client.query(
    `INSERT INTO public.memories (id, tree_id, parent_id) VALUES
       ('m_root',   't_root',        NULL),
       ('m_child',  't_root',        'm_root'),
       ('m_orph_p', 't_root',        'MISSING_PARENT'),
       ('m_orph_t', 'MISSING_TREE',  NULL)`
  );
}

async function memoryFingerprint(client) {
  const res = await client.query(
    `SELECT id, tree_id, parent_id FROM public.memories ORDER BY id`
  );
  return JSON.stringify(res.rows);
}

test('read-only structural sentinel semantics on disposable PostgreSQL 17.4', { concurrency: false }, async () => {
  const catalog = loadCatalog();
  const treeOrphan = catalog.getDescriptor('MEMORY_TREE_PARENT_ORPHAN_COUNT');
  const parentOrphan = catalog.getDescriptor('MEMORY_PARENT_ORPHAN_COUNT');
  assert.ok(treeOrphan.executable);
  assert.ok(parentOrphan.executable);

  await withDisposableDb('sentinel_readonly', null, async ({ client }) => {
    await seedFixture(client);
    const executor = makeExecutor(client);

    // Root + valid child are not orphans; exactly two orphans exist (one per
    // aggregate, independent).
    const beforeFp = await memoryFingerprint(client);
    const treeRes = await executor.execute(treeOrphan);
    const parentRes = await executor.execute(parentOrphan);
    assert.equal(Number(treeRes.rows[0].count), 1, 'only the missing-tree memory is a tree orphan');
    assert.equal(Number(parentRes.rows[0].count), 1, 'only the missing-parent memory is a parent orphan');
    const afterFp = await memoryFingerprint(client);
    assert.equal(afterFp, beforeFp, 'sentinel query must not mutate fixture rows');

    // Restoring the missing parents returns both aggregates to zero.
    await client.query(`INSERT INTO public.trees (id) VALUES ('MISSING_TREE')`);
    await client.query(`INSERT INTO public.memories (id, tree_id, parent_id) VALUES ('MISSING_PARENT', 't_root', NULL)`);
    const treeRes2 = await executor.execute(treeOrphan);
    const parentRes2 = await executor.execute(parentOrphan);
    assert.equal(Number(treeRes2.rows[0].count), 0, 'restored tree returns tree orphan aggregate to zero');
    assert.equal(Number(parentRes2.rows[0].count), 0, 'restored parent returns parent orphan aggregate to zero');
  });
});

test('read-only transaction carries sentinel execution without mutation', { concurrency: false }, async () => {
  const catalog = loadCatalog();
  const parentOrphan = catalog.getDescriptor('MEMORY_PARENT_ORPHAN_COUNT');

  await withDisposableDb('sentinel_tx_readonly', null, async ({ client }) => {
    await seedFixture(client);
    const executor = makeExecutor(client);
    const beforeFp = await memoryFingerprint(client);

    await client.query('BEGIN');
    await client.query('SET TRANSACTION READ ONLY');
    const res = await executor.execute(parentOrphan);
    assert.equal(Number(res.rows[0].count), 1);
    // A write inside the read-only transaction must fail, proving the session
    // is genuinely read-only during sentinel execution.
    await assert.rejects(
      () => client.query(`UPDATE public.memories SET parent_id = NULL WHERE id = 'm_child'`),
      /read-only|READ ONLY|cannot execute/i
    );
    await client.query('ROLLBACK');

    const afterFp = await memoryFingerprint(client);
    assert.equal(afterFp, beforeFp, 'read-only transaction must leave rows unchanged');
  });
});
